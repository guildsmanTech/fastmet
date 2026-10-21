import type { Href } from "expo-router";

export const DEVICE_BANNED_ROUTE = "/(auth)/device-banned" as Href;
export const DEVICE_BLOCKED_ROUTE = "/(auth)/device-blocked" as Href;
export const ACCOUNT_DEACTIVATED_ROUTE = "/(auth)/account-deactivated" as Href;

/** Suspended screen. `data` is a 403 `accountSuspended` body (fields optional). */
export const accountSuspendedRoute = (data?: {
  suspendedUntil?: unknown;
  suspensionReason?: unknown;
}): Href =>
  ({
    pathname: "/(auth)/account-suspended",
    params: {
      suspendedUntil:
        typeof data?.suspendedUntil === "string" ? data.suspendedUntil : "",
      suspensionReason:
        typeof data?.suspensionReason === "string" ? data.suspensionReason : "",
    },
  }) as Href;
