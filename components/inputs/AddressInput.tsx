import {UserAddress} from "@/types/user";
import {GOOGLE_MAPS_API_KEY} from "@/utils/constants";
import {getFastCurrentPosition} from "@/utils/helpers/location";
import {Ionicons} from "@expo/vector-icons";
import * as Location from "expo-location";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import GooglePlacesTextInput, {
  GooglePlacesTextInputRef,
  Place,
} from "react-native-google-places-textinput";

type AddressInputProps = {
  value: UserAddress;
  onChange: (address: UserAddress) => void;
  error?: string;
};

type AddressFields = {
  street: string;
  barangay: string;
  city: string;
  province: string;
};

/**
 * Parse Google Places address_components into structured fields.
 * Uses the Google Places API (new) `addressComponents` format.
 */
function parseAddressComponents(
  components: any[] | undefined,
): Partial<AddressFields> {
  if (!components || !Array.isArray(components)) return {};

  const result: Partial<AddressFields> = {};
  let streetNumber = "";
  let route = "";

  for (const component of components) {
    const types: string[] = component.types || [];

    if (types.includes("street_number")) {
      streetNumber = component.longText || component.long_name || "";
    } else if (types.includes("route")) {
      route = component.longText || component.long_name || "";
    } else if (
      types.includes("sublocality") ||
      types.includes("sublocality_level_1") ||
      types.includes("neighborhood")
    ) {
      result.barangay = component.longText || component.long_name || "";
    } else if (types.includes("locality")) {
      result.city = component.longText || component.long_name || "";
    } else if (types.includes("administrative_area_level_1")) {
      result.province = component.longText || component.long_name || "";
    }
  }

  // Combine street number and route
  if (streetNumber || route) {
    result.street = [streetNumber, route].filter(Boolean).join(" ");
  }

  return result;
}

export default function AddressInput({
  value,
  onChange,
  error,
}: AddressInputProps) {
  const autocompleteRef = useRef<GooglePlacesTextInputRef>(null);
  const [fields, setFields] = useState<AddressFields>({
    street: value?.street || "",
    barangay: value?.barangay || "",
    city: value?.city || "",
    province: value?.province || "",
  });
  const [placeName, setPlaceName] = useState(value?.name || "");
  const [coords, setCoords] = useState(value?.coords || null);
  const [hasSelected, setHasSelected] = useState(!!value);

  // Track whether internal state has been initialized from an external value
  const initializedRef = useRef(!!value);

  // Sync internal state when the value prop changes externally
  // (e.g. when editProfile loads address from the store after mount)
  useEffect(() => {
    if (value && !initializedRef.current) {
      setFields({
        street: value.street || "",
        barangay: value.barangay || "",
        city: value.city || "",
        province: value.province || "",
      });
      setPlaceName(value.name || "");
      setCoords(value.coords || null);
      setHasSelected(true);
      setIsSearching(false);
      initializedRef.current = true;
    }
  }, [value]);

  const buildAddress = useCallback(
    (
      updatedFields: AddressFields,
      name: string,
      latLng: {lat: number; lng: number} | null,
    ) => {
      const parts = [
        updatedFields.street,
        updatedFields.barangay,
        updatedFields.city,
        updatedFields.province,
      ].filter(Boolean);

      if (parts.length === 0 || !latLng) {
        onChange(null);
        return;
      }

      const fullAddress = parts.join(", ");

      onChange({
        name: name || parts[0] || "Home",
        fullAddress,
        coords: latLng,
        street: updatedFields.street || undefined,
        barangay: updatedFields.barangay || undefined,
        city: updatedFields.city || undefined,
        province: updatedFields.province || undefined,
      });
    },
    [onChange],
  );

  const handlePlaceSelect = useCallback(
    (place: Place) => {
      const details = place.details;
      if (!details) return;

      const lat = details.location?.latitude;
      const lng = details.location?.longitude;
      if (lat == null || lng == null) return;

      const newCoords = {lat, lng};
      const name = details.displayName?.text || "";
      const parsed = parseAddressComponents(details.addressComponents);

      const newFields: AddressFields = {
        street: parsed.street || "",
        barangay: parsed.barangay || "",
        city: parsed.city || "",
        province: parsed.province || "",
      };

      setFields(newFields);
      setPlaceName(name);
      setCoords(newCoords);
      setHasSelected(true);
      setIsSearching(false);
      initializedRef.current = true;
      buildAddress(newFields, name, newCoords);
    },
    [buildAddress],
  );

  const handleFieldChange = useCallback(
    (field: keyof AddressFields, text: string) => {
      const updated = {...fields, [field]: text};
      setFields(updated);
      buildAddress(updated, placeName, coords);
    },
    [fields, placeName, coords, buildAddress],
  );

  const handleClear = useCallback(() => {
    setFields({
      street: "",
      barangay: "",
      city: "",
      province: "",
    });
    setPlaceName("");
    setCoords(null);
    setHasSelected(false);
    initializedRef.current = false;
    autocompleteRef.current?.clear();
    onChange(null);
  }, [onChange]);

  // Whether the search box is visible (always visible if no address, toggleable if existing)
  const [isSearching, setIsSearching] = useState(!value);

  const handleChangeAddress = useCallback(() => {
    setIsSearching(true);
  }, []);

  const [locating, setLocating] = useState(false);

  const handleUseCurrentLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access to use your current location as your address.",
          [
            {text: "Cancel", style: "cancel"},
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

      const position = await getFastCurrentPosition();
      const {latitude: lat, longitude: lng} = position.coords;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();
      const result = data.results?.[0];
      if (!result) {
        Alert.alert(
          "Address not found",
          "We couldn't find an address for your location. Please search for it instead.",
        );
        return;
      }

      const parsed = parseAddressComponents(result.address_components);
      const newFields: AddressFields = {
        street: parsed.street || "",
        barangay: parsed.barangay || "",
        city: parsed.city || "",
        province: parsed.province || "",
      };
      const newCoords = {lat, lng};
      const name = "Current Location";

      autocompleteRef.current?.clear();
      setFields(newFields);
      setPlaceName(name);
      setCoords(newCoords);
      setHasSelected(true);
      setIsSearching(false);
      initializedRef.current = true;
      buildAddress(newFields, name, newCoords);
    } catch (error) {
      console.error("Error getting current location:", error);
      Alert.alert("Error", "Failed to get your current location.");
    } finally {
      setLocating(false);
    }
  }, [locating, buildAddress]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View className="gap-2">
        <Text className="text-sm text-red-500">
          Google Maps API key is not configured.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-gray-700">
        Home Address <Text className="text-red-500">*</Text>
      </Text>

      {/* Existing address display */}
      {hasSelected && !isSearching && (
        <View className="flex-row items-center p-4 bg-gray-100 rounded-xl">
          <View className="items-center justify-center w-10 h-10 mr-3 rounded-full bg-amber-500">
            <Ionicons name="home" size={18} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text
              className="text-sm font-semibold text-gray-900"
              numberOfLines={1}
            >
              {placeName || "Home"}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
              {[fields.street, fields.barangay, fields.city, fields.province]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
          <Pressable
            onPress={handleChangeAddress}
            hitSlop={10}
            className="ml-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 active:bg-gray-50"
          >
            <Text className="text-xs font-semibold text-amber-600">Change</Text>
          </Pressable>
        </View>
      )}

      {/* Google Places Autocomplete - shown when no address or user wants to change */}
      {(isSearching || !hasSelected) && (
        <View className="bg-gray-100 rounded-lg">
          <View className="flex-row items-center px-3 py-2">
            <Ionicons
              name="search-outline"
              size={20}
              color="#9CA3AF"
              className="absolute z-50 bg-gray-100 left-3 top-4"
            />
            <View className="flex-1">
              <GooglePlacesTextInput
                ref={autocompleteRef}
                apiKey={GOOGLE_MAPS_API_KEY}
                onPlaceSelect={handlePlaceSelect}
                defaultValue={placeName}
                style={autocompleteStyles}
                languageCode="en"
                includedRegionCodes={["ph"]}
                minCharsToFetch={2}
                fetchDetails={true}
                detailsFields={[
                  "displayName",
                  "formattedAddress",
                  "location",
                  "addressComponents",
                  "id",
                ]}
                placeHolderText="Search for your address..."
                returnKeyType="search"
                textContentType="fullStreetAddress"
                textAlign="left"
                clearElement={
                  <Pressable onPress={handleClear} hitSlop={10}>
                    <Ionicons name="close" size={20} className="pt-2.5" />
                  </Pressable>
                }
                showLoadingIndicator={false}
              />
            </View>
          </View>
        </View>
      )}

      {/* Use current location - shown alongside the search box */}
      {(isSearching || !hasSelected) && (
        <>
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs font-medium text-gray-400">OR</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <Pressable
            onPress={handleUseCurrentLocation}
            disabled={locating}
            className="flex-row items-center p-3 border border-amber-200 rounded-xl bg-amber-50 active:bg-amber-100"
          >
            <View className="items-center justify-center mr-3 rounded-full w-10 h-10 bg-amber-500">
              {locating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="locate" size={20} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">
                {locating ? "Getting your location..." : "Use my current location"}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Auto-fill your address using GPS
              </Text>
            </View>
            {!locating && (
              <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
            )}
          </Pressable>
        </>
      )}

      {/* Structured fields - shown when address is selected */}
      {hasSelected && (
        <View
          className={`gap-3 p-4 bg-gray-50 rounded-xl ${error ? "border border-red-400" : ""}`}
        >
          <Text className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Address Details
          </Text>

          {/* Street */}
          <View className="gap-1">
            <Text className="text-xs font-medium text-gray-600">
              House No. / Street
            </Text>
            <TextInput
              value={fields.street}
              onChangeText={(text) => handleFieldChange("street", text)}
              placeholder="e.g. 123 Rizal Street"
              placeholderTextColor="#9CA3AF"
              className="p-3 text-sm bg-white border border-gray-200 rounded-lg"
            />
          </View>

          {/* Barangay */}
          <View className="gap-1">
            <Text className="text-xs font-medium text-gray-600">Barangay</Text>
            <TextInput
              value={fields.barangay}
              onChangeText={(text) => handleFieldChange("barangay", text)}
              placeholder="e.g. Brgy. San Antonio"
              placeholderTextColor="#9CA3AF"
              className="p-3 text-sm bg-white border border-gray-200 rounded-lg"
            />
          </View>

          {/* City & Province row */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-xs font-medium text-gray-600">
                City / Municipality
              </Text>
              <TextInput
                value={fields.city}
                onChangeText={(text) => handleFieldChange("city", text)}
                placeholder="e.g. Makati"
                placeholderTextColor="#9CA3AF"
                className="p-3 text-sm bg-white border border-gray-200 rounded-lg"
              />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-xs font-medium text-gray-600">
                Province
              </Text>
              <TextInput
                value={fields.province}
                onChangeText={(text) => handleFieldChange("province", text)}
                placeholder="e.g. Metro Manila"
                placeholderTextColor="#9CA3AF"
                className="p-3 text-sm bg-white border border-gray-200 rounded-lg"
              />
            </View>
          </View>

          {/* Postal Code
          <View className="w-1/2 gap-1">
            <Text className="text-xs font-medium text-gray-600">
              Postal Code
            </Text>
            <TextInput
              value={fields.postalCode}
              onChangeText={(text) => handleFieldChange("postalCode", text)}
              placeholder="e.g. 1200"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              className="p-3 text-sm bg-white border border-gray-200 rounded-lg"
            />
          </View> */}
        </View>
      )}

      {error && (
        <Text className="text-xs font-semibold text-center text-red-500">
          {error}
        </Text>
      )}
    </View>
  );
}

const autocompleteStyles = {
  container: {
    marginHorizontal: 0,
  },
  inputContainer: {
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  input: {
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: "#F3F4F6",
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  suggestionsContainer: {
    backgroundColor: "#ffffff",
    maxHeight: 200,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  suggestionItem: {
    padding: 12,
  },
  suggestionText: {
    main: {
      fontSize: 14,
      color: "#1F2937",
    },
    secondary: {
      fontSize: 12,
      color: "#6B7280",
    },
  },
  loadingIndicator: {
    color: "#FFA840",
    paddingTop: 10,
  },
  placeholder: {
    color: "#9CA3AF",
  },
};
