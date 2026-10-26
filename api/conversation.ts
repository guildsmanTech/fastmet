import api from "@/lib/axios";
import {
  ChatMessage,
  ConversationResponse,
  MessageResponse,
} from "@/types/chat";

export const fetchConversations = async (
  page = 1,
  limit = 5,
): Promise<{
  conversations: ConversationResponse[];
  nextPage: number | null;
}> => {
  const res = await api.get<{
    conversations: ConversationResponse[];
    nextPage: number | null;
  }>(`/message`, { params: { page, limit } });

  return res.data;
};

export const getConversationById = async (
  conversationId: string,
): Promise<MessageResponse> => {
  const response = await api.get(`/message/conversation/${conversationId}`);
  return response.data;
};

export const getConversationsByName = async (
  name: string,
): Promise<{
  conversations: ConversationResponse[];
}> => {
  const response = await api.get<{
    conversations: ConversationResponse[];
  }>(`/message/by-name/${encodeURIComponent(name)}`);

  return response.data;
};

export const fetchUnreadChatCount = async () => {
  const res = await api.get<{ unreadConversationsCount: number }>(
    "/message/unread-count",
  );
  return res.data;
};

/** Sends an image message. The same clientMessageId on retry never duplicates. */
export const uploadChatImage = async (
  conversationId: string,
  uri: string,
  clientMessageId: string,
): Promise<ChatMessage> => {
  const form = new FormData();
  form.append("clientMessageId", clientMessageId);
  form.append("image", {
    uri,
    type: "image/jpeg",
    name: `${clientMessageId}.jpg`,
  } as unknown as Blob);

  const { data } = await api.post<{ success: boolean; message: ChatMessage }>(
    `/message/conversation/${conversationId}/image`,
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 },
  );
  return data.message;
};
