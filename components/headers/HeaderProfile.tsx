import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";

const HeaderProfile = ({
  title,
  fallbackHref,
}: {
  title: string;
  fallbackHref?: Href;
}) => {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <View className="flex-row items-center justify-center">
      <Pressable
        className={`absolute ${Platform.OS === "ios" ? "-top-2 -left-2" : "-top-1 left-0"}`}
        onPress={handleBack}
        hitSlop={{ top: 30, left: 30, bottom: 30, right: 30 }}
      >
        <Ionicons
          name="chevron-back"
          size={Platform.OS === "ios" ? 34 : 28}
          color="#FFA840"
        />
      </Pressable>

      {/* Center: Icon + Title */}
      <View className="w-full flex-row items-center justify-center gap-2">
        <Text className="text-lg font-bold text-white">{title}</Text>
      </View>
    </View>
  );
};

export default HeaderProfile;
