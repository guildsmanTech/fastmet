import {Notification} from "@/types/notification";
import {pruneStaleNotifications} from "@/utils/helpers/notifications";
import {updateNotificationHelper} from "@/utils/helpers/query";
import {Socket} from "socket.io-client";

/**
 * Every persisted notification (any type): keeps the list and unread badge
 * live. Toasts stay with the type-specific handlers.
 */
export const notificationCreated = (socket: Socket) => {
  const handler = ({
    notification,
    unreadNotifications,
  }: {
    notification?: Notification | null;
    unreadNotifications?: number;
  }) => {
    updateNotificationHelper(notification, unreadNotifications);
  };

  socket.on("notificationCreated", handler);
  return () => socket.off("notificationCreated", handler);
};

// Booking changes that can finish what a push in the tray asked for.
const BOOKING_PROGRESS_EVENTS = [
  "notificationCreated",
  "driverAccepted",
  "offerCancelledAsap",
  "offerCancelledPooling",
  "poolingOfferResult",
  "poolingTripStarted",
  "driverAcceptedSchedule",
  "bookingNeedsContinuance",
  "bookingDriverReassigned",
  "continuance_cancelled",
  "bookingCompleted",
  "bookingCancelled",
  "bookingCancelledByDriver",
  "bookingExpired",
];

/** Removes tray pushes whose action is done when a booking moves on. */
export const staleNotificationCleanup = (socket: Socket) => {
  const handler = () => pruneStaleNotifications();

  for (const event of BOOKING_PROGRESS_EVENTS) socket.on(event, handler);
  return () => {
    for (const event of BOOKING_PROGRESS_EVENTS) socket.off(event, handler);
  };
};
