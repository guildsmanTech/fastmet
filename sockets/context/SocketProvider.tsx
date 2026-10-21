import {
  ACCOUNT_DEACTIVATED_ROUTE,
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
} from "../handlers/booking";
import {receiveMessage} from "../handlers/chat";
import {getSocket} from "../socket";

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

    const onAppState = (state: string) => {
      if (state === "active" && !socket.connected) {
        socket.connect();
      }
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

    const onConnect = () => {
      retryDelay = SOCKET_RETRY_MIN_MS;
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

    const cleanupReceiveMessage = receiveMessage(socket);
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

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      socket.off("connect", onConnect);
      socket.off("connect_error"); // Clean up the listener
      appStateSub.remove();
      cleanupReceiveMessage();
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
