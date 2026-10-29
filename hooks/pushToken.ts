import api from "@/lib/axios";
import {useAppStore} from "@/store/useAppStore";
import {
  getPushRegistration,
  PUSH_REGISTRATION_KEY,
} from "@/utils/helpers/pushRegistration";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {getItemAsync, setItemAsync} from "expo-secure-store";
import {Platform} from "react-native";

export {PUSH_REGISTRATION_KEY};
export const NOTIFICATION_PERMISSION_KEY = "notification_permission_asked";

export function getEasProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Lean token fetch — only works if OS permission is already granted. */
export async function getExpoPushToken() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFA840",
      });
    }

    if (!Device.isDevice) {
      console.log("⚠️ Must use physical device for Push Notifications");
      return undefined;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      console.error("❌ EAS projectId missing");
      return undefined;
    }

    const {status} = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.log("⚠️ Permission not granted for push notifications");
      return undefined;
    }

    const token = (await Notifications.getExpoPushTokenAsync({projectId})).data;
    return token;
  } catch (error) {
    console.error("❌ getExpoPushToken failed:", error);
    return undefined;
  }
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  const {status} = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/** True when we should ask the OS for notification permission once. */
export async function shouldPromptForNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const hasAsked = await getItemAsync(NOTIFICATION_PERMISSION_KEY);
  if (hasAsked) return false;

  return !(await isNotificationPermissionGranted());
}

export async function requestNotificationPermission(): Promise<boolean> {
  const {status} = await Notifications.requestPermissionsAsync();
  await setItemAsync(NOTIFICATION_PERMISSION_KEY, "asked");
  return status === "granted";
}

/** Fetch token when OS permission is already granted. */
export async function registerForPushNotificationsAsync() {
  try {
    if (!(await isNotificationPermissionGranted())) return undefined;
    return await getExpoPushToken();
  } catch (error) {
    console.error("❌ registerForPushNotificationsAsync failed:", error);
    return undefined;
  }
}

export async function savePushTokenToBackend(token: string) {
  try {
    const userId = useAppStore.getState().id;
    if (!userId) return false;

    const saved = await getPushRegistration();
    if (saved?.token === token && saved?.userId === userId) {
      return true;
    }

    const response = await api.post("/notifications/token", {
      expoPushToken: token,
    });

    if (response.data.success) {
      await setItemAsync(
        PUSH_REGISTRATION_KEY,
        JSON.stringify({token, userId}),
      );
      return true;
    }

    return false;
  } catch (error: any) {
    console.error(
      "❌ Error saving push token:",
      error.response?.data || error.message,
    );
    return false;
  }
}
