import { BookingSettingsBootstrap } from "@/hooks/useBookingSettings";
import { queryClient } from "@/lib/queryClient";
import {
  Montserrat_400Regular,
  Montserrat_700Bold,
  useFonts,
} from "@expo-google-fonts/montserrat";
import { QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AnimatedSplash from "@/components/AnimatedSplash";
import LoadingModal from "@/components/modals/loading";
import { toastConfig } from "@/config/toastConfig";
import { useAuth } from "@/hooks/useAuth";
import { useSyncAuthMeta } from "@/hooks/useSyncAuthMeta";
import SocketProvider from "@/sockets/context/SocketProvider";
import * as Sentry from "@sentry/react-native";
import * as Device from "expo-device";
import Toast from "react-native-toast-message";
import "../global.css";

function AuthMetaSync() {
  useSyncAuthMeta();
  return null;
}

Sentry.init({
  dsn: "https://aceadef3929e78209242fa356db6b552@o4510836378697728.ingest.us.sentry.io/4510836521435136",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

void SplashScreen.preventAutoHideAsync();

export default Sentry.wrap(function RootLayout() {
  const { hasHydrated } = useAuth();
  const isEmulator = !Device.isDevice;

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_700Bold,
  });

  const [preRegStatus, setPreRegStatus] = useState<
    "loading" | "error" | "loaded"
  >("loading");
  const [preRegActive, setPreRegActive] = useState(false);

  const fetchPreRegStatus = async () => {
    // TEMP: bypass pre-reg gate for sideloaded prod APK testing — restore after
    // setPreRegActive(false);
    // setPreRegStatus("loaded");
    // return;
    setPreRegStatus("loading");
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/app-config/pre-registration`,
      );
      const data = await res.json();
      setPreRegActive(data?.isClientPreReg === true);
      setPreRegStatus("loaded");
    } catch (e) {
      setPreRegStatus("error");
    }
  };

  useEffect(() => {
    void fetchPreRegStatus();
  }, []);

  const isReady = fontsLoaded && hasHydrated && preRegStatus !== "loading";
  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    void SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  if (isEmulator) {
    return (
      <View className="flex-1 justify-center items-center px-6 bg-white">
        <Text className="text-base text-center text-neutral-700 font-montserrat">
          This app cannot run on an emulator.
        </Text>
      </View>
    );
  }

  if (preRegStatus === "error") {
    return (
      <View className="flex-1 justify-center items-center px-6 bg-white">
        <Text className="mb-4 text-base text-center text-neutral-700 font-montserrat">
          Couldn&apos;t connect. Please check your connection and try again.
        </Text>
        <Pressable
          onPress={fetchPreRegStatus}
          className="bg-[#ED8718] active:bg-[#FFA840] px-6 py-3 rounded-full"
        >
          <Text className="font-bold text-white font-montserrat">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!splashAnimationFinished) {
    return <AnimatedSplash onFinish={() => setSplashAnimationFinished(true)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BookingSettingsBootstrap />
          <SocketProvider>
            <AuthMetaSync />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={preRegActive}>
                <Stack.Screen name="(pre_registration)" />
              </Stack.Protected>

              <Stack.Protected guard={!preRegActive}>
                <Stack.Screen name="(drawer)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(root_screens)" />
                <Stack.Screen name="(public_screens)" />
              </Stack.Protected>
            </Stack>
          </SocketProvider>
          <Toast config={toastConfig} />
          <LoadingModal />
        </QueryClientProvider>

        <StatusBar backgroundColor="#0F2535" barStyle="light-content" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
