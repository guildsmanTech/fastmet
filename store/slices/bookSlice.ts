import type {LocationDetails, RouteData} from "@/types/book";
import {SelectedVehicle, Service} from "@/types/vehicle";
import {
  addressMentionsAllowedPickupCity,
  isDropOffAllowed,
  isWithinAllowedPickupBounds,
} from "@/utils/constants";
import {deriveDefaultBookingType, resolveModifier} from "@/utils/helpers/bookingType";
import {StateCreator} from "zustand";
import {BookingTypeSlice} from "./bookingTypeSlice";
import {LoadingSlice} from "./loadingStore";

export type Type = "asap" | "pooling" | "schedule";

export type BookingType = {
  type: Type;
  value: string;
  priceModifier: number; // resolved from DB config at selection time
};

export interface BookSlice {
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  bookingType: BookingType | null;
  selectedVehicle: SelectedVehicle | null;
  /** Server-computed price breakdown (from the latest quote/estimate). */
  routeData: RouteData;
  /** Price lock for the current inputs. Null for guests and while re-quoting. */
  quoteId: string | null;
  quoteExpiresAt: number | null;
  /** Identity of the inputs `routeData`/`quoteId` were computed for. */
  quoteKey: string | null;
  quoteStatus: "idle" | "loading" | "ready" | "error";
  quoteError: string | null;
  paymentMethod: "cash" | "gcash";
  paidBy: "sender" | "receiver";
  note: string;
  itemType: string | null;
  photos: string[];

  addedServices: Service[];
  toggleService: (service: Service) => void;
  updateServiceQuantity: (
    serviceKey: string,
    originalPrice: number,
    quantity: number,
  ) => void;

  setPickUp: (details: LocationDetails) => void;
  setPickUpAdditionalDetails: (details: string) => void;
  setPickUpContactName: (contactName: string) => void;
  setPickUpContactPhone: (contactPhone: string) => void;

  setDropOff: (details: LocationDetails) => void;
  setDropOffAdditionalDetails: (details: string) => void;
  setDropOffContactName: (contactName: string) => void;
  setDropOffContactPhone: (contactPhone: string) => void;
  /** Swaps pickup/dropoff only if both pass service-area checks. Returns false if blocked. */
  swapLocations: () => boolean;
  setBookingType: (payload: {type: Type; value: string}) => void;
  setSelectedVehicle: (vehicle: SelectedVehicle) => void;
  setQuoteLoading: () => void;
  setQuoteReady: (quote: {
    key: string;
    quoteId?: string;
    expiresAt?: number;
    routeData: RouteData;
  }) => void;
  setQuoteError: (message: string) => void;
  /** Inputs incomplete: drop the price entirely. */
  resetQuote: () => void;
  setNote: (note: string) => void;
  setItemType: (itemType: string | null) => void;
  setPaymentMethod: (method: "cash" | "gcash") => void;
  setPaidBy: (paidBy: "sender" | "receiver") => void;

  setPhoto: (photo: string) => void;
  removePhoto: (photo: string) => void;

  clearStates: () => void;
}

const EMPTY_ROUTE_DATA: RouteData = {
  distance: 0,
  duration: 0,
  basePrice: 0,
  distanceFee: 0,
  serviceFee: 0,
  totalPrice: 0,
  surgeMultiplier: 1.0,
  gasAdjFactor: 1.0,
};

const EMPTY_QUOTE = {
  quoteId: null,
  quoteExpiresAt: null,
  quoteKey: null,
  quoteStatus: "idle" as const,
  quoteError: null,
};

export const createBookSlice: StateCreator<
  BookSlice & BookingTypeSlice & LoadingSlice, // gives get() visibility into bookingTypes
  [],
  [],
  BookSlice
> = (set, get) => ({
  pickUp: null,
  dropOff: null,
  bookingType: null,
  selectedVehicle: null,
  routeData: EMPTY_ROUTE_DATA,
  ...EMPTY_QUOTE,
  paymentMethod: "cash",
  paidBy: "sender",
  note: "",
  itemType: null,
  photos: [],
  addedServices: [],

  // Prices are never computed here: changing services only changes the
  // selection, and the quote hook asks the server for the new total.
  toggleService: (service: Service) =>
    set((state) => {
      const exists = state.addedServices.some((s) => s.key === service.key);
      return {
        addedServices: exists
          ? state.addedServices.filter((s) => s.key !== service.key)
          : [...state.addedServices, service],
      };
    }),

  updateServiceQuantity: (serviceKey, originalPrice, quantity) =>
    set((state) => ({
      addedServices: state.addedServices.map((service) =>
        service.key === serviceKey
          ? {...service, quantity, price: originalPrice * quantity}
          : service,
      ),
    })),

  setPickUp: (details) => set({pickUp: details}),
  setPickUpAdditionalDetails: (additionalDetails) =>
    set((state) => ({
      pickUp: state.pickUp
        ? {...state.pickUp, additionalDetails: additionalDetails.trim()}
        : null,
    })),

  setPickUpContactName: (contactName) =>
    set((state) => ({
      pickUp: state.pickUp
        ? {...state.pickUp, contactName: contactName.trim()}
        : null,
    })),
  setPickUpContactPhone: (contactPhone) =>
    set((state) => ({
      pickUp: state.pickUp
        ? {...state.pickUp, contactPhone: contactPhone.trim()}
        : null,
    })),
  setDropOff: (details) => set({dropOff: details}),
  setDropOffAdditionalDetails: (additionalDetails) =>
    set((state) => ({
      dropOff: state.dropOff
        ? {...state.dropOff, additionalDetails: additionalDetails.trim()}
        : null,
    })),

  setDropOffContactName: (contactName) =>
    set((state) => ({
      dropOff: state.dropOff
        ? {...state.dropOff, contactName: contactName.trim()}
        : null,
    })),
  setDropOffContactPhone: (contactPhone) =>
    set((state) => ({
      dropOff: state.dropOff
        ? {...state.dropOff, contactPhone: contactPhone.trim()}
        : null,
    })),

  swapLocations: () => {
    const {pickUp, dropOff} = get();
    if (!pickUp || !dropOff) return false;

    // Current dropOff becomes the new pickup — must pass pickup gates
    const newPickupInBounds = isWithinAllowedPickupBounds(
      dropOff.coords.lat,
      dropOff.coords.lng,
    );
    const newPickupCityOk =
      addressMentionsAllowedPickupCity(dropOff.address) ||
      addressMentionsAllowedPickupCity(dropOff.name);
    // Current pickUp becomes the new dropoff — must pass dropoff gates
    const newDropoffOk = isDropOffAllowed(pickUp.coords.lat, pickUp.coords.lng);

    if (!newPickupInBounds || !newPickupCityOk || !newDropoffOk) {
      return false;
    }

    set({pickUp: dropOff, dropOff: pickUp});
    return true;
  },

  setBookingType: ({type, value}) => {
    const priceModifier = resolveModifier(get().bookingTypes, type, value);
    set({bookingType: {type, value, priceModifier}});
  },

  setSelectedVehicle: (vehicle) => set({selectedVehicle: vehicle}),
  setQuoteLoading: () =>
    set({
      quoteStatus: "loading",
      quoteError: null,
      // A quote for different inputs must never be redeemable.
      quoteId: null,
      quoteExpiresAt: null,
    }),
  setQuoteReady: ({key, quoteId, expiresAt, routeData}) =>
    set({
      routeData,
      quoteKey: key,
      quoteId: quoteId ?? null,
      quoteExpiresAt: expiresAt ?? null,
      quoteStatus: "ready",
      quoteError: null,
    }),
  setQuoteError: (message) =>
    set({
      quoteStatus: "error",
      quoteError: message,
      quoteId: null,
      quoteExpiresAt: null,
      quoteKey: null,
    }),
  resetQuote: () => set({routeData: EMPTY_ROUTE_DATA, ...EMPTY_QUOTE}),
  setNote: (note) => set({note}),
  setItemType: (itemType) => set({itemType}),
  setPhoto: (photo) => set((state) => ({photos: [...state.photos, photo]})),
  removePhoto: (photo) =>
    set((state) => ({photos: state.photos.filter((p) => p !== photo)})),
  setPaymentMethod: (method) => set({paymentMethod: method}),
  setPaidBy: (paidBy) => set({paidBy}),

  clearStates: () =>
    set((state) => ({
      pickUp: null,
      dropOff: null,
      bookingType: deriveDefaultBookingType(state.bookingTypes),
      selectedVehicle: null,
      routeData: EMPTY_ROUTE_DATA,
      ...EMPTY_QUOTE,
      note: "",
      itemType: null,
      photos: [],
      paymentMethod: "cash",
      paidBy: "sender",
      addedServices: [],
    })),
});
