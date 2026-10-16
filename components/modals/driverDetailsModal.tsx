import {RequestedDriver} from "@/types/book";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import React, {memo} from "react";
import {Modal, Platform, Pressable, ScrollView, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import StarDisplay from "../StarDisplay";

function DriverDetailsModal({
  isModalOpen,
  driver,
  handleCloseModal,
  acceptDriver,
  rejectDriver,
  showAvailability = false,
}: {
  isModalOpen: boolean;
  driver: RequestedDriver;
  handleCloseModal: () => void;
  acceptDriver: () => void;
  rejectDriver?: () => void;
  /** ASAP offers only: show whether the driver is free or finishing a trip. */
  showAvailability?: boolean;
}) {
  const inset = useSafeAreaInsets();

  return (
    <Modal
      visible={isModalOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseModal}
    >
      <View className="justify-end flex-1 bg-black/50">
        <View className="max-h-[85%] rounded-t-3xl bg-white">
          {/* Header */}
          <View className="items-center justify-center py-4 border-b border-gray-200">
            <Pressable
              onPress={handleCloseModal}
              className="absolute left-5"
              hitSlop={20}
            >
              <Ionicons
                name="chevron-back"
                size={Platform.OS === "ios" ? 32 : 28}
                color="#6B7280"
              />
            </Pressable>
            <Text className="text-xl font-bold text-gray-900">
              Driver Details
            </Text>
          </View>

          <ScrollView
            className="px-6 py-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: inset.bottom + 30}}
          >
            {/* Profile Section */}
            <View className="items-center pb-6">
              {driver.profilePicture ? (
                <Image
                  source={{uri: driver.profilePicture}}
                  contentFit="cover"
                  style={{width: 120, height: 120, borderRadius: 60}}
                />
              ) : (
                <Ionicons name="person-circle" size={120} color="#F7931E" />
              )}
              <Text className="mt-4 text-2xl font-bold text-gray-900 capitalize">
                {driver.name}
              </Text>
              <View className="flex-row items-center gap-2 mt-2">
                <StarDisplay rating={driver.rating} />
              </View>
              <Text className="text-sm font-semibold text-gray-500">
                {driver.rating} stars
              </Text>
              <Text className="mt-2 text-lg font-semibold text-gray-700">
                Total Completed Bookings: {driver.totalBookings}
              </Text>
            </View>

            {/* Info Cards */}
            <View className="gap-4">
              {/* Availability */}
              {!showAvailability ? null : driver.isQueued ? (
                <View className="flex-row gap-3 p-4 rounded-xl bg-amber-50">
                  <Ionicons name="time-outline" size={22} color="#B45309" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-amber-800">
                      Finishing a nearby delivery
                    </Text>
                    <Text className="mt-1 text-xs leading-5 text-amber-700">
                      This driver will head to your pickup right after
                      completing their current drop-off nearby.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center gap-3 p-4 rounded-xl bg-emerald-50">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color="#047857"
                  />
                  <Text className="text-sm font-bold text-emerald-800">
                    Available now
                  </Text>
                </View>
              )}

              {/* Distance */}
              {driver.distance && (
                <View className="p-4 rounded-xl bg-orange-50">
                  <Text className="mb-1 text-xs font-semibold tracking-wide text-orange-600 uppercase">
                    Approx. distance from pickup
                  </Text>
                  <Text className="text-2xl font-bold text-orange-600">
                    {driver.distance < 1
                      ? `${(driver.distance * 1000).toFixed(0)}m`
                      : `${driver.distance.toFixed(2)}km`}{" "}
                    away
                  </Text>
                </View>
              )}

              {/* Vehicle Image */}
              <View className="p-4 rounded-xl bg-gray-50">
                <Text className="mb-3 text-sm font-semibold tracking-wide text-gray-700 uppercase">
                  Vehicle Image
                </Text>
                <View
                  className="w-full overflow-hidden bg-white rounded-lg"
                  style={{aspectRatio: 4 / 3}}
                >
                  {driver.vehicleImage ? (
                    <Image
                      source={{uri: driver.vehicleImage}}
                      style={{width: "100%", height: "100%"}}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="items-center justify-center w-full h-full bg-gray-200">
                      <Ionicons
                        name="image-outline"
                        size={40}
                        color="#9CA3AF"
                      />
                      <Text className="mt-1 text-gray-400">Not available</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-3 mt-6">
              <Pressable
                className="items-center py-4 rounded-xl bg-lightPrimary active:bg-darkPrimary"
                onPress={acceptDriver}
              >
                <Text className="text-base font-bold text-white">
                  Accept Driver
                </Text>
              </Pressable>

              <Pressable
                onPress={rejectDriver}
                className="items-center py-4 border border-red-300 rounded-xl bg-red-50 active:bg-red-100"
              >
                <Text className="text-base font-bold text-red-600">
                  Decline Offer
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default memo(DriverDetailsModal);
