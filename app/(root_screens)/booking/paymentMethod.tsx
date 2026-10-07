import VoucherPickerModal from "@/components/voucher/VoucherPickerModal";
import {useAuth} from "@/hooks/useAuth";
import {clearCachedQuotes, requestFreshQuote} from "@/hooks/useBookingQuote";
import {queryClient} from "@/lib/queryClient";
import {rewardKeys} from "@/queries/rewardQueries";
import {useSocket} from "@/sockets/context/SocketProvider";
import {useAppStore} from "@/store/useAppStore";
import {Booking, RequestBooking} from "@/types/book";
import {IssuedReward} from "@/types/voucher";
import {STATIC_IMAGES} from "@/utils/constants";
import {generateBookingRef} from "@/utils/helpers/booking";
import {isQuoteRedeemable} from "@/utils/helpers/quote";
import {uploadBookingImages} from "@/utils/helpers/imagePicker";
import {formatCurrency} from "@/utils/helpers/voucher";
import {Ionicons} from "@expo/vector-icons";
import {InfiniteData} from "@tanstack/react-query";
import {Image} from "expo-image";
import {router, useFocusEffect} from "expo-router";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Alert, Platform, Pressable, Text, View} from "react-native";
import {SafeAreaView, useSafeAreaInsets} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function PaymentMethod() {
  const insets = useSafeAreaInsets();
  const paymentMethod = useAppStore((state) => state.paymentMethod);
  const isLoading = useAppStore((state) => state.isLoading);

  const routeData = useAppStore((state) => state.routeData);
  const {bookingType, setPaymentMethod} = useAppStore.getState();
  const [loading, setLoading] = useState(false);

  // Voucher state
  const [showVoucherPicker, setShowVoucherPicker] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<{
    reward: IssuedReward;
    discountAmount: number;
    netAmount: number;
  } | null>(null);

  const {id} = useAuth();
  const socket = useSocket();
  const hasNavigatedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const lastBookingRefRef = useRef<string | null>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSubmitTimeout = () => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  };

  // Clear voucher selection when screen loses focus or fare changes
  useFocusEffect(
    useCallback(() => {
      // Keep voucher selected on focus
      return () => {
        // Cleanup on unfocus if needed
      };
    }, []),
  );

  const handleVoucherSelect = (
    reward: IssuedReward,
    preview: {discountAmount: number; netAmount: number},
  ) => {
    setSelectedVoucher({
      reward,
      discountAmount: preview.discountAmount,
      netAmount: preview.netAmount,
    });
  };

  const handleRemoveVoucher = () => {
    setSelectedVoucher(null);
  };

  const handleBookNow = async () => {
    // Immediate protection against rapid clicks (ref is synchronous, no render delay)
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);

      const {
        selectedVehicle,
        pickUp,
        dropOff,
        addedServices,
        photos,
        note,
        itemType,
        paidBy,
      } = useAppStore.getState();

      if (!selectedVehicle || !selectedVehicle.variant || !pickUp || !dropOff) {
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      if (!bookingType) {
        Toast.show({
          type: "error",
          text1: "Booking type required",
          text2: "Please select a booking type and try again.",
          position: "top",
          visibilityTime: 4000,
        });
        setLoading(false);
        isSubmittingRef.current = false;
        router.back();
        return;
      }

      if (!selectedVehicle.refCode) {
        Toast.show({
          type: "error",
          text1: "Vehicle unavailable",
          text2: "Please reselect your vehicle and try again.",
          position: "top",
          visibilityTime: 4000,
        });
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const bookingRef = generateBookingRef({
        bookingType: bookingType.type,
        refCode: selectedVehicle.refCode,
        priority: bookingType.type === "asap" ? bookingType.value : undefined,
      });

      // Idempotency check: prevent duplicate submission with same booking ref
      if (lastBookingRefRef.current === bookingRef) {
        console.warn(
          "⚠️ Duplicate booking ref detected, ignoring:",
          bookingRef,
        );
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      // The price must be a fresh server-locked quote. If the one we hold is
      // missing or about to expire, lock a new one first; when the price moved,
      // stop here so the user sees the new total before confirming.
      if (!isQuoteRedeemable(useAppStore.getState())) {
        const previousTotal = useAppStore.getState().routeData.totalPrice;
        const fresh = await requestFreshQuote();
        const newTotal = fresh.routeData.totalPrice;

        if (newTotal !== previousTotal) {
          if (selectedVoucher) setSelectedVoucher(null);
          setLoading(false);
          isSubmittingRef.current = false;
          Alert.alert(
            "Price updated",
            `Your total is now Php ${newTotal.toFixed(2)}.${selectedVoucher ? " Please re-apply your voucher." : ""} Tap Book Now to confirm.`,
          );
          return;
        }
      }

      const lockedQuoteId = useAppStore.getState().quoteId;
      if (!lockedQuoteId) {
        throw new Error("We couldn't lock your price. Please try again.");
      }

      lastBookingRefRef.current = bookingRef;

      // Upload images first
      const uploadResult = await uploadBookingImages(photos, bookingRef);

      if (!uploadResult.success) {
        Toast.show({
          type: "error",
          text1: "Upload Failed",
          text2: "Could not upload photos. Please try again.",
          position: "top",
          visibilityTime: 4000,
        });
        setLoading(false);
        isSubmittingRef.current = false;
        lastBookingRefRef.current = null;
        return;
      }

      const payload: RequestBooking = {
        customerId: id!,
        bookingRef,
        quoteId: lockedQuoteId,
        pickUp: pickUp,
        dropOff: dropOff,
        bookingType: bookingType,
        selectedVehicle: {
          _id: selectedVehicle._id,
          key: selectedVehicle.key,
          variant: selectedVehicle.variant,
          searchConfig: selectedVehicle.searchConfig,
        },
        paymentMethod: paymentMethod,
        paidBy: paidBy,
        addedServices: addedServices.map((service) => ({
          key: service.key,
          quantity: service.quantity ?? 1,
        })),
        photos: uploadResult.images, // Cloudinary URLs
        note: note.trim(),
        itemType: itemType,
        voucherRewardId: selectedVoucher?.reward._id, // Include voucher if selected
      };

      // Send via socket
      if (bookingType.type === "asap") {
        socket.emit("request_asap_booking", payload);
      } else if (bookingType.type === "schedule") {
        socket.emit("request_schedule_booking", payload);
      } else if (bookingType.type === "pooling") {
        socket.emit("request_pooling_booking", payload);
      }

      clearSubmitTimeout();
      submitTimeoutRef.current = setTimeout(() => {
        if (hasNavigatedRef.current) return;
        setLoading(false);
        isSubmittingRef.current = false;
        lastBookingRefRef.current = null;
        Toast.show({
          type: "error",
          text1: "Request Timeout",
          text2: "Server not responding. Please try again.",
          position: "top",
          visibilityTime: 4000,
        });
      }, 15000);
    } catch (error) {
      console.error("Booking submission error:", error);
      clearSubmitTimeout();
      setLoading(false);
      isSubmittingRef.current = false;
      lastBookingRefRef.current = null;

      Toast.show({
        type: "error",
        text1: "Booking Failed",
        text2: error instanceof Error ? error.message : "Something went wrong",
        position: "top",
        visibilityTime: 4000,
      });
    }
  };

  useEffect(() => {
    const bookingSaved = (data: {
      success: boolean;
      bookingId: string;
      city?: string;
      message: string;
      noDriversOnline?: boolean;
    }) => {
      clearSubmitTimeout();
      // Guard against duplicate events causing multiple navigation
      if (hasNavigatedRef.current) return;

      setLoading(false);

      if (data.success) {
        hasNavigatedRef.current = true;

        // Invalidate voucher queries if a voucher was used
        if (selectedVoucher) {
          void queryClient.invalidateQueries({queryKey: rewardKeys.all});
        }

        // Build a Booking from store state and prepend to pending cache
        const state = useAppStore.getState();
        const newBooking: Booking = {
          _id: data.bookingId,
          bookingRef: lastBookingRefRef.current ?? "",
          customerId: id!,
          pickUp: state.pickUp,
          dropOff: state.dropOff,
          bookingType: {
            type: state.bookingType!.type,
            value: state.bookingType!.value,
          },
          selectedVehicle: {
            name: state.selectedVehicle?.name ?? "",
            maxLoadKg: state.selectedVehicle?.variant?.maxLoadKg ?? 0,
            freeServices: state.selectedVehicle?.freeServices ?? [],
          },
          routeData: state.routeData,
          paymentMethod: state.paymentMethod,
          paidBy: state.paidBy,
          addedServices: state.addedServices,
          note: state.note.trim(),
          itemType: state.itemType,
          photos: state.photos,
          createdAt: new Date().toISOString(),
          status: "pending",
          driverRating: null,
          cancelledAt: null,
          requestedDrivers: [],
          voucherApplied: selectedVoucher
            ? {
                issuedRewardId: selectedVoucher.reward._id,
                voucherTemplateId: selectedVoucher.reward.voucherId?._id ?? "",
                discountAmount: selectedVoucher.discountAmount,
              }
            : null,
        };

        if (!state.bookingType) return;

        if (
          state.bookingType.type === "asap" ||
          state.bookingType.type === "pooling"
        )
          router.push({
            pathname: "/(root_screens)/booking/searchingDriver",
            params: {
              bookingId: data.bookingId,
              type: state.bookingType.type,
              city: data.city,
            },
          });
        else {
          Toast.show({
            type: data.noDriversOnline ? "info" : "success",
            text1: data.noDriversOnline
              ? "Booking saved"
              : "Booking Request Saved",
            text2: data.message,
            position: "top",
            visibilityTime: 5_000,
            swipeable: true,
            topOffset: 50,
          });
          queryClient.invalidateQueries({
            queryKey: ["userBookingCounts"],
          });
          router.replace("/(drawer)/(tabs)/request");

          // Prepend to pending cache so the Request tab shows it immediately
          queryClient.setQueriesData<
            InfiniteData<{bookings: Booking[]; nextPage: number | null}>
          >({queryKey: ["userBookings", "pending"]}, (oldData) => {
            if (!oldData) return oldData;
            const newPages = [...oldData.pages];
            newPages[0] = {
              ...newPages[0],
              bookings: [newBooking, ...newPages[0].bookings],
            };
            return {...oldData, pages: newPages};
          });
        }

        state.clearStates();
        clearCachedQuotes();
      }
    };

    socket.on("bookingRequestSaved", bookingSaved);
    return () => {
      socket.off("bookingRequestSaved", bookingSaved);
      clearSubmitTimeout();
    };
  }, [id, setLoading, socket, bookingType?.type, selectedVoucher]);

  useEffect(() => {
    const handleBookingFailed = (data: {
      message: string;
      code?: string;
      approvalStatus?: string;
      voucherError?: boolean;
    }) => {
      clearSubmitTimeout();
      setLoading(false);
      isSubmittingRef.current = false;
      lastBookingRefRef.current = null;

      // The price lock was rejected (expired / inputs changed / missing):
      // lock a fresh one and let the user review before booking again.
      if (
        data.code === "QUOTE_EXPIRED" ||
        data.code === "QUOTE_MISMATCH" ||
        data.code === "QUOTE_REQUIRED"
      ) {
        const previousTotal = useAppStore.getState().routeData.totalPrice;
        clearCachedQuotes();
        void requestFreshQuote()
          .then((fresh) => {
            const newTotal = fresh.routeData.totalPrice;
            if (selectedVoucher && newTotal !== previousTotal) {
              setSelectedVoucher(null);
            }
            Alert.alert(
              "Price updated",
              newTotal !== previousTotal
                ? `Your total is now Php ${newTotal.toFixed(2)}. Tap Book Now to confirm.`
                : "Your price was refreshed. Tap Book Now to continue.",
            );
          })
          .catch((err) => {
            Toast.show({
              type: "error",
              text1: "Couldn't refresh price",
              text2: err instanceof Error ? err.message : data.message,
              position: "top",
              visibilityTime: 4000,
            });
          });
        return;
      }

      // Quote already used / being used: drop it so the next try locks a new one.
      if (data.code === "QUOTE_USED" || data.code === "QUOTE_IN_USE") {
        clearCachedQuotes();
        useAppStore.getState().resetQuote();
      }

      // Handle voucher-specific errors
      if (data.voucherError && selectedVoucher) {
        // Invalidate voucher queries to refresh the list
        void queryClient.invalidateQueries({queryKey: rewardKeys.all});

        // Clear invalid voucher selection
        setSelectedVoucher(null);

        Toast.show({
          type: "error",
          text1: "Voucher Error",
          text2: data.message || "Selected voucher is no longer valid",
          position: "top",
          visibilityTime: 5000,
        });
        return;
      }

      if (data.approvalStatus) {
        useAppStore.getState().setAuthData({
          approvalStatus: data.approvalStatus as
            "pending" | "approved" | "rejected",
        });
      }

      Toast.show({
        type: "error",
        text1: "Booking Failed",
        text2: data.message || "Something went wrong",
        position: "top",
        visibilityTime: 4000,
      });
    };

    socket.on("bookingRequestFailed", handleBookingFailed);
    return () => {
      socket.off("bookingRequestFailed", handleBookingFailed);
    };
  }, [socket, setLoading, selectedVoucher]);

  useEffect(() => {
    const handleNoDriversAvailable = (data: {message: string}) => {
      // ASAP/pooling keep existing behavior. Schedule already toasts via
      // bookingRequestSaved; only show this if that event already ran.
      if (bookingType?.type !== "schedule") return;
      if (!hasNavigatedRef.current) return;

      Toast.show({
        type: "info",
        text1: "No drivers online yet",
        text2:
          data.message ||
          "Your booking is saved. You'll be notified when a driver offers.",
        position: "top",
        visibilityTime: 5000,
        swipeable: true,
        topOffset: 50,
      });
    };

    socket.on("no_drivers_available", handleNoDriversAvailable);
    return () => {
      socket.off("no_drivers_available", handleNoDriversAvailable);
    };
  }, [bookingType?.type, socket]);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: "white"}}>
      {/* header */}
      <View className="relative flex-row justify-center items-center px-6 pt-2 pb-8">
        <Pressable
          className="absolute left-5 top-1.5"
          onPress={() => router.back()}
          hitSlop={20}
        >
          <Ionicons
            name="chevron-back"
            size={Platform.OS === "ios" ? 32 : 28}
            color="#FFA840"
          />
        </Pressable>
        <Text className="text-lg font-semibold">Payment Method</Text>
        <Text className="absolute text-sm font-semibold right-5 top-3.5">
          Step 4/4
        </Text>
      </View>

      <View className="gap-4 px-6">
        {/* Voucher Selection */}
        {selectedVoucher ? (
          <Pressable
            onPress={() => setShowVoucherPicker(true)}
            className="flex-row items-center justify-between rounded-xl border border-green-500 bg-green-50 px-4 py-3"
          >
            <View className="flex-1 flex-row gap-3 items-center">
              <View className="justify-center items-center w-10 h-10 bg-green-100 rounded-full">
                <Ionicons name="ticket" size={24} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-green-900">
                  {selectedVoucher.reward.voucherId?.code}
                </Text>
                <Text className="text-xs text-green-700">
                  Saving {formatCurrency(selectedVoucher.discountAmount)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleRemoveVoucher}
              hitSlop={10}
              className="ml-2 p-1"
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </Pressable>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowVoucherPicker(true)}
            className="flex-row items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 active:bg-gray-50"
          >
            <View className="flex-row gap-3 items-center">
              <View className="justify-center items-center w-10 h-10 bg-orange-50 rounded-full">
                <Ionicons name="ticket-outline" size={24} color="#FFA840" />
              </View>
              <View>
                <Text className="text-sm font-medium text-gray-800">
                  Use Voucher
                </Text>
                <Text className="text-xs text-gray-500">
                  Apply discount to your booking
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        )}

        {/* Payment Method Group */}
        <View>
          <Text className="text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">
            Payment Method
          </Text>
          <View className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <Pressable
              onPress={() => setPaymentMethod("cash")}
              className={`flex-row items-center justify-between px-4 py-3 border-b border-gray-100 ${
                paymentMethod === "cash" ? "bg-[#FFF6EB]" : "bg-white"
              }`}
            >
              <View className="flex-row gap-3 items-center">
                <View className="justify-center items-center w-10 h-10 bg-blue-50 rounded-full">
                  <Image
                    source={STATIC_IMAGES.cashPayment}
                    style={{width: 24, height: 24}}
                    contentFit="contain"
                  />
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-800">
                    Cash Payment
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Pay directly to driver
                  </Text>
                </View>
              </View>
              {paymentMethod === "cash" && (
                <Ionicons name="checkmark-circle" size={22} color="#FFA840" />
              )}
            </Pressable>

            <Pressable
              onPress={() => setPaymentMethod("gcash")}
              className={`flex-row items-center justify-between px-4 py-3 ${
                paymentMethod === "gcash" ? "bg-[#FFF6EB]" : "bg-white"
              }`}
            >
              <View className="flex-row gap-3 items-center">
                <View className="justify-center items-center w-10 h-10 bg-blue-50 rounded-full">
                  <Image
                    source={STATIC_IMAGES.gcash}
                    style={{width: 24, height: 24}}
                    contentFit="contain"
                  />
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-800">
                    GCash Manual Payment
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Pay via GCash wallet manually
                  </Text>
                </View>
              </View>
              {paymentMethod === "gcash" && (
                <Ionicons name="checkmark-circle" size={22} color="#FFA840" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <View
        className="z-30 gap-2 px-5 py-3 bg-white"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 10,
        }}
      >
        {/* Fare Breakdown */}
        {routeData.basePrice > 0 && (
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-gray-500">
              Base Fare
            </Text>
            <Text className="text-xs font-semibold text-gray-500">
              Php {routeData.basePrice.toFixed(2)}
            </Text>
          </View>
        )}

        {routeData.distanceFee > 0 && (
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-gray-500">
              Distance / Duration ({routeData.distance.toFixed(2)} km -{" "}
              {routeData.duration.toFixed(0)} min)
            </Text>
            <Text className="text-xs font-semibold text-gray-500">
              Php {routeData.distanceFee.toFixed(2)}
            </Text>
          </View>
        )}

        {routeData.serviceFee > 0 && (
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-gray-500">
              Added Services ({useAppStore.getState().addedServices.length})
            </Text>
            <Text className="text-xs font-semibold text-gray-500">
              Php {routeData.serviceFee.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Voucher Discount */}
        {selectedVoucher && (
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-green-600">
              Voucher Discount
            </Text>
            <Text className="text-xs font-semibold text-green-600">
              - Php {selectedVoucher.discountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Total / Amount to Pay */}
        <View className="flex-row justify-between items-center mt-1">
          <Text className="font-semibold">
            {selectedVoucher ? "Amount to Pay" : "Total Amount"}
          </Text>
          <Text className="text-lg font-bold text-lightPrimary">
            Php{" "}
            {selectedVoucher
              ? selectedVoucher.netAmount.toFixed(2)
              : routeData.totalPrice.toFixed(2)}
          </Text>
        </View>

        {selectedVoucher && (
          <Text className="text-xs text-gray-500 text-right -mt-1">
            Original: Php {routeData.totalPrice.toFixed(2)}
          </Text>
        )}

        <Pressable
          className={`flex-1 py-3 rounded-md bg-lightPrimary ${loading ? "opacity-50" : "active:bg-darkPrimary"}`}
          onPress={handleBookNow}
          disabled={loading}
        >
          <Text className="text-lg font-bold text-center text-white">
            {loading ? "Booking..." : "Book Now"}
          </Text>
        </Pressable>
      </View>

      {/* Voucher Picker Modal */}
      <VoucherPickerModal
        visible={showVoucherPicker}
        onClose={() => setShowVoucherPicker(false)}
        onSelect={handleVoucherSelect}
        orderValue={routeData.totalPrice}
        selectedRewardId={selectedVoucher?.reward._id}
      />
    </SafeAreaView>
  );
}
