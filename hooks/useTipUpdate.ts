import {useSocket} from "@/sockets/context/SocketProvider";
import type {TipUpdateFailedPayload, TipUpdatedPayload} from "@/types/book";
import {useCallback, useEffect, useRef, useState} from "react";
import Toast from "react-native-toast-message";

const RESPONSE_TIMEOUT_MS = 10_000;

/**
 * Sends tip changes for one booking and tracks the reply. `onTip` gets every
 * confirmed value for the booking (from this device or another) and the
 * current value when a change is refused, so the screen never shows a tip the
 * server doesn't have.
 */
export function useTipUpdate(
  bookingId: string | undefined,
  /** `mine`: this device's change was confirmed; `refused`: it was rejected. */
  onTip?: (amount: number, source: "mine" | "other" | "refused") => void,
) {
  const socket = useSocket();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTipRef = useRef(onTip);
  onTipRef.current = onTip;

  const settle = useCallback(() => {
    pendingRef.current = false;
    setPending(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!bookingId) return;

    const onUpdated = (payload: TipUpdatedPayload) => {
      if (payload.bookingId !== bookingId) return;
      const mine = pendingRef.current;
      settle();
      onTipRef.current?.(payload.tipAmount, mine ? "mine" : "other");
      if (!mine) return;
      Toast.show({
        type: "success",
        text1: payload.tipAmount > 0 ? "Tip updated" : "Tip removed",
        text2:
          payload.tipAmount > 0
            ? `Drivers now see your ₱${payload.tipAmount.toLocaleString("en-US")} tip.`
            : "Your booking no longer has a tip.",
        position: "top",
        visibilityTime: 3_000,
        topOffset: 50,
      });
    };

    const onFailed = (payload: TipUpdateFailedPayload) => {
      if (payload.bookingId && payload.bookingId !== bookingId) return;
      if (!pendingRef.current) return;
      settle();
      if (typeof payload.tipAmount === "number") {
        onTipRef.current?.(payload.tipAmount, "refused");
      }
      Toast.show({
        type: "error",
        text1: payload.code === "locked" ? "Tip locked" : "Couldn't update tip",
        text2: payload.message,
        position: "top",
        visibilityTime: 5_000,
        topOffset: 50,
      });
    };

    socket.on("tipUpdated", onUpdated);
    socket.on("tipUpdateFailed", onFailed);
    return () => {
      socket.off("tipUpdated", onUpdated);
      socket.off("tipUpdateFailed", onFailed);
    };
  }, [bookingId, socket, settle]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const submit = useCallback(
    (amount: number) => {
      if (!bookingId || pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      socket.emit("updateTip", {bookingId, amount});
      timeoutRef.current = setTimeout(() => {
        if (!pendingRef.current) return;
        settle();
        Toast.show({
          type: "error",
          text1: "No response",
          text2: "Check your connection and try again.",
          position: "top",
          visibilityTime: 4_000,
          topOffset: 50,
        });
      }, RESPONSE_TIMEOUT_MS);
    },
    [bookingId, socket, settle],
  );

  return {submit, pending};
}
