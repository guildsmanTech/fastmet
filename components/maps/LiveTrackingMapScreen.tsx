import {useSocket} from "@/sockets/context/SocketProvider";
import {useAppStore} from "@/store/useAppStore";
import {useDriverLocationStore} from "@/store/useDriverLocationStore";
import {
  BookingETAUpdatedPayload,
  Driver,
  DriverLocationResponsePayload,
  LocationDetails,
} from "@/types/book";
import {GOOGLE_MAPS_API_KEY, STATIC_IMAGES} from "@/utils/constants";
import {formatDuration} from "@/utils/helpers/date";
import {
  bearingDegrees,
  distanceMeters,
  DrivingRoute,
  fetchDrivingRoute,
  shortestAngleDelta,
  splitRouteAt,
} from "@/utils/helpers/routeGeometry";
import {Ionicons} from "@expo/vector-icons";
import {useFocusEffect} from "expo-router";
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Image, Pressable, StatusBar, StyleSheet, Text, View} from "react-native";
import MapView, {
  LatLng,
  MapStyleElement,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {GasCategory, VehicleMarkerIcon} from "../VehicleMarkerIcon";

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
  /** Pooling drivers make other stops first, so the direct-route ETA would be wrong. */
  isPooling?: boolean;
};

type DriverPoint = {lat: number; lng: number; at: number};

type RouteRequest = {origin: LatLng; target: LatLng; targetKey: string};

const CACHE_WRITE_THROTTLE_MS = 15000;
const CLOCK_TICK_MS = 15000;
/** Show "last updated" once the driver has been silent this long. */
const STALE_AFTER_MS = 60000;
/** Reroute when the driver is this far off the drawn route… */
const OFF_ROUTE_M = 60;
/** …for this many consecutive updates (ignores single GPS spikes). */
const OFF_ROUTE_CONFIRMATIONS = 2;
/** Minimum gap between Directions requests (cost and rate guard). */
const ROUTE_MIN_INTERVAL_MS = 30000;
/** Draw the car on the road when GPS is within this distance of the route. */
const SNAP_MAX_M = 30;
const AUTO_FIT_INTERVAL_MS = 15000;
const MARKER_ANIMATION_MS = 1000;
/** Jumps bigger than this (e.g. stale cache → live) are not animated. */
const TELEPORT_M = 2000;
/** Ignore heading changes from sub-metre GPS jitter. */
const MIN_HEADING_MOVE_M = 3;

const ROUTE_CASING = "#0052CC";
const ROUTE_FILL = "#4D9FFF";
const ROUTE_TRAVELED = "#B8C0CC";

const MAP_STYLE: MapStyleElement[] = [
  {featureType: "poi.business", stylers: [{visibility: "off"}]},
  {featureType: "transit", stylers: [{visibility: "off"}]},
];

const toLatLng = (p: {lat: number; lng: number}): LatLng => ({
  latitude: p.lat,
  longitude: p.lng,
});

const isValidLoc = (loc: unknown): loc is {lat: number; lng: number} => {
  const c = loc as {lat?: unknown; lng?: unknown} | null | undefined;
  return (
    !!c &&
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng)
  );
};

function formatAgo(timestamp: number, now: number): string {
  const minutesAgo = Math.floor((now - timestamp) / 60000);
  if (minutesAgo <= 0) return "just now";
  if (minutesAgo === 1) return "1 min ago";
  if (minutesAgo < 60) return `${minutesAgo} mins ago`;
  return "over an hour ago";
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
  isPooling = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const socket = useSocket();
  const getLiveEtaCache = useAppStore((state) => state.getLiveEtaCache);
  const setLiveEtaCache = useAppStore((state) => state.setLiveEtaCache);
  const clearDriverLocationCache = useDriverLocationStore(
    (state) => state.clearDriverLocationCache,
  );

  const [driverPoint, setDriverPoint] = useState<DriverPoint | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [serverETA, setServerETA] = useState<{
    distance: number;
    duration: number;
  } | null>(null);
  const [route, setRoute] = useState<(DrivingRoute & {targetKey: string}) | null>(
    null,
  );
  const [routeRequest, setRouteRequest] = useState<RouteRequest | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [markerRotation, setMarkerRotation] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);

  const lastPointTsRef = useRef(0);
  const lastCacheWriteRef = useRef(0);
  const driverPointRef = useRef<DriverPoint | null>(null);
  const lastRouteAttemptRef = useRef(0);
  const offRouteCountRef = useRef(0);
  const offRouteCheckedPointRef = useRef<LatLng | null>(null);
  const lastFitAtRef = useRef(0);
  const prevMarkerPointRef = useRef<LatLng | null>(null);
  const isFollowingRef = useRef(true);

  // Before pickup the driver heads to the pickup pin; after, to the drop-off.
  // No route while a replacement driver is being found.
  const target = useMemo<LatLng | null>(() => {
    if (status === "need_continuance") return null;
    const coords = status === "picked_up" ? dropOff?.coords : pickUp?.coords;
    return isValidLoc(coords) ? toLatLng(coords) : null;
  }, [dropOff?.coords, pickUp?.coords, status]);
  const targetKey = target ? `${status}:${target.latitude},${target.longitude}` : "";

  // MapView needs an initial region once; never re-center on refetches.
  useEffect(() => {
    if (region || !isValidLoc(pickUp?.coords)) return;
    setRegion({
      latitude: pickUp.coords.lat,
      longitude: pickUp.coords.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, [pickUp?.coords, region, setRegion]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      return () => StatusBar.setHidden(false);
    }, []),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Clear cache when booking reaches a terminal state
  useEffect(() => {
    if (status === "completed" || status === "cancelled") {
      clearDriverLocationCache(bookingId);
    }
  }, [bookingId, clearDriverLocationCache, status]);

  // Live driver location. Deps are only socket + booking so the listener is
  // never torn down mid-trip.
  useFocusEffect(
    useCallback(() => {
      if (!socket || !bookingId) return;

      const store = useDriverLocationStore.getState();

      if (!driverPointRef.current) {
        const cached = store.getDriverLocationCache(bookingId);
        if (cached && isValidLoc(cached)) {
          const seeded = {lat: cached.lat, lng: cached.lng, at: cached.timestamp};
          driverPointRef.current = seeded;
          setDriverPoint(seeded);
        }
      }

      const handleDriverLocationResponse = (
        data: DriverLocationResponsePayload,
      ) => {
        if (!data || !isValidLoc(data.driverLoc)) return;
        // Older backends send no bookingId; newer ones scope it per booking.
        if (data.bookingId && String(data.bookingId) !== String(bookingId)) {
          return;
        }

        const receivedAt = Date.now();
        const serverTs =
          typeof data.ts === "number" && Number.isFinite(data.ts) ? data.ts : 0;
        // Socket and background HTTP relays can arrive out of order.
        if (serverTs && serverTs < lastPointTsRef.current) return;
        if (serverTs) lastPointTsRef.current = serverTs;

        const at = serverTs ? Math.min(serverTs, receivedAt) : receivedAt;
        const next = {lat: data.driverLoc.lat, lng: data.driverLoc.lng, at};
        driverPointRef.current = next;
        setDriverPoint(next);
        setIsLive(true);

        const {getDriverLocationCache, setDriverLocationCache} =
          useDriverLocationStore.getState();
        if (
          !getDriverLocationCache(bookingId) ||
          receivedAt - lastCacheWriteRef.current >= CACHE_WRITE_THROTTLE_MS
        ) {
          setDriverLocationCache(bookingId, {
            lat: next.lat,
            lng: next.lng,
            timestamp: at,
          });
          lastCacheWriteRef.current = receivedAt;
        }
      };

      const requestLatest = () => socket.emit("requestDriverLocation", {bookingId});

      socket.on("driverLocationResponse", handleDriverLocationResponse);
      socket.on("connect", requestLatest);
      if (socket.connected) requestLatest();

      return () => {
        socket.off("driverLocationResponse", handleDriverLocationResponse);
        socket.off("connect", requestLatest);

        const latest = driverPointRef.current;
        const {getDriverLocationCache, setDriverLocationCache} =
          useDriverLocationStore.getState();
        const cached = getDriverLocationCache(bookingId);
        if (
          latest &&
          (!cached || cached.lat !== latest.lat || cached.lng !== latest.lng)
        ) {
          setDriverLocationCache(bookingId, {
            lat: latest.lat,
            lng: latest.lng,
            timestamp: latest.at,
          });
        }
      };
    }, [bookingId, socket]),
  );

  // Server ETA. Used for pooling (accounts for other stops) and as a fallback
  // when the route can't be fetched.
  useFocusEffect(
    useCallback(() => {
      if (!socket || !bookingId) return;

      const cached = getLiveEtaCache(bookingId);
      if (cached) {
        setServerETA({distance: cached.distance, duration: cached.duration});
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
        setServerETA({distance: data.distanceKm, duration: data.durationMin});
      };

      socket.on("bookingETAUpdated", handleBookingETAUpdated);
      socket.emit("requestBookingETA", {bookingId});

      return () => {
        socket.off("bookingETAUpdated", handleBookingETAUpdated);
      };
    }, [bookingId, getLiveEtaCache, setLiveEtaCache, socket]),
  );

  const driverLatLng = useMemo(
    () => (driverPoint ? toLatLng(driverPoint) : null),
    [driverPoint],
  );

  const activeRoute = route && route.targetKey === targetKey ? route : null;

  const progress = useMemo(
    () =>
      activeRoute && driverLatLng
        ? splitRouteAt(activeRoute.coordinates, driverLatLng)
        : null,
    [activeRoute, driverLatLng],
  );

  // Decide when a (billed) Directions request is needed: no route for this
  // stage yet, or the driver has clearly left the drawn route.
  useEffect(() => {
    // Pooling: the driver visits other passengers' stops first, so a direct
    // driver → this-booking route would be wrong (and keep triggering reroutes).
    if (isPooling || !driverLatLng || !target) return;

    const sinceLast = Date.now() - lastRouteAttemptRef.current;
    const stageChanged = routeRequest?.targetKey !== targetKey;

    if (!activeRoute) {
      if (stageChanged || sinceLast >= ROUTE_MIN_INTERVAL_MS) {
        lastRouteAttemptRef.current = Date.now();
        offRouteCountRef.current = 0;
        setRouteRequest({origin: driverLatLng, target, targetKey});
      }
      return;
    }

    // Count each GPS point once, not every re-run of this effect.
    if (offRouteCheckedPointRef.current === driverLatLng) return;
    offRouteCheckedPointRef.current = driverLatLng;

    if (progress && progress.offRouteM > OFF_ROUTE_M) {
      offRouteCountRef.current += 1;
    } else {
      offRouteCountRef.current = 0;
    }

    if (
      offRouteCountRef.current >= OFF_ROUTE_CONFIRMATIONS &&
      sinceLast >= ROUTE_MIN_INTERVAL_MS
    ) {
      lastRouteAttemptRef.current = Date.now();
      offRouteCountRef.current = 0;
      setRouteRequest({origin: driverLatLng, target, targetKey});
    }
  }, [
    activeRoute,
    driverLatLng,
    isPooling,
    progress,
    routeRequest?.targetKey,
    target,
    targetKey,
  ]);

  useEffect(() => {
    if (!routeRequest) return;
    const controller = new AbortController();

    fetchDrivingRoute(
      routeRequest.origin,
      routeRequest.target,
      GOOGLE_MAPS_API_KEY ?? "",
      controller.signal,
    )
      .then((result) => {
        if (result) setRoute({...result, targetKey: routeRequest.targetKey});
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.log("Route fetch failed, will retry:", err);
        }
      });

    return () => controller.abort();
  }, [routeRequest]);

  // Draw the car on the road when GPS is close; face the road direction.
  const markerPoint = useMemo<LatLng | null>(() => {
    if (!driverLatLng) return null;
    if (progress && progress.offRouteM <= SNAP_MAX_M) return progress.snapped;
    return driverLatLng;
  }, [driverLatLng, progress]);

  useEffect(() => {
    if (!markerPoint) return;
    const prev = prevMarkerPointRef.current;
    prevMarkerPointRef.current = markerPoint;

    if (progress && progress.offRouteM <= SNAP_MAX_M) {
      setMarkerRotation(progress.roadBearing);
    } else if (prev && distanceMeters(prev, markerPoint) >= MIN_HEADING_MOVE_M) {
      setMarkerRotation(bearingDegrees(prev, markerPoint));
    }
  }, [markerPoint, progress]);

  const fitCamera = useCallback(
    (points: LatLng[]) => {
      if (!mapRef.current || points.length === 0) return;
      lastFitAtRef.current = Date.now();
      mapRef.current.fitToCoordinates(points, {
        edgePadding: {
          top: insets.top + 140,
          right: 60,
          bottom: 300,
          left: 60,
        },
        animated: true,
      });
    },
    [insets.top],
  );

  const cameraPoints = useMemo(() => {
    const points: LatLng[] = [];
    if (markerPoint) points.push(markerPoint);
    if (target) points.push(target);
    if (points.length < 2 && isValidLoc(pickUp?.coords)) {
      points.push(toLatLng(pickUp.coords));
    }
    if (points.length < 2 && isValidLoc(dropOff?.coords)) {
      points.push(toLatLng(dropOff.coords));
    }
    return points;
  }, [dropOff?.coords, markerPoint, pickUp?.coords, target]);

  // Follow mode: keep driver + destination in view, without fighting the user.
  useEffect(() => {
    if (!isMapReady || !isFollowingRef.current || cameraPoints.length === 0) {
      return;
    }
    if (Date.now() - lastFitAtRef.current < AUTO_FIT_INTERVAL_MS) return;
    fitCamera(cameraPoints);
  }, [cameraPoints, fitCamera, isMapReady]);

  // Refit right away when the stage (destination) changes.
  useEffect(() => {
    lastFitAtRef.current = 0;
  }, [targetKey]);

  const stopFollowing = useCallback(() => {
    if (!isFollowingRef.current) return;
    isFollowingRef.current = false;
    setIsFollowing(false);
  }, []);

  const recenter = useCallback(() => {
    isFollowingRef.current = true;
    setIsFollowing(true);
    fitCamera(cameraPoints);
  }, [cameraPoints, fitCamera]);

  const eta = useMemo(() => {
    if (isPooling || !activeRoute || !progress) {
      // Server ETA for "active" covers pickup + drop-off, so only use it
      // when it matches what we show.
      if (serverETA && (isPooling || status === "picked_up")) {
        return {km: serverETA.distance, min: serverETA.duration};
      }
      return null;
    }
    const ratio =
      activeRoute.distanceM > 0
        ? Math.min(1, progress.remainingM / activeRoute.distanceM)
        : 1;
    return {
      km: progress.remainingM / 1000,
      min: Math.max(1, Math.round((activeRoute.durationS * ratio) / 60)),
    };
  }, [activeRoute, isPooling, progress, serverETA, status]);

  const headline =
    status === "need_continuance"
      ? "Finding a replacement driver"
      : status === "picked_up"
        ? "On the way to drop-off"
        : "Driver is heading to pickup";

  const isStale = !!driverPoint && now - driverPoint.at > STALE_AFTER_MS;
  const waitingForDriver = !driverPoint && status !== "need_continuance";

  const driverTitle = driver?.name
    ? `Driver - ${driver.name.replace(/\b\w/g, (c) => c.toUpperCase())}`
    : "Your Driver";

  return (
    <View className="flex-1">
      {region && (
        <MapView
          provider={PROVIDER_GOOGLE}
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mapType="standard"
          initialRegion={region}
          customMapStyle={MAP_STYLE}
          toolbarEnabled={false}
          showsCompass={false}
          onMapReady={() => setIsMapReady(true)}
          onPanDrag={stopFollowing}
          onRegionChangeComplete={(_, details) => {
            if (details?.isGesture) stopFollowing();
          }}
        >
          {progress && progress.traveled.length > 1 && (
            <Polyline
              coordinates={progress.traveled}
              strokeWidth={5}
              strokeColor={ROUTE_TRAVELED}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
          )}
          {progress && progress.remaining.length > 1 && (
            <>
              <Polyline
                coordinates={progress.remaining}
                strokeWidth={8}
                strokeColor={ROUTE_CASING}
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
              <Polyline
                coordinates={progress.remaining}
                strokeWidth={5}
                strokeColor={ROUTE_FILL}
                lineCap="round"
                lineJoin="round"
                zIndex={3}
              />
            </>
          )}
          {/* Route not available yet: hint the direction with a dashed line */}
          {/* Also the pooling line: direction only, since the driver may stop elsewhere first */}
          {!progress && markerPoint && target && (
            <Polyline
              coordinates={[markerPoint, target]}
              strokeWidth={3}
              strokeColor={ROUTE_FILL}
              lineDashPattern={[10, 10]}
              zIndex={2}
            />
          )}

          {isValidLoc(pickUp?.coords) && (
            <PinMarker
              coordinate={toLatLng(pickUp.coords)}
              title="Pick Up"
              source={STATIC_IMAGES.pickup}
              zIndex={1000}
            />
          )}
          {isValidLoc(dropOff?.coords) && (
            <PinMarker
              coordinate={toLatLng(dropOff.coords)}
              title="Drop Off"
              source={STATIC_IMAGES.dropoff}
              zIndex={1001}
            />
          )}

          {markerPoint && (
            <DriverMarker
              coordinate={markerPoint}
              rotation={markerRotation}
              gasCategory={gasCategory}
              title={driverTitle}
            />
          )}
        </MapView>
      )}

      <View
        className="absolute right-4 left-4 flex-row gap-3 items-start"
        style={{top: insets.top + 12}}
        pointerEvents="box-none"
      >
        <View className="flex-1 px-4 py-3 bg-white rounded-2xl" style={styles.shadow}>
          <Text className="text-base font-semibold text-gray-900">{headline}</Text>
          {eta ? (
            <Text className="mt-0.5 text-sm text-gray-600">
              <Text className="font-semibold text-darkPrimary">
                {formatDuration(eta.min)}
              </Text>
              {"  ·  "}
              {eta.km.toFixed(1)} km away
            </Text>
          ) : waitingForDriver ? (
            <Text className="mt-0.5 text-sm text-gray-500">
              Getting driver&apos;s location…
            </Text>
          ) : null}
          {isPooling && status !== "need_continuance" && (
            <Text className="mt-1 text-xs text-gray-500">
              Your driver may make other stops first.
            </Text>
          )}
          {(isStale || (!isLive && driverPoint)) && driverPoint && (
            <View className="flex-row gap-1 items-center mt-1">
              <Ionicons name="time-outline" size={13} color="#9CA3AF" />
              <Text className="text-xs text-gray-500">
                {isLive ? "Last updated " : "Last known location, "}
                {formatAgo(driverPoint.at, now)}
              </Text>
            </View>
          )}
        </View>

        {!isFollowing && (
          <Pressable
            onPress={recenter}
            hitSlop={10}
            className="justify-center items-center w-12 h-12 bg-white rounded-full active:opacity-70"
            style={styles.shadow}
          >
            <Ionicons name="locate" size={22} color="#ED8718" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const PinMarker = memo(function PinMarker({
  coordinate,
  title,
  source,
  zIndex,
}: {
  coordinate: LatLng;
  title: string;
  source: number;
  zIndex: number;
}) {
  const tracksViewChanges = useInitialSnapshot();
  return (
    <Marker
      coordinate={coordinate}
      title={title}
      anchor={{x: 0.5, y: 1}}
      tracksViewChanges={tracksViewChanges}
      zIndex={zIndex}
    >
      <Image source={source} style={{width: 44, height: 44}} />
    </Marker>
  );
});

/**
 * Glides between GPS points instead of jumping. The marker stays mounted
 * (stable key) so only its native position/rotation change.
 */
const DriverMarker = memo(function DriverMarker({
  coordinate,
  rotation,
  gasCategory,
  title,
}: {
  coordinate: LatLng;
  rotation: number;
  gasCategory: GasCategory;
  title: string;
}) {
  const tracksViewChanges = useInitialSnapshot();
  const [shown, setShown] = useState({...coordinate, rotation});
  const shownRef = useRef(shown);

  useEffect(() => {
    const from = shownRef.current;
    const to = {...coordinate, rotation};

    if (distanceMeters(from, to) > TELEPORT_M) {
      shownRef.current = to;
      setShown(to);
      return;
    }

    const rotationDelta = shortestAngleDelta(from.rotation, to.rotation);
    const start = Date.now();
    let frame = 0;
    let lastPaint = 0;

    const step = () => {
      const t = Math.min(1, (Date.now() - start) / MARKER_ANIMATION_MS);
      const nowMs = Date.now();
      // ~30fps is smooth for a map marker and halves native updates.
      if (t < 1 && nowMs - lastPaint < 32) {
        frame = requestAnimationFrame(step);
        return;
      }
      lastPaint = nowMs;
      const next = {
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
        rotation: (from.rotation + rotationDelta * t + 360) % 360,
      };
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [coordinate, rotation]);

  return (
    <Marker
      coordinate={{latitude: shown.latitude, longitude: shown.longitude}}
      rotation={shown.rotation}
      flat
      title={title}
      anchor={{x: 0.5, y: 0.5}}
      tracksViewChanges={tracksViewChanges}
      zIndex={1002}
    >
      <View style={{width: 44, height: 44}}>
        <VehicleMarkerIcon gasCategory={gasCategory} size={44} />
      </View>
    </Marker>
  );
});

/** Render custom marker views once, then freeze them (big perf win on Android). */
function useInitialSnapshot() {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timeout = setTimeout(() => setTracksViewChanges(false), 800);
    return () => clearTimeout(timeout);
  }, []);
  return tracksViewChanges;
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
});
