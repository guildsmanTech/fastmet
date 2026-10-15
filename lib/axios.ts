import {
  ACCOUNT_DEACTIVATED_ROUTE,
  DEVICE_BANNED_ROUTE,
} from "@/constants/routes";
import {getSocket} from "@/sockets/socket";
import {useAppStore} from "@/store/useAppStore";
import {versionHeaders} from "@/utils/appVersion";
import {clearPushRegistrationCache} from "@/utils/helpers/pushRegistration";
import axios, {InternalAxiosRequestConfig} from "axios";
import {router} from "expo-router";
import Toast from "react-native-toast-message";

export const apiUrl = `${process.env.EXPO_PUBLIC_BASE_URL}/api/client`;

const api = axios.create({
  baseURL: apiUrl,
  headers: {"Content-Type": "application/json"},
});

// --- Shared refresh promise ---
// A single in-flight promise shared by all callers (interceptor + socket).
// Any second caller that arrives while a refresh is already in progress simply
// awaits the same promise — no duplicate HTTP requests, no token rotation race.
let activeRefreshPromise: Promise<string> | null = null;

export const ensureFreshToken = (): Promise<string> => {
  if (activeRefreshPromise) return activeRefreshPromise;

  const storedRefreshToken = useAppStore.getState().refreshToken;
  if (!storedRefreshToken) return Promise.reject(new Error("No refresh token"));

  activeRefreshPromise = axios
    .post<{accessToken: string; refreshToken: string}>(
      `${apiUrl}/auth/refresh`,
      {refreshToken: storedRefreshToken},
      {headers: versionHeaders()},
    )
    .then(({data}) => {
      useAppStore.getState().setAuthData({
        token: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    })
    .finally(() => {
      activeRefreshPromise = null;
    });

  return activeRefreshPromise;
};

export const performLogout = async () => {
  const store = useAppStore.getState();

  // Fire-and-forget — don't let a network error block local logout
  try {
    const token = store.token;
    if (token) {
      await api.post("/auth/logout", null, {
        headers: {Authorization: `Bearer ${token}`},
      });
    }
  } catch {
    // intentionally swallowed
  }

  const socket = getSocket("");
  if (socket?.connected) socket.disconnect();

  await clearPushRegistrationCache();
  store.logout();
  router.replace("/(auth)/auth");
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

    if (status === 403 && data?.deviceBanned) {
      const socket = getSocket("");
      if (socket?.connected) socket.disconnect();
      useAppStore.getState().logout();
      router.replace(DEVICE_BANNED_ROUTE);
      return new Promise(() => {});
    }

    if (status === 403 && data?.accountDeactivated) {
      const socket = getSocket("");
      if (socket?.connected) socket.disconnect();
      useAppStore.getState().logout();
      router.replace(ACCOUNT_DEACTIVATED_ROUTE);
      return new Promise(() => {});
    }

    if (status === 401) {
      // Session displaced — another device took over, no refresh attempt
      if (data?.sessionDisplaced) {
        Toast.show({
          type: "error",
          text1: "Signed Out",
          text2: "Your account was signed in on another device.",
          position: "top",
          visibilityTime: 6000,
          swipeable: true,
        });
        await performLogout();
        return new Promise(() => {});
      }

      // Access token expired — attempt refresh
      if (data?.tokenExpired && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await ensureFreshToken();
          originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
          return api(originalRequest);
        } catch {
          Toast.show({
            type: "error",
            text1: "Session Expired",
            text2: "Please log in again.",
            position: "top",
            visibilityTime: 4000,
            swipeable: true,
          });

          await performLogout();
          return new Promise(() => {});
        }
      }

      // Any other 401 (e.g. truly invalid token) — hard logout
      Toast.show({
        type: "error",
        text1: "Session Expired",
        text2: "Please log in again.",
        position: "top",
        visibilityTime: 4000,
        swipeable: true,
      });

      await performLogout();
      return new Promise(() => {});
    }

    return Promise.reject(error);
  },
);

export default api;
