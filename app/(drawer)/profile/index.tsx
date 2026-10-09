import NotLoggedIn from "@/components/notLoggedIn";
import {PreRegBadge} from "@/components/PreRegBadge";
import {useAuth} from "@/hooks/useAuth";
import {useAppStore} from "@/store/useAppStore";
import {formatPHNumber} from "@/utils/helpers/format";
import {pushOnce} from "@/utils/helpers/navigation";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import React from "react";
import {Pressable, ScrollView, Text, View} from "react-native";

export default function MyProfile() {
  const {isLoggedIn} = useAuth();
  const name = useAppStore((state) => state.name);
  const profilePictureUrl = useAppStore((state) => state.profilePictureUrl);
  const gender = useAppStore((state) => state.gender);
  const address = useAppStore((state) => state.address);
  const options = [
    {
      icon: "person",
      label: "Edit Profile",
      onPress: () => pushOnce("/(drawer)/profile/editProfile"),
    },
    {
      icon: "document-text",
      label: "My Documents",
      onPress: () => pushOnce("/(drawer)/profile/myDocument"),
    },
    {
      icon: "settings",
      label: "Settings",
      onPress: () => pushOnce("/(drawer)/settings"),
    },
  ];

  if (!isLoggedIn) return <NotLoggedIn />;

  return (
    <ScrollView
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{paddingBottom: 60}}
    >
      <View className="items-center gap-4 pt-12 pb-8">
        {/* Profile Image with Border */}
        <View className="relative p-2 border rounded-full border-lightPrimary">
          {profilePictureUrl ? (
            <Image
              source={{uri: profilePictureUrl}}
              style={{width: 120, height: 120, borderRadius: 999}}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="person-circle" size={120} color="#F7931E" />
          )}

          {useAppStore.getState().approvalStatus === "approved" && (
            <View
              className="absolute items-center justify-center bg-white rounded-full bottom-1 right-1"
              style={{width: 28, height: 28}}
            >
              <Ionicons name="shield-checkmark" size={26} color="#2563EB" />
            </View>
          )}
        </View>

        {/* User Info */}
        <View className="items-center gap-1">
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-xl font-bold text-gray-800">{name}</Text>
            {!gender ? null : gender === "male" ? (
              <Ionicons name="male" size={20} color="#FFA840" />
            ) : (
              <Ionicons name="female" size={20} color="#FFA840" />
            )}
          </View>
          {useAppStore.getState().preRegistered && <PreRegBadge />}

          <Text className="text-base text-gray-400">
            {formatPHNumber(useAppStore.getState().phoneNumber)}
          </Text>
          {address && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={20} color="#FFA840" />
              <Text
                className="text-base text-gray-400 max-w-[70%]"
                numberOfLines={1}
              >
                {address?.fullAddress}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Menu Items */}
      <View className="gap-3 px-4">
        {options.map((item, index) => (
          <Pressable
            key={index}
            onPress={item.onPress}
            className="flex-row items-center px-5 py-3 bg-gray-100 rounded-2xl active:opacity-70"
          >
            <View className="items-center justify-center w-10 h-10">
              <Ionicons name={item.icon as any} size={22} color="#FFA840" />
            </View>

            <Text className="flex-1 ml-4 text-base font-semibold text-gray-800">
              {item.label}
            </Text>

            <Ionicons name="chevron-forward" size={24} color="#FFA840" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
