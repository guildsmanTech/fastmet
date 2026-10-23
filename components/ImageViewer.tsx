import {Ionicons} from "@expo/vector-icons";
import React from "react";
import {Platform, StatusBar, Text, TouchableOpacity, View} from "react-native";
import ImageView from "react-native-image-viewing";
import {useSafeAreaInsets} from "react-native-safe-area-context";

type ImageViewProps = React.ComponentProps<typeof ImageView>;
type ImageSource = ImageViewProps["images"][number];

// Fallback in case Android returns 0 for insets.top (translucent-modal edge case)
const ANDROID_STATUSBAR_FALLBACK = StatusBar.currentHeight ?? 24;

type ImageViewerProps = {
  images: ImageSource[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  onImageIndexChange?: (index: number) => void;
  showCounter?: boolean;
};

function Header({
  imageIndex,
  total,
  showCounter,
  onClose,
}: {
  imageIndex: number;
  total: number;
  showCounter?: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const topPadding =
    Platform.OS === "android"
      ? Math.max(insets.top, ANDROID_STATUSBAR_FALLBACK)
      : insets.top;

  return (
    <View
      className="flex-row items-center justify-between px-4"
      style={{paddingTop: topPadding}}
    >
      {showCounter ? (
        <Text className="text-sm font-semibold text-white">
          {imageIndex + 1} / {total}
        </Text>
      ) : (
        <View />
      )}
      <TouchableOpacity onPress={onClose} hitSlop={12} className="p-2">
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function ImageViewer({
  images,
  imageIndex,
  visible,
  onRequestClose,
  onImageIndexChange,
  showCounter = false,
}: ImageViewerProps) {
  return (
    <ImageView
      images={images}
      imageIndex={imageIndex}
      visible={visible}
      onRequestClose={onRequestClose}
      onImageIndexChange={onImageIndexChange}
      HeaderComponent={({imageIndex: currentIndex}) => (
        <Header
          imageIndex={currentIndex}
          total={images.length}
          showCounter={showCounter}
          onClose={onRequestClose}
        />
      )}
    />
  );
}
