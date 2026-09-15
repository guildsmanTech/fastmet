import useSeeMoreDetails from "@/hooks/useSeeMoreDetails";
import {useMarkAsReadMutation} from "@/mutations/booking";
import {useUserBookings} from "@/queries/bookingQueries";
import {Booking} from "@/types/book";
import {formatDate} from "@/utils/helpers/date";
import {Ionicons} from "@expo/vector-icons";
import {useEffect} from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import SeeMoreModalDisplay from "../modals/seeMoreModalDisplay";

export default function CancelledRoute({count}: {count: number}) {
  const {modalVisible, setModalVisible, selectedRequest, handleSeeMorePress} =
    useSeeMoreDetails<Booking>();

  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserBookings("cancelled", 5);

  const {mutate: markAsReadBooking, isPending: isMarkingAsRead} =
    useMarkAsReadMutation();

  useEffect(() => {
    if (count > 0) markAsReadBooking("cancelled");
  }, [count, markAsReadBooking]);

  if (isPending || isMarkingAsRead)
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

  const cancelledBookings = data?.pages.flatMap((page) => page.bookings) ?? [];

  return (
    <>
      <FlatList
        data={cancelledBookings}
        renderItem={({item}) => (
          <CancelledCard
            vehicle={item.selectedVehicle.name}
            maxLoadKg={item.selectedVehicle.maxLoadKg ?? 0}
            bookingRef={item.bookingRef}
            pickup={item.pickUp?.address || ""}
            dropoff={item.dropOff?.address || ""}
            distance={item.routeData.distance}
            isCash={item.paymentMethod === "cash"}
            amount={item.routeData.totalPrice}
            onPressSeeMore={() => handleSeeMorePress(item)}
            cancelledAt={item.cancelledAt!}
          />
        )}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        className="flex-1 p-4"
        contentContainerStyle={{
          paddingBottom: 40,
          gap: 15,
        }}
        ListEmptyComponent={() => (
          <View className="justify-center items-center px-8 py-12">
            <View className="items-center">
              <Ionicons name="alert-circle-outline" size={80} color="#9CA3AF" />
              <Text className="mt-6 text-2xl font-bold text-center text-gray-800">
                No Requests Yet
              </Text>
              <Text className="mt-2 text-base text-center text-gray-500">
                You currently don&apos;t have any active requests.
              </Text>
            </View>
          </View>
        )}
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
      />

      {selectedRequest && (
        <SeeMoreModalDisplay
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          type="Cancelled Booking"
          data={selectedRequest}
        />
      )}
    </>
  );
}

type CancelledCardProps = {
  vehicle: string;
  maxLoadKg: number;
  bookingRef: string;
  pickup: string;
  dropoff: string;
  distance: number;
  isCash: boolean;
  amount: number;
  cancelledAt: string;
  onPressSeeMore: () => void;
};

const CancelledCard = ({
  vehicle,
  maxLoadKg,
  bookingRef,
  pickup,
  dropoff,
  distance,
  isCash,
  amount,
  cancelledAt,
  onPressSeeMore,
}: CancelledCardProps) => {
  return (
    <View
      style={{
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8, // for Android
      }}
      className="rounded-2xl"
    >
      <Pressable
        onPress={onPressSeeMore}
        className="overflow-hidden bg-white rounded-2xl active:opacity-90"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center px-5 py-3 bg-red-500">
          <Text
            className={`font-semibold text-white ${maxLoadKg ? "text-base" : "text-lg"}`}
          >
            {vehicle} {maxLoadKg ? `(${maxLoadKg}kg)` : ""}
          </Text>
          <Text className="text-sm text-white">{bookingRef}</Text>
        </View>

        {/* Body */}
        <View className="px-3 py-5">
          {/* Pickup & Drop */}
          <View className="relative flex-row justify-between items-center pl-7 mr-2 ml-5 border-l border-dashed">
            <View className="gap-4">
              <Text
                className={`font-medium ${Platform.OS === "ios" ? "max-w-60" : "max-w-52"}`}
                numberOfLines={2}
              >
                {pickup}
              </Text>
              <Text
                className={`font-medium ${Platform.OS === "ios" ? "max-w-60" : "max-w-52"}`}
                numberOfLines={2}
              >
                {dropoff}
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
          {/* Payment */}
          <View className="flex-row justify-between items-center p-4 mt-6 bg-gray-100 rounded-lg">
            <Text className="text-base text-gray-600">
              {isCash ? "Cash Payment" : "Online Payment"}
            </Text>
            <Text className="text-lg font-semibold text-darkPrimary">
              Php {amount.toLocaleString("en-US")}
            </Text>
          </View>
          <View className="flex-row justify-between items-center px-2 mt-6">
            <Text className="text-sm font-semibold text-red-500">
              Cancelled Request
            </Text>
            <Text className="text-sm font-semibold">
              {formatDate(cancelledAt)}
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
    </View>
  );
};
