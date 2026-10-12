import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, Text, View } from "react-native";

type ClientReportStatus = "pending" | "resolved" | "dismissed";

type Props = {
  canReport: boolean;
  reportStatus?: ClientReportStatus | null;
  onPressReport: () => void;
};

/** Right-side action next to driver: Report, or waiting / reviewed after filing. */
export default function BookingReportAction({
  canReport,
  reportStatus,
  onPressReport,
}: Props) {
  const iconSize = Platform.OS === "ios" ? 28 : 24;

  if (reportStatus === "pending") {
    return (
      <View className="items-center max-w-[88px]">
        <Ionicons name="hourglass-outline" size={iconSize} color="#F7931E" />
        <Text className="text-xs text-center text-gray-600" numberOfLines={2}>
          Waiting for admin&apos;s review
        </Text>
      </View>
    );
  }

  if (reportStatus === "resolved" || reportStatus === "dismissed") {
    return (
      <View className="items-center max-w-[88px]">
        <Ionicons
          name="checkmark-done-outline"
          size={iconSize}
          color="#6B7280"
        />
        <Text className="text-xs text-center text-gray-500" numberOfLines={2}>
          Report reviewed
        </Text>
      </View>
    );
  }

  if (!canReport) return null;

  return (
    <Pressable
      className="items-center active:scale-110"
      hitSlop={20}
      onPress={(e) => {
        e.stopPropagation?.();
        onPressReport();
      }}
    >
      <Ionicons name="flag-outline" size={iconSize} color="#F7931E" />
      <Text className="text-sm text-gray-600">Report</Text>
    </Pressable>
  );
}
