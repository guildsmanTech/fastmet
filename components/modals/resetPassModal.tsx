import Ionicons from "@expo/vector-icons/Ionicons";
import React, {useEffect} from "react";
import {Modal, Pressable, Text, View} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  duration?: number; // optional auto-close duration in ms
};

const PasswordResetModal = ({visible, onClose, duration = 3000}: Props) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      statusBarTranslucent={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="items-center justify-center flex-1 bg-black/50">
        <View className="items-center w-4/5 p-6 bg-white rounded-xl">
          <Ionicons name="mail-open-outline" size={40} color="#FFA840" />
          <Text className="text-xl font-bold text-[#FFA840] mt-2 mb-1">
            Email Sent
          </Text>
          <Text className="mb-5 text-base text-center text-gray-700">
            We&apos;ve sent a password reset link to your email. Please check your
            inbox and follow the instructions.
          </Text>
          <Pressable
            className="bg-[#FFA840] px-6 py-2 rounded-lg"
            onPress={onClose}
          >
            <Text className="text-base font-semibold text-white">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default PasswordResetModal;
