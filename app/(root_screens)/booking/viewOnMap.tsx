import LiveTrackingMapScreen from "@/components/maps/LiveTrackingMapScreen";
import StarDisplay from "@/components/StarDisplay";
import { useBooking } from "@/queries/bookingQueries";
import { useSocket } from "@/sockets/context/SocketProvider";
import { useAppStore } from "@/store/useAppStore";
import { createConversationId } from "@/utils/helpers/booking";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function ViewOnMap() {
  const [region, setRegion] = useState<Region | null>(null);
  // Unmount the live map before navigating — replace while MapView is mounted
  // is unreliable and can leave this screen stuck until the user presses back.
  const [leavingToCompleted, setLeavingToCompleted] = useState(false);
  const hasNavigatedRef = useRef(false);

  const params = useLocalSearchParams<{
    bookingId: string | string[];
    shouldGoBack: string | string[];
  }>();
  const bookingId = normalizeParam(params.bookingId);
  const shouldGoBack = normalizeParam(params.shouldGoBack);

  const insets = useSafeAreaInsets();
  const socket = useSocket();

  const { data: booking, isPending, error } = useBooking(bookingId ?? "");

  const leaveToCompleted = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    // Drop MapView from the tree first; navigation runs in the effect below.
    setLeavingToCompleted(true);
  }, []);

  // After MapView unmounts, land on the completed tab.
  useEffect(() => {
    if (!leavingToCompleted) return;

    const task = InteractionManager.runAfterInteractions(() => {
      router.replace("/(drawer)/(tabs)/request?tab=completed");
    });

    return () => task.cancel();
  }, [leavingToCompleted]);

  useFocusEffect(
    useCallback(() => {
      if (!socket || !bookingId || leavingToCompleted) return;

      const handleBookingCompleted = ({
        bookingId: completedId,
      }: {
        bookingId: string;
      }) => {
        if (String(completedId) !== String(bookingId)) return;
        leaveToCompleted();
      };

      socket.on("bookingCompleted", handleBookingCompleted);
      return () => {
        socket.off("bookingCompleted", handleBookingCompleted);
      };
    }, [bookingId, socket, leaveToCompleted, leavingToCompleted]),
  );

  // Query fallback — global socket handler invalidates this booking; if status
  // lands on completed (e.g. focus/listener edge cases), still leave the map.
  useEffect(() => {
    if (leavingToCompleted) return;
    if (booking?.status === "completed") {
      leaveToCompleted();
    }
  }, [booking?.status, leaveToCompleted, leavingToCompleted]);

  if (leavingToCompleted) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  }

  if (isPending || !bookingId)
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  if (error)
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg font-semibold text-gray-500">
          {error.message}
        </Text>
      </View>
    );

  const handleBack = () => {
    router.back();
    if (!shouldGoBack || shouldGoBack !== "true") {
      router.push("/(drawer)/(tabs)/request?tab=active");
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "white" }}
      edges={["right", "bottom", "left"]}
    >
      <View className="relative flex-1">
        <LiveTrackingMapScreen
          pickUp={booking.pickUp}
          dropOff={booking.dropOff}
          gasCategory={booking.selectedVehicle.gasCategory ?? "light"}
          region={region}
          setRegion={setRegion}
          bookingId={bookingId}
          driver={booking.driver!}
          status={booking.status}
        />
      </View>
      <View className="absolute right-0 bottom-0 left-0">
        <View
          className="gap-3 justify-center px-5 py-6 w-full bg-white rounded-t-3xl"
          style={{ paddingBottom: insets.bottom + 15 }}
        >
          <View className="flex-row justify-center items-center px-4">
            <Pressable
              onPress={handleBack} // TODO: infinite routing
              className="absolute left-0 -top-1"
              hitSlop={20}
            >
              <Ionicons
                name="chevron-back-outline"
                size={Platform.OS === "ios" ? 30 : 28}
                color="#FFA840"
              />
            </Pressable>
            <Text className="text-lg font-semibold">
              {booking.status === "need_continuance"
                ? "Finding a replacement"
                : "On the way"}
            </Text>
          </View>

          <View>
            <Text className="mb-1 text-sm font-semibold text-gray-500">
              Driver
            </Text>
            <View className="flex-row justify-between items-center">
              <View className="flex-row gap-2 justify-center items-center">
                {booking.driver.profilePictureUrl ? (
                  <Pressable className="w-[44px] h-[44px] rounded-full overflow-hidden">
                    <Image
                      source={{ uri: booking.driver.profilePictureUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </Pressable>
                ) : (
                  <Ionicons name="person-circle" size={48} color="#F7931E" />
                )}
                <View>
                  <Text className="text-lg font-semibold text-gray-800">
                    {booking.driver.name}
                  </Text>
                  <View className="flex-row gap-2 items-center">
                    <StarDisplay rating={booking.driver.rating} />
                    <Text className="text-sm font-semibold text-gray-600">
                      ({booking.driver.rating})
                    </Text>
                  </View>
                </View>
              </View>

              <View className="flex-row gap-6 mr-2">
                <Pressable
                  className="items-center active:scale-110"
                  hitSlop={20}
                  onPress={() =>
                    router.push({
                      pathname: "/message",
                      params: {
                        conversationId: createConversationId(
                          useAppStore.getState().id!,
                          booking.driver.id,
                        ),
                      },
                    })
                  }
                >
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={28}
                    color="#F7931E"
                  />
                  <Text className="text-gray-600">Chat</Text>
                </Pressable>
                <Pressable
                  className="items-center active:scale-110"
                  hitSlop={20}
                  onPress={() => {
                    const phoneNumber = booking.driver.phoneNumber;
                    if (!phoneNumber) return;
                    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
                      Alert.alert("Unable to place call", "Please try again.");
                    });
                  }}
                >
                  <Ionicons name="call" size={28} color="#F7931E" />
                  <Text className="text-gray-600">Call</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
