import { uploadChatImage } from "@/api/conversation";
import { queryClient } from "@/lib/queryClient";
import { applyChatExitToCache } from "@/queries/conversation";
import { useSocket } from "@/sockets/context/SocketProvider";
import { useAppStore } from "@/store/useAppStore";
import { ChatMessage, ChatSurface } from "@/types/chat";
import { PickedImage, prepareChatImage } from "@/utils/helpers/imagePicker";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { IMessage } from "react-native-gifted-chat";
import Toast from "react-native-toast-message";
import { Socket } from "socket.io-client";

const MY_TYPE = "client";
const JOIN_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 30;

export type ChatUser = { id: string; name: string; avatar?: string };

/** A server message, or one of ours still on its way (`pending`). */
type ChatItem = ChatMessage & { pending?: boolean };

type Ack<T> = ({ ok: true } & T) | { ok: false; code?: string; message?: string };

const newClientMessageId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs: number,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket
      .timeout(timeoutMs)
      .emit(event, payload, (err: Error | null, res?: Ack<T>) => {
        if (err || !res) {
          resolve({
            ok: false,
            code: "TIMEOUT",
            message: "Connection problem. Please try again.",
          });
        } else {
          resolve(res);
        }
      });
  });
}

/**
 * Newest first, one entry per message. A server copy replaces the pending
 * entry with the same clientMessageId (pending entries use it as their _id).
 */
function mergeMessages(current: ChatItem[], incoming: ChatItem[]): ChatItem[] {
  const byId = new Map(current.map((m) => [m._id, m]));
  for (const message of incoming) {
    if (!message.pending && message.clientMessageId) {
      byId.delete(message.clientMessageId);
    }
    byId.set(message._id, message);
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: string })?.message;
    if (message) return message;
  }
  return fallback;
}

/**
 * Everything a chat UI needs for one conversation: joining (again after a
 * reconnect or returning from background), history by cursor, live messages,
 * the send lock, and sends that show right away and survive retries.
 */
export function useChatRoom({
  conversationId,
  enabled = true,
  surface,
  me,
  counterpart,
}: {
  conversationId: string | null;
  enabled?: boolean;
  surface: ChatSurface;
  me: ChatUser;
  counterpart: ChatUser;
}) {
  const socket = useSocket();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [canSendMessages, setCanSendMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [imagesInFlight, setImagesInFlight] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const itemsRef = useRef<ChatItem[]>([]);
  const lastFailedRef = useRef<{ text: string; clientMessageId: string } | null>(
    null,
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // A different conversation starts empty.
  useEffect(() => {
    setItems((prev) => (prev.length ? [] : prev));
    setHasMore(false);
    setCanSendMessages(false);
    setUnavailable(false);
    lastFailedRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!enabled || !conversationId) return;
    let disposed = false;
    let joined = false;

    const join = async () => {
      if (!socket.connected) return; // "connect" runs this again
      const res = await emitWithAck<{ canSendMessages: boolean }>(
        socket,
        "join_room",
        { conversationId },
        JOIN_TIMEOUT_MS,
      );
      if (disposed) return;
      if (!res.ok) {
        if (res.code === "NOT_FOUND") setUnavailable(true);
        return;
      }
      joined = true;
      setCanSendMessages(res.canSendMessages);

      const page = await emitWithAck<{
        messages: ChatMessage[];
        hasMore: boolean;
      }>(
        socket,
        "get_messages",
        { conversationId, limit: PAGE_SIZE },
        REQUEST_TIMEOUT_MS,
      );
      if (disposed || !page.ok) return;

      // Messages missed while away fill in. If more arrived than one page,
      // the older list no longer connects to the new page: start over from it.
      const known = itemsRef.current.filter((m) => !m.pending);
      const newestKnown = known[0];
      const oldestFetched = page.messages[page.messages.length - 1];
      const gap =
        page.hasMore &&
        !!newestKnown &&
        !!oldestFetched &&
        Date.parse(oldestFetched.createdAt) > Date.parse(newestKnown.createdAt);

      if (gap || known.length === 0) {
        setItems((prev) =>
          mergeMessages(
            prev.filter((m) => m.pending),
            page.messages,
          ),
        );
        setHasMore(page.hasMore);
      } else {
        setItems((prev) => mergeMessages(prev, page.messages));
      }
    };

    const leave = () => {
      if (!joined) return;
      joined = false;
      if (socket.connected) socket.emit("leave_room", { conversationId });
    };

    const onReceive = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;
      setItems((prev) => mergeMessages(prev, [message]));
    };

    const onPermission = (data: {
      conversationId: string;
      canSendMessages: boolean;
    }) => {
      if (data.conversationId !== conversationId) return;
      setCanSendMessages(data.canSendMessages);
      // Phone number and booking refs follow the lock.
      void queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId],
      });
    };

    const onConnect = () => {
      joined = false; // the server forgot our rooms
      void join();
    };

    // Leaving while backgrounded keeps unread counts and pushes right.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "background") leave();
      else if (state === "active" && !joined) void join();
    });

    useAppStore.getState().setActiveChat({ conversationId, surface });
    socket.on("connect", onConnect);
    socket.on("receive_message", onReceive);
    socket.on("chat_permission", onPermission);
    void join();

    return () => {
      disposed = true;
      appStateSub.remove();
      socket.off("connect", onConnect);
      socket.off("receive_message", onReceive);
      socket.off("chat_permission", onPermission);
      leave();

      const { activeChat, setActiveChat } = useAppStore.getState();
      if (activeChat?.conversationId === conversationId) setActiveChat(null);
      applyChatExitToCache(
        conversationId,
        itemsRef.current.find((m) => !m.pending),
      );
    };
  }, [socket, conversationId, enabled, surface]);

  const loadEarlier = useCallback(async () => {
    if (!conversationId || isLoadingEarlier || !hasMore) return;
    const known = itemsRef.current.filter((m) => !m.pending);
    const oldest = known[known.length - 1];
    if (!oldest) return;

    setIsLoadingEarlier(true);
    const page = await emitWithAck<{ messages: ChatMessage[]; hasMore: boolean }>(
      socket,
      "get_messages",
      { conversationId, before: oldest._id, limit: PAGE_SIZE },
      REQUEST_TIMEOUT_MS,
    );
    if (page.ok) {
      setItems((prev) => mergeMessages(prev, page.messages));
      setHasMore(page.hasMore);
    }
    setIsLoadingEarlier(false);
  }, [socket, conversationId, isLoadingEarlier, hasMore]);

  const addPending = useCallback(
    (clientMessageId: string, fields: { text: string; image: string | null }) => {
      if (!conversationId) return;
      setItems((prev) =>
        mergeMessages(prev, [
          {
            _id: clientMessageId,
            conversationId,
            senderId: me.id,
            senderType: MY_TYPE,
            createdAt: new Date().toISOString(),
            clientMessageId,
            pending: true,
            ...fields,
          },
        ]),
      );
    },
    [conversationId, me.id],
  );

  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((m) => m._id !== id)),
    [],
  );

  /** Resolves false when the text was not sent, so the input can keep it. */
  const sendText = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!conversationId || !text || !canSendMessages) return false;
      if (!socket.connected) {
        Toast.show({
          type: "error",
          text1: "You're offline",
          text2: "Check your connection and try again.",
        });
        return false;
      }

      // Retrying the same failed text reuses its id, so the server can't
      // save it twice if the first attempt did go through.
      const lastFailed = lastFailedRef.current;
      const clientMessageId =
        lastFailed?.text === text
          ? lastFailed.clientMessageId
          : newClientMessageId();
      lastFailedRef.current = null;

      addPending(clientMessageId, { text, image: null });
      const res = await emitWithAck<{ message: ChatMessage }>(
        socket,
        "send_message",
        { conversationId, text, clientMessageId },
        REQUEST_TIMEOUT_MS,
      );
      if (res.ok) {
        setItems((prev) => mergeMessages(prev, [res.message]));
        return true;
      }

      removeItem(clientMessageId);
      lastFailedRef.current = { text, clientMessageId };
      Toast.show({
        type: "error",
        text1: "Message not sent",
        text2: res.message || "Unable to send message",
      });
      return false;
    },
    [socket, conversationId, canSendMessages, addPending, removeItem],
  );

  const sendImage = useCallback(
    async (image: PickedImage) => {
      if (!conversationId || !canSendMessages) return;
      const clientMessageId = newClientMessageId();
      addPending(clientMessageId, { text: "", image: image.uri });
      setImagesInFlight((n) => n + 1);

      try {
        const uri = await prepareChatImage(image);
        const message = await uploadChatImage(conversationId, uri, clientMessageId);
        setItems((prev) => mergeMessages(prev, [message]));
      } catch (err) {
        removeItem(clientMessageId);
        Toast.show({
          type: "error",
          text1: "Image not sent",
          text2: errorMessage(err, "Unable to send the image. Please try again."),
        });
      } finally {
        setImagesInFlight((n) => n - 1);
      }
    },
    [conversationId, canSendMessages, addPending, removeItem],
  );

  const messages = useMemo<IMessage[]>(
    () =>
      items.map((m) => {
        const mine = m.senderId === me.id;
        const user = mine ? me : counterpart;
        return {
          _id: m._id,
          text: m.text,
          image: m.image ?? undefined,
          createdAt: new Date(m.createdAt),
          pending: m.pending,
          user: { _id: user.id, name: user.name, avatar: user.avatar },
        };
      }),
    // Primitive deps: callers may pass new objects every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      items,
      me.id,
      me.name,
      me.avatar,
      counterpart.id,
      counterpart.name,
      counterpart.avatar,
    ],
  );

  return {
    messages,
    canSendMessages,
    /** The server has no such chat (no booking with this person). */
    unavailable,
    hasMore,
    isLoadingEarlier,
    loadEarlier,
    sendText,
    sendImage,
    isSendingImage: imagesInFlight > 0,
  };
}
