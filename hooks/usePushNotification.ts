import {
  registerForPushNotificationsAsync,
  requestNotificationPermission,
  savePushTokenToBackend,
  shouldPromptForNotificationPermission,
} from "@/hooks/pushToken";
import {handleNotificationEntry} from "@/utils/helpers/notificationRouting";
import * as Notifications from "expo-notifications";
import {useEffect, useRef, useState} from "react";
import {AppState} from "react-native";
import {useAuth} from "./useAuth";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined;
    const isForeground = AppState.currentState === "active";
    // Socket already shows these offers while the app is open.
    const suppressBanner =
      isForeground &&
      (type === "driver_offer" || type === "driver_offer_pooling");

    return {
      shouldPlaySound: !suppressBanner,
      shouldSetBadge: true,
      shouldShowBanner: !suppressBanner,
      shouldShowList: true,
    };
  },
});

let coldStartResponse: Notifications.NotificationResponse | null = null;
let hasFetchedColdStart = false;

Notifications.addNotificationResponseReceivedListener((response) => {
  if (!hasFetchedColdStart) {
    coldStartResponse = response;
  }
});

Promise.resolve(Notifications.getLastNotificationResponse()).then(
  (response) => {
    hasFetchedColdStart = true;
    if (response && !coldStartResponse) {
      coldStartResponse = response;
    }
  },
);

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const {isLoggedIn} = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;

    void (async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        await savePushTokenToBackend(token);
        return;
      }

      if (await shouldPromptForNotificationPermission()) {
        const granted = await requestNotificationPermission();
        if (granted) {
          const newToken = await registerForPushNotificationsAsync();
          setExpoPushToken(newToken);
          if (newToken) {
            await savePushTokenToBackend(newToken);
          }
        }
      }
    })();

    if (coldStartResponse) {
      handleNotificationEntry(coldStartResponse.notification.request.content.data);
      coldStartResponse = null;
    }

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
        console.log("📬 Notification received:", notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("👆 Notification tapped:", data);
        handleNotificationEntry(data);
      });

    return () => {
      notificationListener.current?.remove();
      notificationListener.current = null;
      responseListener.current?.remove();
      responseListener.current = null;
    };
  }, [isLoggedIn]);

  return {
    expoPushToken,
    notification,
  };
}
