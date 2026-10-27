import {
  fetchConversations,
  fetchUnreadChatCount,
  getConversationById,
  getConversationsByName,
} from "@/api/conversation";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useAppStore } from "@/store/useAppStore";
import { ChatMessage, ConversationResponse } from "@/types/chat";
import { InfiniteData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

type ConversationsPage = {
  conversations: ConversationResponse[];
  nextPage: number | null;
};

export const getConversationUnreadFromCache = (
  conversationId: string,
): number => {
  const queries = queryClient.getQueriesData<InfiniteData<ConversationsPage>>({
    queryKey: ["conversations"],
  });

  for (const [, data] of queries) {
    for (const page of data?.pages ?? []) {
      const found = page.conversations.find((c) => c._id === conversationId);
      if (found) return found.unreadCount.client;
    }
  }
  return 0;
};

export const clearConversationUnreadInCache = (
  conversationId: string,
): void => {
  queryClient.setQueriesData<InfiniteData<ConversationsPage>>(
    { queryKey: ["conversations"] },
    (old) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          conversations: page.conversations.map((c) =>
            c._id === conversationId
              ? { ...c, unreadCount: { ...c.unreadCount, client: 0 } }
              : c,
          ),
        })),
      };
    },
  );
};

/** The driver read this chat, so our last message shows as seen. */
export const markConversationSeenInCache = (conversationId: string): void => {
  queryClient.setQueriesData<InfiniteData<ConversationsPage>>(
    { queryKey: ["conversations"] },
    (old) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          conversations: page.conversations.map((c) =>
            c._id === conversationId
              ? { ...c, unreadCount: { ...c.unreadCount, driver: 0 } }
              : c,
          ),
        })),
      };
    },
  );
};

/** After leaving a chat: unread 0 and the latest message as the preview. */
export const applyChatExitToCache = (
  conversationId: string,
  latest: ChatMessage | undefined,
): void => {
  let sentNew = false;
  queryClient.setQueriesData<InfiniteData<ConversationsPage>>(
    { queryKey: ["conversations"] },
    (old) => {
      if (!old?.pages?.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          conversations: page.conversations.map((c) => {
            if (c._id !== conversationId) return c;
            const updated = {
              ...c,
              unreadCount: { ...c.unreadCount, client: 0 },
            };
            if (latest) {
              // We sent it on this visit: not seen until the server says so.
              if (
                latest.senderType === "client" &&
                latest.createdAt !== c.lastMessageAt
              ) {
                sentNew = true;
                updated.unreadCount.driver = Math.max(c.unreadCount.driver, 1);
              }
              updated.lastMessage = latest.text || "Sent an image";
              updated.lastMessageAt = latest.createdAt;
              updated.lastMessageBy = latest.senderType;
            }
            return updated;
          }),
        })),
      };
    },
  );
  // The driver may have read it while we were in the chat.
  if (sentNew) void queryClient.invalidateQueries({ queryKey: ["conversations"] });
};

export const useConversations = (limit: number) => {
  const { isLoggedIn } = useAuth();
  return useInfiniteQuery({
    queryKey: ["conversations", limit],
    queryFn: ({ pageParam = 1 }) => fetchConversations(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: isLoggedIn,
  });
};

export const useConversationById = (conversationId: string) => {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversationById(conversationId),
    enabled: !!conversationId,
  });
};

export const useConversationsByName = (name: string) => {
  return useQuery({
    queryKey: ["conversations", "search", name],
    queryFn: () => getConversationsByName(name),
    enabled: name.trim().length > 0,
  });
};

export const useUnreadChatCount = () => {
  const { isLoggedIn } = useAuth();

  return useQuery({
    queryKey: ["unreadChatCount"],
    queryFn: async () => {
      const data = await fetchUnreadChatCount();
      useAppStore
        .getState()
        .setUnreadConversationsCount(data.unreadConversationsCount);
      return data;
    },
    enabled: isLoggedIn,
  });
};
