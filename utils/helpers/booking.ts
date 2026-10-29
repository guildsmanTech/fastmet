import { Type } from "@/store/slices/bookSlice";

interface BookingRefOptions {
  bookingType: Type;
  refCode: string;
  priority?: string; // Only for ASAP bookings
}

export const generateBookingRef = ({
  bookingType,
  refCode,
  priority = "regular",
}: BookingRefOptions): string => {
  // Compact prefix mapping
  const prefixMap: Record<Type, string> = {
    asap: priority === "priority" ? "AP" : "AR", // ASAP Priority / ASAP Regular
    pooling: "PL",
    schedule: "SC",
  };

  const prefix = prefixMap[bookingType];

  const now = new Date();

  // Compact date: YYMMDD
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");

  // Hour: HH (for uniqueness)
  const hour = now.getHours().toString().padStart(2, "0");

  // 4-digit random number
  const randomNum = Math.floor(Math.random() * 9000 + 1000);

  // Format: AP-250116-14-MC-4521
  return `${prefix}-${date}-${hour}-${refCode}-${randomNum}`;
};

export const createConversationId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join("_");
};

export type BookingTimelineContext = "request" | "active" | "cancelled" | "completed";

export type BookingTimelineItem = {
  label: string;
  date: string;
};

type BookingTimelineSource = {
  createdAt: string;
  status?: string;
  bookingType: {type: string; value?: string};
  acceptedAt?: string | null;
  activeAt?: string | null;
  pickedUpAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
};

export function getBookingTimelineContext(
  modalType: string,
): BookingTimelineContext {
  if (modalType === "Active Booking") return "active";
  if (modalType === "Cancelled Booking") return "cancelled";
  return "request";
}

export function getBookingTimelineItems(
  booking: BookingTimelineSource,
  context: BookingTimelineContext,
): BookingTimelineItem[] {
  const items: BookingTimelineItem[] = [
    {label: "Booked", date: booking.createdAt},
  ];

  if (booking.bookingType.type === "schedule" && booking.bookingType.value) {
    items.push({
      label: "Scheduled pickup",
      date: booking.bookingType.value,
    });
  }

  if (booking.acceptedAt) {
    items.push({label: "Driver accepted", date: booking.acceptedAt});
  }

  if (context !== "request") {
    if (booking.activeAt) {
      items.push({label: "Trip started", date: booking.activeAt});
    }
    if (booking.pickedUpAt) {
      items.push({label: "Picked up", date: booking.pickedUpAt});
    }
  }

  if (context === "cancelled" && booking.cancelledAt) {
    items.push({label: "Cancelled", date: booking.cancelledAt});
  }

  if (context === "completed" && booking.completedAt) {
    items.push({label: "Completed", date: booking.completedAt});
  }

  return items;
}
