import {sendOTPAccountDeletion} from "@/api/accountDeletion";
import {Countdown} from "@/components/Timers";
import {formatPHNumber} from "@/utils/helpers/format";
import {Ionicons} from "@expo/vector-icons";
import axios from "axios";
import {useEffect, useRef, useState} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

const OTP_VALIDITY_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  phoneNumber: string;
  onVerifySuccess: (verifyToken: string) => void;
  loading?: boolean; // true while parent is submitting the final delete request
};

export default function DeleteAccountOtpModal({
  isOpen,
  setIsOpen,
  phoneNumber,
  onVerifySuccess,
  loading = false,
}: Props) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [otpTimerKey, setOtpTimerKey] = useState(0);
  const [resendTimerKey, setResendTimerKey] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setIsLocked(false);
      setOtpExpired(false);
      setCanResend(false);
      setOtpTimerKey((k) => k + 1);
      setResendTimerKey((k) => k + 1);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const clearInputs = () => {
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;

    if (value.length > 1) {
      const digits = value
        .replace(/\D/g, "")
        .slice(0, 6 - index)
        .split("");
      const next = [...otp];
      digits.forEach((d, i) => (next[index + i] = d));
      setOtp(next);
      setError("");
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      if (next.every((d) => d) && !isVerifying) {
        setTimeout(() => handleVerify(next.join("")), 200);
      }
      return;
    }

    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError("");

    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (index === 5 && value && next.every((d) => d) && !isVerifying) {
      setTimeout(() => handleVerify(next.join("")), 300);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setError("");
    try {
      await sendOTPAccountDeletion();
      clearInputs();
      setIsLocked(false);
      setOtpExpired(false);
      setCanResend(false);
      setOtpTimerKey((k) => k + 1);
      setResendTimerKey((k) => k + 1);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (code?: string) => {
    if (isLocked || otpExpired || isVerifying) return;
    const otpCode = code ?? otp.join("");
    if (otpCode.length !== 6) {
      setError("Enter all 6 digits");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const {data} = await axios.post<{success: boolean; verifyToken: string}>(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/verify-otp`,
        {phoneNumber, otpCode},
      );
      onVerifySuccess(data.verifyToken);
    } catch (err: any) {
      const statusCode: number | undefined = err.response?.status;
      const msg: string | undefined = err.response?.data?.error;

      if (statusCode === 400 && msg?.includes("expired")) {
        setOtpExpired(true);
        setError("Code expired. Please resend.");
      } else if (
        statusCode === 400 &&
        (msg?.includes("locked") || msg?.includes("attempts"))
      ) {
        setIsLocked(true);
        clearInputs();
        setError(msg ?? "Too many failed attempts. Please resend.");
      } else {
        setError(msg ?? "Invalid code. Try again.");
        clearInputs();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  return (
    <Modal
      visible={isOpen}
      statusBarTranslucent
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-center items-center px-5 bg-black/50">
        <View className="gap-4 p-6 w-full max-w-md bg-white rounded-2xl">
          <Text className="text-xl font-bold text-center text-gray-800">
            Verify to Delete Account
          </Text>

          <Text className="text-sm leading-5 text-center text-gray-600">
            Enter the 6-digit code sent to{" "}
            <Text className="font-semibold text-gray-800">
              {formatPHNumber(phoneNumber)}
            </Text>
          </Text>

          <View className="flex-row gap-1 justify-center items-center">
            <Ionicons
              name="time-outline"
              size={14}
              color={otpExpired ? "#DC2626" : "#6B7280"}
            />
            {otpExpired ? (
              <Text className="text-xs font-medium text-red-600">
                Code expired — please resend
              </Text>
            ) : (
              <View className="flex-row gap-1 items-center">
                <Text className="text-xs text-gray-500">Expires in</Text>
                <Countdown
                  key={otpTimerKey}
                  seconds={OTP_VALIDITY_SECONDS}
                  onExpire={() => setOtpExpired(true)}
                  className="text-xs font-medium text-gray-500"
                />
              </View>
            )}
          </View>

          <View className="flex-row justify-between mb-4 w-full">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref: TextInput | null) => {
                  inputRefs.current[index] = ref;
                }}
                className={`w-12 h-14 rounded-2xl text-center text-xl font-bold border-2
                  ${digit ? "bg-orange-100 border-darkPrimary" : "bg-white border-gray-300"}
                  ${error ? "border-red-500" : ""}
                  ${isLocked || otpExpired ? "opacity-40" : ""}
                `}
                value={digit}
                onChangeText={(value) => handleChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                editable={!loading && !isLocked && !otpExpired}
                autoFocus={index === 0}
              />
            ))}
          </View>
          {error ? (
            <Text className="text-xs text-center text-red-500">{error}</Text>
          ) : null}

          <Pressable
            disabled={
              otp.join("").length < 6 ||
              isVerifying ||
              isLocked ||
              otpExpired ||
              loading
            }
            onPress={() => handleVerify()}
            className={`items-center py-3.5 rounded-lg ${
              otp.join("").length === 6 && !isLocked && !otpExpired
                ? "bg-red-600 active:bg-red-700"
                : "bg-red-300"
            }`}
          >
            {isVerifying || loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">
                Verify & Delete
              </Text>
            )}
          </Pressable>

          <View className="items-center">
            <Text className="mb-1 text-sm text-gray-500">
              Didn&apos;t receive the code?
            </Text>
            {canResend ? (
              <Pressable
                disabled={isResending || loading}
                onPress={handleResend}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text className="text-sm font-semibold text-red-600">
                    Resend Code
                  </Text>
                )}
              </Pressable>
            ) : (
              <View className="flex-row gap-1">
                <Text className="text-sm text-gray-400">Resend in</Text>
                <Countdown
                  key={resendTimerKey}
                  seconds={RESEND_COOLDOWN_SECONDS}
                  onExpire={() => setCanResend(true)}
                  className="text-sm text-gray-400"
                />
              </View>
            )}
          </View>

          <Pressable
            disabled={loading}
            onPress={handleClose}
            className="items-center py-3"
          >
            <Text className="text-base font-semibold text-gray-600">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
