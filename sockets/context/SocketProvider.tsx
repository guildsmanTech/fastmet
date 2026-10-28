import {
  ACCOUNT_DEACTIVATED_ROUTE,
  accountBannedRoute,
  accountSuspendedRoute,
  DEVICE_BANNED_ROUTE,
} from "@/constants/routes";
import {useAuth} from "@/hooks/useAuth";
import {
  endSession,
  ensureFreshToken,
  expireSession,
  performLogout,
  SessionExpiredError,
  signOutDisplacedSession,
} from "@/lib/axios";
import {useAppStore} from "@/store/useAppStore";
import {runUpdateCheck} from "@/utils/helpers/appUpdateCheck";
import {DefaultEventsMap} from "@socket.io/component-emitter";
import React, {createContext, useContext, useEffect, useMemo} from "react";
import {AppState} from "react-native";
import {Socket} from "socket.io-client";
import {
  acceptanceRequestedSchedule,
  bookingCompleted,
  bookingDriverReassigned,
  bookingNeedsContinuance,
  bookingQueueUpdated,
  continuanceCancelledClient,
  cancelScheduleDriverOffer,
  driverArrivedAtDropoff,
  driverArrivedAtPickup,
  driverUnavailable,
  rescheduleDriverResponse,
  scheduledReminder,
  tipUpdated,
} from "../handlers/booking";
import {forceLogout} from "../handlers/account";
import {receiveMessage} from "../handlers/chat";
import {
  notificationCreated,
  staleNotificationCleanup,
} from "../handlers/notification";
import {getSocket} from "../socket";
import {pruneStaleNotifications} from "@/utils/helpers/notifications";
import {resyncNotifications} from "@/utils/helpers/query";

const SOCKET_RETRY_MIN_MS = 2000;
const SOCKET_RETRY_MAX_MS = 30000;

interface SocketContextValue {
  socket: Socket<DefaultEventsMap, DefaultEventsMap> | null;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
});

export default function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {token} = useAuth();
  const socket = useMemo(() => (token ? getSocket(token) : null), [token]);
  // Forced update (not deferred by a trip in progress): stay disconnected.
  // Flipping this to true re-runs the effect, whose cleanup disconnects.
  const updateBlocked = useAppStore(
    (state) => !!state.updateRequired && !state.updateRequired.deferred,
  );

  useEffect(() => {
    if (!socket || !token || updateBlocked) return;

    socket.connect();

    // The server pushes chat messages only when no app is in the foreground.
    // iOS "inactive" is a brief transition, so only background/active count.
    const onAppState = (state: string) => {
      if (state === "background") {
        if (socket.connected) socket.emit("app_state", {active: false});
        return;
      }
      if (state !== "active") return;
      if (!socket.connected) {
        // Reconnecting resyncs notifications (see onConnect); the handshake
        // carries the foreground state.
        socket.connect();
        return;
      }
      socket.emit("app_state", {active: true});
      // Still connected: events may have been missed while backgrounded.
      void resyncNotifications();
      pruneStaleNotifications();
    };
    const appStateSub = AppState.addEventListener("change", onAppState);

    let disposed = false;
    let refreshAttempted = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = SOCKET_RETRY_MIN_MS;

    // Auth rejections stop socket.io's own reconnection, so after a transient
    // refresh failure retry the handshake ourselves, with backoff.
    const scheduleReconnect = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!disposed && !socket.connected) socket.connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, SOCKET_RETRY_MAX_MS);
    };

    // The first connect follows the initial fetch; later ones may have missed events.
    let hasConnected = socket.connected;
    const onConnect = () => {
      retryDelay = SOCKET_RETRY_MIN_MS;
      if (hasConnected) void resyncNotifications();
      hasConnected = true;
      // Also on launch: bookings may have moved on while the app was closed.
      pruneStaleNotifications();
    };
    socket.on("connect", onConnect);

    socket.on("connect_error", async (err) => {
      console.error("🔌 Socket connection error:", err.message);

      switch (err.message) {
        // Server-side version gate. Don't retry; the update check shows the modal.
        case "APP_UPDATE_REQUIRED":
          socket.disconnect();
          void runUpdateCheck();
          return;
        // Same account guards as the HTTP API (see lib/axios.ts).
        case "Session displaced":
          void signOutDisplacedSession();
          return;
        case "Account banned":
          void performLogout(
            accountBannedRoute(
              (err as Error & {data?: {banReason?: unknown}}).data,
            ),
          );
          return;
        case "Device banned":
          void performLogout(DEVICE_BANNED_ROUTE);
          return;
        case "Account deactivated":
          void performLogout(ACCOUNT_DEACTIVATED_ROUTE);
          return;
        case "Account suspended":
          void performLogout(accountSuspendedRoute());
          return;
        case "Account not found":
        case "Authentication required":
          void expireSession();
          return;
        case "Authentication failed":
          break;
        default:
          return; // transport error: socket.io reconnects on its own
      }

      if (refreshAttempted) return;
      refreshAttempted = true;

      try {
        await ensureFreshToken();
        // store updated inside ensureFreshToken → re-render → new socket with fresh token
      } catch (refreshError) {
        if (refreshError instanceof SessionExpiredError) {
          void endSession(refreshError);
          return;
        }
        // Transient (offline, 5xx): keep the session and try again later.
        if (disposed) return;
        refreshAttempted = false;
        scheduleReconnect();
      }
    });

    const cleanupForceLogout = forceLogout(socket);
    const cleanupReceiveMessage = receiveMessage(socket);
    const cleanupNotificationCreated = notificationCreated(socket);
    const cleanupStaleNotifications = staleNotificationCleanup(socket);
    const cleanupAcceptanceRequestedSchedule =
      acceptanceRequestedSchedule(socket);
    const cleanupCancelScheduleDriverOffer = cancelScheduleDriverOffer(socket);
    const cleanupDriverUnavailable = driverUnavailable(socket);
    const cleanupRescheduleDriverResponse = rescheduleDriverResponse(socket);
    const cleanupScheduledReminder = scheduledReminder(socket);
    const cleanupDriverArrivedAtPickup = driverArrivedAtPickup(socket);
    const cleanupDriverArrivedAtDropoff = driverArrivedAtDropoff(socket);
    const cleanupBookingCompleted = bookingCompleted(socket);
    const cleanupNeedsContinuance = bookingNeedsContinuance(socket);
    const cleanupDriverReassigned = bookingDriverReassigned(socket);
    const cleanupContinuanceCancelled = continuanceCancelledClient(socket);
    const cleanupBookingQueueUpdated = bookingQueueUpdated(socket);
    const cleanupTipUpdated = tipUpdated(socket);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      socket.off("connect", onConnect);
      socket.off("connect_error"); // Clean up the listener
      appStateSub.remove();
      cleanupForceLogout();
      cleanupReceiveMessage();
      cleanupNotificationCreated();
      cleanupStaleNotifications();
      cleanupAcceptanceRequestedSchedule();
      cleanupCancelScheduleDriverOffer();
      cleanupDriverUnavailable();
      cleanupRescheduleDriverResponse();
      cleanupScheduledReminder();
      cleanupDriverArrivedAtPickup();
      cleanupDriverArrivedAtDropoff();
      cleanupBookingCompleted();
      cleanupNeedsContinuance();
      cleanupDriverReassigned();
      cleanupContinuanceCancelled();
      cleanupBookingQueueUpdated();
      cleanupTipUpdated();
      socket.disconnect();
    };
  }, [socket, token, updateBlocked]);

  return (
    <SocketContext.Provider value={{socket}}>{children}</SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  if (!context.socket) throw new Error("Socket is not connected");

  return context.socket;
};
