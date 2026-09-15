import useSeeMoreDetails from "@/hooks/useSeeMoreDetails";
import {
  useMarkAsReadMutation,
  useRateDriverMutation,
} from "@/mutations/booking";
import {useUserBookings} from "@/queries/bookingQueries";
import {CompletedBooking, LocationDetails} from "@/types/book";
import {getBookingTimelineItems} from "@/utils/helpers/booking";
import {formatLocation} from "@/utils/helpers/location";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {useEffect, useMemo, useState} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {
  AttachedImages,
  BookingTimeline,
  ItemType,
  LocationUI,
  Note,
  PaymentInfo,
  SeeMoreHeader,
  SelectedServices,
} from "../BookingSeeMoreInfo";
import ImageViewer from "../ImageViewer";
import StarDisplay from "../StarDisplay";

export default function CompletedRoute({count}: {count: number}) {
  const {modalVisible, setModalVisible, selectedRequest, handleSeeMorePress} =
    useSeeMoreDetails<CompletedBooking>();

  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserBookings("completed", 5);

  const {mutate: markAsReadBooking, isPending: isMarkingAsRead} =
    useMarkAsReadMutation();

  useEffect(() => {
    if (count > 0) markAsReadBooking("completed");
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

  const completedBookings = data?.pages.flatMap((page) => page.bookings) ?? [];

  return (
    <>
      <FlatList
        data={completedBookings}
        renderItem={({item}) => (
          <CompletedCard
            vehicle={item.selectedVehicle.name}
            maxLoadKg={item.selectedVehicle.maxLoadKg ?? 0}
            bookingType={item.bookingType}
            pickup={item.pickUp}
            dropoff={item.dropOff}
            distance={item.routeData.distance}
            amount={item.routeData.totalPrice}
            isCash={item.paymentMethod === "cash"}
            completedTime={item.completedAt}
            onPressSeeMore={() => handleSeeMorePress(item)}
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
        <SeeMoreModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          data={selectedRequest}
          isAccepted={true}
        />
      )}
    </>
  );
}

type CompleteCardProps = {
  vehicle: string;
  maxLoadKg: number;
  pickup: LocationDetails;
  bookingType: {
    type: string; // "asap" | "schedule"
    value: string | null;
  };
  dropoff: LocationDetails;
  distance: number;
  isCash: boolean;
  amount: number;
  completedTime: string;
  onPressSeeMore: () => void;
};

const CompletedCard = ({
  vehicle,
  maxLoadKg,
  completedTime,
  pickup,
  dropoff,
  distance,
  isCash,
  amount,
  onPressSeeMore,
}: CompleteCardProps) => {
  const formatted = new Date(completedTime).toLocaleString("en-US", {
    month: "short", // "Nov"
    day: "numeric", // "13"
    hour: "numeric", // "1"
    minute: "2-digit",
    hour12: true,
  });

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
        <View className="px-5 py-3 bg-lightPrimary">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-4">
              <Text
                className="text-base font-semibold text-white"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {vehicle}
                {maxLoadKg ? ` · ${maxLoadKg}kg` : ""}
              </Text>
            </View>

            <Text className="text-xs text-white/80 shrink-0">{formatted}</Text>
          </View>
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
          {/* Payment */}
          <View className="flex-row justify-between items-center p-4 mt-6 bg-gray-100 rounded-lg">
            <Text className="text-base text-gray-600">
              {isCash ? "Cash Payment" : "Online Payment"}
            </Text>
            <Text className="text-lg font-semibold text-darkPrimary">
              Php {amount.toLocaleString("en-US")}
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

function SeeMoreModal({
  visible,
  onClose,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  data: CompletedBooking;
  isAccepted: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [isImageViewVisible, setIsImageViewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [userRating, setUserRating] = useState(0);
  const [showRatingCard, setShowRatingCard] = useState(false);

  const {mutate, isPending, error} = useRateDriverMutation();

  const openImageViewer = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageViewVisible(true);
  };

  const handleRateDriver = () => {
    if (userRating > 0) {
      mutate(
        {bookingId: data._id, rating: userRating},
        {
          onSuccess: (data) => {
            setShowRatingCard(false);
            setUserRating(0);
            onClose();
          },
        },
      );
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (data.driverRating !== null) setShowRatingCard(false);
      else setShowRatingCard(true);
    }, 7000);

    return () => clearTimeout(timeoutId);
  }, [visible, data.driverRating]);

  // Memoize calculations to prevent recalculation on every render
  const {totalServicesPrice, hasAddedServices, hasFreeServices} =
    useMemo(() => {
      if (!data)
        return {
          totalServicesPrice: 0,
          hasAddedServices: false,
          hasFreeServices: false,
        };

      const addedServices = data.addedServices ?? [];
      const freeServices = data.selectedVehicle?.freeServices ?? [];

      return {
        // service.price is already total (unit price × quantity) from bookSlice
        totalServicesPrice: addedServices.reduce(
          (total, service) => total + service.price,
          0,
        ),
        hasAddedServices: addedServices.length > 0,
        hasFreeServices: freeServices.length > 0,
      };
    }, [data]);

  const timelineItems = useMemo(
    () => (data ? getBookingTimelineItems(data, "completed") : []),
    [data],
  );

  if (!data) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom,
          backgroundColor: "white",
        }}
      >
        {/* Header */}
        <SeeMoreHeader onClose={onClose} bookingType={data.bookingType.type} />

        {/* Content - Scrollable */}
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: 20,
            paddingBottom: showRatingCard ? 170 : 30,
          }}
        >
          <View className="p-5 rounded-2xl bg-lightPrimary">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-3">
                <Text className="mb-1 text-sm text-white opacity-90">
                  Order Reference
                </Text>
                <Text className="text-sm font-bold text-white">
                  {data.bookingRef}
                </Text>
              </View>
              <View className="items-end shrink-0 max-w-[55%]">
                <Text className="mb-1 text-sm text-white opacity-90">
                  Vehicle Type
                </Text>
                <Text
                  className="text-lg font-semibold text-right text-white"
                  numberOfLines={2}
                >
                  {data.selectedVehicle.name}
                </Text>
                {data.selectedVehicle.maxLoadKg != null && (
                  <Text className="mt-0.5 text-sm text-white opacity-90 text-right">
                    {data.selectedVehicle.maxLoadKg}kg
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Driver Info */}
          {data.driverRating !== null && (
            <View className="px-4 py-3">
              <Text className="mb-1 text-sm font-semibold text-gray-500">
                Driver
              </Text>
              <View className="flex-row justify-between items-center">
                <View className="flex-row gap-2 justify-center items-center">
                  {data.driver.profilePictureUrl ? (
                    <Pressable
                      className="w-[48px] h-[48px] rounded-full overflow-hidden"
                      onPress={() =>
                        openImageViewer(data.driver.profilePictureUrl)
                      }
                    >
                      <Image
                        source={{uri: data.driver.profilePictureUrl}}
                        style={{width: "100%", height: "100%"}}
                        contentFit="cover"
                      />
                    </Pressable>
                  ) : (
                    <Ionicons name="person-circle" size={44} color="#F7931E" />
                  )}
                  <View>
                    <Text className="text-lg font-semibold text-gray-800">
                      {data.driver.name}
                    </Text>
                    <View className="flex-row gap-2 items-center">
                      <StarDisplay rating={data.driver.rating} />
                      <Text className="text-sm font-semibold text-gray-600">
                        ({data.driver.rating})
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="items-end">
                  <Text className="mb-1 text-xs text-gray-500">
                    Your Rating
                  </Text>
                  <View className="flex-row gap-1 items-center">
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text className="text-sm font-semibold text-gray-800">
                      {data.driverRating}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Location Details */}
          <View className="p-5 bg-gray-50 rounded-2xl">
            <Text className="mb-4 text-base font-semibold text-gray-800">
              Trip Details
            </Text>

            <LocationUI pickUp={data.pickUp} dropOff={data.dropOff} />

            {/* Distance */}
            <View className="flex-row justify-between items-center p-3 mt-4 bg-white rounded-lg">
              <Text className="text-sm text-gray-600">Distance</Text>
              <Text className="text-lg font-bold text-lightPrimary">
                {data.routeData.distance.toFixed(2)}km
              </Text>
            </View>
          </View>

          <BookingTimeline items={timelineItems} />

          {/* Note */}
          {data.note && <Note note={data.note} />}

          {/* Payment Info */}
          <PaymentInfo
            paymentMethod={data.paymentMethod}
            routeData={data.routeData}
            paidBy={data.paidBy}
            voucherApplied={data.voucherApplied}
          />

          {/* Delivery Proof Images */}
          <View className="p-5 bg-gray-50 rounded-2xl">
            <View className="flex-row gap-2 items-center mb-3">
              <View className="p-1 bg-green-100 rounded-full">
                <Ionicons
                  name="checkmark-done-circle"
                  size={22}
                  color="#10B981"
                />
              </View>
              <Text className="text-base font-bold text-gray-800">
                Delivery Proof Images
              </Text>
            </View>

            <View className="gap-3 p-4 bg-white rounded-xl">
              {/* Pickup Section */}
              <View className="gap-2">
                <Text className="text-xs font-bold text-gray-500">
                  Pickup Confirmation
                </Text>

                <View className="flex-row gap-2">
                  {data.bookingImages.pickup.beforeImageUrl && (
                    <Pressable
                      onPress={() =>
                        openImageViewer(
                          data.bookingImages.pickup.beforeImageUrl,
                        )
                      }
                      className="flex-1"
                    >
                      <Image
                        source={{
                          uri: data.bookingImages.pickup.beforeImageUrl,
                        }}
                        style={{height: 90, width: "100%"}}
                        contentFit="cover"
                      />
                      <View className="p-2">
                        <Text className="text-xs text-center text-gray-600">
                          Before Loading
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {data.bookingImages.pickup.afterImageUrl && (
                    <Pressable
                      onPress={() =>
                        openImageViewer(data.bookingImages.pickup.afterImageUrl)
                      }
                      className="flex-1"
                    >
                      <Image
                        source={{
                          uri: data.bookingImages.pickup.afterImageUrl,
                        }}
                        style={{height: 90, width: "100%"}}
                        contentFit="cover"
                      />
                      <View className="p-2">
                        <Text className="text-xs text-center text-gray-600">
                          After Loading
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Dropoff Section */}
              <View className="gap-2">
                <Text className="text-xs font-bold text-gray-500">
                  Delivery Confirmation
                </Text>

                <View className="flex-row gap-2">
                  {data.bookingImages.dropoff.signatureImageUrl && (
                    <Pressable
                      onPress={() =>
                        openImageViewer(
                          data.bookingImages.dropoff.signatureImageUrl,
                        )
                      }
                      className="flex-1"
                    >
                      <Image
                        source={{
                          uri: data.bookingImages.dropoff.signatureImageUrl,
                        }}
                        style={{height: 90, width: "100%"}}
                        contentFit="cover"
                      />
                      <View className="p-2">
                        <Text className="text-xs text-center text-gray-600">
                          Receipt/Signature
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {data.bookingImages.dropoff.packageImageUrl && (
                    <Pressable
                      onPress={() =>
                        openImageViewer(
                          data.bookingImages.dropoff.packageImageUrl,
                        )
                      }
                      className="flex-1"
                    >
                      <Image
                        source={{
                          uri: data.bookingImages.dropoff.packageImageUrl,
                        }}
                        style={{height: 90, width: "100%"}}
                        contentFit="cover"
                      />
                      <View className="p-2">
                        <Text className="text-xs text-center text-gray-600">
                          Delivered Package
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Selected Services */}
          {(hasFreeServices || hasAddedServices) && (
            <SelectedServices
              addedServices={data.addedServices}
              hasFreeServices={hasFreeServices}
              hasAddedServices={hasAddedServices}
              totalServicesPrice={totalServicesPrice}
              freeServices={data.selectedVehicle?.freeServices}
            />
          )}

          {/* Item Type */}
          {data.itemType && <ItemType itemType={data.itemType} />}

          {/* Images */}
          {data.photos && data.photos.length > 0 && (
            <AttachedImages
              photos={data.photos}
              setImageViewerVisible={setIsImageViewVisible}
              setSelectedImageUrl={setSelectedImage}
            />
          )}
        </ScrollView>

        {/* Floating Rating Card */}
        {showRatingCard && (
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 10,
              left: 16,
              right: 16,
              backgroundColor: "white",
              borderRadius: 16,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: {width: 0, height: -2},
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-semibold text-gray-800">
                Rate this driver
              </Text>
              <Pressable
                onPress={() => setShowRatingCard(false)}
                hitSlop={{top: 10, left: 10, bottom: 10, right: 10}}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Star Rating */}
            <View className="flex-row gap-2 justify-center items-center mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setUserRating(star)}
                  className="active:scale-110"
                >
                  <Ionicons
                    name={star <= userRating ? "star" : "star-outline"}
                    size={40}
                    color={star <= userRating ? "#FFD700" : "#D1D5DB"}
                  />
                </Pressable>
              ))}
            </View>

            {/* Rate Button */}
            <Pressable
              onPress={handleRateDriver}
              disabled={userRating === 0 || isPending}
              className={`py-3 rounded-xl ${
                userRating > 0 ? "bg-lightPrimary" : "bg-gray-300"
              }`}
            >
              <Text className="text-base font-semibold text-center text-white">
                {isPending
                  ? "Please wait..."
                  : userRating > 0
                    ? `Rate ${userRating} Star${userRating > 1 ? "s" : ""}`
                    : "Select Rating"}
              </Text>
            </Pressable>
            {error && (
              <Text className="mt-2 text-sm text-center text-red-500">
                {error.response?.data?.message ??
                  "Failed to submit rating. Please try again."}
              </Text>
            )}
          </View>
        )}
      </View>
      <ImageViewer
        images={[{uri: selectedImage}]}
        imageIndex={0}
        visible={isImageViewVisible}
        onRequestClose={() => setIsImageViewVisible(false)}
      />
    </Modal>
  );
}
