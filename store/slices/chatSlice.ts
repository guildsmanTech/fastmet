import { ChatSurface } from "@/types/chat";
import { StateCreator } from "zustand";

export type ActiveChat = { conversationId: string; surface: ChatSurface };

export interface ChatSlice {
  unreadConversationsCount: number;
  setUnreadConversationsCount: (count: number) => void;
  /** The chat currently open on screen, if any (set by useChatRoom). */
  activeChat: ActiveChat | null;
  setActiveChat: (chat: ActiveChat | null) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  unreadConversationsCount: 0,
  activeChat: null,
  setUnreadConversationsCount: (count: number) => {
    set({ unreadConversationsCount: count });
  },
  setActiveChat: (chat: ActiveChat | null) => {
    set({ activeChat: chat });
  },
});
