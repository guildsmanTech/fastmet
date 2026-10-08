import DriverDetailsModal from "@/components/modals/driverDetailsModal";
import {getBookingById, getBookingOffers} from "@/api/book";
import {queryClient} from "@/lib/queryClient";
import {useSocket} from "@/sockets/context/SocketProvider";
import {useAppStore} from "@/store/useAppStore";
import {useDriverLocationStore} from "@/store/useDriverLocationStore";
import {RequestedDriver} from "@/types/book";
import type {Notification, NotificationsResponse} from "@/types/notification";
import {STATIC_IMAGES} from "@/utils/constants";
import {Ionicons} from "@expo/vector-icons";
import {usePreventRemove} from "@react-navigation/native";
import type {InfiniteData} from "@tanstack/react-query";
import {Image, ImageBackground} from "expo-image";
import {LinearGradient} from "expo-linear-gradient";
import {router, useLocalSearchParams} from "expo-router";
import {cssInterop} from "nativewind";
import React, {memo, useCallback, useEffect, useRef, useState} from "react";
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const AnimatedView = cssInterop(Animated.View, {className: "style"});

const formatRadius = (km: number) => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

export default function SearchingDriver() {
  //get params
  const {bookingId, type, city} = useLocalSearchParams<{
    bookingId: string;
    type: "asap" | "pooling";
    city?: string;
  }>();

  const isPooling = type === "pooling";
  const [waitingForTripStart, setWaitingForTripStart] = useState(false);

  const sweepAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const inset = useSafeAreaInsets();
  const [drivers, setDrivers] = useState<RequestedDriver[]>([]);
  const socket = useSocket();
  const [shouldPrevent, setShouldPrevent] = useState(true);
  // Single modal state managed at parent level
  const [selectedDriver, setSelectedDriver] = useState<RequestedDriver | null>(
    null,
  );

  console.log("SearchingDriver");

  const resyncBookingState = useCallback(async () => {
    if (!bookingId) return;
    try {
      const [booking, offersRes] = await Promise.all([
        getBookingById(bookingId),
        getBookingOffers(bookingId),
      ]);

      if (booking.status === "active" || booking.status === "picked_up") {
        setShouldPrevent(false);
        router.replace({
          pathname: "/(root_screens)/booking/viewOnMap",
          params: {bookingId},
        });
        return;
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        setShouldPrevent(false);
        useAppStore.getState().clearStates();
        router.replace("/(drawer)/book");
        return;
      }

      if (booking.status === "pending" && isPooling) {
        setWaitingForTripStart(true);
      }

      setDrivers(
        (offersRes.offers ?? []).map((offer) => ({
          ...offer,
          bookingId,
        })),
      );
    } catch {
      // 404 = expired / deleted searching booking
      setShouldPrevent(false);
      useAppStore.getState().clearStates();
      Toast.show({
        type: "error",
        text1: "Request Expired",
        text2: "This booking is no longer available. Please try again.",
        position: "top",
        visibilityTime: 5_000,
        topOffset: 50,
      });
      router.replace("/(drawer)/book");
    }
  }, [bookingId, isPooling]);

  useEffect(() => {
    void resyncBookingState();
  }, [resyncBookingState]);

  useEffect(() => {
    const onAppState = (state: string) => {
      if (state === "active") void resyncBookingState();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [resyncBookingState]);

  useEffect(() => {
    const onConnect = () => {
      void resyncBookingState();
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket, resyncBookingState]);

  // 1. Prevent screen removal (for both platforms)
  usePreventRemove(shouldPrevent, () => null);
  // 2. Android hardware back override
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => shouldPrevent, // Only block if shouldPrevent is true
    );

    return () => backHandler.remove();
  }, [shouldPrevent]);

  useEffect(() => {
    // Faster, smoother rotation for 2026 UI standards
    Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Subtle breathing pulse
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ).start();

    return () => {
      sweepAnim.setValue(0);
      pulseAnim.setValue(0);
    };
  }, [pulseAnim, sweepAnim]);

  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.9],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  //SOCKETS LISTENER
  useEffect(() => {
    const handleBookingCancelled = ({bookingId}: {bookingId: string}) => {
      // Clear driver location cache for this booking
      useDriverLocationStore.getState().clearDriverLocationCache(bookingId);
      
      router.replace("/(drawer)/(tabs)/request?tab=cancelled");
      setShouldPrevent(false);
      useAppStore.getState().clearStates();
      Toast.show({
        type: "success",
        text1: "Booking Cancelled",
        text2: "Successfully cancelled booking",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
    };

    // ASAP only (client accepts)
    const handleDriverAccepted = ({bookingId}: {bookingId: string}) => {
      if (isPooling) return;
      Toast.show({
        type: "driverAccepted",
        text1: "Driver Found! 🎉",
        text2: "Your driver is on the way",
        position: "top",
        visibilityTime: 10_000,
        swipeable: true,
        topOffset: 50,
      });
      setSelectedDriver(null);
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "active"],
        exact: false,
      });
      router.push({
        pathname: "/(root_screens)/booking/viewOnMap",
        params: {bookingId},
      });
    };

    // Pooling only — driver started the trip (pre-trip) or mid-trip join
    const handlePoolingTripStarted = ({
      tripId,
      bookingCount,
      totalDistance,
      totalDuration,
    }: {
      tripId: string;
      bookingCount: number;
      totalDistance: number;
      totalDuration: number;
    }) => {
      if (!isPooling || !tripId) return;
      setWaitingForTripStart(false);

      const distanceKm = (totalDistance / 1000).toFixed(1);
      const durationMin = Math.round(totalDuration / 60);
      const otherBookings = bookingCount - 1;

      Toast.show({
        type: "success",
        text1: "Trip Started! 🎉",
        text2:
          otherBookings > 0
            ? `Driver has ${otherBookings} other booking${
                otherBookings > 1 ? "s" : ""
              } to complete alongside yours. Total route: ${distanceKm} km, ${durationMin} min.`
            : `Total route: ${distanceKm} km, ${durationMin} min.`,
        position: "top",
        visibilityTime: 10_000,
        swipeable: true,
        topOffset: 50,
      });

      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "active"],
        exact: false,
      });

      router.push({
        pathname: "/(root_screens)/booking/viewOnMap",
        params: {bookingId},
      });
    };

    const handlePoolingOfferResult = ({
      bookingId: resultBookingId,
      joinedActiveTrip,
    }: {
      bookingId: string;
      joinedActiveTrip: boolean;
    }) => {
      if (!isPooling || resultBookingId !== bookingId) return;
      // Pre-trip: show wait banner. Mid-trip: poolingTripStarted navigates.
      if (!joinedActiveTrip) {
        setWaitingForTripStart(true);
      }
    };

    const handleQueuedDriverAccepted = () => {
      Toast.show({
        type: "success",
        text1: "Driver Queued! 🎉",
        text2: "Your driver will come after finishing their current delivery.",
        position: "top",
        visibilityTime: 8_000,
        swipeable: true,
        topOffset: 50,
      });
      queryClient.invalidateQueries({queryKey: ["userBookingCounts"]});
      queryClient.invalidateQueries({
        queryKey: ["userBookings", "active"],
        exact: false,
      });
      router.push({
        pathname: "/(root_screens)/booking/viewOnMap",
        params: {bookingId},
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
      useAppStore.getState().clearStates();
      router.push("/(drawer)/book");
    };

    const handleBookingExpired = ({
      message,
      notification,
      unreadNotifications,
    }: {
      message: string;
      notification: Notification;
      unreadNotifications: number;
    }) => {
      setShouldPrevent(false);

      // Invalidate voucher queries (voucher may have been released)
      queryClient.invalidateQueries({
        queryKey: ["rewards"],
        exact: false,
      });

      Toast.show({
        type: "error",
        text1: "Request Expired",
        text2: message,
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
      useAppStore.getState().clearStates();
      useAppStore.getState().setUnreadNotificationCount(unreadNotifications);

      // If notifications have been fetched before, prepend this notif in the cache
      const notificationsQueries = queryClient.getQueriesData<
        InfiniteData<NotificationsResponse>
      >({queryKey: ["notifications"]});

      const hasNotificationsCache = notificationsQueries.some(
        ([, data]) => !!data?.pages?.length,
      );

      if (hasNotificationsCache) {
        queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
          {queryKey: ["notifications"]},
          (old) => {
            if (!old?.pages?.length) return old;

            const alreadyExists = old.pages.some((p) =>
              p.notifications.some((n) => n._id === notification._id),
            );
            if (alreadyExists) return old;

            return {
              ...old,
              pages: old.pages.map((page, idx) =>
                idx === 0
                  ? {
                      ...page,
                      notifications: [notification, ...page.notifications],
                    }
                  : page,
              ),
            };
          },
        );
      }

      // Keep unread count query cache in sync with backend-provided count
      queryClient.setQueryData(["notificationUnreadCount"], {
        unreadCount: unreadNotifications,
      });

      setImmediate(() => {
        router.replace("/(drawer)/book");
      });
    };

    socket.on("bookingCancelled", handleBookingCancelled);
    socket.on("driverAccepted", handleDriverAccepted);
    socket.on("poolingTripStarted", handlePoolingTripStarted);
    socket.on("poolingOfferResult", handlePoolingOfferResult);
    socket.on("error", errorHandler);
    socket.on("bookingExpired", handleBookingExpired);
    socket.on("queuedDriverAccepted", handleQueuedDriverAccepted);

    return () => {
      socket.off("bookingCancelled", handleBookingCancelled);
      socket.off("driverAccepted", handleDriverAccepted);
      socket.off("poolingTripStarted", handlePoolingTripStarted);
      socket.off("poolingOfferResult", handlePoolingOfferResult);
      socket.off("error", errorHandler);
      socket.off("bookingExpired", handleBookingExpired);
      socket.off("queuedDriverAccepted", handleQueuedDriverAccepted);
    };
  }, [socket, isPooling, bookingId]);

  // Driver offers listener — ASAP vs pooling use different events but same data shape
  useEffect(() => {
    const handleAcceptanceRequest = (
      data: RequestedDriver & {isQueued?: boolean},
    ) => {
      if (drivers.some((driver) => driver.id === data.id)) return;
      setDrivers((prev) => [data, ...prev]);
    };

    const event = isPooling
      ? "acceptanceRequestedPooling"
      : "acceptanceRequestedASAP";
    socket.on(event, handleAcceptanceRequest);
    return () => {
      socket.off(event, handleAcceptanceRequest);
    };
  }, [socket, drivers, isPooling]);

  //SOCKETS LISTENER
  useEffect(() => {
    const handleCancelOffer = ({driverId}: {driverId: string}) => {
      setDrivers((prev) => prev.filter((driver) => driver.id !== driverId));
      if (selectedDriver?.id === driverId) setSelectedDriver(null);

      setWaitingForTripStart(false); //test
    };

    const event = isPooling ? "offerCancelledPooling" : "offerCancelledAsap";
    socket.on(event, handleCancelOffer);
    return () => {
      socket.off(event, handleCancelOffer);
    };
  }, [selectedDriver?.id, socket, isPooling]);

  const handleRemoveDriver = (id: string) => {
    setDrivers((prev) => prev.filter((driver) => driver.id !== id));
    socket.emit("asapTimerEnd", {driverId: id, bookingId});
  };

  const handleCancelRequest = () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel?",
      [
        {
          text: "No",
          style: "cancel",
          onPress: () => console.log("Alert cancelled"),
        },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            console.log("Confirming cancellation");
            socket.emit("cancelBookingRequest", {bookingId});
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => console.log("Alert dismissed"),
      },
    );
  };

  return (
    <ImageBackground
      source={STATIC_IMAGES.map_bg}
      style={{flex: 1}}
      contentFit="cover"
    >
      <View className="flex-1 px-6 pt-10 bg-black/70">
        {/* Top Section: Status */}
        {isPooling ? (
          <CitySearchIndicator city={city} />
        ) : (
          <SearchRadiusIndicator />
        )}

        {/* Center Section: The Radar */}
        <View className="flex-1 justify-center items-center">
          {/* Ambient Pulse Glow */}
          <AnimatedView
            className="absolute rounded-full size-64 bg-orange-500/50"
            style={{
              transform: [{scale: pulseScale}],
              opacity: pulseOpacity,
            }}
          />

          {/* Main Radar Disc */}
          <View className="overflow-hidden justify-center items-center rounded-full border size-72 border-white/10 bg-black/40">
            {/* Background Rings */}
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                className="absolute rounded-full border-lightPrimary/20"
                style={{width: i * 80, height: i * 80, borderWidth: 4 - i}}
              />
            ))}

            {/* The Rotating Sweep */}
            <AnimatedView
              style={{
                ...StyleSheet.absoluteFillObject,
                transform: [{rotate: sweepRotate}],
              }}
            >
              {/* This View creates the "Pie Slice" sweep */}
              <LinearGradient
                colors={["rgba(251, 146, 60, 0.5)", "transparent"]}
                start={{x: 1, y: 0}}
                end={{x: 0, y: 1}}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "50%",
                  height: "50%",
                  borderTopRightRadius: 128, // Matches radius (64*2 / 2)
                }}
              />
              {/* Leading Scanning Line */}
              <View className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-orange-400 shadow-lg shadow-orange-500" />
            </AnimatedView>

            {/* Center Logo Hub */}
            <View className="justify-center items-center rounded-full border-2 border-orange-500 shadow-2xl size-28 bg-slate-900 shadow-orange-500/50">
              <Image
                source={STATIC_IMAGES.fastmetLogo}
                style={{width: 50, height: 50}}
                contentFit="fill"
              />
            </View>
          </View>
        </View>

        {/* Bottom Section: Driver Card and Cancel Button */}
        <View style={{marginBottom: inset.bottom + 10}}>
          {drivers.length > 0 && !waitingForTripStart && (
            <DriverListCard
              drivers={drivers}
              handleRemoveDriver={handleRemoveDriver}
              bookingId={bookingId}
              setDrivers={setDrivers}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              isPooling={isPooling}
              onPoolingAccepted={() => {
                // Wait banner is set by poolingOfferResult (pre-trip only)
              }}
            />
          )}

          {/* Waiting for trip start banner — pooling only */}
          {isPooling && waitingForTripStart ? (
            <View className="flex-row gap-3 items-center px-4 py-3 mb-3 rounded-2xl border bg-green-500/20 border-green-500/40">
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <View className="flex-1">
                <Text className="font-bold text-white">Offer Accepted!</Text>
                <Text className="text-gray-300 text-xs mt-0.5">
                  Waiting for driver to start the trip...
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleCancelRequest}
              className="items-center py-4 mt-4 w-full rounded-2xl shadow-lg bg-white/30 active:opacity-90"
            >
              <Text className="text-lg font-bold text-white">
                Cancel Request
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const DriverListCard = ({
  drivers,
  handleRemoveDriver,
  bookingId,
  setDrivers,
  selectedDriver,
  setSelectedDriver,
  isPooling,
  onPoolingAccepted,
}: {
  drivers: RequestedDriver[];
  setDrivers: React.Dispatch<React.SetStateAction<RequestedDriver[]>>;
  handleRemoveDriver: (id: string) => void;
  bookingId: string;
  selectedDriver: RequestedDriver | null;
  setSelectedDriver: React.Dispatch<
    React.SetStateAction<RequestedDriver | null>
  >;
  isPooling: boolean;
  onPoolingAccepted: () => void;
}) => {
  const socket = useSocket();
  const [areAllPaused, setAreAllPaused] = useState(false);

  const acceptDriver = useCallback(() => {
    if (!selectedDriver) return;

    if (selectedDriver.isQueued) {
      socket.emit("acceptQueuedDriver", {
        driverId: selectedDriver.id,
        bookingId,
      });
      setSelectedDriver(null);
      setAreAllPaused(false);
      return;
    }

    if (isPooling) {
      socket.emit("acceptPoolingOffer", {
        driverId: selectedDriver.id,
        bookingId,
      });
      setSelectedDriver(null);
      setAreAllPaused(false);
      // Wait UI / navigation come from poolingOfferResult + poolingTripStarted
    } else {
      socket.emit("acceptDriver", {
        driverId: selectedDriver.id,
        bookingId,
        type: "asap",
      });
    }
  }, [bookingId, selectedDriver, socket, isPooling, setSelectedDriver]);

  const rejectDriver = useCallback(() => {
    if (!selectedDriver) return;

    if (selectedDriver.isQueued) {
      socket.emit("declineQueuedDriver", {
        driverId: selectedDriver.id,
        bookingId,
      });
      setSelectedDriver(null);
      setAreAllPaused(false);
      setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
      return;
    }

    socket.emit("rejectOffer", {
      driverId: selectedDriver.id,
      bookingId,
    });
    setSelectedDriver(null);
    setAreAllPaused(false);
    setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
  }, [selectedDriver, socket, bookingId, setSelectedDriver, setDrivers]);

  const handleDriverSelect = useCallback(
    (driver: RequestedDriver) => {
      setSelectedDriver(driver);
      setAreAllPaused(true);
    },
    [setSelectedDriver],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedDriver(null);
    setAreAllPaused(false);
  }, [setSelectedDriver]);

  return (
    <>
      <View style={{width: "100%", paddingHorizontal: 8}}>
        <View style={{marginBottom: 12, paddingHorizontal: 4}}>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: 12,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Available Drivers ({drivers.length})
          </Text>
        </View>

        <View style={{maxHeight: 280}}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{gap: 4, paddingBottom: 4}}
            nestedScrollEnabled={true}
          >
            {drivers.map((driver) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                onRemove={handleRemoveDriver}
                onSelect={handleDriverSelect}
                isPaused={areAllPaused} // All drivers get the same pause state
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Single modal instance */}
      {selectedDriver && (
        <DriverDetailsModal
          isModalOpen={true}
          driver={selectedDriver}
          handleCloseModal={handleCloseModal}
          acceptDriver={acceptDriver}
          rejectDriver={rejectDriver}
        />
      )}
    </>
  );
};

const DriverRow = memo(
  ({
    driver,
    onRemove,
    onSelect,
    isPaused,
  }: {
    driver: RequestedDriver;
    onRemove: (id: string) => void;
    onSelect: (driver: RequestedDriver) => void;
    isPaused: boolean;
  }) => {
    console.log("DriverRow");
    const translateX = useRef(new Animated.Value(-400)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(100)).current;
    const initialRemainingMs =
      typeof driver.remainingMs === "number" && driver.remainingMs > 0
        ? driver.remainingMs
        : 60_000;
    const remainingTimeRef = useRef(initialRemainingMs);
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    const startTimer = useCallback(
      (duration: number) => {
        const clamped = Math.max(0, Math.min(duration, 60_000));
        const currentProgress = (clamped / 60_000) * 100;
        progressAnim.setValue(currentProgress);

        animationRef.current = Animated.timing(progressAnim, {
          toValue: 0,
          duration: clamped,
          useNativeDriver: false,
          easing: Easing.linear,
        });

        animationRef.current.start(({finished}) => {
          if (finished && !isPaused) {
            // Trigger swipe-right removal animation
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: 400,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onRemove(driver.id);
            });
          }
        });
      },
      [progressAnim, isPaused, translateX, opacity, onRemove, driver.id],
    );

    useEffect(() => {
      // Entrance animation - slide in from left
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start timer after entrance animation
        startTimer(remainingTimeRef.current);
      });

      return () => {
        if (animationRef.current) {
          animationRef.current.stop();
        }
      };
    }, [opacity, startTimer, translateX]);

    // Handle pause/resume based on isPaused prop
    useEffect(() => {
      if (isPaused) {
        if (animationRef.current) {
          animationRef.current.stop();
          // Calculate remaining time based on current progress
          const currentProgressValue = (progressAnim as any)._value;
          remainingTimeRef.current = (currentProgressValue / 100) * 60_000;
        }
      } else {
        // Resume if we have remaining time and we're not paused
        if (remainingTimeRef.current < 60_000) {
          startTimer(remainingTimeRef.current);
        }
      }
    }, [isPaused, progressAnim, startTimer]);

    const handlePress = () => {
      onSelect(driver);
    };

    // Interpolate progress to percentage string
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ["0%", "100%"],
    });

    // Interpolate for color changes
    const progressBackgroundColor = progressAnim.interpolate({
      inputRange: [0, 33, 66, 100],
      outputRange: ["#EF4444", "#F59E0B", "#F59E0B", "#10B981"],
    });

    return (
      <Animated.View
        style={{
          opacity,
          transform: [{translateX}],
        }}
      >
        <Pressable onPress={handlePress}>
          <View className="relative flex-row justify-between items-center px-4 py-3 bg-gray-100 rounded-md">
            {/* Progress Bar (background) */}
            <View className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5">
              <Animated.View
                style={{
                  width: progressWidth,
                  backgroundColor: progressBackgroundColor,
                }}
                className="h-full rounded-full"
              />
            </View>

            {/* Left: Driver Info */}
            <View className="flex-row gap-3 items-center">
              {driver.profilePicture ? (
                <Image
                  source={{uri: driver.profilePicture}}
                  contentFit="cover"
                  style={{width: 40, height: 40, borderRadius: 999}}
                />
              ) : (
                <Ionicons name="person-circle" size={40} color="#F7931E" />
              )}

              <View>
                <Text className="text-sm font-semibold text-gray-900">
                  {driver.name}
                </Text>

                <View className="mt-0.5 flex-row items-center gap-1">
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text className="text-xs text-gray-500">
                    {driver.rating} ({driver.totalBookings} bookings)
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: Distance */}
            {driver.distance && (
              <View className="justify-center items-center px-3 py-2 bg-orange-500 rounded-xl">
                <Text className="text-[10px] uppercase tracking-wide text-white">
                  Approx. Distance
                </Text>
                <Text className="text-sm font-bold text-white">
                  {driver.distance < 1
                    ? `${(driver.distance * 1000).toFixed(0)}m`
                    : `${driver.distance.toFixed(2)}km`}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

DriverRow.displayName = "DriverRow";

const SearchRadiusIndicator = () => {
  const [searchRadius, setSearchRadius] = useState(0.1);
  const [searchAttempt, setSearchAttempt] = useState(1);
  const socket = useSocket();

  useEffect(() => {
    const handleRadiusExpansion = ({
      radiusKm,
      attempt,
    }: {
      radiusKm: number;
      attempt: number;
    }) => {
      setSearchRadius(radiusKm);
      setSearchAttempt(attempt);
    };

    socket.on("radiusExpansion", handleRadiusExpansion);

    return () => {
      socket.off("radiusExpansion", handleRadiusExpansion);
    };
  }, [socket]);

  return (
    <View className="items-center mt-10">
      <Text className="text-2xl font-bold tracking-tight text-white">
        Searching...
      </Text>
      <Text className="mt-2 text-sm text-gray-400">
        Connecting you with the best driver nearby
      </Text>

      {/* Search Radius Indicator */}
      <View className="px-4 py-2 mt-4 rounded-full border bg-orange-500/20 border-orange-500/30">
        <View className="flex-row gap-2 items-center">
          <Ionicons name="radio-outline" size={16} color="#FB923D" />
          <Text className="text-sm font-semibold text-orange-400">
            Searching within {formatRadius(searchRadius)} radius
          </Text>
        </View>
      </View>

      {/* Attempt counter */}
      <Text className="mt-2 text-xs text-gray-400">
        Attempt {searchAttempt}
      </Text>
    </View>
  );
};

const CitySearchIndicator = ({city}: {city?: string}) => {
  return (
    <View className="items-center mt-10">
      <Text className="text-2xl font-bold tracking-tight text-white">
        Searching...
      </Text>
      <Text className="mt-2 text-sm text-gray-400">
        Looking for available drivers in your area
      </Text>

      <View className="px-4 py-2 mt-4 rounded-full border bg-orange-500/20 border-orange-500/30">
        <View className="flex-row gap-2 items-center">
          <Ionicons name="location-outline" size={16} color="#FB923D" />
          <Text className="text-sm font-semibold text-orange-400">
            Searching in {city ?? "your pick up location"}
          </Text>
        </View>
      </View>
    </View>
  );
};
