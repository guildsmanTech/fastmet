import {
  ACCOUNT_DEACTIVATED_ROUTE,
  accountBannedRoute,
  accountSuspendedRoute,
  DEVICE_BANNED_ROUTE,
} from "@/constants/routes";
import { performLogout, signOutUnlinkedDevice } from "@/lib/axios";
import { Socket } from "socket.io-client";

type ForceLogoutPayload = {
  code?: string;
  banReason?: unknown;
  suspendedUntil?: unknown;
  suspensionReason?: unknown;
};

/**
 * The server emits `force-logout` right before it disconnects this user's
 * sockets (admin ban / suspension / deactivation / device ban, or another
 * account's device unlink request approved for this device). A server-side
 * disconnect is not retried by socket.io, so without this the app would sit
 * on a dead socket until its next API call.
 */
export const forceLogout = (socket: Socket) => {
  const handler = (payload: ForceLogoutPayload = {}) => {
    switch (payload.code) {
      case "account_banned":
        void performLogout(accountBannedRoute(payload));
        return;
      case "account_suspended":
        void performLogout(accountSuspendedRoute(payload));
        return;
      case "account_deactivated":
        void performLogout(ACCOUNT_DEACTIVATED_ROUTE);
        return;
      case "device_banned":
        void performLogout(DEVICE_BANNED_ROUTE);
        return;
      case "device_unlinked":
        void signOutUnlinkedDevice();
        return;
      default:
        // Events without a code: the next API call or socket handshake
        // returns the matching 403 and routes from there.
        return;
    }
  };

  socket.on("force-logout", handler);
  return () => {
    socket.off("force-logout", handler);
  };
};
