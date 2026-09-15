import {useCancelBookingTimer} from "@/hooks/useCancelBookingTimer";
import {useSocket} from "@/sockets/context/SocketProvider";
import {Ionicons} from "@expo/vector-icons";
import React, {useState} from "react";
import {ActivityIndicator, Alert, Pressable, Text, View} from "react-native";
import Toast from "react-native-toast-message";

interface CancelBookingButtonProps {
  bookingId: string;
  referenceTime: Date | null; // activeAt, scheduled start, or last completed stop time
  graceMinutes: number; // 50 for driver no-show
  onCancelled?: () => void;
}

export default function CancelBookingButton({
  bookingId,
  referenceTime,
  graceMinutes,
  onCancelled,
}: CancelBookingButtonProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const socket = useSocket();

  const {canCancel, remainingMinutes, remainingSeconds} = useCancelBookingTimer(
    referenceTime,
    graceMinutes,
  );

  const handleCancel = () => {
    Alert.alert(
      "Cancel Booking - Driver No-Show",
      "Are you sure the driver is not showing up? This action cannot be undone.",
      [
        {text: "No, Wait Longer", style: "cancel"},
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);

            // Listen for success/error
            const handleSuccess = () => {
              socket.off("bookingCancelled", handleSuccess);
              socket.off("error", handleError);

              Toast.show({
                type: "success",
                text1: "Booking Cancelled",
                text2:
                  "You can report the driver as a no-show through the Customer Support page.",
                position: "top",
                topOffset: 50,
              });

              onCancelled?.();
            };

            const handleError = (error: {text1: string; text2?: string}) => {
              socket.off("bookingCancelled", handleSuccess);
              socket.off("error", handleError);

              setIsCancelling(false);
              Alert.alert(error.text1, error.text2 || "Please try again");
            };

            socket.once("bookingCancelled", handleSuccess);
            socket.once("error", handleError);

            socket.emit("cancelBookingRequest", {
              bookingId,
            });

            // Timeout fallback
            setTimeout(() => {
              socket.off("bookingCancelled", handleSuccess);
              socket.off("error", handleError);
              if (isCancelling) {
                setIsCancelling(false);
                Alert.alert("Request timeout", "Please check your connection");
              }
            }, 10000);
          },
        },
      ],
    );
  };

  if (!canCancel) {
    return (
      <View className="px-5 py-3 bg-amber-50 border-t border-amber-100">
        <View className="flex-row gap-2 items-center">
          <Ionicons name="time-outline" size={20} color="#F59E0B" />
          <Text className="text-sm text-amber-700">
            You can cancel if driver doesn't arrive in{" "}
            <Text className="font-bold">
              {remainingMinutes}:{remainingSeconds.toString().padStart(2, "0")}
            </Text>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="px-5 py-3 bg-red-50 border-t border-red-100">
      <Pressable
        onPress={handleCancel}
        disabled={isCancelling}
        className="flex-row gap-2 justify-center items-center py-3 bg-red-500 rounded-xl active:opacity-80"
      >
        {isCancelling ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons name="close-circle" size={20} color="white" />
            <Text className="font-bold text-white">
              Cancel - Driver No-Show
            </Text>
          </>
        )}
      </Pressable>
      <Text className="mt-2 text-xs text-center text-red-600">
        Grace period has elapsed. Report this incident?
      </Text>
    </View>
  );
}
