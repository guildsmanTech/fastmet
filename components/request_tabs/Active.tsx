import CancelBookingButton from "@/components/CancelBookingButton";
import { useBookingSettings } from "@/hooks/useBookingSettings";
import useSeeMoreDetails from "@/hooks/useSeeMoreDetails";
import { useUserBookings } from "@/queries/bookingQueries";
import { useSocket } from "@/sockets/context/SocketProvider";
import { useAppStore } from "@/store/useAppStore";
import { ActiveBooking } from "@/types/book";
import { createConversationId } from "@/utils/helpers/booking";
import { formatLocation } from "@/utils/helpers/location";
import { pushOnce } from "@/utils/helpers/navigation";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import SeeMoreModalDisplay from "../modals/seeMoreModalDisplay";
import StarDisplay from "../StarDisplay";

export default function ActiveRoute() {
  const { modalVisible, setModalVisible, selectedRequest, handleSeeMorePress } =
    useSeeMoreDetails<ActiveBooking>();
  const socket = useSocket();

  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserBookings("active", 5);

  // Listen for booking cancellation events
  useEffect(() => {
    const handleBookingCancelledByDriver = ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      Toast.show({
        type: "info",
        text1: "Booking Cancelled",
        text2:
          reason === "no_show_client"
            ? "Driver reported you as no-show"
            : "Driver cancelled the booking",
        position: "top",
        topOffset: 50,
        visibilityTime: 5000,
      });
      refetch();
    };

    const handlePoolingBookingCancelled = ({
      cancelledBookingId,
    }: {
      tripId: string;
      stops: any[];
      currentStopIndex: number;
      cancelledBookingId: string;
    }) => {
      // Check if it's our booking
      const myBooking = activeBookings.find(
        (b) => b._id === cancelledBookingId,
      );
      if (myBooking) {
        Toast.show({
          type: "info",
          text1: "Booking Cancelled",
          text2: "Your stop in the pooling trip was cancelled",
          position: "top",
          topOffset: 50,
        });
        refetch();
      }
    };

    socket.on("bookingCancelledByDriver", handleBookingCancelledByDriver);
    socket.on("poolingBookingCancelled", handlePoolingBookingCancelled);

    return () => {
      socket.off("bookingCancelledByDriver", handleBookingCancelledByDriver);
      socket.off("poolingBookingCancelled", handlePoolingBookingCancelled);
    };
  }, [socket, refetch]);

  if (isPending)
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

  const activeBookings = data?.pages.flatMap((page) => page.bookings) ?? [];

  return (
    <>
      <FlatList
        data={activeBookings}
        renderItem={({ item }) => (
          <ActiveCard
            booking={item}
            onPressSeeMore={() => handleSeeMorePress(item)}
            onCancelled={refetch}
          />
        )}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        className="flex-1 p-4"
        contentContainerStyle={{
          paddingBottom: 40,
          gap: 15,
        }}
        // pull to refresh
        refreshing={isPending}
        onRefresh={refetch}
        // infinite scroll
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        // Loading indicator at bottom
        ListFooterComponent={() => {
          if (isFetchingNextPage) {
            return (
              <View className="py-4">
                <ActivityIndicator size="small" color="#FFA840" />
              </View>
            );
          }
          return null;
        }}
        ListEmptyComponent={() => (
          <View className="justify-center items-center px-8 py-12">
            <View className="items-center">
              <Ionicons name="alert-circle-outline" size={80} color="#9CA3AF" />
              <Text className="mt-6 text-2xl font-bold text-center text-gray-800">
                No Active Bookings
              </Text>
              <Text className="mt-2 text-base text-center text-gray-500">
                You currently don&apos;t have any active requests.
              </Text>
            </View>
          </View>
        )}
      />

      {selectedRequest && (
        <SeeMoreModalDisplay
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          type="Active Booking"
          data={selectedRequest}
        />
      )}
    </>
  );
}

type ActiveCardProps = {
  booking: ActiveBooking;
  onPressSeeMore: () => void;
  onCancelled: () => void;
};

const ActiveCard = ({
  booking,
  onPressSeeMore,
  onCancelled,
}: ActiveCardProps) => {
  const { driverNoShowMinutes } = useBookingSettings();
  const {
    _id: id,
    selectedVehicle: { name: vehicle, maxLoadKg = 0 },
    pickUp: pickup,
    dropOff: dropoff,
    routeData: { distance, totalPrice: amount },
    paymentMethod,
    driver,
    bookingType,
    activeAt,
  } = booking;

  const isCash = paymentMethod === "cash";

  const getReferenceTime = (): Date | null => {
    if (bookingType.type === "schedule") {
      return new Date(bookingType.value);
    }
    if (bookingType.type === "asap" && activeAt) {
      return new Date(activeAt);
    }
    // TODO: For pooling, need to get last completed stop time from backend
    // For now, use activeAt as fallback
    if (bookingType.type === "pooling" && activeAt) {
      return new Date(activeAt);
    }
    return null;
  };

  return (
    // Outer view: shadow only, no overflow-hidden (elevation + overflow-hidden
    // fight on Android and can clip the shadow)
    <View
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
      className="rounded-2xl"
    >
      {/* Inner view: actual clip boundary for the whole card */}
      <View className="overflow-hidden bg-white rounded-2xl">
        <Pressable onPress={onPressSeeMore} className="active:opacity-90">
          {/* Header */}
          <View className="flex-row justify-between items-center px-5 py-3 bg-lightPrimary">
            <Text
              className={`font-semibold text-white ${maxLoadKg ? "text-base" : "text-lg"}`}
            >
              {vehicle} {maxLoadKg ? `(${maxLoadKg}kg)` : ""}
            </Text>
            <Pressable
              className="flex-row gap-2 items-center active:scale-105"
              hitSlop={15}
              onPress={() =>
                pushOnce({
                  pathname: "/(root_screens)/booking/viewOnMap",
                  params: { bookingId: id, shouldGoBack: "true" },
                })
              }
            >
              <Text className="text-sm font-semibold text-white underline">
                View on Map
              </Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </Pressable>
          </View>

          {booking.status === "need_continuance" && (
            <View className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <Text className="text-sm font-semibold text-amber-900">
                Finding a replacement driver
              </Text>
              <Text className="mt-1 text-xs leading-5 text-amber-800">
                No action needed. Your price stays the same. We will assign a
                new driver automatically.
              </Text>
            </View>
          )}

          <View className="px-4 py-3">
            <Text className="mb-1 text-sm font-semibold text-gray-500">
              Driver
            </Text>
            <View className="flex-row justify-between items-center">
              <View className="flex-row gap-2 justify-center items-center">
                {driver.profilePictureUrl ? (
                  <View className="w-[44px] h-[44px] rounded-full overflow-hidden">
                    <Image
                      source={{ uri: driver.profilePictureUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                ) : (
                  <Ionicons name="person-circle" size={50} color="#F7931E" />
                )}
                <View>
                  <Text className="text-lg font-semibold text-gray-800">
                    {driver.name}
                  </Text>
                  <View className="flex-row gap-2 items-center">
                    <StarDisplay rating={driver.rating} />
                    <Text className="text-sm font-semibold text-gray-600">
                      ({driver.rating})
                    </Text>
                  </View>
                </View>
              </View>

              <View className="flex-row gap-5">
                <Pressable
                  className="items-center active:scale-110"
                  hitSlop={20}
                  onPress={() =>
                    pushOnce({
                      pathname: "/message",
                      params: {
                        conversationId: createConversationId(
                          useAppStore.getState().id!,
                          driver.id,
                        ),
                      },
                    })
                  }
                >
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={Platform.OS === "ios" ? 28 : 24}
                    color="#F7931E"
                  />
                  <Text className="text-sm text-gray-600">Chat</Text>
                </Pressable>
                <Pressable
                  className="items-center active:scale-110"
                  hitSlop={20}
                  onPress={() => {
                    const phoneNumber = driver.phoneNumber;
                    if (!phoneNumber) return;
                    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
                      Alert.alert("Unable to place call", "Please try again.");
                    });
                  }}
                >
                  <Ionicons
                    name="call"
                    size={Platform.OS === "ios" ? 28 : 24}
                    color="#F7931E"
                  />
                  <Text className="text-sm text-gray-600">Call</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Body */}
          <View className="px-3 py-5">
            <View className="relative flex-row justify-between items-center pl-7 mr-2 ml-5 border-l border-dashed">
              <View className="gap-4">
                <Text
                  className={`font-medium ${Platform.OS === "ios" ? "max-w-60" : "max-w-52"}`}
                  numberOfLines={2}
                >
                  {formatLocation(pickup)}
                </Text>
                <Text
                  className={`font-medium ${Platform.OS === "ios" ? "max-w-60" : "max-w-52"}`}
                  numberOfLines={2}
                >
                  {formatLocation(dropoff)}
                </Text>
              </View>
              <Text className="font-bold">{distance.toFixed(1)}km</Text>

              <Ionicons
                name="location-sharp"
                size={24}
                className="absolute -left-3.5 -top-1 bg-white"
              />
              <Ionicons
                name="flag-outline"
                size={24}
                className="absolute -left-3.5 -bottom-1 bg-white"
              />
            </View>

            <View className="flex-row justify-between items-center p-4 mt-6 bg-gray-100 rounded-lg">
              <Text className="text-base text-gray-600">
                {isCash ? "Cash Payment" : "Online Payment"}
              </Text>
              <Text className="text-lg font-semibold text-darkPrimary">
                Php{" "}
                {amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>

            <Pressable
              className="justify-center items-center mt-6 active:scale-105"
              onPress={onPressSeeMore}
            >
              <Text className="text-sm font-medium">+ See more</Text>
            </Pressable>
          </View>
        </Pressable>

        <CancelBookingButton
          bookingId={id}
          referenceTime={getReferenceTime()}
          graceMinutes={driverNoShowMinutes}
          onCancelled={onCancelled}
        />
      </View>
    </View>
  );
};
