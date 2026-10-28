import { fetchRoadPoint } from "@/api/pricing";
import { useShake } from "@/hooks/useShakeAnimation";
import { useAppStore } from "@/store/useAppStore";
import { LocationDetails } from "@/types/book";
import {
  addressMentionsAllowedPickupCity,
  GOOGLE_MAPS_API_KEY,
  isAllowedPickupCity,
  isDropOffAllowed,
  isWithinAllowedPickupBounds,
} from "@/utils/constants";
import {
  formatLocation,
  formatMeters,
  getFastCurrentPosition,
} from "@/utils/helpers/location";
import { getArray, pushToArray } from "@/utils/helpers/recentPlaceStorage";
import * as Contacts from "expo-contacts";
import * as Location from "expo-location";
import { router } from "expo-router";
import { getDistance } from "geolib";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ToastAndroid,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Place } from "react-native-google-places-textinput";
import MapView, { Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapPinStepView from "./(search-modal)/MapPinStepView";
import OffRoadWarningModal from "./(search-modal)/OffRoadWarningModal";
import PickupCoverageModal from "./(search-modal)/PickupCoverageModal";
import SearchStepView from "./(search-modal)/SearchStepView";

type SearchType = "pickup" | "dropoff";

type SearchModalProps = {
  visible: boolean;
  onClose: () => void;
  type: SearchType;
};

type Step = "search" | "map";
type Coords = { lat: number; lng: number };

const THEME_COLOR = "#FFA840";

export const PICKUP_AREA_ERROR =
  "We don't service this location yet. Check our list of covered cities.";

const DROPOFF_AREA_ERROR =
  "Drop-off location must be reachable by road (no ferry required).";

const SAME_LOCATION_ERROR =
  "Pickup and drop-off can't be the same location.";

const SAME_LOCATION_THRESHOLD_M = 5;
const MAP_DRAG_VALIDATE_DELAY_MS = 400;

/** Re-confirming within this distance reuses the last road-point result (no new lookup). */
const ROAD_RECHECK_MIN_MOVE_M = 10;
/** Road point farther than this from the pin = not reachable by vehicle (matches driver app). */
const OFF_ROAD_THRESHOLD_M = 30;
/** Never hold up "Confirm pin" longer than this for the road lookup. */
const ROAD_LOOKUP_TIMEOUT_MS = 4000;

/** acknowledged = client already saw the off-road warning for this pin. */
type RoadCheck = { pin: Coords; road: Coords | null; acknowledged: boolean };

function metersBetween(a: Coords, b: Coords) {
  return getDistance(
    { latitude: a.lat, longitude: a.lng },
    { latitude: b.lat, longitude: b.lng },
  );
}

function validateCoords(
  type: SearchType,
  lat: number,
  lng: number,
  other: LocationDetails | null,
): string | null {
  if (type === "pickup" && !isWithinAllowedPickupBounds(lat, lng)) {
    return PICKUP_AREA_ERROR;
  }
  if (type === "dropoff" && !isDropOffAllowed(lat, lng)) {
    return DROPOFF_AREA_ERROR;
  }
  if (other?.coords) {
    const meters = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: other.coords.lat, longitude: other.coords.lng },
    );
    if (meters <= SAME_LOCATION_THRESHOLD_M) {
      return SAME_LOCATION_ERROR;
    }
  }
  return null;
}

function showValidationError(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.showWithGravity(message, ToastAndroid.LONG, ToastAndroid.TOP);
  } else {
    Alert.alert("Not Available", message);
  }
}

function extractCityFromPlaceComponents(
  components:
    { longText?: string; long_name?: string; types?: string[] }[] | undefined,
): string | null {
  if (!components?.length) return null;
  const locality = components.find((c) => c.types?.includes("locality"));
  if (locality) return locality.longText || locality.long_name || null;
  const admin2 = components.find((c) =>
    c.types?.includes("administrative_area_level_2"),
  );
  if (admin2) return admin2.longText || admin2.long_name || null;
  return null;
}

function extractCityFromGeocodeComponents(
  components: { long_name?: string; types?: string[] }[] | undefined,
): string | null {
  if (!components?.length) return null;
  const locality = components.find((c) => c.types?.includes("locality"));
  if (locality?.long_name) return locality.long_name;
  const admin2 = components.find((c) =>
    c.types?.includes("administrative_area_level_2"),
  );
  if (admin2?.long_name) return admin2.long_name;
  return null;
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ name: string; address: string; city: string | null } | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        name: result.address_components?.[0]?.long_name || "Dropped pin",
        address: result.formatted_address || "Unknown address",
        city: extractCityFromGeocodeComponents(result.address_components),
      };
    }
    return null;
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return null;
  }
}

function cleanPhoneInput(value: string) {
  let cleaned = value.replace(/\D/g, "");
  if (cleaned.startsWith("63")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("9")) cleaned = cleaned.slice(1);
  return cleaned.slice(0, 10);
}

const RECENT_PLACE_KEY = "recent_places";

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose, type }) => {
  const [recentPlaces, setRecentPlaces] = useState<LocationDetails[]>([]);
  const inset = useSafeAreaInsets();
  const insets = useSafeAreaInsets();

  const setPickUp = useAppStore((state) => state.setPickUp);
  const setPickUpAdditionalDetails = useAppStore(
    (state) => state.setPickUpAdditionalDetails,
  );
  const setPickUpContactName = useAppStore(
    (state) => state.setPickUpContactName,
  );
  const setPickUpContactPhone = useAppStore(
    (state) => state.setPickUpContactPhone,
  );

  const setDropOff = useAppStore((state) => state.setDropOff);
  const setDropOffAdditionalDetails = useAppStore(
    (state) => state.setDropOffAdditionalDetails,
  );
  const setDropOffContactName = useAppStore(
    (state) => state.setDropOffContactName,
  );
  const setDropOffContactPhone = useAppStore(
    (state) => state.setDropOffContactPhone,
  );

  const dropOff = useAppStore((state) => state.dropOff);
  const pickUp = useAppStore((state) => state.pickUp);
  const homeAddress = useAppStore((state) => state.address);
  const { shake, animatedStyle } = useShake();
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  const [showCoverage, setShowCoverage] = useState(false);
  const [offRoadPrompt, setOffRoadPrompt] = useState<{
    distanceLabel: string;
    onUse: () => void;
  } | null>(null);

  const contactLabel = type === "pickup" ? "Sender" : "Receiver";
  const isContactValid = useMemo(
    () => contactName.trim().length > 0 && contactPhone.length === 10,
    [contactName, contactPhone],
  );

  const haveValue = type === "pickup" ? pickUp : dropOff;
  const otherValue = type === "pickup" ? dropOff : pickUp;

  const [searchText, setSearchText] = useState("");
  const [confirmedLocation, setConfirmedLocation] =
    useState<LocationDetails | null>(null);

  const [step, setStep] = useState<Step>("search");
  const [markerCoord, setMarkerCoord] = useState<Coords | null>(null);
  const [mapName, setMapName] = useState("");
  const [mapAddress, setMapAddress] = useState("");
  const [pinMoved, setPinMoved] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isInitialRegion = useRef(true);
  const dragValidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Nearest drivable road, looked up only on "Confirm pin" (one paid lookup
  // per confirm at most; server-cached).
  const [roadCheck, setRoadCheck] = useState<RoadCheck | null>(null);
  const roadAbortRef = useRef<AbortController | null>(null);

  const cancelRoadCheck = () => {
    roadAbortRef.current?.abort();
    roadAbortRef.current = null;
  };

  /** Resolves null on failure/timeout — informational, never blocks confirm. */
  const lookupRoadPoint = async (pin: Coords): Promise<Coords | null> => {
    cancelRoadCheck();
    const controller = new AbortController();
    roadAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), ROAD_LOOKUP_TIMEOUT_MS);
    try {
      return await fetchRoadPoint(pin, controller.signal);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      if (roadAbortRef.current === controller) roadAbortRef.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      setAdditionalDetails(haveValue?.additionalDetails || "");
      setConfirmedLocation(haveValue ?? null);
      setSearchText(haveValue ? formatLocation(haveValue) : "");
      setStep("search");
      setMarkerCoord(null);
      setContactName(haveValue?.contactName || "");
      setContactPhone(haveValue?.contactPhone || "");
      setNameError(false);
      setPhoneError(false);
    } else {
      if (dragValidateTimerRef.current) {
        clearTimeout(dragValidateTimerRef.current);
        dragValidateTimerRef.current = null;
      }
      cancelRoadCheck();
      setRoadCheck(null);
    }
  }, [visible, haveValue?.additionalDetails, haveValue]);

  useEffect(() => {
    return () => {
      if (dragValidateTimerRef.current)
        clearTimeout(dragValidateTimerRef.current);
      cancelRoadCheck();
    };
  }, []);

  useEffect(() => {
    async function getRecentPlaces() {
      setRecentPlaces(await getArray(RECENT_PLACE_KEY));
    }
    getRecentPlaces();
  }, [visible]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) router.back();
  }, []);

  const handleUseMyInfo = () => {
    const { name, phoneNumber } = useAppStore.getState();
    if (name) {
      setContactName(name);
      setNameError(false);
    }
    if (phoneNumber) {
      setContactPhone(cleanPhoneInput(phoneNumber));
      setPhoneError(false);
    }
  };

  const handlePickContact = async () => {
    try {
      if (Platform.OS === "android") {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== "granted") return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      if (contact.name) setContactName(contact.name);
      const rawNumber = contact.phoneNumbers?.[0]?.number;
      if (rawNumber) setContactPhone(cleanPhoneInput(rawNumber));
    } catch (err) {
      console.warn("Contact pick failed:", err);
    }
  };

  const goToMapStep = (coords: Coords, name: string, address: string) => {
    const boundsError = validateCoords(
      type,
      coords.lat,
      coords.lng,
      otherValue,
    );
    if (boundsError) {
      showValidationError(boundsError);
      shake();
      return;
    }

    isInitialRegion.current = true;
    setPinMoved(false);
    setMarkerCoord(coords);
    setMapName(name);
    setMapAddress(address);
    setStep("map");

    cancelRoadCheck();
    setRoadCheck(null);

    requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        300,
      );
    });
  };

  const handleOnPlaceSelect = async (place: Place) => {
    const loc = place.details?.location;
    if (!loc) return;

    if (type === "pickup") {
      const city = extractCityFromPlaceComponents(
        place.details?.addressComponents,
      );
      const address = place.details?.formattedAddress || "";
      const allowed =
        isAllowedPickupCity(city) || addressMentionsAllowedPickupCity(address);
      if (!allowed) {
        showValidationError(PICKUP_AREA_ERROR);
        shake();
        return;
      }
    }

    if (type === "dropoff" && !isDropOffAllowed(loc.latitude, loc.longitude)) {
      showValidationError(DROPOFF_AREA_ERROR);
      shake();
      return;
    }

    goToMapStep(
      { lat: loc.latitude, lng: loc.longitude },
      place.details?.displayName?.text || "Unknown location",
      place.details?.formattedAddress || "Unknown address",
    );
  };

  const handleRecentPlacePress = async (place: LocationDetails) => {
    if (!place) return;

    if (
      type === "pickup" &&
      !addressMentionsAllowedPickupCity(place.address) &&
      !addressMentionsAllowedPickupCity(place.name)
    ) {
      showValidationError(PICKUP_AREA_ERROR);
      shake();
      return;
    }

    if (
      type === "dropoff" &&
      !isDropOffAllowed(place.coords.lat, place.coords.lng)
    ) {
      showValidationError(DROPOFF_AREA_ERROR);
      shake();
      return;
    }

    goToMapStep(place.coords, place.name, place.address);
  };

  const handleCurrentLocation = async () => {
    try {
      setLoading(true);
      const isLocationEnabled = await Location.hasServicesEnabledAsync();

      if (!isLocationEnabled) {
        Alert.alert(
          "Location Services Disabled",
          "Please enable location services in your device settings to use this feature.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS === "ios") Linking.openURL("app-settings:");
                else Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showValidationError("Permission to access location was denied");
        return;
      }

      const location = await getFastCurrentPosition();
      const { latitude, longitude } = location.coords;
      const geocoded = await reverseGeocode(latitude, longitude);

      if (type === "pickup") {
        const allowed =
          isAllowedPickupCity(geocoded?.city) ||
          addressMentionsAllowedPickupCity(geocoded?.address);
        if (!allowed) {
          showValidationError(PICKUP_AREA_ERROR);
          return;
        }
      }

      if (type === "dropoff" && !isDropOffAllowed(latitude, longitude)) {
        showValidationError(DROPOFF_AREA_ERROR);
        return;
      }

      goToMapStep(
        { lat: latitude, lng: longitude },
        geocoded?.name || "Current Location",
        geocoded?.address || "Current Location",
      );
    } catch (error) {
      console.error("Error getting current location:", error);
      showValidationError("Failed to get current location");
    } finally {
      setLoading(false);
    }
  };

  const handleHomePress = () => {
    if (!homeAddress) return;

    if (
      type === "pickup" &&
      !addressMentionsAllowedPickupCity(homeAddress.fullAddress) &&
      !addressMentionsAllowedPickupCity(homeAddress.name)
    ) {
      showValidationError(PICKUP_AREA_ERROR);
      shake();
      return;
    }

    if (
      type === "dropoff" &&
      !isDropOffAllowed(homeAddress.coords.lat, homeAddress.coords.lng)
    ) {
      showValidationError(DROPOFF_AREA_ERROR);
      shake();
      return;
    }

    goToMapStep(
      { lat: homeAddress.coords.lat, lng: homeAddress.coords.lng },
      homeAddress.name,
      homeAddress.fullAddress,
    );
  };

  const handleRegionChangeComplete = (region: Region) => {
    const { latitude, longitude } = region;

    if (isInitialRegion.current) {
      isInitialRegion.current = false;
      return;
    }

    setMarkerCoord({ lat: latitude, lng: longitude });
    setPinMoved(true);

    if (dragValidateTimerRef.current)
      clearTimeout(dragValidateTimerRef.current);

    dragValidateTimerRef.current = setTimeout(() => {
      dragValidateTimerRef.current = null;
      const error = validateCoords(type, latitude, longitude, otherValue);
      if (error) {
        showValidationError(error);
        shake();
      }
    }, MAP_DRAG_VALIDATE_DELAY_MS);
  };

  // Car marker + notice after the warning, while the pin stays put.
  const offRoad = useMemo(() => {
    if (!markerCoord || !roadCheck?.road) return null;
    if (metersBetween(roadCheck.pin, markerCoord) >= ROAD_RECHECK_MIN_MOVE_M)
      return null;
    const meters = metersBetween(markerCoord, roadCheck.road);
    if (meters <= OFF_ROAD_THRESHOLD_M) return null;
    return { roadPoint: roadCheck.road, meters };
  }, [markerCoord, roadCheck]);

  const handleMapConfirmPin = async () => {
    if (!markerCoord) return;

    const boundsError = validateCoords(
      type,
      markerCoord.lat,
      markerCoord.lng,
      otherValue,
    );
    if (boundsError) {
      showValidationError(boundsError);
      shake();
      return;
    }

    const pin = markerCoord;
    let finalName = mapName;
    let finalAddress = mapAddress;
    let finalCity: string | null = null;

    // Same spot as the last check → reuse it (no new lookup).
    const previous =
      roadCheck && metersBetween(roadCheck.pin, pin) < ROAD_RECHECK_MIN_MOVE_M
        ? roadCheck
        : null;

    // Address + road lookups run in parallel, so confirm is no slower.
    setResolvingAddress(true);
    const [geocoded, road] = await Promise.all([
      pinMoved ? reverseGeocode(pin.lat, pin.lng) : Promise.resolve(null),
      previous ? Promise.resolve(previous.road) : lookupRoadPoint(pin),
    ]);
    setResolvingAddress(false);

    if (pinMoved) {
      finalName = geocoded?.name || "Dropped pin";
      finalAddress =
        geocoded?.address || `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`;
      finalCity = geocoded?.city ?? null;

      if (type === "pickup") {
        const allowed =
          isAllowedPickupCity(finalCity) ||
          addressMentionsAllowedPickupCity(finalAddress);
        if (!allowed) {
          showValidationError(PICKUP_AREA_ERROR);
          shake();
          return;
        }
      }

      if (type === "dropoff" && !isDropOffAllowed(pin.lat, pin.lng)) {
        showValidationError(DROPOFF_AREA_ERROR);
        shake();
        return;
      }
    }

    const newLoc = {
      name: finalName,
      address: finalAddress,
      coords: pin,
    };
    const finishConfirm = () => {
      setConfirmedLocation(newLoc);
      setSearchText(formatLocation(newLoc));
      setStep("search");
    };

    const roadMeters = road ? metersBetween(pin, road) : 0;
    const isOffRoad = road !== null && roadMeters > OFF_ROAD_THRESHOLD_M;

    // Warn once per pin; confirming again at the same spot means "keep it".
    if (!isOffRoad || previous?.acknowledged) {
      setRoadCheck({ pin, road, acknowledged: previous?.acknowledged ?? false });
      finishConfirm();
      return;
    }

    // Shows the car marker + notice on the map behind the dialog.
    setRoadCheck({ pin, road, acknowledged: true });
    setOffRoadPrompt({
      distanceLabel: formatMeters(roadMeters),
      onUse: finishConfirm,
    });
  };

  const handleFinalConfirm = async () => {
    if (!confirmedLocation) return;

    const validName = contactName.trim().length > 0;
    const validPhone = contactPhone.length === 10;

    if (!validName || !validPhone) {
      setNameError(!validName);
      setPhoneError(!validPhone);
      shake();
      showValidationError(
        `${contactLabel} name and mobile number are required.`,
      );
      return;
    }

    if (type === "pickup") {
      setPickUp(confirmedLocation);
      setPickUpAdditionalDetails(additionalDetails);
      setPickUpContactName(contactName);
      setPickUpContactPhone(contactPhone);
    } else {
      setDropOff(confirmedLocation);
      setDropOffAdditionalDetails(additionalDetails);
      setDropOffContactName(contactName);
      setDropOffContactPhone(contactPhone);
    }

    await pushToArray(RECENT_PLACE_KEY, confirmedLocation);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 5,
            backgroundColor: "white",
          }}
        >
          {step === "map" && markerCoord ? (
            <MapPinStepView
              type={type}
              themeColor={THEME_COLOR}
              additionalDetails={additionalDetails}
              setAdditionalDetails={setAdditionalDetails}
              pinMoved={pinMoved}
              mapAddress={mapAddress}
              markerCoord={markerCoord}
              mapRef={mapRef}
              onRegionChangeComplete={handleRegionChangeComplete}
              resolvingAddress={resolvingAddress}
              offRoad={offRoad}
              onConfirmPin={handleMapConfirmPin}
              onBack={() => setStep("search")}
              bottomInset={inset.bottom}
            />
          ) : (
            <SearchStepView
              type={type}
              themeColor={THEME_COLOR}
              onClose={onClose}
              animatedStyle={animatedStyle}
              searchText={searchText}
              setSearchText={setSearchText}
              onPlaceSelect={handleOnPlaceSelect}
              contactLabel={contactLabel}
              contactName={contactName}
              setContactName={(value) => {
                setContactName(value);
                if (nameError) setNameError(false);
              }}
              contactPhone={contactPhone}
              setContactPhone={(value) => {
                setContactPhone(value);
                if (phoneError) setPhoneError(false);
              }}
              additionalDetails={additionalDetails}
              onUseMyInfo={handleUseMyInfo}
              onPickContact={handlePickContact}
              nameError={nameError}
              phoneError={phoneError}
              cleanPhoneInput={cleanPhoneInput}
              loading={loading}
              onCurrentLocation={handleCurrentLocation}
              homeAddress={homeAddress}
              onHomePress={handleHomePress}
              recentPlaces={recentPlaces}
              onRecentPlacePress={handleRecentPlacePress}
              confirmedLocation={confirmedLocation}
              isContactValid={isContactValid}
              onFinalConfirm={handleFinalConfirm}
              onShowCoverage={
                type === "pickup" ? () => setShowCoverage(true) : undefined
              }
              bottomInset={inset.bottom}
            />
          )}
        </View>
      </TouchableWithoutFeedback>

      <OffRoadWarningModal
        visible={offRoadPrompt !== null}
        distanceLabel={offRoadPrompt?.distanceLabel ?? ""}
        onMovePin={() => setOffRoadPrompt(null)}
        onUsePin={() => {
          offRoadPrompt?.onUse();
          setOffRoadPrompt(null);
        }}
      />

      {type === "pickup" && (
        <PickupCoverageModal
          visible={showCoverage}
          onClose={() => setShowCoverage(false)}
        />
      )}
    </Modal>
  );
};

export default SearchModal;
