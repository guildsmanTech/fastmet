import { useSocket } from "@/sockets/context/SocketProvider";
import { useAppStore } from "@/store/useAppStore";
import { useDriverLocationStore } from "@/store/useDriverLocationStore";
import { BookingETAUpdatedPayload, Driver, LocationDetails } from "@/types/book";
import { GOOGLE_MAPS_API_KEY, STATIC_IMAGES } from "@/utils/constants";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StatusBar, StyleSheet, Text, View } from "react-native";
import MapView, { LatLng, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { GasCategory, VehicleMarkerIcon } from "../VehicleMarkerIcon";
import { DistanceBubble } from "./MapScreen";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  gasCategory: GasCategory;
  region: Region | null;
  setRegion: React.Dispatch<React.SetStateAction<Region | null>>;
  bookingId: string;
  driver: Driver;
  status: string;
};

const MAP_EDGE_PADDING = { top: 80, right: 80, bottom: 80, left: 80 };
const WRITE_THROTTLE_MS = 15000; // 15 seconds
const LAST_SEEN_TICK_MS = 30000; // 30 seconds

function formatLastSeenLabel(timestamp: number, now: number): string {
  const minutesAgo = Math.floor((now - timestamp) / 60000);
  if (minutesAgo <= 0) return "just now";
  if (minutesAgo === 1) return "1 minute ago";
  return `${minutesAgo} minutes ago`;
}

export default function LiveTrackingMapScreen({
  pickUp,
  dropOff,
  gasCategory,
  region,
  setRegion,
  bookingId,
  driver,
  status,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const routeCoordinatesRef = useRef<LatLng[]>([]);
  const lastPersistedWriteRef = useRef<number>(0);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const socket = useSocket();
  const getLiveEtaCache = useAppStore((state) => state.getLiveEtaCache);
  const setLiveEtaCache = useAppStore((state) => state.setLiveEtaCache);
  const getDriverLocationCache = useDriverLocationStore(
    (state) => state.getDriverLocationCache,
  );
  const setDriverLocationCache = useDriverLocationStore(
    (state) => state.setDriverLocationCache,
  );
  const clearDriverLocationCache = useDriverLocationStore(
    (state) => state.clearDriverLocationCache,
  );
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [liveLocationReceivedThisSession, setLiveLocationReceivedThisSession] =
    useState(false);
  const [lastSeenTick, setLastSeenTick] = useState(() => Date.now());
  const [liveETA, setLiveETA] = useState<{
    distance: number;
    duration: number;
  } | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [isLoadingDriverLocation, setIsLoadingDriverLocation] =
    useState<boolean>(false);

  const isShowingLastKnown =
    !liveLocationReceivedThisSession && !!getDriverLocationCache(bookingId);

  const lastSeenLabel = useMemo(() => {
    if (!isShowingLastKnown) return null;
    const cached = getDriverLocationCache(bookingId);
    if (!cached) return null;
    return formatLastSeenLabel(cached.timestamp, lastSeenTick);
  }, [bookingId, getDriverLocationCache, isShowingLastKnown, lastSeenTick]);

  const fitToRoute = useCallback((coords: LatLng[]) => {
    if (!mapRef.current || coords.length === 0) return;

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: MAP_EDGE_PADDING,
      animated: true,
    });
  }, []);

  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  // Live-updating "Xm ago" label while showing cached location
  useEffect(() => {
    if (!isShowingLastKnown) return;
    const id = setInterval(
      () => setLastSeenTick(Date.now()),
      LAST_SEEN_TICK_MS,
    );
    return () => clearInterval(id);
  }, [isShowingLastKnown]);

  // Clear cache when booking reaches a terminal state
  useEffect(() => {
    if (status === "completed" || status === "cancelled") {
      clearDriverLocationCache(bookingId);
    }
  }, [bookingId, clearDriverLocationCache, status]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      return () => StatusBar.setHidden(false);
    }, []),
  );

  // request driver location
  useFocusEffect(
    useCallback(() => {
      if (!socket || !bookingId) return;

      let isSubscribed = true;
      setIsLoadingDriverLocation(true);

      // Seed from cache if no live location received yet this session
      if (!liveLocationReceivedThisSession) {
        const cached = getDriverLocationCache(bookingId);
        if (cached) {
          const seeded = { lat: cached.lat, lng: cached.lng };
          setDriverLocation(seeded);
          driverLocationRef.current = seeded;
          setIsLoadingDriverLocation(false);
          setLastSeenTick(Date.now());
          console.log("📦 Seeded from cache:", cached);
        }
      }

      const handleDriverLocationResponse = (data: {
        driverLoc: { lat: number; lng: number } | null;
      }) => {
        if (isSubscribed && data.driverLoc) {
          const { lat, lng } = data.driverLoc;

          setDriverLocation({ lat, lng });
          driverLocationRef.current = { lat, lng };
          setLiveLocationReceivedThisSession(true);
          console.log("📍 Driver location received:", data.driverLoc);

          const now = Date.now();
          const existingCache = getDriverLocationCache(bookingId);

          if (!existingCache) {
            setDriverLocationCache(bookingId, { lat, lng, timestamp: now });
            lastPersistedWriteRef.current = now;
            console.log("💾 First cache write (immediate)");
          } else if (now - lastPersistedWriteRef.current >= WRITE_THROTTLE_MS) {
            setDriverLocationCache(bookingId, { lat, lng, timestamp: now });
            lastPersistedWriteRef.current = now;
            console.log("💾 Throttled cache write");
          }
        }
        if (isSubscribed) {
          setIsLoadingDriverLocation(false);
        }
      };

      socket.on("driverLocationResponse", handleDriverLocationResponse);

      return () => {
        isSubscribed = false;

        const isTerminal = status === "completed" || status === "cancelled";
        const latest = driverLocationRef.current;
        if (latest && !isTerminal) {
          const cached = getDriverLocationCache(bookingId);
          if (
            !cached ||
            cached.lat !== latest.lat ||
            cached.lng !== latest.lng
          ) {
            setDriverLocationCache(bookingId, {
              ...latest,
              timestamp: Date.now(),
            });
            console.log("💾 Unmount flush");
          }
        }

        socket.off("driverLocationResponse", handleDriverLocationResponse);
        console.log("🔌 Unsubscribed from driver location");
      };
    }, [
      bookingId,
      getDriverLocationCache,
      liveLocationReceivedThisSession,
      setDriverLocationCache,
      socket,
      status,
    ]),
  );

  // Live ETA — cache locally; request only when server may need to recalc
  useFocusEffect(
    useCallback(() => {
      if (!socket || !bookingId) return;

      const cached = getLiveEtaCache(bookingId);
      if (cached) {
        setLiveETA({
          distance: cached.distance,
          duration: cached.duration,
        });
      }

      const handleBookingETAUpdated = (data: BookingETAUpdatedPayload) => {
        if (data.bookingId !== bookingId) return;
        if (data.distanceKm <= 0 || data.durationMin <= 0) return;
        if (!data.etaRevision) return;

        setLiveEtaCache(bookingId, {
          etaRevision: data.etaRevision,
          distance: data.distanceKm,
          duration: data.durationMin,
        });
        setLiveETA({
          distance: data.distanceKm,
          duration: data.durationMin,
        });
      };

      socket.on("bookingETAUpdated", handleBookingETAUpdated);
      socket.emit("requestBookingETA", { bookingId });

      return () => {
        socket.off("bookingETAUpdated", handleBookingETAUpdated);
      };
    }, [bookingId, getLiveEtaCache, setLiveEtaCache, socket]),
  );

  useEffect(() => {
    if (pickUp?.coords) {
      const newRegion = {
        latitude: pickUp.coords.lat,
        longitude: pickUp.coords.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [pickUp, setRegion]);

  useEffect(() => {
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timeout);
  }, [
    pickUp?.coords?.lat,
    pickUp?.coords?.lng,
    dropOff?.coords?.lat,
    dropOff?.coords?.lng,
    driverLocation?.lat,
    driverLocation?.lng,
  ]);

  const showDriverOnMap =
    !!driverLocation && (!isLoadingDriverLocation || isShowingLastKnown);

  return (
    <View className="flex-1">
      {region && (
        <MapView
          provider={PROVIDER_GOOGLE}
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          showsCompass
          mapType="standard"
          initialRegion={region}
        >
          {pickUp && (
            <Marker
              key={`pickup-${pickUp.coords.lat}-${pickUp.coords.lng}`}
              coordinate={{
                latitude: pickUp.coords.lat,
                longitude: pickUp.coords.lng,
              }}
              title="Pick Up"
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={tracksViewChanges}
              zIndex={1000}
            >
              <View>
                <Image
                  source={STATIC_IMAGES.pickup}
                  style={{ width: 50, height: 50 }}
                />
              </View>
            </Marker>
          )}
          {/* DRIVER LOCATION */}
          {driverLocation && showDriverOnMap && (
            <Marker
              key={`driver-${driverLocation.lat}-${driverLocation.lng}`}
              coordinate={{
                latitude: driverLocation.lat,
                longitude: driverLocation.lng,
              }}
              title={driver.name ? `Driver - ${driver.name}` : "Your Driver"}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracksViewChanges}
              zIndex={1000}
            >
              <View style={{ width: 40, height: 40, opacity: 1 }}>
                <VehicleMarkerIcon gasCategory={gasCategory} size={50} />
              </View>
            </Marker>
          )}

          {dropOff && (
            <Marker
              key={`dropoff-${dropOff.coords.lat}-${dropOff.coords.lng}`}
              coordinate={{
                latitude: dropOff.coords.lat,
                longitude: dropOff.coords.lng,
              }}
              title="Drop Off"
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={tracksViewChanges}
              zIndex={1001} // ← Higher than pickup
            >
              <View>
                <Image
                  source={STATIC_IMAGES.dropoff}
                  style={{ width: 50, height: 50 }}
                />
              </View>
            </Marker>
          )}

          {driverLocation &&
            showDriverOnMap &&
            status !== "need_continuance" && (
              <MapViewDirections
                origin={{
                  latitude: driverLocation.lat,
                  longitude: driverLocation.lng,
                }}
                destination={
                  status === "picked_up"
                    ? {
                      latitude: dropOff!.coords.lat,
                      longitude: dropOff!.coords.lng,
                    }
                    : {
                      latitude: pickUp!.coords.lat,
                      longitude: pickUp!.coords.lng,
                    }
                }
                apikey={GOOGLE_MAPS_API_KEY ?? ""}
                strokeWidth={5}
                strokeColor="#007AFF"
                optimizeWaypoints
                onReady={(result) => {
                  routeCoordinatesRef.current = result.coordinates;
                  fitToRoute(result.coordinates);
                }}
              />
            )}
        </MapView>
      )}

      {liveETA && liveETA.distance > 0 && liveETA.duration > 0 && (
        <DistanceBubble routeData={liveETA} />
      )}

      {isShowingLastKnown && lastSeenLabel && (
        <View
          style={{
            position: "absolute",
            top: 75,
            alignSelf: "center",
            backgroundColor: "rgba(255, 152, 0, 0.95)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>
            Showing driver&apos;s last location: {lastSeenLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
