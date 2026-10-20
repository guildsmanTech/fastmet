import {useUnreadNotificationCount} from "@/queries/notification";
import {useAppStore} from "@/store/useAppStore";

/**
 * Hook to fetch and sync unread notification count with the store.
 * Call this at app root level to keep the count updated.
 */
export const useNotificationCount = () => {
  const {isLoading, error, refetch} = useUnreadNotificationCount();
  const unreadNotificationCount = useAppStore(
    (state) => state.unreadNotificationCount,
  );

  return {
    unreadCount: unreadNotificationCount,
    isLoading,
    error,
    refetch,
  };
};
