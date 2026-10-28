import {LocationDetails} from "@/types/book";
import * as Location from "expo-location";

/**
 * Current device position, fast: uses the OS's cached fix when it's recent and
 * precise enough, and only waits for a fresh fix (which can take 5–30s) otherwise.
 */
export const getFastCurrentPosition = async () =>
  (await Location.getLastKnownPositionAsync({
    maxAge: 60_000,
    requiredAccuracy: 100,
  })) ??
  (await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  }));

export const isSameLocation = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): boolean => {
  // Compare coordinates with a small tolerance (about 10 meters)
  const tolerance = 0.0001; // approximately 10 meters
  return Math.abs(lat1 - lat2) < tolerance && Math.abs(lng1 - lng2) < tolerance;
};

/** Rough walking distance for UI copy: "120 m", "1.2 km". */
export const formatMeters = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
};

export const formatLocation = (loc: LocationDetails) => {
  return (
    loc?.address.includes(loc.name)
      ? loc.address
      : loc?.name + ", " + loc?.address
  ).replace(", Philippines", "");
};
