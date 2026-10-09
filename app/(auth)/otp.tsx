import CustomKeyAvoidingView from "@/components/CustomKeyAvoid";
import { Countdown } from "@/components/Timers";
import { ApprovalStatus } from "@/store/slices/authSlice";
import { useAppStore } from "@/store/useAppStore";
import { UserAddress } from "@/types/user";
import {
  handleSendOtpError,
  routeAuthGuardError,
} from "@/utils/helpers/authGuardErrors";
import { getDeviceId } from "@/utils/helpers/deviceId";
import { formatPHNumber } from "@/utils/helpers/format";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export const RESEND_TIMEOUT_SECONDS = 60;
export const RESEND_KEY = "resend_available_at";
const OTP_VALIDITY_SECONDS = 300;

type LoginResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  client: {
    id: string;
    phoneNumber: string;
    registrationStep: number;
    approvalStatus: ApprovalStatus;
    fullName: string;
    profilePictureUrl: string;
    address: UserAddress | null;
    gender?: "male" | "female";
    preRegistered: boolean;
    email: string | null;
    deletionStatus?: "active" | "pending_deletion" | "deleted";
    deletionScheduledAt?: string | null;
  };
  status: "new" | "existing" | "pre-registered";
};

export default function PhoneOTPScreen() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const setLoading = useAppStore((state) => state.setLoading);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const pendingVerifyToken = useRef<string | null>(null);

  const [initialResendSeconds, setInitialResendSeconds] = useState(
    RESEND_TIMEOUT_SECONDS,
  );
  const [canResend, setCanResend] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpTimerKey, setOtpTimerKey] = useState(0);
  const [resendTimerKey, setResendTimerKey] = useState(0);

  useEffect(() => {
    const initCountdown = async () => {
      const stored = await SecureStore.getItemAsync(RESEND_KEY);
      if (!stored) {
        setCanResend(true);
        return;
      }

      const availableAt = Number(stored);
      const remaining = Math.ceil((availableAt - Date.now()) / 1000);

      if (remaining > 0) {
        setInitialResendSeconds(remaining);
        setCanResend(false);
      } else {
        await SecureStore.deleteItemAsync(RESEND_KEY);
        setCanResend(true);
      }
    };

    initCountdown();
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }, []);

  const clearOTPInputs = () => {
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const resetTimers = () => {
    setOtpTimerKey((k) => k + 1);
    setResendTimerKey((k) => k + 1);
    setCanResend(false);
    setOtpExpired(false);
  };

  const handleResendOtp = async () => {
    if (!canResend || isResending) return;

    const deviceId = await getDeviceId();

    try {
      setIsResending(true);
      setLoading(true);

      await axios.post(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/send-otp-client`,
        {
          phoneNumber: useAppStore.getState().phoneNumber,
          deviceId,
        },
      );

      const availableAt = Date.now() + RESEND_TIMEOUT_SECONDS * 1000;
      await SecureStore.setItemAsync(RESEND_KEY, String(availableAt));

      setInitialResendSeconds(RESEND_TIMEOUT_SECONDS);
      setIsLocked(false);
      pendingVerifyToken.current = null;
      resetTimers();
      clearOTPInputs();
      setError("");

      Toast.show({
        type: "success",
        text1: "Code sent",
        text2: "Please check your messages",
        position: "top",
        visibilityTime: 5000,
        topOffset: 50,
      });
    } catch (error: any) {
      if (
        handleSendOtpError(
          error,
          {
            deviceId,
            phoneNumber: useAppStore.getState().phoneNumber ?? "",
          },
          { onRetry: handleResendOtp },
        )
      )
        return;
    } finally {
      setIsResending(false);
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;

    // Handle paste — distribute digits across boxes
    if (value.length > 1) {
      const digits = value
        .replace(/\D/g, "")
        .slice(0, 6 - index)
        .split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        newOtp[index + i] = d;
      });
      setOtp(newOtp);
      setError("");
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      if (newOtp.every((d) => d)) {
        setTimeout(() => handleVerifyOTP(newOtp.join("")), 200);
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && value && newOtp.every((d) => d)) {
      setTimeout(() => handleVerifyOTP(newOtp.join("")), 300);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ─── Login ──────────────────────────────────────────────────────────────────
  const attemptLogin = async (verifyToken: string) => {
    setIsVerifying(true);
    setLoading(true);
    try {
      const deviceId = await getDeviceId();

      const { data } = await axios.post<LoginResponse>(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/client/auth/login`,
        { deviceId },
        { headers: { Authorization: `Bearer ${verifyToken}` } },
      );

      if (data.success) {
        pendingVerifyToken.current = null;
        await SecureStore.deleteItemAsync(RESEND_KEY);

        useAppStore.getState().setAuthData({
          token: data.accessToken,
          refreshToken: data.refreshToken,
          id: data.client.id,
          phoneNumber: data.client.phoneNumber,
          registrationStep: data.client.registrationStep ?? 1,
          approvalStatus: data.client.approvalStatus ?? "pending",
          name: data.client.fullName,
          profilePictureUrl: data.client.profilePictureUrl,
          address: data.client.address,
          gender: data.client.gender,
          preRegistered: data.client.preRegistered,
          email: data.client.email,
        });

        if (data.client.deletionStatus === "pending_deletion") {
          Toast.show({
            type: "info",
            text1: "Account pending deletion",
            text2: "Cancel deletion to keep using Fastmet.",
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
          router.replace({
            pathname: "/(auth)/account-pending-deletion",
            params: {
              scheduledAt: data.client.deletionScheduledAt
                ? String(data.client.deletionScheduledAt)
                : "",
            },
          });
          return;
        }

        const message =
          data.status === "existing"
            ? "Welcome to FastMet"
            : "Thank you for pre-registering with Fastmet";

        const step = data.client.registrationStep ?? 1;
        const status = data.client.approvalStatus ?? "pending";

        if (status === "approved") {
          Toast.show({
            type: "success",
            text1: "Verified!",
            text2: message,
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
        } else if (step < 2) {
          Toast.show({
            type: "info",
            text1: "Complete your profile to book",
            text2: "You can skip this step for now.",
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
          router.replace("/(auth)/profile-register");
        } else if (step < 3) {
          Toast.show({
            type: "info",
            text1: "ID verification required to book",
            text2: "Submit your ID when you are ready.",
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
          router.replace("/(auth)/id-verification");
        } else if (status === "rejected") {
          Toast.show({
            type: "error",
            text1: "Verification rejected",
            text2: "Please resubmit your documents to book.",
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
          router.replace("/(auth)/verification-resubmit");
        } else {
          Toast.show({
            type: "info",
            text1: "Verification in progress",
            text2: "You can browse while we review your account.",
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
        }

        router.replace("/(drawer)/book");
      }
    } catch (error: any) {
      const statusCode: number | undefined = error.response?.status;

      if (
        routeAuthGuardError(error, {
          deviceId: await getDeviceId(),
          phoneNumber: useAppStore.getState().phoneNumber ?? "",
        })
      ) {
        pendingVerifyToken.current = null;
        return;
      }

      if (statusCode === 401) {
        // verifyToken JWT expired between verify and login steps
        pendingVerifyToken.current = null;
        Alert.alert("Session Expired", "Please verify your number again.");
      } else {
        // Transient failure (500, network) — allow retry with cached verifyToken
        Alert.alert(
          "Login Failed",
          "Couldn't connect. Tap Retry to try again.",
          [
            {
              text: "Retry",
              onPress: () => {
                if (pendingVerifyToken.current) {
                  attemptLogin(pendingVerifyToken.current);
                }
              },
            },
            { text: "Cancel" },
          ],
        );
      }
    } finally {
      setIsVerifying(false);
      setLoading(false);
    }
  };

  // ─── Verify ─────────────────────────────────────────────────────────────────
  const handleVerifyOTP = async (code?: string) => {
    if (isLocked || otpExpired || isVerifying) return;

    const otpCode = code ?? otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setIsVerifying(true);
    setLoading(true);
    setError("");

    let verifyToken: string;
    try {
      const { data: otpData } = await axios.post<{
        success: boolean;
        verifyToken: string;
      }>(`${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/verify-otp`, {
        phoneNumber: useAppStore.getState().phoneNumber,
        otpCode,
      });
      verifyToken = otpData.verifyToken;
    } catch (error: any) {
      const statusCode: number | undefined = error.response?.status;
      const errorMessage: string | undefined = error.response?.data?.error;

      if (statusCode === 400) {
        if (errorMessage?.includes("expired")) {
          setOtpExpired(true);
          Alert.alert(
            "Code Expired",
            "Your verification code has expired. Please request a new one.",
          );
        } else if (
          errorMessage?.includes("locked") ||
          errorMessage?.includes("attempts")
        ) {
          setIsLocked(true);
          clearOTPInputs();
          Alert.alert(
            "Too Many Failed Attempts",
            "This code has been invalidated. Please request a new one.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Request New Code",
                onPress: () => setIsLocked(false),
              },
            ],
          );
        } else {
          setError(
            errorMessage ?? "Invalid verification code. Please try again.",
          );
          clearOTPInputs();
        }
      } else if (statusCode === 429) {
        const retryAfter = error.response?.data?.retryAfter;
        const minutes = retryAfter ? Math.ceil(retryAfter / 60) : null;
        setError(
          errorMessage ??
          (minutes
            ? `Too many failed attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`
            : "Too many attempts. Please try again later."),
        );
      } else {
        setError("Verification failed. Please try again.");
        clearOTPInputs();
      }

      setIsVerifying(false);
      setLoading(false);
      return;
    }

    // OTP verified — cache the token, then attempt login
    pendingVerifyToken.current = verifyToken;
    setIsVerifying(false);
    setLoading(false);

    await attemptLogin(verifyToken);
  };

  const isLoading = isVerifying || isResending;
  const otpFilled = otp.join("").length === 6;
  const canVerify = otpFilled && !isLoading && !isLocked && !otpExpired;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <CustomKeyAvoidingView>
        <View className="flex-1 justify-center items-center px-6">
          {/* Title */}
          <Text className="text-3xl font-extrabold text-[#111] mb-3">
            Verify Your Number
          </Text>

          {/* Subtitle */}
          <Text className="mb-2 text-base leading-6 text-center text-gray-500">
            Enter the 6-digit verification code sent to{" "}
            <Text className="font-semibold text-[#111] underline">
              {formatPHNumber(useAppStore.getState().phoneNumber)}
            </Text>
          </Text>

          {/* OTP expiry countdown */}
          <View className="flex-row gap-1 items-center mb-8">
            <Ionicons
              name="time-outline"
              size={14}
              color={otpExpired ? "#DC2626" : "#6B7280"}
            />
            {otpExpired ? (
              <Text className="text-sm font-medium text-red-600">
                Code expired — please request a new one
              </Text>
            ) : (
              <View className="flex-row gap-1 items-center">
                <Text className="text-sm text-gray-500">Code expires in</Text>
                <Countdown
                  key={otpTimerKey}
                  seconds={OTP_VALIDITY_SECONDS}
                  onExpire={() => setOtpExpired(true)}
                  className="text-sm font-medium text-gray-500"
                />
              </View>
            )}
          </View>

          {/* OTP Inputs */}
          <View className="flex-row justify-between mb-4 w-full">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref: TextInput | null) => {
                  inputRefs.current[index] = ref;
                }}
                className={`w-14 h-16 rounded-2xl text-center text-2xl font-bold border-2
                  ${digit ? "bg-orange-100 border-darkPrimary" : "bg-white border-gray-300"}
                  ${error ? "border-red-500" : ""}
                  ${isLocked || otpExpired ? "opacity-40" : ""}
                `}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                editable={!isLoading && !isLocked && !otpExpired}
                autoFocus={index === 0}
              />
            ))}
          </View>

          {/* Error Banner */}
          {error ? (
            <View
              className="flex-row gap-2 justify-center items-center px-4 py-3 mb-5 w-full bg-red-50 rounded-xl border border-red-200"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text className="flex-1 text-sm leading-5 text-red-700">
                {error}
              </Text>
            </View>
          ) : null}

          {/* Locked Banner */}
          {isLocked ? (
            <View className="flex-row items-center px-4 py-3 mb-5 w-full bg-yellow-50 rounded-xl border border-yellow-300">
              <Ionicons name="lock-closed" size={18} color="#D97706" />
              <Text className="flex-1 ml-2 text-sm leading-5 text-yellow-800">
                Code locked. Please request a new one below.
              </Text>
            </View>
          ) : null}

          {/* Resend */}
          <View className="items-center mb-10">
            <Text className="mb-1 text-sm text-gray-600">
              Didn&apos;t receive the code?
            </Text>

            {canResend ? (
              <Pressable
                disabled={isResending}
                onPress={handleResendOtp}
                className="active:opacity-70"
              >
                {isResending ? (
                  <ActivityIndicator color="#FF8A00" size="small" />
                ) : (
                  <Text className="text-base font-semibold text-darkPrimary">
                    Resend Code
                  </Text>
                )}
              </Pressable>
            ) : (
              <View className="flex-row gap-1 items-center">
                <Text className="text-base font-semibold text-gray-400">
                  Resend in{" "}
                </Text>
                <Countdown
                  key={resendTimerKey}
                  seconds={initialResendSeconds}
                  onExpire={() => setCanResend(true)}
                  className="text-base font-semibold text-gray-400"
                />
              </View>
            )}
          </View>

          {/* Verify Button */}
          <Pressable
            onPress={() => handleVerifyOTP()}
            disabled={!canVerify}
            className={`rounded-xl py-4 items-center w-full mb-4 active:bg-darkPrimary
              ${canVerify ? "bg-lightPrimary" : "opacity-50 bg-lightPrimary"}
            `}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {isLocked ? "Locked" : otpExpired ? "Code Expired" : "Verify"}
              </Text>
            )}
          </Pressable>

          {/* Change Number */}
          <Pressable
            onPress={() => router.push("/(auth)/auth")}
            disabled={isLoading}
            className="items-center active:opacity-70"
          >
            <Text className="text-sm font-medium text-gray-600">
              Wrong number? Change it
            </Text>
          </Pressable>
        </View>
      </CustomKeyAvoidingView>
    </SafeAreaView>
  );
}
