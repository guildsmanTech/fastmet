import BookSheet from "@/components/maps/BookSheet";
import MapScreen, { MapScreenHandle } from "@/components/maps/MapScreen";
import SearchModal from "@/components/modals/mapSearchModal";
import { useBookingQuote } from "@/hooks/useBookingQuote";
import { useRoutePreview } from "@/queries/bookingQueries";
import { useAppStore } from "@/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions } from "@react-navigation/native";
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

  const floatingButtonStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  };

  // Map route line only. The server caches it per origin/destination/toll and
  // reuses it for the price quote, so this adds no extra paid lookup.
  const allowExpressway = useMemo(
    () => addedServices.some((s) => s.key === "toll_fee"),
    [addedServices],
  );

  const { data: route, isFetching } = useRoutePreview(
    pickUp,
    dropOff,
    allowExpressway,
  );

  // Price: computed and locked by the server on every relevant change.
  // Results land in the store (routeData / quote fields).
  useBookingQuote();

  const routeCoordinates =
    pickUp && dropOff
      ? (route?.coordinates ?? EMPTY_COORDINATES)
      : EMPTY_COORDINATES;

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
          routeCoordinates={routeCoordinates}
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
