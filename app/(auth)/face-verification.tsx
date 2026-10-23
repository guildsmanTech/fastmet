import {
  completeFaceVerification,
  startFaceVerification,
} from "@/api/faceVerification";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {useAppStore} from "@/store/useAppStore";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import React, {useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {WebView, WebViewMessageEvent} from "react-native-webview";

// Hosted by fastmet_web (/app-view/face-verification). The page runs the AWS
// Face Liveness check and posts {type: "complete" | "cancel" | "error"} back.
// const LIVENESS_ORIGIN = "https://www.fastmet.com.ph";
const LIVENESS_ORIGIN = "http://localhost:5173";
const LIVENESS_PATH = "/app-view/face-verification";

type Phase =
  | {name: "intro"; notice?: string}
  | {name: "scanning"; sessionId: string}
  | {name: "processing"}
  | {name: "review"};

type LivenessMessage =
  {type: "complete"} | {type: "cancel"} | {type: "error"; message?: string};

const isFromLivenessPage = (url: string | undefined) =>
  !!url && url.startsWith(`${LIVENESS_ORIGIN}${LIVENESS_PATH}`);

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || fallback;

const TIPS: {icon: keyof typeof Ionicons.glyphMap; title: string; text: string}[] =
  [
    {
      icon: "sunny-outline",
      title: "Good lighting",
      text: "Find a well-lit place, facing the light.",
    },
    {
      icon: "glasses-outline",
      title: "Clear face",
      text: "Remove sunglasses, masks, or hats.",
    },
    {
      icon: "phone-portrait-outline",
      title: "Hold steady",
      text: "Keep your phone at eye level and follow the prompts.",
    },
  ];

async function ensureCameraPermission(): Promise<boolean> {
  // iOS asks through NSCameraUsageDescription when the page opens the camera.
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export default function FaceVerification() {
  const {isAuthenticated} = useAuthGuard();
  const [phase, setPhase] = useState<Phase>({name: "intro"});
  const [starting, setStarting] = useState(false);

  const onStart = async () => {
    if (!isAuthenticated()) return;

    const granted = await ensureCameraPermission();
    if (!granted) {
      Alert.alert(
        "Camera needed",
        "Allow camera access in your phone settings to verify your face.",
        [
          {text: "Cancel", style: "cancel"},
          {text: "Open settings", onPress: () => Linking.openSettings()},
        ],
      );
      return;
    }

    setStarting(true);
    try {
      const sessionId = await startFaceVerification();
      setPhase({name: "scanning", sessionId});
    } catch (error) {
      setPhase({
        name: "intro",
        notice: errorMessage(
          error,
          "Couldn't start the face scan. Please try again.",
        ),
      });
    } finally {
      setStarting(false);
    }
  };

  const finish = async (sessionId: string) => {
    setPhase({name: "processing"});
    try {
      const data = await completeFaceVerification(sessionId);

      if (data.result === "retry") {
        const left =
          data.attemptsLeft !== null
            ? ` You have ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? "" : "s"} left.`
            : "";
        setPhase({name: "intro", notice: `${data.message}${left}`});
        return;
      }

      useAppStore.getState().setAuthData({
        registrationStep: data.registrationStep,
        approvalStatus: data.approvalStatus,
      });

      if (data.result === "approved") {
        Toast.show({
          type: "success",
          text1: "You're verified!",
          text2: "You can now book deliveries.",
          position: "top",
          visibilityTime: 4000,
          topOffset: 50,
        });
        router.replace("/(drawer)/book");
        return;
      }

      setPhase({name: "review"});
    } catch (error) {
      setPhase({
        name: "intro",
        notice: errorMessage(error, "Something went wrong. Please try again."),
      });
    }
  };

  const onMessage = (event: WebViewMessageEvent, sessionId: string) => {
    if (!isFromLivenessPage(event.nativeEvent.url)) return;

    let message: LivenessMessage;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (message.type === "complete") {
      void finish(sessionId);
    } else if (message.type === "cancel") {
      setPhase({name: "intro"});
    } else if (message.type === "error") {
      setPhase({
        name: "intro",
        notice: message.message || "The face scan stopped. Please try again.",
      });
    }
  };

  if (phase.name === "scanning") {
    const uri = `${LIVENESS_ORIGIN}${LIVENESS_PATH}?sessionId=${encodeURIComponent(phase.sessionId)}`;
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: "#fff"}}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => setPhase({name: "intro"})}
            hitSlop={12}
            className="items-center justify-center w-10 h-10 bg-gray-100 rounded-full active:bg-gray-200"
          >
            <Ionicons name="close" size={22} color="#111" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-center text-gray-900">
            Face Scan
          </Text>
          <View className="w-10" />
        </View>
        <WebView
          source={{uri}}
          style={{flex: 1}}
          onMessage={(event) => onMessage(event, phase.sessionId)}
          onShouldStartLoadWithRequest={(request) =>
            request.url.startsWith(LIVENESS_ORIGIN)
          }
          originWhitelist={[LIVENESS_ORIGIN]}
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          startInLoadingState
          renderLoading={() => (
            <View className="absolute inset-0 items-center justify-center bg-white">
              <ActivityIndicator size="large" color="#FFA840" />
            </View>
          )}
          onError={() =>
            setPhase({
              name: "intro",
              notice:
                "Couldn't load the face scan. Check your connection and try again.",
            })
          }
        />
      </SafeAreaView>
    );
  }

  if (phase.name === "processing") {
    return (
      <SafeAreaView className="items-center justify-center flex-1 px-6 bg-white">
        <View className="items-center justify-center w-28 h-28 mb-6 rounded-full bg-orange-50">
          <View className="items-center justify-center w-20 h-20 bg-orange-100 rounded-full">
            <Ionicons name="shield-checkmark-outline" size={38} color="#FFA840" />
          </View>
        </View>
        <ActivityIndicator size="small" color="#FFA840" />
        <Text className="mt-4 text-lg font-bold text-gray-900">
          Verifying your face
        </Text>
        <Text className="mt-1 text-sm text-center text-gray-500">
          This only takes a moment. Please don&apos;t close the app.
        </Text>
      </SafeAreaView>
    );
  }

  if (phase.name === "review") {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="items-center flex-1 px-6 pt-20">
          <View className="items-center justify-center mb-6 rounded-full w-32 h-32 bg-orange-50">
            <View className="items-center justify-center w-24 h-24 bg-orange-100 rounded-full">
              <Ionicons name="hourglass-outline" size={44} color="#FFA840" />
            </View>
          </View>
          <Text className="mb-2 text-2xl font-extrabold text-center text-gray-900">
            Almost there
          </Text>
          <Text className="text-sm leading-6 text-center text-gray-500">
            Thanks for verifying. We need a little more time to review your
            account.
          </Text>

          <View className="w-full gap-3 p-4 mt-8 bg-gray-50 rounded-2xl">
            <View className="flex-row items-center gap-3">
              <Ionicons name="notifications-outline" size={20} color="#FFA840" />
              <Text className="flex-1 text-sm text-gray-700">
                We&apos;ll notify you as soon as it&apos;s done.
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Ionicons name="compass-outline" size={20} color="#FFA840" />
              <Text className="flex-1 text-sm text-gray-700">
                You can browse the app in the meantime.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.replace("/(drawer)/book")}
            className="items-center w-full py-4 mt-auto mb-6 rounded-xl bg-lightPrimary active:bg-darkPrimary"
          >
            <Text className="text-base font-bold text-white">Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: "#fff"}}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.replace("/(drawer)/book")}
          hitSlop={12}
          className="items-center justify-center w-10 h-10 bg-gray-100 rounded-full active:bg-gray-200"
        >
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-center text-gray-900">
          Face Verification
        </Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 gap-6 px-6 pt-4">
        <View className="items-center">
          <View className="items-center justify-center w-32 h-32 mb-5 rounded-full bg-orange-50">
            <View className="items-center justify-center w-24 h-24 bg-orange-100 rounded-full">
              <Ionicons name="scan-outline" size={52} color="#FFA840" />
              <View className="absolute items-center justify-center bg-white rounded-full w-9 h-9 -bottom-1 -right-1">
                <Ionicons name="happy" size={22} color="#ED8718" />
              </View>
            </View>
          </View>
          <Text className="text-2xl font-extrabold text-center text-gray-900">
            Verify it&apos;s really you
          </Text>
          <Text className="mt-2 text-sm leading-6 text-center text-gray-500">
            A quick live face scan keeps every FastMet account real and unique.
          </Text>
          <View className="flex-row items-center gap-1 px-3 py-1 mt-3 rounded-full bg-orange-50">
            <Ionicons name="timer-outline" size={14} color="#ED8718" />
            <Text className="text-xs font-semibold text-darkPrimary">
              Takes about 10 seconds
            </Text>
          </View>
        </View>

        <View className="gap-4 p-4 border border-gray-100 bg-gray-50 rounded-2xl">
          {TIPS.map((tip) => (
            <View key={tip.title} className="flex-row items-center gap-3">
              <View className="items-center justify-center w-10 h-10 bg-white rounded-full">
                <Ionicons name={tip.icon} size={20} color="#FFA840" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {tip.title}
                </Text>
                <Text className="text-xs leading-4 text-gray-500">
                  {tip.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {phase.notice ? (
          <View className="flex-row items-start gap-2 p-4 border border-red-200 rounded-xl bg-red-50">
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text className="flex-1 text-sm leading-5 text-red-700">
              {phase.notice}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="px-6 pb-6">
        <View className="flex-row items-center justify-center gap-1 mb-3">
          <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />
          <Text className="text-xs text-gray-400">
            Your scan is encrypted and only used to verify you.
          </Text>
        </View>
        <Pressable
          className={`flex-row items-center justify-center gap-2 py-4 rounded-xl bg-lightPrimary active:bg-darkPrimary ${starting ? "opacity-50" : ""}`}
          onPress={onStart}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="camera-outline" size={20} color="#fff" />
          )}
          <Text className="text-base font-bold text-white">
            {starting ? "Starting..." : "Start face scan"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
