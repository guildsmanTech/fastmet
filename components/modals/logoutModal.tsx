import { performLogout } from "@/lib/axios";
import { STATIC_IMAGES } from "@/utils/constants";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

const LogoutModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const handleLogout = async () => {
    setIsOpen(false);
    await performLogout();
  };

  return (
    <Modal
      visible={isOpen}
      statusBarTranslucent={true}
      transparent
      animationType="fade"
      onRequestClose={() => setIsOpen(false)}
    >
      <View className="items-center justify-center flex-1 bg-black/50">
        <View className="items-center w-4/5 gap-4 p-6 bg-white rounded-2xl">
          <View className="flex-row items-center">
            <Image
              source={STATIC_IMAGES.fastmetLogo}
              style={{ width: 50, height: 50 }}
              contentFit="contain"
            />
            <Text className="text-xl font-bold tracking-widest text-secondary">
              FastMet
            </Text>
          </View>
          <View className="items-center p-6 border-2 rounded-full justify-cen0er border-lightPrimary">
            <Ionicons name="log-out-outline" size={60} color="#ED8718" />
          </View>

          <Text className="text-lg font-bold text-gray-700">
            Are you sure you want to logout?
          </Text>

          {/*  Button */}
          <View className="w-full mt-5">
            <Pressable
              className="items-center py-4 rounded-lg bg-lightPrimary active:bg-darkPrimary"
              onPress={handleLogout}
            >
              <Text className="text-base font-bold text-white">Logout</Text>
            </Pressable>
            <Pressable
              className="items-center py-4 my-2 border border-gray-200 rounded-lg bg-ctaSecondary active:bg-ctaSecondaryActive"
              onPress={() => setIsOpen(false)}
            >
              <Text className="text-base font-bold ">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LogoutModal;
