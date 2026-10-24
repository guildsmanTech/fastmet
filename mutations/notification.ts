import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/api/notification";
import { queryClient } from "@/lib/queryClient";
import { useAppStore } from "@/store/useAppStore";
import type {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
} from "@/types/notification";
import { InfiniteData, useMutation } from "@tanstack/react-query";
export const useMarkNotificationAsRead = () => {
  const setUnreadNotificationCount = useAppStore(
    (state) => state.setUnreadNotificationCount,
  );

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationAsRead(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({
        queryKey: ["notificationUnreadCount"],
      });

      const prevStoreCount = useAppStore.getState().unreadNotificationCount;

      const previousUnreadCount = queryClient.getQueryData<UnreadCountResponse>(
        ["notificationUnreadCount"],
      );

      const previousNotificationsQueries = queryClient.getQueriesData<
        InfiniteData<NotificationsResponse>
      >({ queryKey: ["notifications"] });

      // Determine whether this specific notification was unread (avoid double-decrement)
      let foundInCache = false;
      let wasUnread = false;
      for (const [, data] of previousNotificationsQueries) {
        if (!data?.pages?.length) continue;
        for (const page of data.pages) {
          const match = page.notifications?.find(
            (n) => n._id === notificationId,
          );
          if (match) {
            foundInCache = true;
            wasUnread = !match.isRead;
            break;
          }
        }
        if (wasUnread) break;
      }

      // Opened from a push: the viewer's own cache knows the read state.
      const previousNotification = queryClient.getQueryData<Notification>([
        "notification",
        notificationId,
      ]);
      if (!foundInCache && previousNotification) {
        foundInCache = true;
        wasUnread = !previousNotification.isRead;
      }
      if (previousNotification && !previousNotification.isRead) {
        queryClient.setQueryData<Notification>(
          ["notification", notificationId],
          { ...previousNotification, isRead: true },
        );
      }

      // Optimistically mark the notification as read across *all* cached limits/pages
      queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
        { queryKey: ["notifications"] },
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) =>
                n._id === notificationId
                  ? {
                      ...n,
                      isRead: true,
                      readAt: n.readAt ?? new Date().toISOString(),
                    }
                  : n,
              ),
            })),
          };
        },
      );

      const baseCount = previousUnreadCount?.unreadCount ?? prevStoreCount;
      const shouldDecrement = wasUnread || (!foundInCache && baseCount > 0);

      if (shouldDecrement) {
        const nextCount = Math.max(0, baseCount - 1);

        queryClient.setQueryData<UnreadCountResponse>(
          ["notificationUnreadCount"],
          { unreadCount: nextCount },
        );
        setUnreadNotificationCount(nextCount);
      }

      return {
        previousNotificationsQueries,
        previousNotification,
        previousUnreadCount,
        prevStoreCount,
        wasUnread: shouldDecrement,
      };
    },
    onError: (_err, notificationId, context) => {
      if (!context) return;

      // Rollback notifications
      for (const [key, data] of context.previousNotificationsQueries) {
        queryClient.setQueryData(key, data);
      }
      if (context.previousNotification) {
        queryClient.setQueryData(
          ["notification", notificationId],
          context.previousNotification,
        );
      }

      // Rollback unread count (both query cache + store)
      if (context.previousUnreadCount) {
        queryClient.setQueryData(
          ["notificationUnreadCount"],
          context.previousUnreadCount,
        );
        setUnreadNotificationCount(context.previousUnreadCount.unreadCount);
      } else {
        setUnreadNotificationCount(context.prevStoreCount);
      }
    },
    onSuccess: (updatedNotification, notificationId) => {
      // Merge server truth (e.g. readAt) into cache without refetching
      queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
        { queryKey: ["notifications"] },
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) =>
                n._id === notificationId ? { ...n, ...updatedNotification } : n,
              ),
            })),
          };
        },
      );
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const setUnreadNotificationCount = useAppStore(
    (state) => state.setUnreadNotificationCount,
  );

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({
        queryKey: ["notificationUnreadCount"],
      });

      const prevStoreCount = useAppStore.getState().unreadNotificationCount;

      const previousUnreadCount = queryClient.getQueryData<UnreadCountResponse>(
        ["notificationUnreadCount"],
      );

      const previousNotificationsQueries = queryClient.getQueriesData<
        InfiniteData<NotificationsResponse>
      >({ queryKey: ["notifications"] });

      // Optimistically mark *everything* as read in cached notification pages
      queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
        { queryKey: ["notifications"] },
        (old) => {
          if (!old?.pages?.length) return old;
          const now = new Date().toISOString();
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) =>
                n.isRead
                  ? n
                  : {
                      ...n,
                      isRead: true,
                      readAt: n.readAt ?? now,
                    },
              ),
            })),
          };
        },
      );

      // Optimistically zero the unread count (query cache + store)
      queryClient.setQueryData<UnreadCountResponse>(
        ["notificationUnreadCount"],
        {
          unreadCount: 0,
        },
      );
      setUnreadNotificationCount(0);

      return {
        previousNotificationsQueries,
        previousUnreadCount,
        prevStoreCount,
      };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;

      for (const [key, data] of context.previousNotificationsQueries) {
        queryClient.setQueryData(key, data);
      }

      if (context.previousUnreadCount) {
        queryClient.setQueryData(
          ["notificationUnreadCount"],
          context.previousUnreadCount,
        );
        setUnreadNotificationCount(context.previousUnreadCount.unreadCount);
      } else {
        setUnreadNotificationCount(context.prevStoreCount);
      }
    },
  });
};
