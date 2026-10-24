import {
  ACCOUNT_DEACTIVATED_ROUTE,
  accountBannedRoute,
  DEVICE_BANNED_ROUTE,
} from "@/constants/routes";
import {router} from "expo-router";
import {Alert} from "react-native";

interface AuthGuardContext {
  deviceId?: string;
  phoneNumber?: string;
}

export function routeAuthGuardError(
  error: {response?: {status?: number; data?: Record<string, unknown>}},
  context: AuthGuardContext = {},
): boolean {
  const status = error.response?.status;
  const data = error.response?.data;

  if (status !== 403) return false;

  // Account ban outranks every other restriction (same order as the server).
  if (data?.accountBanned) {
    router.replace(accountBannedRoute(data));
    return true;
  }

  if (data?.deviceBanned) {
    router.replace(DEVICE_BANNED_ROUTE);
    return true;
  }

  if (data?.deviceBlocked) {
    router.push({
      pathname: "/(auth)/device-blocked",
      params: {
        deviceId: context.deviceId ?? "",
        phoneNumber: context.phoneNumber ?? "",
        requestStatus: (data.requestStatus as string) ?? "none",
        adminNote: (data.adminNote as string) ?? "",
      },
    });
    return true;
  }

  if (data?.accountDeactivated) {
    router.replace(ACCOUNT_DEACTIVATED_ROUTE);
    return true;
  }

  if (data?.accountSuspended) {
    router.replace({
      pathname: "/(auth)/account-suspended",
      params: {
        suspendedUntil: (data.suspendedUntil as string) ?? "",
        suspensionReason: (data.suspensionReason as string) ?? "",
      },
    });
    return true;
  }

  return false;
}

export function handleSendOtpError(
  error: {
    response?: {status?: number; data?: Record<string, unknown>};
  },
  context: AuthGuardContext = {},
  options?: {onRetry?: () => void},
): boolean {
  if (routeAuthGuardError(error, context)) return true;

  const statusCode = error.response?.status;
  const errorMessage = error.response?.data?.error as string | undefined;

  if (statusCode === 429) {
    Alert.alert(
      "Too Many Requests",
      errorMessage ??
        "Too many OTP requests. Please wait a minute and try again.",
    );
    return true;
  }

  if (statusCode === 400) {
    Alert.alert(
      "Invalid Number",
      errorMessage ?? "Please enter a valid Philippine mobile number.",
    );
    return true;
  }

  if (statusCode === 401) {
    Alert.alert(
      "Invalid Number",
      errorMessage ?? "Failed to get device ID. Please try again.",
    );
    return true;
  }

  if (statusCode === 500) {
    Alert.alert(
      "Service Unavailable",
      "SMS service is temporarily unavailable. Please try again later.",
    );
    return true;
  }

  Alert.alert(
    "Connection Error",
    "Failed to send OTP. Please check your internet connection and try again.",
    options?.onRetry
      ? [{text: "Retry", onPress: options.onRetry}, {text: "Cancel"}]
      : [{text: "OK"}],
  );
  return true;
}
