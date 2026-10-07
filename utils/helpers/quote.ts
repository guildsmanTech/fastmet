import type {QuoteRequestBody} from "@/api/pricing";
import type {BookingType} from "@/store/slices/bookSlice";
import type {LocationDetails, RouteData} from "@/types/book";
import type {SelectedVehicle, Service} from "@/types/vehicle";

/** Quotes expire after 10 min server-side; refresh a little before that. */
export const QUOTE_EXPIRY_MARGIN_MS = 30_000;

type QuoteInputs = {
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  selectedVehicle: SelectedVehicle | null;
  bookingType: BookingType | null;
  addedServices: Service[];
};

export type QuoteState = QuoteInputs & {
  quoteId: string | null;
  quoteExpiresAt: number | null;
  quoteKey: string | null;
  quoteStatus: "idle" | "loading" | "ready" | "error";
  routeData: RouteData;
};

/**
 * Everything the server needs to price a booking. No prices go up: the
 * server derives them. Returns null until the booking is fully specified.
 */
export const buildQuoteBody = (s: QuoteInputs): QuoteRequestBody | null => {
  const variantId = s.selectedVehicle?.variant?._id;
  if (!s.pickUp || !s.dropOff || !s.selectedVehicle || !variantId || !s.bookingType) {
    return null;
  }

  return {
    pickUp: {coords: {lat: s.pickUp.coords.lat, lng: s.pickUp.coords.lng}},
    dropOff: {coords: {lat: s.dropOff.coords.lat, lng: s.dropOff.coords.lng}},
    vehicleTypeId: s.selectedVehicle._id,
    variantId,
    bookingType: {
      type: s.bookingType.type,
      // A schedule's date never changes the price; don't re-quote when it moves.
      value: s.bookingType.type === "schedule" ? "schedule" : s.bookingType.value,
    },
    services: s.addedServices.map((service) => ({
      key: service.key,
      quantity: service.quantity ?? 1,
    })),
  };
};

/** Stable identity of a quote request. */
export const quoteKeyOf = (body: QuoteRequestBody): string =>
  JSON.stringify(body);

/**
 * True when the stored quote matches the inputs currently on screen (so the
 * displayed price can be trusted). Logged-in users also need a locked quoteId.
 */
export const isQuoteCurrent = (s: QuoteState, isLoggedIn: boolean): boolean => {
  if (s.quoteStatus !== "ready" || !s.quoteKey) return false;
  const body = buildQuoteBody(s);
  if (!body || quoteKeyOf(body) !== s.quoteKey) return false;
  return isLoggedIn ? !!s.quoteId : true;
};

/** True when a locked quote can still be redeemed for a booking right now. */
export const isQuoteRedeemable = (s: QuoteState, now = Date.now()): boolean =>
  isQuoteCurrent(s, true) &&
  s.quoteExpiresAt !== null &&
  s.quoteExpiresAt - now > QUOTE_EXPIRY_MARGIN_MS;
