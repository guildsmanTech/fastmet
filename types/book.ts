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

/** `bookingId` and `ts` are absent from older backends. */
export type DriverLocationResponsePayload = {
  bookingId?: string;
  driverLoc: {lat: number; lng: number} | null;
  /** Server time (ms epoch) the position was received. */
  ts?: number;
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
  /** ASAP priority option: the driver handles it before their other bookings. */
  isPriority?: boolean;
  /** When the driver became free to work on this booking (null while behind a priority one). */
  unlockedAt?: string | null;
  /** In-progress bookings: the rest of the driver's work. Null when not applicable. */
  driverQueue?: DriverQueue | null;
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
  /** Driver must collect a signature at dropoff. */
  requireSignature?: boolean;
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
  /** Set on completed/cancelled lists when this client already filed a report. */
  clientReport?: {
    status: "pending" | "resolved" | "dismissed";
    reportId: string;
  } | null;
  /** Pending while assigned driver must confirm a client reschedule. */
  rescheduleConfirmation?: {
    status: "pending";
    requestedAt: string;
    expiresAt: string;
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
  /** Already masked by the API, e.g. AB**34 */
  plateNumber?: string | null;
  /** Up to 2 vehicle exterior photos */
  vehicleImages?: string[];
  /** Completed trips for this driver */
  totalBookings?: number;
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
  requireSignature: boolean;
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
  /** Other deliveries the driver was handling when they offered (ASAP offers). */
  activeBookingCount?: number;
  /** The driver will finish a priority delivery before this booking. */
  hasPriority?: boolean;
  /** Milliseconds left on the offer timer (from server clock). */
  remainingMs?: number;
};

/** Where a booking stands in its driver's work (in-progress ASAP / scheduled bookings). */
export type DriverQueue = {
  /** Other deliveries the same driver is handling. */
  otherActiveCount: number;
  /** The driver must finish a priority delivery before this one. */
  waitingForPriority: boolean;
};

export type BookingQueueUpdatedPayload = {
  bookingId: string;
  driverQueue: DriverQueue;
};
