import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Text, View } from "react-native";
import { Bubble } from "react-native-gifted-chat";

export const renderChatBubble = (props: any) => (
  <Bubble
    {...props}
    wrapperStyle={{
      right: {
        backgroundColor: "#FFA840",
      },
      left: {
        backgroundColor: "#E5E5E5",
      },
    }}
    textStyle={{
      right: {
        color: "white",
        fontSize: 15,
      },
      left: {
        color: "#1F2937",
        fontSize: 15,
      },
    }}
  />
);

export const renderChatEmpty = () => (
  <View
    className="items-center px-6 pb-20"
    style={{
      transform: [{ scaleY: -1 }, { scaleX: Platform.OS === "android" ? -1 : 1 }],
    }}
  >
    <Ionicons name="chatbubbles-outline" size={100} color="#9CA3AF" />
    <Text className="mt-4 text-xl font-semibold text-gray-300">
      No conversation yet
    </Text>
    <Text className="mt-2 text-base text-center text-gray-400">
      Start a conversation with your driver
    </Text>
  </View>
);

export const ChatReadOnlyNotice = () => (
  <View className="px-4 py-4 border-t border-gray-700 bg-secondary">
    <Text className="text-center text-gray-400">
      This chat is read-only because the booking has ended.
    </Text>
  </View>
);

export const fullName = (
  first?: string | null,
  last?: string | null,
  fallback = "",
) => [first, last].filter(Boolean).join(" ").trim() || fallback;
