import {LocationDetails} from "@/types/book";

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
