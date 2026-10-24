import {Notification} from "@/types/notification";
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
