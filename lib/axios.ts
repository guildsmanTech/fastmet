import {
  ACCOUNT_DEACTIVATED_ROUTE,
  accountBannedRoute,
  accountSuspendedRoute,
  DEVICE_BANNED_ROUTE,
} from "@/constants/routes";
import {queryClient} from "@/lib/queryClient";
import {disconnectSocket} from "@/sockets/socket";
import {useAppStore} from "@/store/useAppStore";
import {versionHeaders} from "@/utils/appVersion";
import {clearPushRegistrationCache} from "@/utils/helpers/pushRegistration";
import axios, {InternalAxiosRequestConfig, isAxiosError} from "axios";
import {Href, router} from "expo-router";
import Toast from "react-native-toast-message";

export const apiUrl = `${process.env.EXPO_PUBLIC_BASE_URL}/api/client`;

const REFRESH_TIMEOUT_MS = 15000;
const LOGOUT_TIMEOUT_MS = 5000;

// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: apiUrl,
  headers: {"Content-Type": "application/json"},
});

/**
 * The server rejected the refresh token (401), or there is none: the login
 * session is over. Any other refresh failure (offline, timeout, 5xx) is
 * transient and must not log the user out.
 */
export class SessionExpiredError extends Error {
  /** Ended because another device logged in to this account. */
  readonly displaced: boolean;

  constructor(displaced = false) {
    super("Session expired");
    this.name = "SessionExpiredError";
    this.displaced = displaced;
  }
}

const never = <T>() => new Promise<T>(() => {});

type LogoutNotice = {title: string; message: string; visibilityTime?: number};

const SESSION_EXPIRED_NOTICE: LogoutNotice = {
  title: "Session Expired",
  message: "Please log in again.",
};

const SESSION_DISPLACED_NOTICE: LogoutNotice = {
  title: "Signed Out",
  message: "Your account was signed in on another device.",
  visibilityTime: 6000,
};

// An admin approved another account's unlink request for this device.
const DEVICE_UNLINKED_NOTICE: LogoutNotice = {
  title: "Signed Out",
  message: "This device is now linked to another account.",
  visibilityTime: 6000,
};

// --- Single logout ---
// Concurrent 401s, socket errors and refresh failures all funnel here; only the
// first caller tears down (one toast, one redirect), the rest share its promise.
let activeLogoutPromise: Promise<void> | null = null;

export const performLogout = (
  redirectTo: Href = "/(auth)/auth",
  notice?: LogoutNotice,
): Promise<void> => {
  if (activeLogoutPromise) return activeLogoutPromise;

  activeLogoutPromise = (async () => {
    if (notice) {
      Toast.show({
        type: "error",
        text1: notice.title,
        text2: notice.message,
        position: "top",
        visibilityTime: notice.visibilityTime ?? 4000,
        swipeable: true,
      });
    }

    const {token, refreshToken} = useAppStore.getState();
    if (token || refreshToken) {
      // Raw axios, not `api`: a 401 here must not re-enter the interceptor
      // (that looped logout → refresh → logout forever). The refresh token
      // lets the server revoke the session even if the access token expired.
      // Not awaited so a slow network never delays the local logout.
      void axios
        .post(
          `${apiUrl}/auth/logout`,
          {refreshToken},
          {
            headers: {
              ...(token && {Authorization: `Bearer ${token}`}),
              ...versionHeaders(),
            },
            timeout: LOGOUT_TIMEOUT_MS,
          },
        )
        .catch(() => {});
    }

    disconnectSocket();
    await clearPushRegistrationCache().catch(() => {});
    useAppStore.getState().logout();
    queryClient.clear();
    router.replace(redirectTo);
  })().finally(() => {
    activeLogoutPromise = null;
  });

  return activeLogoutPromise;
};

export const expireSession = () =>
  performLogout(undefined, SESSION_EXPIRED_NOTICE);

export const signOutDisplacedSession = () =>
  performLogout(undefined, SESSION_DISPLACED_NOTICE);

export const signOutUnlinkedDevice = () =>
  performLogout(undefined, DEVICE_UNLINKED_NOTICE);

export const endSession = (reason: SessionExpiredError) =>
  reason.displaced ? signOutDisplacedSession() : expireSession();

// --- Shared refresh promise ---
// A single in-flight promise shared by all callers (interceptor + socket).
// Any second caller that arrives while a refresh is already in progress simply
// awaits the same promise — no duplicate HTTP requests, no token rotation race.
let activeRefreshPromise: Promise<string> | null = null;

export const ensureFreshToken = (): Promise<string> => {
  if (activeRefreshPromise) return activeRefreshPromise;

  const storedRefreshToken = useAppStore.getState().refreshToken;
  if (!storedRefreshToken) return Promise.reject(new SessionExpiredError());

  activeRefreshPromise = (async () => {
    try {
      const {data} = await axios.post<{
        accessToken: string;
        refreshToken: string;
      }>(
        `${apiUrl}/auth/refresh`,
        {refreshToken: storedRefreshToken},
        {headers: versionHeaders(), timeout: REFRESH_TIMEOUT_MS},
      );

      // Logged out while the refresh was in flight: don't log back in.
      if (useAppStore.getState().refreshToken !== storedRefreshToken) {
        throw new Error("Session changed during refresh");
      }

      useAppStore.getState().setAuthData({
        token: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    } catch (error) {
      // No response = offline/timeout: transient, keep the session.
      if (!isAxiosError(error) || !error.response) throw error;

      const {status, data} = error.response;

      if (status === 403 && data?.accountBanned) {
        await performLogout(accountBannedRoute(data));
        return never<string>();
      }

      if (status === 403 && data?.accountDeactivated) {
        await performLogout(ACCOUNT_DEACTIVATED_ROUTE);
        return never<string>();
      }

      if (status === 403 && data?.accountSuspended) {
        await performLogout(accountSuspendedRoute(data));
        return never<string>();
      }

      if (status === 401) {
        throw new SessionExpiredError(!!data?.sessionDisplaced);
      }

      throw error; // 5xx, 503 (retry), 429, ...: transient
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
};

// Attach access token to every request
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = useAppStore.getState().token;
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    for (const [key, value] of Object.entries(versionHeaders())) {
      config.headers.set(key, value);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const data = error.response?.data;
    const status = error.response?.status;
    const originalRequest = error.config;

    // App build below the server's minimum (version gate). Show the force
    // update modal; reject (not hang) so callers finish. Never logs out. The
    // server never sends this to a user with a trip in progress.
    if (status === 426 && data?.code === "APP_UPDATE_REQUIRED") {
      useAppStore.getState().setUpdateRequired({
        minBuild: data.minBuild,
        latestBuild: data.latestBuild,
        storeUrl: data.storeUrl,
        deferred: false,
      });
      return Promise.reject(error);
    }

    // Account ban outranks a device ban (the server sends it first too).
    if (status === 403 && data?.accountBanned) {
      await performLogout(accountBannedRoute(data));
      return never();
    }

    if (status === 403 && data?.deviceBanned) {
      await performLogout(DEVICE_BANNED_ROUTE);
      return never();
    }

    if (status === 403 && data?.accountDeactivated) {
      await performLogout(ACCOUNT_DEACTIVATED_ROUTE);
      return never();
    }

    if (status === 403 && data?.accountSuspended) {
      await performLogout(accountSuspendedRoute(data));
      return never();
    }

    if (status === 401) {
      // No session on this device (guest): nothing to expire.
      if (!useAppStore.getState().token) return Promise.reject(error);

      // Session displaced — another device took over, no refresh attempt
      if (data?.sessionDisplaced) {
        await signOutDisplacedSession();
        return never();
      }

      // Access token expired — refresh once, then retry. The request
      // interceptor attaches the current token on the retry.
      if (data?.tokenExpired && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        // Another caller already refreshed since this request was sent.
        const sentAuth = originalRequest.headers?.get?.("Authorization");
        const current = useAppStore.getState().token;
        if (current && sentAuth !== `Bearer ${current}`) {
          return api(originalRequest);
        }

        try {
          await ensureFreshToken();
          return api(originalRequest);
        } catch (refreshError) {
          if (refreshError instanceof SessionExpiredError) {
            await endSession(refreshError);
            return never();
          }
          // Transient refresh failure: keep the session, fail this request.
          return Promise.reject(refreshError);
        }
      }

      // Any other 401 (invalid token, account not found) — hard logout
      await expireSession();
      return never();
    }

    return Promise.reject(error);
  },
);

export default api;
