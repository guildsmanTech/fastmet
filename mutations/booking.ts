import { rateDriver, rescheduleBooking } from "@/api/book";
import api from "@/lib/axios";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import Toast from "react-native-toast-message";

interface RateDriverParams {
  bookingId: string;
  rating: number;
}

interface RateDriverResponse {
  message: string;
  driverRating: {
    average: number;
    count: number;
  };
}

export const useRateDriverMutation = () =>
  useMutation<
    RateDriverResponse,
    AxiosError<{ message: string }>,
    { bookingId: string; rating: number }
  >({
    mutationFn: ({ bookingId, rating }: RateDriverParams) =>
      rateDriver(bookingId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "completed"],
        exact: false,
      });

      Toast.show({
        type: "success",
        text1: "Driver rated successfully!",
        text2: "Thank you for your feedback",
        position: "top",
        visibilityTime: 3000,
        swipeable: true,
        topOffset: 50,
      });
    },
    onError: (error) => {
      console.error("Error rating driver:", error);

      Toast.show({
        type: "error",
        text1: "Failed to rate driver",
        text2: error.response?.data?.message || "Please try again",
        position: "top",
        visibilityTime: 3000,
        swipeable: true,
        topOffset: 50,
      });
    },
  });

export const useRescheduleBookingMutation = () =>
  useMutation({
    mutationFn: ({
      bookingId,
      newScheduledTime,
    }: {
      bookingId: string;
      newScheduledTime: string;
    }) => rescheduleBooking(bookingId, newScheduledTime),
    onSuccess: (data: {
      awaitingDriverConfirmation?: boolean;
    }) => {
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "pending"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "scheduled"],
        exact: false,
      });
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});

      Toast.show({
        type: data?.awaitingDriverConfirmation ? "info" : "success",
        text1: data?.awaitingDriverConfirmation
          ? "Waiting for driver"
          : "Booking rescheduled",
        text2: data?.awaitingDriverConfirmation
          ? "Your driver has 1 hour to keep or decline the new pickup time."
          : "Pickup time has been updated.",
        position: "top",
        visibilityTime: data?.awaitingDriverConfirmation ? 5000 : 4000,
        swipeable: true,
        topOffset: 50,
      });
    },
    onError: (error: AxiosError<{message: string}>) => {
      Toast.show({
        type: "error",
        text1: "Could not reschedule",
        text2: error.response?.data?.message || "Please try again",
        position: "top",
        visibilityTime: 4500,
        swipeable: true,
        topOffset: 50,
      });
    },
  });

export const useMarkAsReadMutation = () =>
  useMutation({
    mutationFn: (status: "completed" | "cancelled") =>
      api.patch(`/booking/mark-as-read/${status}`),
    onSuccess: () => {
      // ✅ Automatically refetch count
      queryClient.invalidateQueries({ queryKey: ["userBookingCounts"] });
    },
    onError: (error) => {
      console.error("Error marking booking as read:", error.message);
    },
  });
