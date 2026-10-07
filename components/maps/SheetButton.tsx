import { useAuth } from "@/hooks/useAuth";
import { BOOKING_QUOTE_KEY } from "@/hooks/useBookingQuote";
import { useAppStore } from "@/store/useAppStore";
import {
  canBook,
  hasProfile,
  hasSubmittedId,
} from "@/utils/helpers/onboarding";
import { isQuoteCurrent } from "@/utils/helpers/quote";
import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import NotLoggedInModal from "../modals/notLoggedInModal";

const SheetButton = ({
  next,
  isLast,
}: {
  next: () => void;
  isLast?: boolean;
}) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const { isLoggedIn } = useAuth();

  const quoteStatus = useAppStore((state) => state.quoteStatus);
  const quoteError = useAppStore((state) => state.quoteError);
  const quoteReady = useAppStore((state) => isQuoteCurrent(state, isLoggedIn));

  const bookingType = useAppStore((state) => state.bookingType);
  const selectedVehicle = useAppStore((state) => state.selectedVehicle);
  const pickUp = useAppStore((state) => state.pickUp);
  const dropOff = useAppStore((state) => state.dropOff);
  const routeData = useAppStore((state) => state.routeData);
  const registrationStep = useAppStore((state) => state.registrationStep);
  const approvalStatus = useAppStore((state) => state.approvalStatus);

  const handleNext = () => {
    if (!isLoggedIn) {
      setShowModal(true);
      return;
    }

    if (!hasProfile(registrationStep)) {
      Toast.show({
        type: "info",
        text1: "Complete your profile",
        text2: "Profile is required before you can book.",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
      router.push("/(auth)/profile-register");
      return;
    }

    if (!hasSubmittedId(registrationStep)) {
      Toast.show({
        type: "info",
        text1: "ID verification required",
        text2: "Submit your ID and selfie to continue.",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
      router.push("/(auth)/id-verification" as Href);
      return;
    }

    if (approvalStatus === "rejected") {
      Toast.show({
        type: "error",
        text1: "Verification rejected",
        text2: "Please resubmit your documents.",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
      router.push("/(auth)/verification-resubmit" as Href);
      return;
    }

    if (!canBook(approvalStatus)) {
      Toast.show({
        type: "info",
        text1: "Verification in progress",
        text2: "You can book once your account is approved.",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
      return;
    }

    next();
  };

  // The price shown is only trusted while it matches what's currently chosen.
  const isDisabled =
    !bookingType ||
    !selectedVehicle ||
    !pickUp ||
    !dropOff ||
    !routeData.totalPrice ||
    !quoteReady;

  const isPriceLoading =
    quoteStatus === "loading" || (quoteStatus === "ready" && !quoteReady);
  const hasQuoteError = quoteStatus === "error";

  const retryQuote = () =>
    void queryClient.invalidateQueries({queryKey: [BOOKING_QUOTE_KEY]});

  return (
    <View
      className="px-5 py-3 gap-3 bg-white z-30"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom + 10,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold">Total Amount</Text>

        {isPriceLoading ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#FFA840" />
            <Text className="text-gray-400 text-sm">Calculating...</Text>
          </View>
        ) : hasQuoteError ? (
          <Pressable
            onPress={retryQuote}
            hitSlop={8}
            className="flex-1 flex-row items-center justify-end gap-2 pl-4"
          >
            <Text
              className="flex-1 text-right text-xs text-red-500"
              numberOfLines={2}
            >
              {quoteError}
            </Text>
            <Text className="text-sm font-semibold underline text-lightPrimary">
              Retry
            </Text>
          </Pressable>
        ) : (
          <Text className="font-bold text-lightPrimary text-lg">
            Php {routeData.totalPrice.toFixed(2)}
          </Text>
        )}
      </View>

      <Pressable
        disabled={isDisabled}
        className={`flex-1 py-3 rounded-md bg-lightPrimary active:bg-darkPrimary ${isDisabled ? "opacity-60" : ""}`}
        onPress={handleNext}
      >
        {isPriceLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="font-bold text-center text-lg text-white">
            {isLast ? "Book Now" : "Next"}
          </Text>
        )}
      </Pressable>

      <NotLoggedInModal visible={showModal} setVisible={setShowModal} />
    </View>
  );
};

export default SheetButton;
