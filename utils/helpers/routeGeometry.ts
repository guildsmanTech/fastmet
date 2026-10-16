import type {LatLng} from "react-native-maps";

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from a to b, 0–360 (0 = north). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed smallest rotation from `from` to `to`, in degrees (-180..180). */
export function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Decodes a Google encoded polyline. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({latitude: lat / 1e5, longitude: lng / 1e5});
  }
  return points;
}

export type RouteProgress = {
  /** Route already driven, ending at the snapped point. */
  traveled: LatLng[];
  /** Route still to drive, starting at the snapped point. */
  remaining: LatLng[];
  /** Closest point on the route to the driver. */
  snapped: LatLng;
  /** Direction of the road at the snapped point. */
  roadBearing: number;
  /** How far the driver is from the route. */
  offRouteM: number;
  remainingM: number;
};

/**
 * Projects the driver onto the route and splits it at that point.
 * Uses a local flat-earth approximation, which is accurate at street scale.
 */
export function splitRouteAt(route: LatLng[], point: LatLng): RouteProgress | null {
  if (route.length < 2) return null;

  const cosLat = Math.cos(toRad(point.latitude));
  const toXY = (p: LatLng) => ({
    x: toRad(p.longitude) * cosLat * EARTH_RADIUS_M,
    y: toRad(p.latitude) * EARTH_RADIUS_M,
  });
  const P = toXY(point);

  let bestIdx = 0;
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const A = toXY(route[i]);
    const B = toXY(route[i + 1]);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
    const d = Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestT = t;
    }
  }

  const a = route[bestIdx];
  const b = route[bestIdx + 1];
  const snapped = {
    latitude: a.latitude + (b.latitude - a.latitude) * bestT,
    longitude: a.longitude + (b.longitude - a.longitude) * bestT,
  };

  const remaining = [snapped, ...route.slice(bestIdx + 1)];
  let remainingM = 0;
  for (let i = 0; i < remaining.length - 1; i++) {
    remainingM += distanceMeters(remaining[i], remaining[i + 1]);
  }

  return {
    traveled: [...route.slice(0, bestIdx + 1), snapped],
    remaining,
    snapped,
    roadBearing: bearingDegrees(a, b),
    offRouteM: bestDist,
    remainingM,
  };
}

export type DrivingRoute = {
  coordinates: LatLng[];
  distanceM: number;
  durationS: number;
};

/**
 * One Google Directions request (same API and key the app already used via
 * react-native-maps-directions). Callers must keep this to stage changes and
 * reroutes — it is billed per request.
 */
export async function fetchDrivingRoute(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
  signal?: AbortSignal,
): Promise<DrivingRoute | null> {
  if (!apiKey) return null;

  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=driving&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {signal});
  if (!res.ok) return null;

  const json = (await res.json()) as {
    status?: string;
    routes?: {
      overview_polyline?: {points?: string};
      legs?: {distance?: {value?: number}; duration?: {value?: number}}[];
    }[];
  };
  const route = json.routes?.[0];
  const encoded = route?.overview_polyline?.points;
  if (json.status !== "OK" || !route || !encoded) return null;

  const coordinates = decodePolyline(encoded);
  if (coordinates.length < 2) return null;

  const legs = route.legs ?? [];
  return {
    coordinates,
    distanceM: legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0),
    durationS: legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0),
  };
}
