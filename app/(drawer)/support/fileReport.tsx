import {reportAPI} from "@/api/reports";
import {useBookingSettings} from "@/hooks/useBookingSettings";
import {useSubmitReportMutation} from "@/mutations/reportMutation";
import {Booking} from "@/types/book";
import {CategoryOption} from "@/types/report";
import {openGallery, takePhoto} from "@/utils/helpers/imagePicker";
import {formatLocation} from "@/utils/helpers/location";
import {Ionicons} from "@expo/vector-icons";
import {useQuery} from "@tanstack/react-query";
import {Image} from "expo-image";
import {router, useLocalSearchParams} from "expo-router";
import React, {useEffect, useMemo, useState} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";

const MAX_PHOTOS = 5;
const PHOTO_GAP = 10;
const PHOTO_COLS = 3;

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  no_show_driver: "time-outline",
  late: "timer-outline",
  rude: "person-remove-outline",
  damaged: "warning-outline",
  wrong_dropoff: "location-outline",
  other: "ellipsis-horizontal-circle-outline",
};

export default function FileReportScreen() {
  const {width: screenWidth} = useWindowDimensions();
  const {reportWindowDays} = useBookingSettings();
  const {bookingId: bookingIdParam} = useLocalSearchParams<{
    bookingId?: string | string[];
  }>();
  const bookingId = Array.isArray(bookingIdParam)
    ? bookingIdParam[0]
    : bookingIdParam;
  const photoSlotSize =
    (screenWidth - 40 - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<(string | null)[]>(
    Array(MAX_PHOTOS).fill(null),
  );
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  /** Last bookingId param we applied — must update when navigating to a different booking. */
  const [preselectedId, setPreselectedId] = useState<string | null>(null);

  // Fetch eligible bookings from backend (already filtered)
  const {
    data: eligibleBookingsData,
    isLoading: isLoadingBookings,
    error: bookingsError,
  } = useQuery({
    queryKey: ["eligibleBookings"],
    queryFn: reportAPI.getEligibleBookings,
  });

  const eligibleBookings = useMemo(
    () => eligibleBookingsData?.bookings ?? [],
    [eligibleBookingsData?.bookings],
  );

  // Pre-select booking when navigated with bookingId (e.g. from Completed/Cancelled)
  useEffect(() => {
    if (!bookingId || isLoadingBookings || !eligibleBookingsData) return;
    if (preselectedId === bookingId) return;

    const match = eligibleBookings.find(
      (b) => String(b._id) === String(bookingId),
    );
    setPreselectedId(bookingId);

    if (match) {
      setSelectedBooking(match);
      setSelectedCategory(null);
      setDescription("");
      setImages(Array(MAX_PHOTOS).fill(null));
      setShowBookingPicker(false);
      return;
    }

    Alert.alert(
      "Unable to report",
      `This booking is not eligible for reporting. Completed bookings and driver no-shows can be reported within ${reportWindowDays} days, and only if you haven't already filed a report.`,
    );
  }, [
    bookingId,
    preselectedId,
    eligibleBookings,
    eligibleBookingsData,
    isLoadingBookings,
    reportWindowDays,
  ]);

  // Drop selection if that booking was reported / removed from eligible list
  useEffect(() => {
    if (!eligibleBookingsData || isLoadingBookings || !selectedBooking) return;

    const stillEligible = eligibleBookings.some(
      (b) => String(b._id) === String(selectedBooking._id),
    );
    if (stillEligible) return;

    setSelectedBooking(null);
    setSelectedCategory(null);
    setDescription("");
    setImages(Array(MAX_PHOTOS).fill(null));
    setShowBookingPicker(false);
  }, [
    eligibleBookings,
    eligibleBookingsData,
    isLoadingBookings,
    selectedBooking,
  ]);

  const availableCategories: CategoryOption[] =
    selectedBooking?.status === "cancelled" &&
    selectedBooking?.cancellationReason === "no_show_driver"
      ? [{category: "no_show_driver", label: "Driver No-Show"}]
      : [
          {category: "late", label: "Driver Late"},
          {category: "rude", label: "Driver Misconduct"},
          {category: "damaged", label: "Damaged Package"},
          {category: "wrong_dropoff", label: "Wrong Drop-off"},
          {category: "other", label: "Other Issue"},
        ];

  const filledPhotoCount = images.filter(Boolean).length;
  const submitMutation = useSubmitReportMutation();

  const addImageAt = (index: number, uri: string) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = uri;
      return next;
    });
  };

  const handleAddPhoto = (index: number) => {
    if (images[index]) return;

    Alert.alert("Add Photo", "Choose an option", [
      {text: "Cancel", style: "cancel"},
      {
        text: "Take Photo",
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) addImageAt(index, uri);
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          const result = await openGallery();
          if (result && !result.canceled && result.assets?.length) {
            addImageAt(index, result.assets[0].uri);
          }
        },
      },
    ]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      while (next.length < MAX_PHOTOS) next.push(null);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!selectedBooking) {
      Alert.alert("Required", "Please select a booking");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Required", "Please select a category");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required", "Please provide a description");
      return;
    }

    const photoUris = images.filter((uri): uri is string => !!uri);

    submitMutation.mutate(
      {
        bookingId: selectedBooking._id,
        category: selectedCategory,
        description: description.trim(),
        images: photoUris.map((uri, i) => ({
          uri,
          type: "image/jpeg",
          fileName: `report-${i + 1}.jpg`,
        })),
      },
      {onSuccess: () => router.back()},
    );
  };

  const canSubmit =
    !!selectedBooking &&
    !!selectedCategory &&
    description.trim().length > 0 &&
    !submitMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 py-4"
          contentContainerStyle={{paddingBottom: 40}}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900">
              File a Report
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              Report issues within {reportWindowDays} days of completion or
              cancellation
            </Text>
          </View>

          {/* Booking Selector */}
          <View className="mb-5">
            <Text className="mb-2 text-sm font-semibold text-gray-800">
              Select Booking <Text className="text-red-500">*</Text>
            </Text>

            <Pressable
              onPress={() => setShowBookingPicker(!showBookingPicker)}
              className={`flex-row items-center p-4 bg-white rounded-xl border active:bg-gray-50 ${
                selectedBooking
                  ? "border-lightPrimary"
                  : "border-gray-200"
              }`}
            >
              {selectedBooking ? (
                <>
                  <View
                    className={`justify-center items-center mr-3 w-10 h-10 rounded-full ${
                      selectedBooking.status === "completed"
                        ? "bg-green-50"
                        : "bg-red-50"
                    }`}
                  >
                    <Ionicons
                      name={
                        selectedBooking.status === "completed"
                          ? "checkmark-circle"
                          : "close-circle"
                      }
                      size={22}
                      color={
                        selectedBooking.status === "completed"
                          ? "#22C55E"
                          : "#EF4444"
                      }
                    />
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="font-semibold text-gray-900">
                      {selectedBooking.bookingRef}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text
                        className="flex-1 text-xs text-gray-500"
                        numberOfLines={1}
                      >
                        {formatLocation(selectedBooking.pickUp) ?? "Unknown"}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={11}
                        color="#9CA3AF"
                        style={{marginHorizontal: 4}}
                      />
                      <Text
                        className="flex-1 text-xs text-gray-500"
                        numberOfLines={1}
                      >
                        {formatLocation(selectedBooking.dropOff) ?? "Unknown"}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text className="flex-1 text-gray-400">Choose a booking</Text>
              )}
              <Ionicons
                name={showBookingPicker ? "chevron-up" : "chevron-down"}
                size={20}
                color="#9CA3AF"
              />
            </Pressable>

          {showBookingPicker && (
            <View className="overflow-hidden mt-2 max-h-60 bg-white rounded-xl border border-gray-200">
              {isLoadingBookings ? (
                <View className="justify-center items-center p-6">
                  <ActivityIndicator size="small" color="#FFA840" />
                  <Text className="mt-2 text-sm text-center text-gray-500">
                    Loading bookings...
                  </Text>
                </View>
              ) : bookingsError ? (
                <View className="justify-center items-center p-6">
                  <Ionicons name="alert-circle" size={28} color="#EF4444" />
                  <Text className="mt-2 text-sm text-center text-red-600">
                    Failed to load bookings
                  </Text>
                </View>
              ) : eligibleBookings.length === 0 ? (
                <View className="justify-center items-center p-6">
                  <Ionicons
                    name="calendar-outline"
                    size={28}
                    color="#D1D5DB"
                  />
                  <Text className="mt-2 text-sm text-center text-gray-500">
                    No eligible bookings found
                  </Text>
                    <Text className="mt-1 text-xs text-center text-gray-400">
                      Only completed or no-show bookings from the last{" "}
                      {reportWindowDays} days
                    </Text>
                </View>
              ) : (
                <ScrollView nestedScrollEnabled>
                  {eligibleBookings.map((booking) => {
                      const isSelected = selectedBooking?._id === booking._id;
                      return (
                        <Pressable
                          key={booking._id}
                          onPress={() => {
                            setSelectedBooking(booking);
                            setShowBookingPicker(false);
                            setSelectedCategory(null);
                          }}
                          className={`flex-row items-center px-4 py-3.5 border-b border-gray-100 active:bg-gray-50 ${
                            isSelected ? "bg-orange-50" : ""
                          }`}
                        >
                          <View
                            className={`justify-center items-center mr-3 w-9 h-9 rounded-full ${
                              booking.status === "completed"
                                ? "bg-green-50"
                                : "bg-red-50"
                            }`}
                          >
                            <Ionicons
                              name={
                                booking.status === "completed"
                                  ? "checkmark-circle-outline"
                                  : "close-circle-outline"
                              }
                              size={19}
                              color={
                                booking.status === "completed"
                                  ? "#22C55E"
                                  : "#EF4444"
                              }
                            />
                          </View>

                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center">
                              <Text
                                className="flex-1 font-semibold text-gray-900"
                                numberOfLines={1}
                              >
                                {booking.bookingRef}
                              </Text>
                              <Text
                                className={`ml-2 text-xs font-medium ${
                                  booking.status === "completed"
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}
                              >
                                {booking.status === "completed"
                                  ? "Completed"
                                  : "Cancelled"}
                              </Text>
                            </View>

                            <View className="flex-row items-center mt-1">
                              <Text
                                className="flex-1 text-xs text-gray-500"
                                numberOfLines={1}
                              >
                                {formatLocation(booking.pickUp) ?? "Unknown"}
                              </Text>
                              <Ionicons
                                name="arrow-forward"
                                size={12}
                                color="#9CA3AF"
                                style={{marginHorizontal: 5}}
                              />
                              <Text
                                className="flex-1 text-xs text-gray-500"
                                numberOfLines={1}
                              >
                                {formatLocation(booking.dropOff) ?? "Unknown"}
                              </Text>
                            </View>
                          </View>

                          {isSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color="#FFA840"
                            />
                          ) : (
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#9CA3AF"
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Category Selector */}
          {selectedBooking && (
            <View className="mb-5">
              <Text className="mb-2 text-sm font-semibold text-gray-800">
                Category <Text className="text-red-500">*</Text>
              </Text>

              <View className="gap-2">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.category;
                  const iconName =
                    CATEGORY_ICONS[cat.category] ?? "help-circle-outline";

                  return (
                    <Pressable
                      key={cat.category}
                      onPress={() => setSelectedCategory(cat.category)}
                      className={`flex-row items-center p-3.5 rounded-xl border active:opacity-80 ${
                        isSelected
                          ? "border-lightPrimary bg-[#FFF6EB]"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <View
                        className={`justify-center items-center mr-3 w-9 h-9 rounded-full ${
                          isSelected ? "bg-orange-100" : "bg-gray-100"
                        }`}
                      >
                        <Ionicons
                          name={iconName}
                          size={18}
                          color={isSelected ? "#FFA840" : "#6B7280"}
                        />
                      </View>
                      <Text
                        className={`flex-1 font-medium ${
                          isSelected ? "text-[#0F2535]" : "text-gray-800"
                        }`}
                      >
                        {cat.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#FFA840"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Description + Photos */}
          {selectedBooking && selectedCategory && (
            <>
              <View className="mb-5">
                <Text className="mb-2 text-sm font-semibold text-gray-800">
                  Description <Text className="text-red-500">*</Text>
                </Text>
                <View className="overflow-hidden bg-white rounded-xl border border-gray-200">
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe what happened in detail..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    maxLength={2000}
                    className="p-4 text-gray-900 min-h-[140px]"
                  />
                  <View className="flex-row justify-end items-center px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <Text
                      className={`text-xs ${
                        description.length >= 1900
                          ? "text-orange-500"
                          : "text-gray-400"
                      }`}
                    >
                      {description.length}/2000
                    </Text>
                  </View>
                </View>
              </View>

              {/* Photo slots — all shown at once */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-800">
                    Photos{" "}
                    <Text className="text-xs font-normal text-gray-400">
                      (Optional)
                    </Text>
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {filledPhotoCount}/{MAX_PHOTOS}
                  </Text>
                </View>

                <View
                  className="flex-row flex-wrap"
                  style={{gap: PHOTO_GAP}}
                >
                  {images.map((uri, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleAddPhoto(index)}
                      className={`relative overflow-hidden justify-center items-center rounded-xl border ${
                        uri
                          ? "border-gray-200"
                          : "border-dashed border-gray-300 bg-white active:bg-gray-50"
                      }`}
                      style={{
                        width: photoSlotSize,
                        height: photoSlotSize,
                      }}
                    >
                      {uri ? (
                        <>
                          <Image
                            source={{uri}}
                            style={{width: "100%", height: "100%"}}
                            contentFit="cover"
                          />
                          <Pressable
                            onPress={() => removeImage(index)}
                            hitSlop={8}
                            className="absolute top-1.5 right-1.5 justify-center items-center w-6 h-6 bg-red-500 rounded-full"
                          >
                            <Ionicons name="close" size={14} color="white" />
                          </Pressable>
                        </>
                      ) : (
                        <View className="items-center gap-1">
                          <View className="justify-center items-center w-9 h-9 bg-orange-50 rounded-full">
                            <Ionicons
                              name="camera-outline"
                              size={18}
                              color="#FFA840"
                            />
                          </View>
                          <Text className="text-[10px] text-gray-400">
                            Add
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>

                <Text className="mt-2 text-xs text-gray-400">
                  Camera or gallery · up to {MAX_PHOTOS} images
                </Text>
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                className={`justify-center items-center p-4 rounded-xl ${
                  canSubmit ? "bg-lightPrimary active:opacity-90" : "bg-gray-300"
                }`}
              >
                {submitMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-bold text-white">
                    Submit Report
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
