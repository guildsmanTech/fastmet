import {LocationDetails} from "@/types/book";
import {ILoadVariant} from "@/types/vehicle";
import axios from "axios";
import {GOOGLE_MAPS_API_KEY} from "../constants";

export type LatLng = {latitude: number; longitude: number};

export type DrivingRouteResult = {
  distanceKm: number;
  /** Raw Google driving duration (minutes), before vehicle speed factor. */
  durationMin: number;
  coordinates: LatLng[];
};

export const VEHICLE_SPEED_FACTORS: Record<string, number> = {
  motorcycle: 1.15, // 15% faster in traffic
  sedan: 1.0, // baseline
  mpv_suv: 0.95, // slightly slower
  light_van: 0.9,
  small_pickup: 0.9,
  l300: 0.85,
  closed_van: 0.85,
  wing_van: 0.8, // slowest
};

/** Google encoded polyline → lat/lng path */
export function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates: LatLng[] = [];

  while (index < len) {
    let b = 0;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

export function applyVehicleDuration(
  durationMin: number,
  vehicleType: string | undefined,
): number {
  const speedFactor =
    VEHICLE_SPEED_FACTORS[vehicleType ?? ""] ?? 1.0;
  return Math.round(durationMin / speedFactor);
}

/**
 * One Directions call for distance + duration + polyline.
 * Cached separately for service-road vs expressway (allowExpressway).
 */
export async function fetchDrivingDistance(
  pickUp: LocationDetails,
  dropOff: LocationDetails,
  allowExpressway = false,
): Promise<DrivingRouteResult> {
  if (!pickUp || !dropOff) {
    return {distanceKm: 0, durationMin: 0, coordinates: []};
  }

  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/directions/json",
    {
      params: {
        origin: `${pickUp.coords.lat},${pickUp.coords.lng}`,
        destination: `${dropOff.coords.lat},${dropOff.coords.lng}`,
        mode: "driving",
        overview: "full",
        // Default: service roads only. With toll_fee selected, allow expressways/tolls.
        ...(allowExpressway ? {} : {avoid: "tolls|highways"}),
        key: GOOGLE_MAPS_API_KEY,
      },
    },
  );

  const route = res.data.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg) throw new Error("No route found");

  const encoded: string | undefined = route.overview_polyline?.points;
  const coordinates = encoded ? decodePolyline(encoded) : [];

  return {
    distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(leg.duration.value / 60),
    coordinates,
  };
}

/** Tiered distance fee — shared by book screen and toll_fee recalc on services. */
export function computeDistanceFee(
  distanceKm: number,
  variant: ILoadVariant,
  bookingTypeModifier: number,
): number {
  const sortedTiers = [...variant.pricingTiers].sort(
    (a, b) => a.minKm - b.minKm,
  );

  let fee = 0;
  let remaining = distanceKm;
  for (const tier of sortedTiers) {
    if (remaining <= 0) break;
    const tierMax = tier.maxKm ?? Infinity;
    const kmInTier = Math.min(remaining, tierMax - tier.minKm);
    fee += kmInTier * tier.pricePerKm;
    remaining -= kmInTier;
  }
  return Math.round(fee * bookingTypeModifier);
}
