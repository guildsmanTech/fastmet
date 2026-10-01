import {Type} from "@/store/slices/bookSlice";
import {useAppStore} from "@/store/useAppStore";
import {LocationDetails, RouteData} from "@/types/book";
import {STATIC_IMAGES} from "@/utils/constants";
import {formatDuration} from "@/utils/helpers/date";
import {Image} from "expo-image";
import * as Location from "expo-location";
import {useFocusEffect} from "expo-router";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {Alert, StatusBar, StyleSheet, Text, View} from "react-native";
import MapView, {
  LatLng,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import {useSafeAreaInsets} from "react-native-safe-area-context";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  routeData: RouteData;
  region: Region;
  setRegion: React.Dispatch<React.SetStateAction<Region>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  bookingType: Type;
  onRouteFitChange?: (fitted: boolean) => void;
  /** From cached Directions fetch (same as pricing) — already respects avoid/allow. */
  routeCoordinates?: LatLng[];
};

export type MapScreenHandle = {
  fitToRoute: () => void;
};

const MAP_EDGE_PADDING = {top: 80, right: 80, bottom: 400, left: 80};

const MapScreen = forwardRef<MapScreenHandle, Props>(function MapScreen(
  {
    pickUp,
    dropOff,
    routeData,
    region,
    setRegion,
    setIsDragging,
    bookingType,
    onRouteFitChange,
    routeCoordinates = [],
  },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const routeCoordinatesRef = useRef<LatLng[]>([]);
  const isProgrammaticMoveRef = useRef(false);
  const lastFitAtRef = useRef(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const setLoading = useAppStore((state) => state.setLoading);

  const markRouteUnfitted = useCallback(() => {
    onRouteFitChange?.(false);
  }, [onRouteFitChange]);

  const performFitToCoordinates = useCallback(
    (coords: LatLng[]) => {
      if (!mapRef.current || coords.length === 0) return;

      isProgrammaticMoveRef.current = true;
      lastFitAtRef.current = Date.now();
      setIsAnimating(true);
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: MAP_EDGE_PADDING,
        animated: true,
      });
      setTimeout(() => {
        setIsAnimating(false);
        isProgrammaticMoveRef.current = false;
        onRouteFitChange?.(true);
      }, 1500);
    },
    [onRouteFitChange],
  );

  const fitToRoute = useCallback(() => {
    if (!pickUp?.coords || !dropOff?.coords) return;

    const coords =
      routeCoordinatesRef.current.length > 0
        ? routeCoordinatesRef.current
        : [
            {latitude: pickUp.coords.lat, longitude: pickUp.coords.lng},
            {latitude: dropOff.coords.lat, longitude: dropOff.coords.lng},
          ];

    performFitToCoordinates(coords);
  }, [pickUp, dropOff, performFitToCoordinates]);

  useImperativeHandle(ref, () => ({fitToRoute}), [fitToRoute]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      return () => StatusBar.setHidden(false);
    }, []),
  );

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const {status} = await Location.requestForegroundPermissionsAsync();
        setLoading(true);
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Location permission is needed to show your position.",
          );
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        if (!isMounted) return;

        const userRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setRegion(userRegion);
        setTimeout(() => {
          mapRef.current?.animateToRegion(userRegion, 1000);
        }, 300);
      } catch (err) {
        console.error("Failed to get user location:", err);
        Alert.alert(
          "Location Error",
          "Unable to retrieve your current location. Please ensure location services are enabled.",
        );
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [setLoading, setRegion]);

  // Snapshot SVG markers after they paint, then freeze for performance
  useEffect(() => {
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timeout);
  }, [
    pickUp?.coords?.lat,
    pickUp?.coords?.lng,
    dropOff?.coords?.lat,
    dropOff?.coords?.lng,
  ]);

  useEffect(() => {
    onRouteFitChange?.(false);
  }, [
    pickUp?.coords?.lat,
    pickUp?.coords?.lng,
    dropOff?.coords?.lat,
    dropOff?.coords?.lng,
    onRouteFitChange,
  ]);

  // Sync polyline from cached Directions result (service-road vs expressway)
  const lastFittedKeyRef = useRef("");
  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
    if (routeCoordinates.length === 0) {
      lastFittedKeyRef.current = "";
      return;
    }
    const key = `${routeCoordinates.length}:${routeCoordinates[0]?.latitude},${routeCoordinates[0]?.longitude}:${routeCoordinates[routeCoordinates.length - 1]?.latitude},${routeCoordinates[routeCoordinates.length - 1]?.longitude}`;
    if (key === lastFittedKeyRef.current) return;
    lastFittedKeyRef.current = key;
    performFitToCoordinates(routeCoordinates);
  }, [routeCoordinates, performFitToCoordinates]);

  useEffect(() => {
    if (pickUp?.coords && mapRef.current && !isAnimating) {
      const newRegion = {
        latitude: pickUp.coords.lat,
        longitude: pickUp.coords.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);

      if (!dropOff) {
        setIsAnimating(true);
        mapRef.current.animateToRegion(newRegion, 1000);
        setTimeout(() => setIsAnimating(false), 1000);
      }
    }
  }, [pickUp, dropOff, isAnimating, setRegion]);

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        followsUserLocation={!pickUp && !dropOff}
        showsCompass
        mapType="standard"
        initialRegion={region}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchCancel={() => setIsDragging(false)}
        onPanDrag={() => {
          if (pickUp && dropOff) markRouteUnfitted();
        }}
        onRegionChangeComplete={() => {
          const recentlyFitted = Date.now() - lastFitAtRef.current < 2000;
          if (
            !isProgrammaticMoveRef.current &&
            !recentlyFitted &&
            pickUp &&
            dropOff
          ) {
            markRouteUnfitted();
          }
        }}
      >
        {/* Casing — dark, wide, sits underneath */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={7}
            strokeColor="#0052CC"
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}

        {/* Fill — brand blue, narrower, on top */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#4D9FFF"
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        )}

        {/* MARKERS LAST - renders on top */}
        {pickUp && (
          <Marker
            key={`pickup-${pickUp.coords.lat}-${pickUp.coords.lng}`}
            coordinate={{
              latitude: pickUp.coords.lat,
              longitude: pickUp.coords.lng,
            }}
            title="Pick Up"
            anchor={{x: 0.5, y: 1}}
            tracksViewChanges={tracksViewChanges}
            zIndex={1000}
          >
            <View>
              <Image
                source={STATIC_IMAGES.pickup}
                style={{width: 50, height: 50}}
              />
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
            anchor={{x: 0.5, y: 1}}
            tracksViewChanges={tracksViewChanges}
            zIndex={1001}
          >
            <View>
              <Image
                source={STATIC_IMAGES.dropoff}
                style={{width: 50, height: 50}}
              />
            </View>
          </Marker>
        )}
      </MapView>

      {routeData.distance > 0 &&
        routeData.duration > 0 &&
        bookingType !== "pooling" && <DistanceBubble routeData={routeData} />}
    </View>
  );
});

export default memo(MapScreen);

export function DistanceBubble({
  routeData,
}: {
  routeData: Pick<RouteData, "distance" | "duration">;
}) {
  const inset = useSafeAreaInsets();

  return (
    <View
      className="absolute z-50 self-center px-4 py-2 rounded-2xl bg-black/60"
      style={{top: inset.top + 10}}
    >
      <Text className="text-sm font-semibold text-white">
        {routeData.distance.toFixed(1)} km •{" "}
        {formatDuration(routeData.duration)}
      </Text>
    </View>
  );
}
