import { useAppStore } from "@/store/useAppStore";
import { router } from "expo-router";
import { pushOnce } from "./navigation";

/**
 * Opens a conversation without stacking chat screens: no-op when it is
 * already open, replaces the current chat screen, otherwise pushes.
 */
export function openChat(conversationId: string) {
  const { activeChat } = useAppStore.getState();
  if (activeChat?.conversationId === conversationId) return;

  const href = { pathname: "/message", params: { conversationId } } as const;
  if (activeChat?.surface === "screen") {
    router.replace(href);
    return;
  }
  pushOnce(href);
}
