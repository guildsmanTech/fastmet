import {Ionicons} from "@expo/vector-icons";
import {Pressable, Text, View} from "react-native";

/**
 * Entry point to the tip sheet. Shows the current tip, or an invitation to add
 * one. `dark` is for the searching screen's map overlay.
 */
export default function TipButton({
  tipAmount,
  locked,
  onPress,
  variant = "light",
}: {
  tipAmount: number;
  locked: boolean;
  onPress: () => void;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  const hasTip = tipAmount > 0;

  const title = hasTip
    ? `₱${tipAmount.toLocaleString("en-US")} tip added`
    : "Add a tip";
  const subtitle = hasTip
    ? locked
      ? "Drivers are offering · you can still raise it"
      : "Drivers can see it · tap to change"
    : "Drivers see it right away. It can get you a driver faster.";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasTip ? `Change tip, currently ${title}` : "Add a tip"}
      className={`flex-row gap-3 items-center px-4 py-3 rounded-2xl border active:opacity-80 ${
        dark
          ? hasTip
            ? "bg-green-500/20 border-green-400/50"
            : "bg-white/10 border-white/25"
          : hasTip
            ? "bg-green-50 border-green-200"
            : "bg-white border-dashed border-lightPrimary"
      }`}
    >
      <View
        className={`justify-center items-center rounded-full size-9 ${
          hasTip ? "bg-green-500" : dark ? "bg-orange-500" : "bg-orange-100"
        }`}
      >
        <Ionicons
          name="gift"
          size={18}
          color={hasTip || dark ? "white" : "#ED8718"}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-bold ${
            dark ? "text-white" : hasTip ? "text-green-800" : "text-gray-900"
          }`}
        >
          {title}
        </Text>
        <Text
          className={`text-xs ${
            dark ? "text-gray-300" : hasTip ? "text-green-700" : "text-gray-500"
          }`}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <Text
        className={`text-sm font-semibold ${
          dark ? "text-orange-300" : hasTip ? "text-green-700" : "text-darkPrimary"
        }`}
      >
        {hasTip ? "Change" : "Add"}
      </Text>
    </Pressable>
  );
}
