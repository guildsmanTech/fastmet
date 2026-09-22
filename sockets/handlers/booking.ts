import {queryClient} from "@/lib/queryClient";
import {useAppStore} from "@/store/useAppStore";
import {useDriverLocationStore} from "@/store/useDriverLocationStore";
import {Booking, RequestedDriver} from "@/types/book";
import {Notification} from "@/types/notification";
import {updateNotificationHelper} from "@/utils/helpers/query";
import {NOTIFICATION_TYPES} from "@/utils/notification";
import Toast from "react-native-toast-message";
import {Socket} from "socket.io-client";

export const acceptanceRequestedSchedule = (socket: Socket) => {
  const handleAcceptanceRequestedSchedule = ({
    driverOffer,
    notification,
    unreadNotifications,
  }: {
    driverOffer: RequestedDriver;
    notification: Notification;
    unreadNotifications: number;
  }) => {
    // Update ALL pending bookings to add the driver offer
    queryClient.setQueriesData(
      {queryKey: ["userBookings", "pending"]},
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            bookings: page.bookings.map((booking: Booking) => {
              if (booking._id === driverOffer.bookingId) {
                return {
                  ...booking,
                  requestedDrivers: [
                    ...(booking.requestedDrivers || []),
                    driverOffer,
                  ],
                };
              }
              return booking;
            }),
          })),
        };
      },
    );

    updateNotificationHelper(
      notification,
      unreadNotifications,
      NOTIFICATION_TYPES.driver_offer,
    );

    // Dynamic toast message based on driver count
    const driverCount = notification.data?.drivers
      ? Object.keys(notification.data.drivers).length
      : 1;

    Toast.show({
      type: "success",
      text1: "New Driver Offer!",
      text2:
        driverCount === 1
          ? `${driverOffer.name} has offered`
          : `${driverCount} drivers have offered for your booking`,
    });
  };

  socket.on("acceptanceRequestedSchedule", handleAcceptanceRequestedSchedule);
  return () =>
    socket.off(
      "acceptanceRequestedSchedule",
      handleAcceptanceRequestedSchedule,
    );
};

export const cancelScheduleDriverOffer = (socket: Socket) => {
  const handleCancelScheduleDriverOffer = ({
    driverId,
    bookingId,
  }: {
    driverId: string;
    bookingId: string;
  }) => {
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
  };

  socket.on("offerCancelledSchedule", handleCancelScheduleDriverOffer);
  return () =>
    socket.off("offerCancelledSchedule", handleCancelScheduleDriverOffer);
};

export const driverUnavailable = (socket: Socket) => {
  const handleDriverUnavailable = ({
    bookingId,
    driverId,
    notification,
    unreadNotifications,
  }: {
    bookingId: string;
    driverId: string;
    notification: Notification;
    unreadNotifications: number;
  }) => {
    console.log("🔔 Driver unavailable:", bookingId, driverId);

    // Remove from scheduled and capture the booking in a single pass
    let bookingToRestore: Booking | null = null;

    queryClient.setQueriesData(
      {queryKey: ["userBookings", "scheduled"]},
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            bookings: page.bookings.filter((booking: Booking) => {
              if (booking._id === bookingId) {
                bookingToRestore = booking;
                return false;
              }
              return true;
            }),
          })),
        };
      },
    );

    // Add back to pending bookings with updated status (remove unavailable driver)
    if (bookingToRestore) {
      const {driver: _, ...rest} = bookingToRestore as Booking;
      const updatedBooking: Booking = {
        ...rest,
        status: "pending",
        requestedDrivers: (
          (bookingToRestore as Booking).requestedDrivers || []
        ).filter((d) => d.id !== driverId),
      };

      queryClient.setQueriesData(
        {queryKey: ["userBookings", "pending"]},
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          const newPages = [...oldData.pages];
          newPages[0] = {
            ...newPages[0],
            bookings: [updatedBooking, ...(newPages[0]?.bookings || [])],
          };
          return {...oldData, pages: newPages};
        },
      );

      Toast.show({
        type: "info",
        text1: "Driver Unavailable",
        text2:
          "Your driver was removed due to a delay that may impact your pickup time. Please confirm if you would like to reschedule the pickup or wait for a new driver assignment.",
        position: "top",
        visibilityTime: 4000,
        swipeable: true,
        topOffset: 50,
      });
    }

    updateNotificationHelper(
      notification,
      unreadNotifications,
      NOTIFICATION_TYPES.driver_unavailable,
    );
  };

  socket.on("driverUnavailable", handleDriverUnavailable);

  return () => {
    socket.off("driverUnavailable", handleDriverUnavailable);
  };
};

export const rescheduleDriverResponse = (socket: Socket) => {
  const onDeclined = ({
    bookingId,
    notification,
    unreadNotifications,
  }: {
    bookingId: string;
    driverId?: string;
    reason?: string;
    notification?: Notification;
    unreadNotifications?: number;
  }) => {
    queryClient.invalidateQueries({
      queryKey: ["userBookings", "scheduled"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["userBookings", "pending"],
      exact: false,
    });
    queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});

    if (notification?._id && typeof unreadNotifications === "number") {
      updateNotificationHelper(
        notification,
        unreadNotifications,
        NOTIFICATION_TYPES.driver_declined_reschedule,
      );
    }

    Toast.show({
      type: "info",
      text1: "Driver declined new time",
      text2:
        "Your booking is open again for other drivers. You can wait or cancel.",
      position: "top",
      visibilityTime: 5000,
      swipeable: true,
      topOffset: 50,
    });
    void bookingId;
  };

  const onConfirmed = ({bookingId}: {bookingId: string}) => {
    queryClient.invalidateQueries({
      queryKey: ["userBookings", "scheduled"],
      exact: false,
    });

    Toast.show({
      type: "success",
      text1: "Driver confirmed",
      text2: "Your driver accepted the new pickup time.",
      position: "top",
      visibilityTime: 4000,
      swipeable: true,
      topOffset: 50,
    });
    void bookingId;
  };

  socket.on("rescheduleDeclinedByDriver", onDeclined);
  socket.on("rescheduleConfirmedByDriver", onConfirmed);
  return () => {
    socket.off("rescheduleDeclinedByDriver", onDeclined);
    socket.off("rescheduleConfirmedByDriver", onConfirmed);
  };
};

export const scheduledReminder = (socket: Socket) => {
  const handleScheduledReminder = ({
    notification,
    unreadNotifications,
    title,
    message,
    type,
  }: {
    checkpoint: string;
    notification?: Notification | null;
    unreadNotifications?: number;
    bookingId?: string;
    title: string;
    message: string;
    type: string;
  }) => {
    if (notification?._id && typeof unreadNotifications === "number") {
      updateNotificationHelper(
        notification,
        unreadNotifications,
        (notification.type || type) as NOTIFICATION_TYPES,
      );
    }

    if (type === NOTIFICATION_TYPES.scheduled_auto_assigned) {
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "scheduled"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "pending"],
        exact: false,
      });
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
    }

    if (type === NOTIFICATION_TYPES.driver_started_scheduled_trip) {
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "scheduled"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "active"],
        exact: false,
      });
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
    }

    if (type === NOTIFICATION_TYPES.scheduled_auto_cancelled) {
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "pending"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "cancelled"],
        exact: false,
      });
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
      // bookingCancelled already toasts; skip a second toast here.
      return;
    }

    Toast.show({
      type:
        type === NOTIFICATION_TYPES.scheduled_auto_assigned
          ? "success"
          : "info",
      text1: notification?.title || title,
      text2: notification?.message || message,
      position: "top",
      visibilityTime: 8000,
      swipeable: true,
      topOffset: 50,
    });
  };

  socket.on("scheduledReminder", handleScheduledReminder);
  return () => {
    socket.off("scheduledReminder", handleScheduledReminder);
  };
};

export const driverArrivedAtPickup = (socket: Socket) => {
  const handleArrivedAtPickup = () => {
    Toast.show({
      type: "success",
      text1: "Driver Arrived at Pickup",
      text2:
        "The driver has arrived at the pickup location. Please assist them with the delivery.",
      position: "top",
      visibilityTime: 5000,
    });
  };

  socket.on("driverArrivedAtPickup", handleArrivedAtPickup);
  return () => {
    socket.off("driverArrivedAtPickup", handleArrivedAtPickup);
  };
};

export const driverArrivedAtDropoff = (socket: Socket) => {
  const handleArrivedAtDropoff = () => {
    Toast.show({
      type: "success",
      text1: "Driver Arrived at Drop-off",
      text2: "The driver has arrived at the drop-off location.",
      position: "top",
      visibilityTime: 5000,
    });
  };

  socket.on("driverArrivedAtDropoff", handleArrivedAtDropoff);
  return () => {
    socket.off("driverArrivedAtDropoff", handleArrivedAtDropoff);
  };
};

export const bookingCompleted = (socket: Socket) => {
  const handleBookingCompleted = ({bookingId}: {bookingId: string}) => {
    if (!bookingId) return;

    let completedBooking: Booking | null = null;

    // Remove from active (includes status active | picked_up) and capture for completed list
    queryClient.setQueriesData(
      {queryKey: ["userBookings", "active"]},
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            bookings: page.bookings.filter((booking: Booking) => {
              if (booking._id === bookingId) {
                completedBooking = booking;
                return false;
              }
              return true;
            }),
          })),
        };
      },
    );

    if (completedBooking) {
      const source = completedBooking as Booking;
      const bookingForCompleted = {
        ...source,
        status: "completed",
        completedAt: new Date().toISOString(),
      };

      queryClient.setQueriesData(
        {queryKey: ["userBookings", "completed"]},
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          const newPages = [...oldData.pages];
          newPages[0] = {
            ...newPages[0],
            bookings: [bookingForCompleted, ...(newPages[0]?.bookings || [])],
          };
          return {...oldData, pages: newPages};
        },
      );
    }

    // Clear local tracking caches for this booking only
    useAppStore.getState().clearLiveEtaCache(bookingId);
    useDriverLocationStore.getState().clearDriverLocationCache(bookingId);

    // Fallback sync + counts (and voucher may have been fulfilled)
    queryClient.invalidateQueries({
      queryKey: ["userBookings", "active"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["userBookings", "completed"],
      exact: false,
    });
    queryClient.invalidateQueries({queryKey: ["userBooking", bookingId]});
    queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
    queryClient.invalidateQueries({
      queryKey: ["rewards"],
      exact: false,
    });

    Toast.show({
      type: "success",
      text1: "Trip Completed",
      text2: "Your delivery has been completed successfully.",
      position: "top",
      visibilityTime: 5000,
    });
  };

  socket.on("bookingCompleted", handleBookingCompleted);
  return () => {
    socket.off("bookingCompleted", handleBookingCompleted);
  };
};

export const bookingNeedsContinuance = (socket: Socket) => {
  const handler = ({bookingId}: {bookingId: string}) => {
    queryClient.invalidateQueries({queryKey: ["userBookings", "active"]});
    queryClient.invalidateQueries({queryKey: ["userBooking", bookingId]});
    Toast.show({
      type: "info",
      text1: "Finding a replacement driver",
      text2: "No action needed. Your price stays the same.",
      position: "top",
      topOffset: 50,
      visibilityTime: 8000,
    });
  };
  socket.on("bookingNeedsContinuance", handler);
  return () => socket.off("bookingNeedsContinuance", handler);
};

export const bookingDriverReassigned = (socket: Socket) => {
  const handler = ({bookingId}: {bookingId: string}) => {
    useDriverLocationStore.getState().clearDriverLocationCache(bookingId);
    queryClient.invalidateQueries({queryKey: ["userBookings", "active"]});
    queryClient.invalidateQueries({queryKey: ["userBooking", bookingId]});
    Toast.show({
      type: "success",
      text1: "New driver assigned",
      text2: "A replacement driver is continuing your delivery.",
      position: "top",
      topOffset: 50,
    });
  };
  socket.on("bookingDriverReassigned", handler);
  return () => socket.off("bookingDriverReassigned", handler);
};

export const continuanceCancelledClient = (socket: Socket) => {
  const handler = (payload: {bookingId: string; reason: "driver" | "timeout"}) => {
    queryClient.invalidateQueries({queryKey: ["userBookings", "active"]});
    queryClient.invalidateQueries({queryKey: ["userBooking", payload.bookingId]});
    Toast.show({
      type: "info",
      text1: "Driver continuing",
      text2:
        payload.reason === "driver"
          ? "Your original driver will continue the delivery."
          : "No replacement found. Your original driver will continue.",
      position: "top",
      topOffset: 50,
      visibilityTime: 4000,
    });
  };
  socket.on("continuance_cancelled", handler);
  return () => socket.off("continuance_cancelled", handler);
};
