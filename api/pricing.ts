import api from "@/lib/axios";
import type {RouteData} from "@/types/book";
import axios from "axios";

const publicPricingUrl = `${process.env.EXPO_PUBLIC_BASE_URL}/api/pricing`;

export type QuoteRequestBody = {
  pickUp: {coords: {lat: number; lng: number}};
  dropOff: {coords: {lat: number; lng: number}};
  vehicleTypeId: string;
  variantId: string;
  bookingType: {type: "asap" | "pooling" | "schedule"; value: string};
  services: {key: string; quantity: number}[];
};

export type QuoteResponse = {
  /** Present for logged-in users only. Guests get a preview with no lock. */
  quoteId?: string;
  expiresAt?: number;
  routeData: RouteData;
};

export type RoutePreviewResponse = {
  distanceKm: number;
  durationMin: number;
  /** Google encoded polyline. */
  polyline: string;
};

/** Locks a server-computed price for ~10 minutes (auth required). */
export const fetchQuote = async (
  body: QuoteRequestBody,
): Promise<QuoteResponse> => {
  const res = await api.post<QuoteResponse>("/pricing/quote", body);
  return res.data;
};

/** Guest price preview. Same math as the quote, but nothing is locked. */
export const fetchEstimate = async (
  body: QuoteRequestBody,
): Promise<QuoteResponse> => {
  const res = await axios.post<QuoteResponse>(
    `${publicPricingUrl}/estimate`,
    body,
  );
  return res.data;
};

/** Driving route for the map. Server-cached; shared with quotes. */
export const fetchRoutePreview = async (
  pickUp: {lat: number; lng: number},
  dropOff: {lat: number; lng: number},
  allowExpressway: boolean,
): Promise<RoutePreviewResponse> => {
  const res = await axios.post<RoutePreviewResponse>(
    `${publicPricingUrl}/route`,
    {pickUp: {coords: pickUp}, dropOff: {coords: dropOff}, allowExpressway},
  );
  return res.data;
};

/** User-facing message from a pricing API failure. */
export const getPricingErrorMessage = (err: unknown): string => {
  const data = (err as {response?: {data?: {message?: string}}})?.response
    ?.data;
  return (
    data?.message ??
    "We couldn't calculate your price right now. Please try again."
  );
};

/** Business-rule failures (4xx) won't succeed on retry. */
export const isClientPricingError = (err: unknown): boolean => {
  const status = (err as {response?: {status?: number}})?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
};
