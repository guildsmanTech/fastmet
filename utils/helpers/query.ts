import { queryClient } from "@/lib/queryClient";
import { useAppStore } from "@/store/useAppStore";
import {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
} from "@/types/notification";
import { InfiniteData } from "@tanstack/react-query";

// An older notification that changed but isn't loaded stays on its own page
// (the list is sorted by createdAt); only new ones go on top.
const isNewest = (notification: Notification, top?: Notification) =>
  !top ||
  new Date(notification.createdAt).getTime() >=
    new Date(top.createdAt).getTime();

const setUnreadCount = (unreadNotifications: number) => {
  useAppStore.getState().setUnreadNotificationCount(unreadNotifications);
  queryClient.setQueryData<UnreadCountResponse>(["notificationUnreadCount"], {
    unreadCount: unreadNotifications,
  });
};

/**
 * Puts a server notification into the list caches (replacing the same `_id`,
 * e.g. an updated driver offer, else prepending a new one) and syncs the
 * unread count.
 */
export const updateNotificationHelper = (
  notification: Notification | null | undefined,
  unreadNotifications?: number,
) => {
  if (typeof unreadNotifications === "number") {
    setUnreadCount(unreadNotifications);
  }
  if (!notification?._id) return;

  queryClient.setQueryData(["notification", notification._id], notification);
  queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
    { queryKey: ["notifications"] },
    (old) => {
      if (!old?.pages?.length) return old;

      let found = false;
      const pages = old.pages.map((page) => ({
        ...page,
        notifications: page.notifications.map((n) => {
          if (n._id !== notification._id) return n;
          found = true;
          return notification;
        }),
      }));
      if (!found && isNewest(notification, pages[0].notifications[0])) {
        pages[0] = {
          ...pages[0],
          notifications: [notification, ...pages[0].notifications],
        };
      }
      return { ...old, pages };
    },
  );
};

/**
 * Refreshes booking caches after a reconnect or return to foreground: booking
 * events may have been missed. Only screens on display refetch now; the rest
 * refetch when they mount.
 */
export const resyncBookings = () => {
  void queryClient.invalidateQueries({ queryKey: ["userBookings"] });
  void queryClient.invalidateQueries({ queryKey: ["userBooking"] });
  void queryClient.invalidateQueries({ queryKey: ["userBookingCounts"] });
};

/**
 * Re-reads the unread count after a reconnect or return to foreground
 * (socket events may have been missed); refreshes the list only when the
 * count changed.
 */
export const resyncNotifications = async () => {
  const before = queryClient.getQueryData<UnreadCountResponse>([
    "notificationUnreadCount",
  ])?.unreadCount;

  await queryClient.refetchQueries({ queryKey: ["notificationUnreadCount"] });

  const after = queryClient.getQueryData<UnreadCountResponse>([
    "notificationUnreadCount",
  ])?.unreadCount;
  if (after !== before) {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }
};
