// config/toastConfig.tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

export const toastConfig = {
  bookingAccepted: ({ text1, text2 }: any) => (
    <View className="bg-white mx-4 rounded-2xl shadow-lg border border-gray-200 p-4 flex-row items-center justify-between">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text className="font-bold text-gray-800">{text1}</Text>
        </View>
        <Text numberOfLines={2} className="text-gray-600 text-sm">
          {text2}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          Toast.hide();
          router.dismissTo("/(drawer)/(tabs)/request?tab=active"); // Navigate to requests tab
        }}
        className="bg-primary px-4 py-2 rounded-lg ml-3"
      >
        <Text className="font-semibold underline">Track Driver</Text>
      </Pressable>
    </View>
  ),

  driverAccepted: ({ text1, text2 }: any) => (
    <View className="bg-white mx-4 rounded-2xl shadow-lg border border-gray-200 p-4 flex-row items-center justify-between">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text className="font-bold text-gray-800">{text1}</Text>
        </View>
        <Text numberOfLines={2} className="text-gray-600 text-sm">
          {text2}
        </Text>
      </View>
    </View>
  ),

  newMessage: ({ text1, text2, props }: any) => (
    <Pressable
      onPress={() => {
        Toast.hide();
        router.push({
          pathname: "/message",
          params: {
            conversationId: props.conversationId,
          },
        });
      }}
      className="mx-4 mb-2 rounded-2xl bg-white px-4 py-3 flex-row items-center shadow-md active:opacity-80"
    >
      {/* Avatar */}
      {props?.profilePictureUrl ? (
        <Image
          source={{ uri: props.profilePictureUrl }}
          contentFit="cover"
          style={{ width: 48, height: 48, borderRadius: 24 }}
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
          <Ionicons name="person" size={24} color="#9CA3AF" />
        </View>
      )}

      {/* Content */}
      <View className="flex-1 ml-4">
        <Text
          className="font-semibold text-gray-900 text-[15px]"
          numberOfLines={1}
        >
          {text1}
        </Text>

        <Text className="text-gray-500 text-[13px] mt-0.5" numberOfLines={1}>
          {text2}
        </Text>
      </View>

      {/* Unread indicator */}
      <View className="ml-3">
        <View className="w-2.5 h-2.5 rounded-full bg-lightPrimary" />
      </View>
    </Pressable>
  ),
  success: ({ text1, text2 }: any) => (
    <View className="bg-white mx-4 rounded-2xl shadow-lg border border-gray-200 p-4 flex-row items-center justify-between">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text className="font-bold text-gray-800">{text1}</Text>
        </View>
        <Text numberOfLines={2} className="text-gray-600 text-sm">
          {text2}
        </Text>
      </View>
    </View>
  ),
  info: ({ text1, text2 }: any) => (
    <View className="mx-4 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
      <View className="flex-1">
        <View className="mb-1 flex-row items-center gap-2">
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text className="font-bold text-gray-800">{text1}</Text>
        </View>
        <Text numberOfLines={2} className="text-sm text-gray-600">
          {text2}
        </Text>
      </View>
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View className="bg-white mx-4 rounded-2xl shadow-lg border border-gray-200 p-4 flex-row items-center justify-between">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text className="font-bold text-gray-800">{text1}</Text>
        </View>
        <Text numberOfLines={2} className="text-gray-600 text-sm">
          {text2}
        </Text>
      </View>
    </View>
  ),
};
