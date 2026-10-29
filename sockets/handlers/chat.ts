import {queryClient} from "@/lib/queryClient";
import {markConversationSeenInCache} from "@/queries/conversation";
import {useAppStore} from "@/store/useAppStore";
import {ConversationResponse} from "@/types/chat";
import {InfiniteData} from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {Socket} from "socket.io-client";

export const receiveMessage = (socket: Socket) => {
  const receiveMessageHandler = (data: {
    unreadConversationsCount: number;
    message: string;
    sender: string;
    conversationId: string;
    profilePictureUrl: string | null;
  }) => {
    useAppStore
      .getState()
      .setUnreadConversationsCount(data.unreadConversationsCount);

    // The server skips the badge while this chat is open; this guards races.
    const {activeChat} = useAppStore.getState();
    if (activeChat?.conversationId !== data.conversationId) {
      type ConversationsPage = {
        conversations: ConversationResponse[];
        nextPage: number | null;
      };

      const conversationsQueries = queryClient.getQueriesData<
        InfiniteData<ConversationsPage>
      >({queryKey: ["conversations"]});

      const hasCache = conversationsQueries.some(([, d]) => !!d?.pages?.length);
      const foundInCache = conversationsQueries.some(([, d]) =>
        d?.pages?.some((page) =>
          page.conversations.some((c) => c._id === data.conversationId),
        ),
      );

      // Brand-new conversation is not in the list yet. Refetch outside any
      // cache write — invalidating inside setQueriesData gets overwritten by
      // the returned old list, so the first message never appears until refresh.
      if (!hasCache || !foundInCache) {
        queryClient.invalidateQueries({queryKey: ["conversations"]});
      } else {
        queryClient.setQueriesData<InfiniteData<ConversationsPage>>(
          {queryKey: ["conversations"]},
          (old) => {
            if (!old?.pages?.length) return old;

            const found = old.pages
              .flatMap((p) => p.conversations)
              .find((c) => c._id === data.conversationId);

            if (!found) return old;

            // Remove the conversation from whichever page it sits in
            const pagesWithout = old.pages.map((page) => ({
              ...page,
              conversations: page.conversations.filter(
                (c) => c._id !== data.conversationId,
              ),
            }));

            // Build updated conversation with the 4 changed fields
            const updated: ConversationResponse = {
              ...found,
              lastMessage: data.message,
              lastMessageAt: new Date().toISOString(),
              lastMessageBy: "driver",
              unreadCount: {
                ...found.unreadCount,
                client: found.unreadCount.client + 1,
              },
            };

            // Prepend to page 0 so most-recent conversation is on top
            return {
              ...old,
              pages: pagesWithout.map((page, idx) =>
                idx === 0
                  ? {
                      ...page,
                      conversations: [updated, ...page.conversations],
                    }
                  : page,
              ),
            };
          },
        );
      }

      Toast.show({
        type: "newMessage",
        text1: `New Message from ${data.sender}`,
        text2: data.message,
        position: "top",
        visibilityTime: 5000,
        props: {
          conversationId: data.conversationId,
          profilePictureUrl: data.profilePictureUrl,
        },
      });
    }
  };

  const unreadConversationsUpdatedHandler = (data: {
    unreadConversationsCount: number;
  }) => {
    useAppStore
      .getState()
      .setUnreadConversationsCount(data.unreadConversationsCount);
  };

  const conversationSeenHandler = (data: {conversationId: string}) => {
    markConversationSeenInCache(data.conversationId);
  };

  socket.on("new_message_badge", receiveMessageHandler);
  socket.on("unread_conversations_updated", unreadConversationsUpdatedHandler);
  socket.on("conversation_seen", conversationSeenHandler);

  return () => {
    socket.off("new_message_badge", receiveMessageHandler);
    socket.off(
      "unread_conversations_updated",
      unreadConversationsUpdatedHandler,
    );
    socket.off("conversation_seen", conversationSeenHandler);
  };
};
