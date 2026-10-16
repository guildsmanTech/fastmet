import {Ionicons} from "@expo/vector-icons";
import React from "react";
import {Modal, Pressable, Text, View} from "react-native";

type OffRoadWarningModalProps = {
  visible: boolean;
  distanceLabel: string;
  onMovePin: () => void;
  onUsePin: () => void;
};

const OffRoadWarningModal: React.FC<OffRoadWarningModalProps> = ({
  visible,
  distanceLabel,
  onMovePin,
  onUsePin,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onMovePin}
    >
      <View
        className="items-center justify-center flex-1 px-6"
        style={{backgroundColor: "rgba(0,0,0,0.5)"}}
      >
        <View className="w-full p-6 bg-white rounded-3xl">
          <View className="items-center justify-center self-center w-16 h-16 mb-4 rounded-full bg-orange-100">
            <Ionicons name="car-outline" size={32} color="#ED8718" />
          </View>

          <Text className="mb-2 text-xl text-center text-secondary font-montserrat-bold">
            Not reachable by vehicle
          </Text>
          <Text className="mb-4 text-sm text-center text-gray-600 font-montserrat">
            The driver can only get to the nearest road, about{" "}
            <Text className="text-secondary font-montserrat-bold">
              {distanceLabel}
            </Text>{" "}
            from your pin.
          </Text>

          <View className="flex-row p-3 mb-5 bg-gray-50 rounded-xl">
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#6B7280"
              style={{marginRight: 8, marginTop: 1}}
            />
            <Text className="flex-1 text-xs text-gray-600 font-montserrat">
              The car icon on the map shows where the driver can reach. Move
              the pin there, or keep it and add directions in Location details.
            </Text>
          </View>

          <Pressable
            onPress={onMovePin}
            className="items-center py-3.5 mb-3 rounded-full bg-lightPrimary active:opacity-80"
          >
            <Text className="text-base text-white font-montserrat-bold">
              Move pin
            </Text>
          </Pressable>
          <Pressable
            onPress={onUsePin}
            className="items-center py-3.5 border border-gray-300 rounded-full active:bg-gray-100"
          >
            <Text className="text-base text-gray-700 font-montserrat-bold">
              Use this pin
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default OffRoadWarningModal;
