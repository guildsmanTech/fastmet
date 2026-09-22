import {useAuth} from "@/hooks/useAuth";
import {ensureFreshToken, performLogout} from "@/lib/axios";
import {useAppStore} from "@/store/useAppStore";
import {DefaultEventsMap} from "@socket.io/component-emitter";
import React, {createContext, useContext, useEffect, useMemo} from "react";
import Toast from "react-native-toast-message";
import {Socket} from "socket.io-client";
import {
  acceptanceRequestedSchedule,
  bookingCompleted,
  bookingDriverReassigned,
  bookingNeedsContinuance,
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

  useEffect(() => {
    if (!socket || !token) return;

    socket.connect();

    let refreshAttempted = false;

    socket.on("connect_error", async (err) => {
      console.error("🔌 Socket connection error:", err.message);

      if (err.message !== "Authentication failed") return;
      if (refreshAttempted) return;
      refreshAttempted = true;

      if (!useAppStore.getState().refreshToken) {
        await performLogout();
        return;
      }

      try {
        await ensureFreshToken();
        // store updated inside ensureFreshToken → re-render → new socket with fresh token
      } catch {
        Toast.show({
          type: "error",
          text1: "Session Expired",
          text2: "Please log in again.",
          position: "top",
          visibilityTime: 4000,
          swipeable: true,
        });
        await performLogout();
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

    return () => {
      socket.off("connect_error"); // Clean up the listener
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
      socket.disconnect();
    };
  }, [socket, token]);

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
