import TollWebViewModal from "@/components/modals/tollWebViewModal";
import { useAppStore } from "@/store/useAppStore";
import { ILoadVariant, IVehicleType } from "@/types/vehicle";
import { formatDate } from "@/utils/helpers/date";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Popover, { PopoverPlacement } from "react-native-popover-view";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BookingTypeModal from "../modals/bookingTypeModal";
import { VehicleInfoModal } from "../modals/vehicleInfoModal";
import LocationInputs from "./LocationInputs";
import SheetButton from "./SheetButton";

const BookSheet = ({
  isDragging,
  onOpenSearch,
  toZoomOut,
}: {
  isDragging: boolean;
  onOpenSearch: (type: "pickup" | "dropoff") => void;
  toZoomOut: () => void;
}) => {
  const sheetRef = useRef<BottomSheet>(null);
  const previousSnapIndex = useRef<number>(1); // Store the previous index (default to 1, second snap point)

  const insets = useSafeAreaInsets();
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectTimeModalVisible, setSelectTimeModalVisible] = useState(false);
  const [tollModalVisible, setTollModalVisible] = useState(false);
  const [tollPopoverVisible, setTollPopoverVisible] = useState(false);

  const bookingType = useAppStore((state) => state.bookingType);
  const selectedVehicle = useAppStore((state) => state.selectedVehicle);
  const setSelectedVehicle = useAppStore((state) => state.setSelectedVehicle);
  const vehicles = useAppStore((state) => state.vehicles);
  const vehicleError = useAppStore((state) => state.vehicleError);
  const fetchVehicles = useAppStore((state) => state.fetchVehicles);
  const vehicleLoading = useAppStore((state) => state.vehicleLoading);

  const services = useAppStore((state) => state.addedServices);
  const toggleService = useAppStore((state) => state.toggleService);

  const fetchBookingTypes = useAppStore((state) => state.fetchBookingTypes);
  const bookingTypesError = useAppStore((state) => state.bookingTypesError);
  const bookingTypesLoading = useAppStore((state) => state.bookingTypesLoading);

  const hasDistanceFee = useAppStore((state) => state.routeData.distanceFee);

  const vehicleScrollRef = useRef<ScrollView>(null);
  const [vehicleItemWidth] = useState(90);

  const variantScrollRef = useRef<ScrollView>(null);
  const [variantItemWidth] = useState(140);

  // Memoize the selected vehicle's full data to avoid repeated .find() calls
  const selectedVehicleData = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find((v) => v.key === selectedVehicle.key) ?? null;
  }, [selectedVehicle, vehicles]);

  // Memoize active variants for the selected vehicle
  const activeVariants = useMemo(() => {
    if (!selectedVehicleData?.variants) return [];
    return selectedVehicleData.variants.filter((v) => v.isActive);
  }, [selectedVehicleData]);

  const hasMultipleVariants = (selectedVehicleData?.variants?.length ?? 0) > 1;

  const tollService = useMemo(
    () =>
      selectedVehicle?.paidServices?.find((s) => s.key === "toll_fee") ?? null,
    [selectedVehicle],
  );
  const isTollSelected = services.some((s) => s.key === "toll_fee");
  const showTollToggle =
    !!tollService && selectedVehicle?.key !== "motorcycle";

  // to adjust the height of the sheet
  const snapPoints = useMemo(() => {
    // Exact height in pixels rather than screen percentages
    const baseFirst = 170;
    const baseSecond = showTollToggle && tollService ? 475 : 435;

    const first = baseFirst + insets.bottom;
    const second = baseSecond + insets.bottom + (hasMultipleVariants ? 50 : 0);

    return [first, second];
  }, [showTollToggle, tollService, insets.bottom, hasMultipleVariants]);

  const bookingTypeDisplay = useMemo(() => {
    if (!bookingType) return "Select option";
    if (bookingType.type === "asap") {
      return `${bookingType.type.toUpperCase()} - ${bookingType.value}`;
    } else if (bookingType.type === "schedule") {
      return formatDate(bookingType.value);
    } else return bookingType.value;
  }, [bookingType]);

  const handleVehicleSelect = (vehicle: IVehicleType, index: number) => {
    setSelectedVehicle({
      _id: vehicle._id,
      key: vehicle.key,
      refCode: vehicle.refCode,
      name: vehicle.name,
      imageUrl: vehicle.imageUrl,
      freeServices: vehicle.freeServices,
      searchConfig: vehicle.searchConfig,
      paidServices: vehicle.paidServices,
      variant: vehicle.variants[0],
    });

    if (services.some((s) => s.key === "toll_fee") && vehicle.key === "motorcycle") {
      toggleService(services.find((s) => s.key === "toll_fee")!);
    }

    if (vehicleScrollRef.current) {
      const screenWidth = Dimensions.get("window").width;
      const scrollPosition =
        index * vehicleItemWidth - screenWidth / 2 + vehicleItemWidth / 2 + 15;
      vehicleScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  };

  const handleVariantSelect = (variant: ILoadVariant, index: number) => {
    setSelectedVehicle({
      ...selectedVehicle!,
      variant,
    });

    if (variantScrollRef.current) {
      const screenWidth = Dimensions.get("window").width;
      const scrollPosition =
        index * variantItemWidth - screenWidth / 2 + variantItemWidth / 2 + 50; // Adjust -20 to move left/right
      variantScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  };

  // Snap to first position when dragging, restore when not dragging
  useEffect(() => {
    if (isDragging) sheetRef.current?.snapToIndex(0);
    else
      // Restore to previous position when user stops dragging
      sheetRef.current?.snapToIndex(previousSnapIndex.current);
  }, [isDragging]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (!isDragging) {
        previousSnapIndex.current = index;
      }
    },
    [isDragging],
  );

  useEffect(() => {
    if (hasDistanceFee) {
      toZoomOut();
    }
  }, [hasDistanceFee, toZoomOut]);

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={handleSheetChange}
        enableDynamicSizing={false}
        handleIndicatorStyle={{ backgroundColor: "#FFA840" }}
        enableContentPanningGesture={false} // 👈 This is the key
        containerStyle={{ zIndex: 20 }}
      >
        <View className="flex-row justify-between items-center pb-5 pt-1.5 px-3">
          <Text className="text-lg font-bold">Booking Type</Text>

          {bookingTypesLoading ? (
            <View className="flex-row gap-2 items-center px-4 py-2 bg-white rounded-full border-2 opacity-70 border-lightPrimary">
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-sm font-semibold text-gray-500">
                Loading options...
              </Text>
            </View>
          ) : bookingTypesError ? (
            <View className="flex-row gap-2 items-center px-4 py-2 bg-red-50 rounded-full border border-red-400">
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text className="text-sm font-semibold text-red-500">
                Failed to load
              </Text>

              <Pressable
                onPress={fetchBookingTypes}
                className="px-3 py-1 ml-2 bg-red-500 rounded-full active:scale-95"
              >
                <Text className="text-xs font-bold text-white">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setSelectTimeModalVisible(true)}
              className="relative flex-row gap-2 items-center px-4 py-2 bg-white rounded-full border-2 border-lightPrimary active:scale-95"
            >
              <Text className="absolute -left-1 -top-3 text-sm font-semibold bg-white text-darkPrimary">
                Option:
              </Text>

              <Text className="text-sm font-bold text-gray-900">
                {bookingTypeDisplay}
              </Text>

              <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        <BottomSheetScrollView className="flex-1 px-3">
          <View className="gap-4 mb-40">
            <View className="gap-1 justify-center items-center">
              <View className="flex-row items-center justify-between w-full gap-2">
                <View className="flex-row gap-1 justify-center items-center shrink">
                  <Text className="text-sm font-semibold text-gray-900">
                    Choose Vehicle
                  </Text>
                  <Pressable
                    onPress={() => setInfoModalVisible(true)}
                    hitSlop={20}
                  >
                    <Ionicons
                      name="information-circle"
                      color="#FFA840"
                      size={Platform.OS === "ios" ? 22 : 20}
                    />
                  </Pressable>
                </View>


              </View>

              {vehicleLoading ? (
                <View className="px-2 py-2 w-full">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {[1, 2, 3, 4].map((item) => (
                      <View key={item} className="gap-1 items-center">
                        <View className="items-center px-4 py-2 bg-gray-100 rounded-lg">
                          {/* Vehicle name skeleton */}
                          <View className="mb-3 w-16 h-3 bg-gray-300 rounded" />
                          {/* Vehicle image skeleton */}
                          <View className="w-11 h-9 bg-gray-300 rounded" />
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : vehicleError ? (
                <View className="flex-row gap-2 items-center px-3 py-2 h-12 bg-red-100 rounded-lg">
                  <Text className="flex-1 text-xs text-red-800">
                    {vehicleError}
                  </Text>
                  <Pressable onPress={fetchVehicles}>
                    <Text className="text-sm font-semibold text-red-900 underline">
                      Retry
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView
                    ref={vehicleScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="py-2 w-full"
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {vehicles.map((v, index) => (
                      <View key={v.key} className="relative gap-1 items-center">
                        <Pressable
                          className={`items-center gap-3 px-4 py-2 rounded-lg ${selectedVehicle?.key === v.key
                            ? "border-2 border-lightPrimary"
                            : ""
                            }`}
                          onPress={() => handleVehicleSelect(v, index)}
                        >
                          <Text
                            className={`text-xs text-gray-500 ${selectedVehicle?.key === v.key
                              ? "font-semibold"
                              : ""
                              }`}
                          >
                            {v.name}
                          </Text>
                          <Image
                            source={v.imageUrl}
                            style={{ height: 35, width: 45 }}
                            contentFit="contain"
                          />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>

                  {hasMultipleVariants && (
                    <Animated.View
                      key={selectedVehicle!.key}
                      entering={FadeInDown.duration(300).springify()}
                      className="px-2 py-1 w-full"
                    >
                      <ScrollView
                        ref={variantScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="px-2"
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {activeVariants.map((variant, index) => {
                          const isSelected =
                            selectedVehicle!.variant?.maxLoadKg ===
                            variant.maxLoadKg;

                          return (
                            <Pressable
                              key={variant.maxLoadKg}
                              className={`px-5 py-3 rounded-xl ${isSelected ? "bg-lightPrimary" : "bg-gray-200"
                                }`}
                              onPress={() =>
                                handleVariantSelect(variant, index)
                              }
                            >
                              <Text
                                className={`text-sm ${isSelected
                                  ? "font-semibold text-white"
                                  : "font-medium text-gray-700"
                                  }`}
                              >
                                Max Load: {variant.maxLoadKg}kg
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </Animated.View>
                  )}
                </>
              )}
            </View>

            <LocationInputs onOpenSearch={onOpenSearch} />
            {showTollToggle && tollService && (
              <View className="flex-row items-center justify-between px-2">
                <View className="flex-row items-center gap-1.5 flex-1">
                  <Text
                    className={`text-sm ${isTollSelected
                      ? "font-semibold text-gray-900"
                      : "font-medium text-gray-700"
                      }`}
                    numberOfLines={1}
                  >
                    {tollService.name}
                  </Text>

                  <Popover
                    isVisible={tollPopoverVisible}
                    onRequestClose={() => setTollPopoverVisible(false)}
                    placement={PopoverPlacement.TOP}
                    from={
                      <Pressable
                        onPress={() => setTollPopoverVisible(true)}
                        hitSlop={10}
                        className="p-0.5"
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color="#9CA3AF"
                        />
                      </Pressable>
                    }
                  >
                    <View className="px-3 py-2.5 bg-white rounded-lg max-w-[240px] gap-2">
                      <Text className="text-sm text-gray-700 leading-relaxed">
                        {tollService.desc}
                      </Text>

                      <View className="flex-row items-center gap-1">
                        <Text className="text-xs font-medium text-blue-600">
                          Actual Cost
                        </Text>

                        <Pressable
                          onPress={() => {
                            setTollPopoverVisible(false);
                            setTollModalVisible(true);
                          }}
                          hitSlop={8}
                          className="flex-row self-start items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 active:bg-blue-100"
                        >
                          <Ionicons
                            name="receipt-outline"
                            size={12}
                            color="#1D4ED8"
                          />
                          <Text className="text-xs font-medium text-blue-700">
                            View toll rates
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Popover>
                </View>

                <Pressable
                  onPress={() => toggleService(tollService)}
                  hitSlop={8}
                  className="ml-3"
                >
                  <View
                    className={`w-5 h-5 rounded-md border items-center justify-center ${isTollSelected
                      ? "bg-lightPrimary border-lightPrimary"
                      : "bg-white border-gray-300"
                      }`}
                  >
                    {isTollSelected && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      <SheetButton
        next={() => router.push("/(root_screens)/booking/services")}
      />

      {infoModalVisible && (
        <VehicleInfoModal
          visible={infoModalVisible}
          setModalVisible={setInfoModalVisible}
          vehicles={vehicles}
        />
      )}

      {selectTimeModalVisible && (
        <BookingTypeModal
          visible={selectTimeModalVisible}
          onClose={() => setSelectTimeModalVisible(false)}
        />
      )}

      <TollWebViewModal
        visible={tollModalVisible}
        onClose={() => setTollModalVisible(false)}
      />
    </>
  );
};

export default BookSheet;
