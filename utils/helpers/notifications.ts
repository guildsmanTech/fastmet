import {getBookingOffers} from "@/api/book";
import {isAxiosError} from "axios";
import * as Notifications from "expo-notifications";

type NotificationData = Record<string, unknown>;

function getNotificationData(
  notification: Notifications.Notification,
): NotificationData {
  return (notification.request.content.data ?? {}) as NotificationData;
}

export async function dismissNotificationsWhere(
  predicate: (data: NotificationData) => boolean,
): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => predicate(getNotificationData(n)))
        .map((n) =>
          Notifications.dismissNotificationAsync(n.request.identifier),
        ),
    );
  } catch (e) {
    console.log("[notifications] dismiss failed:", e);
  }
}

export function dismissChatNotifications(conversationId: string) {
  return dismissNotificationsWhere(
    (data) =>
      data.type === "chat_message" && data.conversationId === conversationId,
  );
}

/** A booking as the server sees it now; null once it no longer exists. */
type BookingNow = {status: string; offerDriverIds: Set<string>} | null;

const isEnded = (booking: BookingNow) =>
  !booking || booking.status === "completed" || booking.status === "cancelled";

// One driver's ASAP / pooling offer: done once the search is over or that
// driver's offer is gone.
const isOfferGone = (booking: BookingNow, data: NotificationData) =>
  booking?.status !== "searching" ||
  !booking.offerDriverIds.has(String(data.driverId));

// Scheduled booking waiting for the customer to pick a driver.
const isDriverChosen = (booking: BookingNow) => booking?.status !== "pending";

/**
 * Booking pushes that ask for an action or describe a step in progress, and
 * when they are done. Types not listed (cancellations, completion and other
 * final notices) stay in the tray.
 */
const IS_DONE: Record<
  string,
  (booking: BookingNow, data: NotificationData) => boolean
> = {
  // ASAP offer push (`target: "searchingDriver"`) or the scheduled offers summary.
  driver_offer: (booking, data) =>
    data.target === "searchingDriver"
      ? isOfferGone(booking, data)
      : isDriverChosen(booking),
  driver_offer_pooling: isOfferGone,
  scheduled_choose_driver: isDriverChosen,
  scheduled_no_drivers: isDriverChosen,
  scheduled_auto_assign_warning: isDriverChosen,
  driver_unavailable: isDriverChosen,
  driver_arrived_at_pickup: (booking) => booking?.status !== "active",
  booking_needs_continuance: (booking) =>
    booking?.status !== "need_continuance",
  driver_arrived_at_dropoff: isEnded,
  driver_reassigned: isEnded,
  continuance_cancelled: isEnded,
  scheduled_auto_assigned: isEnded,
  driver_confirmed_reschedule: isEnded,
  driver_declined_reschedule: isEnded,
  driver_started_scheduled_trip: isEnded,
};

/** undefined: couldn't tell (offline), so its pushes are left alone. */
async function fetchBookingNow(
  bookingId: string,
): Promise<BookingNow | undefined> {
  try {
    const {status, offers} = await getBookingOffers(bookingId);
    return {
      status,
      offerDriverIds: new Set((offers ?? []).map((offer) => offer.id)),
    };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return null;
    return undefined;
  }
}

async function pruneOnce(): Promise<void> {
  let presented: Notifications.Notification[];
  try {
    presented = await Notifications.getPresentedNotificationsAsync();
  } catch {
    return;
  }

  const candidates = presented.filter((n) => {
    const data = getNotificationData(n);
    return (
      typeof data.bookingId === "string" &&
      typeof data.type === "string" &&
      data.type in IS_DONE
    );
  });
  if (candidates.length === 0) return;

  // Every candidate was shown before this check, and the server saves the
  // booking change before pushing, so the answer already covers it.
  const bookingIds = [
    ...new Set(
      candidates.map((n) => getNotificationData(n).bookingId as string),
    ),
  ];
  const bookings = new Map<string, BookingNow>();
  await Promise.all(
    bookingIds.map(async (id) => {
      const booking = await fetchBookingNow(id);
      if (booking !== undefined) bookings.set(id, booking);
    }),
  );

  await Promise.all(
    candidates
      .filter((n) => {
        const data = getNotificationData(n);
        const bookingId = data.bookingId as string;
        if (!bookings.has(bookingId)) return false;
        return IS_DONE[data.type as string](bookings.get(bookingId)!, data);
      })
      .map((n) =>
        Notifications.dismissNotificationAsync(n.request.identifier).catch(
          () => {},
        ),
      ),
  );
}

let pruneTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Removes booking pushes from the tray once their action is done (offer
 * taken or expired, driver chosen, booking ended). Checks each booking with
 * the server, so it is safe to call on any booking event; bursts are
 * coalesced into one check.
 */
export function pruneStaleNotifications(): void {
  clearTimeout(pruneTimer);
  pruneTimer = setTimeout(() => void pruneOnce(), 500);
}
