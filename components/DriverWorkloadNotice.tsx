import {WorkloadLabel, WorkloadTone} from "@/utils/helpers/driverWorkload";
import {Ionicons} from "@expo/vector-icons";
import React from "react";
import {Text, View} from "react-native";

// Class names live here (Tailwind only scans app/ and components/).
const TONE_STYLES: Record<
  WorkloadTone,
  {
    bg: string;
    pill: string;
    text: string;
    subtext: string;
    icon: string;
    iconName: keyof typeof Ionicons.glyphMap;
  }
> = {
  free: {
    bg: "bg-emerald-50",
    pill: "bg-emerald-100",
    text: "text-emerald-800",
    subtext: "text-emerald-700",
    icon: "#047857",
    iconName: "checkmark-circle-outline",
  },
  busy: {
    bg: "bg-amber-50",
    pill: "bg-amber-100",
    text: "text-amber-800",
    subtext: "text-amber-700",
    icon: "#B45309",
    iconName: "layers-outline",
  },
  priority: {
    bg: "bg-orange-50",
    pill: "bg-orange-100",
    text: "text-orange-800",
    subtext: "text-orange-700",
    icon: "#C2410C",
    iconName: "flash-outline",
  },
};

/**
 * A driver's other work: a small pill (`variant="pill"`) for list rows and
 * cards, or a box with an explanation (`variant="card"`).
 */
export default function DriverWorkloadNotice({
  label,
  variant = "card",
}: {
  label: WorkloadLabel;
  variant?: "pill" | "card";
}) {
  const style = TONE_STYLES[label.tone];

  if (variant === "pill") {
    return (
      <View
        className={`flex-row gap-1 items-center self-start px-2 py-0.5 rounded-full ${style.pill}`}
      >
        <Ionicons name={style.iconName} size={11} color={style.icon} />
        <Text className={`text-[10px] font-semibold ${style.text}`}>
          {label.title}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-row gap-3 p-4 rounded-xl ${style.bg}`}>
      <Ionicons name={style.iconName} size={22} color={style.icon} />
      <View className="flex-1">
        <Text className={`text-sm font-bold ${style.text}`}>{label.title}</Text>
        <Text className={`mt-1 text-xs leading-5 ${style.subtext}`}>
          {label.detail}
        </Text>
      </View>
    </View>
  );
}
