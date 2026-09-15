import useSeeMoreDetails from "@/hooks/useSeeMoreDetails";
import {queryClient} from "@/lib/queryClient";
import {useRescheduleBookingMutation} from "@/mutations/booking";
import {useUserBookings} from "@/queries/bookingQueries";
import {useSocket} from "@/sockets/context/SocketProvider";
import {useAppStore} from "@/store/useAppStore";
import {useDriverLocationStore} from "@/store/useDriverLocationStore";
import {Booking, Driver, LocationDetails, RequestedDriver} from "@/types/book";
import {formatDate} from "@/utils/helpers/date";
import {formatLocation} from "@/utils/helpers/location";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {useCallback, useEffect, useState} from "react";
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
import Popover, {PopoverPlacement} from "react-native-popover-view";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import ConfirmCancelBookingModal from "../modals/confirmCancelBookingModal";
import DriverDetailsModal from "../modals/driverDetailsModal";
import RescheduleModal from "../modals/rescheduleModal";
import SeeMoreModalDisplay from "../modals/seeMoreModalDisplay";
import StarDisplay from "../StarDisplay";

export default function RequestRoute() {
  const {modalVisible, setModalVisible, selectedRequest, handleSeeMorePress} =
    useSeeMoreDetails<Booking>();
  /** Which booking's drivers list is open. Null = drivers modal closed. */
  const [driversModalBookingId, setDriversModalBookingId] = useState<
    string | null
  >(null);
  const [selectedDriver, setSelectedDriver] = useState<RequestedDriver | null>(
    null,
  );
  const [selectedFilters, setSelectedFilters] = useState([
    "PENDING",
    "SCHEDULED",
  ]);
  const setLoading = useAppStore((state) => state.setLoading);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(
    null,
  );
  const socket = useSocket();
  const rescheduleMutation = useRescheduleBookingMutation();

  // Fetch first page of both statuses on mount
  const pendingQuery = useUserBookings("pending", 5);
  const scheduledQuery = useUserBookings("scheduled", 5);

  const isLoading = pendingQuery.isPending && scheduledQuery.isPending;
  const error = pendingQuery.error || scheduledQuery.error;

  // Flatten cached pages
  const pendingBookings =
    pendingQuery.data?.pages.flatMap((page) => page.bookings) ?? [];
  const scheduledBookings =
    scheduledQuery.data?.pages.flatMap((page) => page.bookings) ?? [];

  // Conditionally show data based on selected filter
  let bookings = selectedFilters.includes("PENDING") ? pendingBookings : [];
  bookings = selectedFilters.includes("SCHEDULED")
    ? [...bookings, ...scheduledBookings]
    : bookings;

  const driversModalBooking = bookings.find(
    (b) => b._id === driversModalBookingId,
  );
  const driversForModal = driversModalBooking?.requestedDrivers ?? [];

  // Determine active queries for fetching / refreshing
  const activeQueries =
    selectedFilters.includes("PENDING") && selectedFilters.includes("SCHEDULED")
      ? [pendingQuery, scheduledQuery]
      : selectedFilters.includes("PENDING")
        ? [pendingQuery]
        : [scheduledQuery];

  // Combined states
  const isFetchingNextPage = activeQueries.some((q) => q.isFetchingNextPage);
  const refreshing = activeQueries.some((q) => q.isPending);

  // Pull-to-refresh
  const handleRefresh = () => {
    activeQueries.forEach((q) => q.refetch());
  };

  // Infinite scroll
  const handleEndReached = () => {
    activeQueries.forEach((q) => {
      if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    });
  };

  const handleFilterPress = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      if (selectedFilters.length === 1) return;
      setSelectedFilters(selectedFilters.filter((f) => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  const handleCancelBook = () => {
    setLoading(true);
    socket.emit("cancelBookingRequest", {bookingId: selectedId});
    setSelectedId(null);
  };

  const acceptDriver = useCallback(() => {
    if (!selectedDriver?.id || !selectedDriver?.bookingId) return;
    setLoading(true);
    socket.emit("acceptDriver", {
      driverId: selectedDriver.id,
      bookingId: selectedDriver.bookingId,
      type: "schedule",
    });
  }, [selectedDriver?.bookingId, selectedDriver?.id, setLoading, socket]);

  const rejectDriver = useCallback(() => {
    if (!selectedDriver?.id || !selectedDriver?.bookingId) return;

    const driverId = selectedDriver.id;
    const bookingId = selectedDriver.bookingId;

    socket.emit("rejectOffer", {
      driverId,
      bookingId,
    });

    // Optimistically remove declined driver from pending booking card
    queryClient.setQueriesData(
      {queryKey: ["userBookings", "pending"]},
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            bookings: page.bookings.map((booking: Booking) => {
              if (booking._id === bookingId) {
                return {
                  ...booking,
                  requestedDrivers: (booking.requestedDrivers || []).filter(
                    (driver) => driver.id !== driverId,
                  ),
                };
              }
              return booking;
            }),
          })),
        };
      },
    );

    setSelectedDriver(null);
  }, [selectedDriver?.bookingId, selectedDriver?.id, socket]);

  const closeDriversModal = useCallback(() => {
    setDriversModalBookingId(null);
    setSelectedDriver(null);
  }, []);

  useEffect(() => {
    const bookingCancelled = (bookingId: string) => {
      setLoading(false);

      // Clear driver location cache for this booking
      useDriverLocationStore.getState().clearDriverLocationCache(bookingId);

      queryClient.invalidateQueries({
        queryKey: ["userBookings", "pending"],
        exact: false,
      });

      queryClient.invalidateQueries({
        queryKey: ["userBookings", "scheduled"],
        exact: false,
      });

      queryClient.invalidateQueries({
        queryKey: ["userBookings", "cancelled"],
        exact: false,
      });

      queryClient.invalidateQueries({
        queryKey: ["userBookingCounts"],
      });

      // Invalidate voucher queries (voucher may have been released)
      queryClient.invalidateQueries({
        queryKey: ["rewards"],
        exact: false,
      });

      Toast.show({
        type: "success",
        text1: "Booking Cancelled",
        text2: "Successfully cancelled booking",
        position: "top",
        visibilityTime: 3000,
        swipeable: true,
        topOffset: 50,
      });
    };
    const errorHandler = ({
      text1,
      text2,
      message,
    }: {
      text1?: string;
      text2?: string;
      message?: string;
    }) => {
      Toast.show({
        type: "error",
        text1: text1 || "Error",
        text2: text2 || message,
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
    };
    socket.on("bookingCancelled", bookingCancelled);
    socket.on("error", errorHandler);
    return () => {
      socket.off("bookingCancelled", bookingCancelled);
      socket.off("error", errorHandler);
    };
  }, [setLoading, socket]);

  useEffect(() => {
    const driverAcceptedSchedule = ({
      bookingId,
      success,
    }: {
      bookingId: string;
      success: boolean;
    }) => {
      if (bookingId !== selectedDriver?.bookingId) return;

      setLoading(false);
      closeDriversModal();
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "scheduled"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "pending"],
        exact: false,
      });

      Toast.show({
        type: "success",
        text1: "Offer Accepted!",
        text2: `You have accepted ${selectedDriver?.name}'s offer.`,
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });

      setSelectedFilters(["SCHEDULED"]);
    };

    socket.on("driverAcceptedSchedule", driverAcceptedSchedule);
    return () => {
      socket.off("driverAcceptedSchedule", driverAcceptedSchedule);
    };
  }, [
    closeDriversModal,
    selectedDriver?.bookingId,
    selectedDriver?.name,
    setLoading,
    socket,
  ]);

  if (isLoading)
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

  return (
    <>
      <View className="flex-row justify-between items-center px-4 py-2">
        {/* Display current filter */}
        <Text className="font-bold">
          {selectedFilters.length === 2
            ? selectedFilters.join(" and ")
            : selectedFilters[0]}
        </Text>

        {/* Filter Popover */}
        <Popover
          placement={PopoverPlacement.LEFT}
          from={
            <Pressable className="p-2 bg-gray-200 rounded-full active:scale-95">
              <Ionicons name="options" size={28} color="black" />
            </Pressable>
          }
        >
          <View className="w-40">
            <View className="px-2 py-2 bg-lightPrimary">
              <Text className="text-lg font-bold text-white">Filter</Text>
            </View>
            {["PENDING", "SCHEDULED"].map((option) => (
              <Pressable
                onPress={() => handleFilterPress(option)}
                key={option}
                className="flex-row justify-between items-center p-3 active:scale-105"
              >
                <Text className="font-semibold">{option}</Text>
                {
                  // Check if the option is selected
                  selectedFilters.includes(option) ? (
                    <Ionicons name="checkbox" size={24} color="#FFA840" />
                  ) : (
                    <Ionicons name="square" size={24} color="#999" />
                  )
                }
              </Pressable>
            ))}
          </View>
        </Popover>
      </View>

      {/* Bookings List */}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        className="flex-1 p-4"
        contentContainerStyle={{
          paddingBottom: 40,
          gap: 15,
        }}
        renderItem={({item}) => (
          <RequestCard
            driver={item.driver}
            maxLoadKg={item.selectedVehicle.maxLoadKg ?? 0}
            status={item.status as "pending" | "scheduled"}
            vehicle={item.selectedVehicle.name}
            bookingType={item.bookingType}
            pickup={item.pickUp}
            dropoff={item.dropOff}
            distance={item.routeData.distance}
            amount={item.routeData.totalPrice}
            isCash={item.paymentMethod === "cash"}
            onCancel={() => setSelectedId(item._id)}
            onReschedule={() => setRescheduleBookingId(item._id)}
            onPressSeeMore={() => handleSeeMorePress(item)}
            driverOffers={item.requestedDrivers}
            onOpenDrivers={() => {
              setSelectedDriver(null);
              setDriversModalBookingId(item._id);
            }}
          />
        )}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator size="small" color="#FFA840" />
            </View>
          ) : null
        }
        ListEmptyComponent={() => (
          <View className="justify-center items-center px-8 py-12">
            <Ionicons name="alert-circle-outline" size={80} color="#9CA3AF" />
            <Text className="mt-6 text-2xl font-bold text-center text-gray-800">
              No Requests Yet
            </Text>
            <Text className="mt-2 text-base text-center text-gray-500">
              You currently don&apos;t have any active requests.
            </Text>
          </View>
        )}
      />

      {selectedRequest && (
        <SeeMoreModalDisplay
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          type="Request Booking"
          data={selectedRequest}
          onOpenDriverOffers={() => {
            setModalVisible(false);
            setSelectedDriver(null);
            setDriversModalBookingId(selectedRequest._id);
          }}
        />
      )}

      {selectedId && (
        <ConfirmCancelBookingModal
          visible={selectedId !== null}
          onClose={() => setSelectedId(null)}
          onConfirm={handleCancelBook}
        />
      )}

      <RescheduleModal
        visible={rescheduleBookingId !== null}
        isSubmitting={rescheduleMutation.isPending}
        onClose={() => setRescheduleBookingId(null)}
        onConfirm={(isoTime) => {
          if (!rescheduleBookingId) return;
          rescheduleMutation.mutate(
            {
              bookingId: rescheduleBookingId,
              newScheduledTime: isoTime,
            },
            {
              onSuccess: () => setRescheduleBookingId(null),
            },
          );
        }}
      />

      <DriversListModal
        visible={driversModalBookingId !== null && selectedDriver === null}
        drivers={driversForModal}
        onClose={closeDriversModal}
        onSelectDriver={(driver) =>
          setSelectedDriver({
            ...driver,
            bookingId: driver.bookingId ?? driversModalBookingId ?? undefined,
          })
        }
      />

      {selectedDriver && (
        <DriverDetailsModal
          isModalOpen
          driver={selectedDriver}
          handleCloseModal={() => setSelectedDriver(null)}
          acceptDriver={acceptDriver}
          rejectDriver={rejectDriver}
        />
      )}
    </>
  );
}

type RequestCardProps = {
  maxLoadKg: number;
  vehicle: string;
  bookingType: {
    type: string;
    value: string;
  };
  pickup: LocationDetails;
  dropoff: LocationDetails;
  distance: number;
  isCash: boolean;
  amount: number;
  onCancel: () => void;
  onReschedule: () => void;
  onPressSeeMore: () => void;
  driverOffers?: RequestedDriver[];
  onOpenDrivers: () => void;
  driver?: Driver;
  status: "pending" | "scheduled";
};

const RequestCard = ({
  maxLoadKg,
  status,
  driver,
  vehicle,
  bookingType,
  pickup,
  dropoff,
  distance,
  isCash,
  amount,
  onCancel,
  onReschedule,
  onPressSeeMore,
  driverOffers = [],
  onOpenDrivers,
}: RequestCardProps) => {
  const hasOffers = driverOffers.length > 0;
  const maxStackedAvatars = 4;
  const displayedAvatars = driverOffers.slice(0, maxStackedAvatars);
  const remainingCount = Math.max(0, driverOffers.length - maxStackedAvatars);

  return (
    <>
      <View
        style={{
          shadowColor: "#000",
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        className="rounded-2xl"
      >
        <Pressable
          onPress={onPressSeeMore}
          className="overflow-hidden bg-white rounded-2xl active:opacity-90"
        >
          {/* Header */}
          <View className="flex-row justify-between items-center px-5 py-3 bg-lightPrimary">
            <Text
              className={`font-semibold text-white ${maxLoadKg ? "text-base" : "text-lg"}`}
            >
              {vehicle} {maxLoadKg ? `(${maxLoadKg}kg)` : ""}
            </Text>
            <Text className="text-sm text-white">
              {status === "pending"
                ? bookingType.type.toUpperCase()
                : formatDate(bookingType.value)}
            </Text>
          </View>

          {/* Body */}
          <View className="px-3 py-5">
            {/* Pickup & Drop */}
            <View className="relative flex-row justify-between items-center pl-7 mr-2 ml-5 border-l border-dashed">
              <View className="gap-4">
                <Text className="font-medium max-w-56" numberOfLines={2}>
                  {formatLocation(pickup)}
                </Text>
                <Text className="font-medium max-w-56" numberOfLines={2}>
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

            {/* Assigned Driver */}
            {driver && (
              <View className="flex-row items-center p-3 mt-6 bg-green-50 rounded-xl">
                {driver.profilePictureUrl ? (
                  <Image
                    source={{uri: driver.profilePictureUrl}}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 2,
                      borderColor: "white",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 2,
                      borderColor: "white",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <Ionicons name="person-circle" size={48} color="#F7931E" />
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-green-900">
                    {driver.name}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <StarDisplay rating={driver.rating} />
                    <Text className="ml-2 text-xs text-green-700">
                      {driver.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View className="px-2 py-1 bg-green-500 rounded-md">
                  <Text className="text-xs font-medium text-white">
                    Assigned
                  </Text>
                </View>
              </View>
            )}

            {/* Driver Offers - Stacked Avatars */}
            {hasOffers && (
              <Pressable
                onPress={onOpenDrivers}
                className="flex-row justify-between items-center p-3 mt-6 bg-orange-50 rounded-xl active:bg-orange-100"
              >
                <View className="flex-row items-center">
                  {/* Stacked Avatars */}
                  <View
                    className="flex-row items-center"
                    style={{marginRight: 12}}
                  >
                    {displayedAvatars.map((driver, index) =>
                      driver.profilePicture ? (
                        <Image
                          key={driver.id}
                          source={{uri: driver.profilePicture}}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: "white",
                            marginLeft: index === 0 ? 0 : -12,
                          }}
                        />
                      ) : (
                        <View
                          key={driver.id}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            borderWidth: 2,
                            borderColor: "white",
                            marginLeft: index === 0 ? 0 : -12,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            backgroundColor: "white",
                          }}
                        >
                          <Ionicons
                            name="person-circle"
                            size={40}
                            color="#F7931E"
                          />
                        </View>
                      ),
                    )}
                    {remainingCount > 0 && (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#FF6B35",
                          borderWidth: 2,
                          borderColor: "white",
                          marginLeft: -12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text className="text-xs font-bold text-white">
                          +{remainingCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="text-sm font-semibold text-orange-900">
                      {driverOffers.length} Driver
                      {driverOffers.length > 1 ? "s" : ""} Offered
                    </Text>
                    <Text className="text-xs text-orange-700">
                      Tap to view details
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A3412" />
              </Pressable>
            )}

            {/* Payment */}
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

            {/* Buttons */}
            {(status === "pending" || status === "scheduled") && (
              <View className="flex-row justify-between mt-6">
                <Pressable
                  className="flex-row flex-1 justify-center items-center py-3 mr-2 rounded-xl border border-lightPrimary active:bg-gray-50"
                  onPress={onCancel}
                >
                  <Ionicons name="close" size={18} color="#333" />
                  <Text className="ml-2 font-medium text-gray-700">
                    Cancel Booking
                  </Text>
                </Pressable>

                {bookingType.type === "schedule" && (
                  <Pressable
                    className="flex-row flex-1 justify-center items-center py-3 ml-2 rounded-xl border border-lightPrimary active:bg-gray-50"
                    onPress={onReschedule}
                  >
                    <Ionicons name="time-outline" size={18} color="#333" />
                    <Text className="ml-2 font-medium text-gray-700">
                      Reschedule
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </>
  );
};

const DriversListModal = ({
  visible,
  drivers,
  onClose,
  onSelectDriver,
}: {
  visible: boolean;
  drivers: RequestedDriver[];
  onClose: () => void;
  onSelectDriver: (driver: RequestedDriver) => void;
}) => {
  const inset = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <Pressable
          className="flex-1 bg-black/50"
          onPress={onClose}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <View
          className="max-h-[75%] rounded-t-3xl bg-white"
          style={{paddingBottom: inset.bottom}}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">
              Driver Offers ({drivers.length})
            </Text>
            <Pressable onPress={onClose} hitSlop={20}>
              <Ionicons
                name="close"
                size={Platform.OS === "ios" ? 30 : 28}
                color="#6B7280"
              />
            </Pressable>
          </View>

          {/* Driver List */}
          <ScrollView
            className="px-4 py-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 20}}
          >
            {drivers.map((driver) => (
              <Pressable
                key={driver.id}
                onPress={() => onSelectDriver(driver)}
                className="flex-row justify-between items-center p-3 mb-3 bg-gray-50 rounded-xl active:bg-gray-100"
              >
                <View className="flex-row flex-1 gap-3 items-center">
                  {driver.profilePicture ? (
                    <Image
                      source={{uri: driver.profilePicture}}
                      style={{width: 50, height: 50, borderRadius: 25}}
                    />
                  ) : (
                    <Ionicons name="person-circle" size={50} color="#F7931E" />
                  )}

                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {driver.name}
                    </Text>
                    <View className="flex-row gap-1 items-center mt-1">
                      <Ionicons name="star" size={14} color="#FBBF24" />
                      <Text className="text-sm text-gray-600">
                        {driver.rating} ({driver.totalBookings} trip
                        {driver.totalBookings !== 1 ? "s" : ""} completed)
                      </Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
