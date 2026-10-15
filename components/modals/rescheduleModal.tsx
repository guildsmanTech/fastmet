import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

const getMinTime = () => {
  const min = new Date();
  min.setHours(min.getHours() + 3);
  return min;
};

const isToday = (date: Date) => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export default function RescheduleModal({
  visible,
  onClose,
  onConfirm,
  isSubmitting,
  requiresDriverConfirmation = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (isoTime: string) => void;
  isSubmitting?: boolean;
  /** When true, assigned driver must keep/decline after confirm. */
  requiresDriverConfirmation?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(getMinTime());
  const [selectedTime, setSelectedTime] = useState(getMinTime());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const min = getMinTime();
      setSelectedDate(min);
      setSelectedTime(min);
      setShowCalendar(false);
      setShowTimePicker(false);
    }
  }, [visible]);

  const handleConfirm = () => {
    let combined: Date;

    if (Platform.OS === "ios") {
      combined = selectedDate;
    } else {
      combined = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes(),
      );
    }

    const minDateTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (combined < minDateTime) {
      Toast.show({
        type: "info",
        text1: "Invalid schedule time",
        text2: "Pickup time must be at least 2 hours from now",
      });
      return;
    }

    const maxDateTime = new Date();
    maxDateTime.setMonth(maxDateTime.getMonth() + 1);
    if (combined > maxDateTime) {
      Toast.show({
        type: "info",
        text1: "Invalid schedule time",
        text2: "Pickup time cannot be more than 1 month from now",
      });
      return;
    }

    onConfirm(combined.toISOString());
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="items-center justify-center flex-1 bg-black/40">
        <View className="w-11/12 p-5 bg-white rounded-2xl">
          <View className="relative flex-row items-center justify-center mb-4">
            <Pressable
              hitSlop={20}
              className="absolute -top-1 left-1"
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Ionicons
                name="close"
                color="#FFA840"
                size={Platform.OS === "ios" ? 28 : 24}
              />
            </Pressable>
            <Text className="text-lg font-bold">Reschedule pickup</Text>
          </View>

          <Text className="mb-3 text-sm text-center text-gray-500">
            Choose a time at least 2 hours from now (max 1 month).
          </Text>

          {requiresDriverConfirmation && (
            <View className="flex-row items-start gap-2 p-3 mb-4 rounded-xl border border-amber-200 bg-amber-50">
              <Ionicons name="alert-circle" size={18} color="#B45309" />
              <Text className="flex-1 text-xs leading-4 text-amber-900">
                Your assigned driver will need to confirm the new time. If they
                decline, the booking opens again for other drivers.
              </Text>
            </View>
          )}

          {Platform.OS === "ios" ? (
            <>
              <Pressable
                onPress={() => setShowCalendar(true)}
                className="items-center py-3 mb-4 border border-gray-300 rounded-xl"
              >
                <Text className="text-base font-semibold text-gray-800">
                  {selectedDate.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {selectedDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>

              {showCalendar && (
                <>
                  <DateTimePicker
                    value={selectedDate}
                    mode="datetime"
                    display="spinner"
                    onChange={(_, date) => {
                      if (date) setSelectedDate(date);
                    }}
                    minimumDate={new Date(Date.now() + 2.5 * 60 * 60 * 1000)}
                    maximumDate={
                      new Date(new Date().setMonth(new Date().getMonth() + 1))
                    }
                    textColor="#000000"
                    themeVariant="light"
                  />
                  <Pressable
                    onPress={() => setShowCalendar(false)}
                    className="py-3 mb-3 bg-lightPrimary rounded-xl"
                  >
                    <Text className="font-semibold text-center text-white">
                      Done
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setShowCalendar(true);
                  setShowTimePicker(false);
                }}
                className="items-center py-3 mb-3 border border-gray-300 rounded-xl"
              >
                <Text className="text-base font-semibold text-gray-800">
                  {selectedDate.toDateString()}
                </Text>
              </Pressable>

              {showCalendar && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="calendar"
                  onChange={(_, date) => {
                    setShowCalendar(false);
                    if (date) {
                      setSelectedDate(date);
                      setShowTimePicker(true);
                    }
                  }}
                  minimumDate={new Date()}
                  maximumDate={
                    new Date(new Date().setMonth(new Date().getMonth() + 1))
                  }
                />
              )}

              <Pressable
                onPress={() => {
                  setShowCalendar(false);
                  setShowTimePicker(true);
                }}
                className="items-center py-3 mb-3 border border-gray-300 rounded-xl"
              >
                <Text className="text-base font-semibold text-gray-800">
                  {selectedTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>

              {showTimePicker && (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="clock"
                  onChange={(_, time) => {
                    setShowTimePicker(false);
                    if (!time) return;

                    const selected = new Date(selectedDate);
                    selected.setHours(time.getHours(), time.getMinutes(), 0, 0);

                    if (isToday(selectedDate)) {
                      const minTime = getMinTime();
                      if (selected < minTime) {
                        Toast.show({
                          type: "info",
                          text1: "Invalid time",
                          text2:
                            "Pickup time must be at least 2 hours from now",
                        });
                        setSelectedTime(minTime);
                        return;
                      }
                    }

                    setSelectedTime(selected);
                  }}
                  is24Hour={false}
                />
              )}
            </>
          )}

          {!showCalendar && !showTimePicker && (
            <Pressable
              onPress={handleConfirm}
              disabled={isSubmitting}
              className={`py-3 bg-lightPrimary rounded-xl ${isSubmitting ? "opacity-50" : ""}`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-semibold text-center text-white">
                  {requiresDriverConfirmation
                    ? "Request new time"
                    : "Confirm new time"}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
