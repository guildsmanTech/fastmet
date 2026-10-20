import {Ionicons} from "@expo/vector-icons";
import React from "react";
import {Linking, Pressable, ScrollView, Text, View} from "react-native";

export default function ContactTab() {
  const handleEmail = () => {
    Linking.openURL(`mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL}`);
  };

  return (
    <ScrollView
      className="flex-1 px-5 py-6"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{paddingBottom: 40}}
    >
      <View className="items-center mb-6">
        <View className="justify-center items-center mb-4 w-20 h-20 bg-blue-100 rounded-full">
          <Ionicons name="headset" size={40} color="#3B82F6" />
        </View>
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          Contact Support
        </Text>
        <Text className="text-center text-gray-600">
          We&apos;re here to help with any questions or concerns
        </Text>
      </View>

      <Pressable
        onPress={handleEmail}
        className="flex-row justify-between items-center px-4 py-3  mb-3 bg-white rounded-2xl border border-gray-200 active:bg-gray-50"
      >
        <View className="flex-row gap-4 items-center">
          <View className="justify-center items-center w-12 h-12 bg-blue-100 rounded-full">
            <Ionicons name="mail" size={24} color="#3B82F6" />
          </View>
          <View>
            <Text className="text-base font-semibold text-gray-900">
              Email Us
            </Text>
            <Text className="text-sm text-gray-500">
              {process.env.EXPO_PUBLIC_SUPPORT_EMAIL}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
      </Pressable>

      <View className="mt-6">
        <Text className="mb-3 text-sm font-semibold text-gray-700">
          Support Hours
        </Text>
        <View className="p-4 bg-gray-50 rounded-xl">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Monday - Friday</Text>
            <Text className="font-semibold text-gray-900">
              8:00 AM - 8:00 PM
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Saturday</Text>
            <Text className="font-semibold text-gray-900">
              9:00 AM - 6:00 PM
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Sunday</Text>
            <Text className="font-semibold text-gray-900">
              10:00 AM - 4:00 PM
            </Text>
          </View>
        </View>
      </View>

      {/* <View className="p-4 mt-6 bg-blue-50 rounded-xl">
        <View className="flex-row gap-2 items-start">
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <View className="flex-1">
            <Text className="mb-1 font-semibold text-blue-900">
              Emergency Support
            </Text>
            <Text className="text-sm text-blue-700">
              For urgent matters during active trips, use the in-app SOS button
              on your active booking screen.
            </Text>
          </View>
        </View>
      </View> */}
    </ScrollView>
  );
}
