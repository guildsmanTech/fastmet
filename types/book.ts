import {GasCategory} from "@/components/VehicleMarkerIcon";
import {BookingType} from "@/store/slices/bookSlice";
import {ILoadVariant, SearchConfig, Service} from "./vehicle";

export type LocationDetails = {
  name: string;
  address: string;
  coords: {lat: number; lng: number};
  placeId?: string;
  additionalDetails?: string;
  contactName?: string;
  contactPhone?: string;
} | null;

export type RouteData = {
  distance: number;
  duration: number;
  basePrice: number;
  distanceFee: number;
  serviceFee: number;
  totalPrice: number;
  surgeMultiplier?: number; // optional — only present when pricing is active
  gasAdjFactor?: number;
};

export type BookingETAUpdatedPayload = {
  bookingId: string;
  distanceKm: number;
  durationMin: number;
  etaRevision: string;
};

export type Booking = {
  _id: string;
  bookingRef: string;
  customerId: string;
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  bookingType: {
    type: string; // "asap" | "schedule"
    value: string;
  };
  selectedVehicle: {
    name: string;
    gasCategory?: GasCategory; // populated on read for active bookings (live tracking icon)
    freeServices: Service[];
    maxLoadKg?: number | null;
  };
  routeData: RouteData;
  paymentMethod: string;
  paidBy?: "sender" | "receiver";
  addedServices: Service[];
  note: string;
  itemType: string | null;
  photos: string[];
  createdAt: string;
  status: string;
  driverRating: number | null;
  acceptedAt?: string | null;
  activeAt?: string | null;
  pickedUpAt?: string | null;
  completedAt?: string | null;
  cancelledAt: string | null;
  cancelledBy?: "client" | "driver" | "system" | null;
  cancellationReason?: "no_show_client" | "no_show_driver" | "other" | null;
  requestedDrivers: RequestedDriver[];
  driver?: Driver;
  voucherApplied?: {
    issuedRewardId: string;
    voucherTemplateId: string;
    discountAmount: number;
  } | null;
};

export type ActiveBooking = Booking & {driver: Driver};
export type CompletedBooking = ActiveBooking & {
  completedAt: string;
  bookingImages: {
    pickup: {
      beforeImageUrl: string;
      afterImageUrl: string;
    };
    dropoff: {
      signatureImageUrl: string;
      packageImageUrl: string;
    };
  };
};

export type Driver = {
  id: string;
  name: string;
  rating: number;
  profilePictureUrl: string;
  phoneNumber: string;
};

export type RequestBooking = {
  customerId: string;
  bookingRef: string;
  /** Price lock from POST /pricing/quote. The server prices the booking from it. */
  quoteId: string;
  pickUp: LocationDetails;
  dropOff: LocationDetails;
  bookingType: BookingType;
  selectedVehicle: {
    _id: string;
    key: string;
    variant: ILoadVariant | null;
    searchConfig: SearchConfig;
  };
  paymentMethod: "cash" | "gcash";
  paidBy: "sender" | "receiver";
  /** Only identifies what was chosen; the server prices services itself. */
  addedServices: Pick<Service, "key" | "quantity">[];
  photos: string[];
  note: string;
  itemType: string | null;
  voucherRewardId?: string;
};

export type RequestedDriver = {
  id: string;
  name: string;
  rating: number;
  vehicleImage: string;
  totalBookings: number;
  distance?: number;
  profilePicture: string;
  bookingId?: string;
  isQueued?: boolean;
  /** Milliseconds left on the offer timer (from server clock). */
  remainingMs?: number;
};
