import BookSheet from "@/components/maps/BookSheet";
import MapScreen, { MapScreenHandle } from "@/components/maps/MapScreen";
import SearchModal from "@/components/modals/mapSearchModal";
import {
  drivingDistanceQueryKey,
  useDrivingDistance,
} from "@/queries/bookingQueries";
import { useSurgeFactors } from "@/queries/pricingQueries";
import { useAppStore } from "@/store/useAppStore";
import {
  applyVehicleDuration,
  computeDistanceFee,
  fetchDrivingDistance,
} from "@/utils/helpers/calculatePrice";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_REGION = {
  latitude: 14.5995, // 👈 change to your city center
  longitude: 120.9842,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const EMPTY_COORDINATES: { latitude: number; longitude: number }[] = [];

const Book = () => {
  const pickUp = useAppStore((state) => state.pickUp);
  const dropOff = useAppStore((state) => state.dropOff);
  const routeData = useAppStore((state) => state.routeData);
  const setRouteData = useAppStore((state) => state.setRouteData);
  const selectedVehicle = useAppStore((state) => state.selectedVehicle);
  const bookingType = useAppStore((state) => state.bookingType);
  const addedServices = useAppStore((state) => state.addedServices);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [isDragging, setIsDragging] = useState(false);
  const [isRouteFitted, setIsRouteFitted] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchType, setSearchType] = useState<"pickup" | "dropoff" | null>(
    null,
  );

  const navigation = useNavigation();
  const mapScreenRef = useRef<MapScreenHandle>(null);
  const queryClient = useQueryClient();

  const floatingButtonStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  };

  // Match services: expressway route when toll_fee is selected (both variants cached)
  const allowExpressway = useMemo(
    () => addedServices.some((s) => s.key === "toll_fee"),
    [addedServices],
  );

  const { data: route, isFetching } = useDrivingDistance(
    pickUp,
    dropOff,
    allowExpressway,
  );

  // Prefetch expressway route so BookSheet toll toggle is a cache-hit
  useEffect(() => {
    if (!pickUp || !dropOff) return;

    void queryClient.prefetchQuery({
      queryKey: drivingDistanceQueryKey(pickUp, dropOff, true),
      queryFn: () => fetchDrivingDistance(pickUp, dropOff, true),
      staleTime: Infinity,
    });
  }, [pickUp, dropOff, queryClient]);

  // ── Surge + gas factors ───────────────────────────────────────────────────
  // Only fetches when pickUp is set — cached 60s, covers all variants at once
  const { data: surgeFactors, isLoading: isSurgeLoading } =
    useSurgeFactors(pickUp);

  // ── Pricing ───────────────────────────────────────────────────────────────
  const pricing = useMemo(() => {
    if (!route || !selectedVehicle?.variant || !bookingType) return null;

    const { distanceKm, durationMin: rawDuration } = route;
    const durationMin = applyVehicleDuration(
      rawDuration,
      selectedVehicle.key,
    );
    const variant = selectedVehicle.variant;
    const variantKey = `${selectedVehicle.key}_${variant.maxLoadKg}`;

    const factors = surgeFactors?.[variantKey];
    const surgeMultiplier = factors?.surgeMultiplier ?? 1.0;
    const gasAdjFactor = factors?.gasAdjFactor ?? 1.0;

    const basePrice = Math.round(variant.baseFare * gasAdjFactor);
    const distanceFee = computeDistanceFee(
      distanceKm,
      variant,
      bookingType.priceModifier,
    );

    const serviceFee = addedServices.reduce((sum, s) => sum + s.price, 0);
    const subtotal = basePrice + distanceFee + serviceFee;
    const totalPrice = Math.round(subtotal * surgeMultiplier);

    // ── Pricing breakdown log ─────────────────────────────────────────────
    console.log("──────────────────────────────────────");
    console.log(`🚗 Vehicle:       ${variantKey}`);
    console.log(
      `📍 Distance:      ${distanceKm.toFixed(2)} km (${allowExpressway ? "expressway allowed" : "service roads"})`,
    );
    console.log(
      `⛽ Gas adj:       ×${gasAdjFactor} (base: ₱${variant.baseFare} → ₱${basePrice})`,
    );
    console.log(
      `📦 Booking type:  ×${bookingType.priceModifier} (${bookingType.type} - ${bookingType.value})`,
    );
    console.log(`💰 Distance fee:  ₱${distanceFee}`);
    console.log(`🔧 Service fee:   ₱${serviceFee}`);
    console.log(`📊 Subtotal:      ₱${subtotal}`);
    console.log(`⚡ Surge:         ×${surgeMultiplier}`);
    console.log(`✅ Total:         ₱${totalPrice}`);
    console.log("──────────────────────────────────────");

    return {
      distance: Math.round(distanceKm),
      duration: Math.round(durationMin),
      basePrice,
      distanceFee,
      serviceFee,
      totalPrice,
      surgeMultiplier,
      gasAdjFactor,
    };
  }, [route, selectedVehicle, bookingType, addedServices, surgeFactors, allowExpressway]);

  useEffect(() => {
    if (pricing) setRouteData(pricing);
  }, [pricing, setRouteData]);

  useEffect(() => {
    useAppStore.getState().setLoading(isFetching);
  }, [isFetching]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "white" }}
      edges={["right", "bottom", "left"]}
    >
      <View className="relative flex-1">
        <MapScreen
          ref={mapScreenRef}
          pickUp={pickUp}
          dropOff={dropOff}
          routeData={routeData}
          region={region}
          setRegion={setRegion}
          setIsDragging={setIsDragging}
          bookingType={bookingType?.type ?? "asap"}
          onRouteFitChange={setIsRouteFitted}
          routeCoordinates={route?.coordinates ?? EMPTY_COORDINATES}
        />

        {!isDragging && (
          <View className="absolute left-6 top-8 flex-row gap-2">
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              className="p-2 bg-white rounded-full shadow-lg active:scale-105 active:opacity-80"
              style={floatingButtonStyle}
            >
              <Ionicons name="menu" size={28} color="#FFA840" />
            </Pressable>

            {pickUp && dropOff && !isRouteFitted && (
              <Pressable
                onPress={() => mapScreenRef.current?.fitToRoute()}
                className="p-2 bg-white rounded-full shadow-lg active:scale-105 active:opacity-80"
                style={floatingButtonStyle}
              >
                <Ionicons name="expand-outline" size={28} color="#FFA840" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      <BookSheet
        isDragging={isDragging}
        isSurgeLoading={isSurgeLoading}
        onOpenSearch={(type) => {
          setSearchType(type);
          setSearchModalVisible(true);
        }}
        toZoomOut={() => mapScreenRef.current?.fitToRoute()}
      />

      <SearchModal
        visible={searchModalVisible}
        type={searchType ?? "pickup"}
        onClose={() => {
          setSearchModalVisible(false);
          setSearchType(null);
        }}
      />
    </SafeAreaView>
  );
};

export default Book;
