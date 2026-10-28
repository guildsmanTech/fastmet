import {getBookingOffers} from "@/api/book";
import {queryClient} from "@/lib/queryClient";
import {PENDING_REPORTS_AGAINST_ME_KEY} from "@/queries/reportQueries";
import {pushOnce} from "@/utils/helpers/navigation";
import {openChat} from "@/utils/helpers/openChat";
import {isAxiosError} from "axios";
import {router, type Href} from "expo-router";
import Toast from "react-native-toast-message";

type NotificationData = Record<string, unknown> | undefined | null;

const ENDED_BOOKING_TAB: Record<string, Href> = {
  completed: "/(drawer)/(tabs)/request?tab=completed",
  cancelled: "/(drawer)/(tabs)/request?tab=cancelled",
};

/**
 * A driver offer push can be tapped long after the search ended, so open what
 * fits the booking now: the search, its live map, or the request list.
 */
async function openOfferedBooking(
  bookingId: string,
  type: "asap" | "pooling",
): Promise<void> {
  let status: string | undefined;
  try {
    ({status} = await getBookingOffers(bookingId));
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) {
      Toast.show({
        type: "error",
        text1: "Booking unavailable",
        text2: "This booking no longer exists.",
        position: "top",
        visibilityTime: 5_000,
        topOffset: 50,
      });
      return;
    }
    // Offline: the search screen re-checks the booking on its own.
  }

  try {
    if (
      status === "active" ||
      status === "picked_up" ||
      status === "need_continuance"
    ) {
      pushOnce({
        pathname: "/(root_screens)/booking/viewOnMap",
        params: {bookingId},
      });
      return;
    }

    const endedTab = status ? ENDED_BOOKING_TAB[status] : undefined;
    if (endedTab) {
      Toast.show({
        type: "info",
        text1:
          status === "completed" ? "Booking completed" : "Booking cancelled",
        text2: "This driver offer is no longer available.",
        position: "top",
        visibilityTime: 5_000,
        topOffset: 50,
      });
      router.dismissTo(endedTab);
      return;
    }

    // Still searching (or waiting for the pooling trip to start).
    pushOnce({
      pathname: "/(root_screens)/booking/searchingDriver",
      params: {bookingId, type},
    });
  } catch {
    // navigation not ready — ignore
  }
}

/**
 * CLIENT APP - Push Notification Routing Handler
 *
 * This function handles all push notification taps and routes to the appropriate screen.
 * See NOTIFICATION_ROUTING_GUIDE.md in backend for how to add new routes.
 *
 * Current supported targets:
 * - "searchingDriver": Driver offer; opens the search while it's running,
 *   otherwise the booking's live map or the request list
 * - "chat": Navigate to the conversation
 * - "reportDetail": Navigate to a filed or received report
 * - default: Navigate to generic notification viewer
 */
function reportIdFrom(data: NotificationData): string | undefined {
  if (!data) return;
  if (typeof data.reportId === "string" && data.reportId) return data.reportId;
  const nested = data.data as Record<string, unknown> | undefined;
  return typeof nested?.reportId === "string" ? nested.reportId : undefined;
}

export function navigateToReportDetail(reportId: string): void {
  if (!reportId) return;

  void queryClient.invalidateQueries({queryKey: ["reports"]});
  void queryClient.invalidateQueries({queryKey: ["report", reportId]});
  void queryClient.invalidateQueries({queryKey: PENDING_REPORTS_AGAINST_ME_KEY});

  setTimeout(() => {
    try {
      pushOnce({
        pathname: "/(root_screens)/reportDetail",
        params: {reportId},
      });
    } catch {
      // navigation not ready — ignore
    }
  }, 0);
}

export function handleNotificationEntry(
  data: NotificationData,
  options: {navigate?: boolean} = {navigate: true},
): void {
  if (!data || !options.navigate) return;

  const target = data.target as string | undefined;

  const type = data.type as string | undefined;

  // Driver offer notification → the search, or wherever the booking is now
  if (target === "searchingDriver") {
    const bookingId = data.bookingId as string | undefined;
    if (bookingId) {
      void openOfferedBooking(
        bookingId,
        type === "driver_offer_pooling" ? "pooling" : "asap",
      );
    }
    return;
  }
  if (target === "reportDetail" || type === "report" || type === "report_reply") {
    const reportId = reportIdFrom(data);
    if (reportId) navigateToReportDetail(reportId);
    return;
  }

  if (target === "chat") {
    const conversationId = data.conversationId as string | undefined;
    if (conversationId) {
      setTimeout(() => {
        try {
          openChat(conversationId);
        } catch {
          // navigation not ready — ignore
        }
      }, 0);
    }
    return;
  }

  // Default notification viewer for other types
  const notificationId =
    (data.notificationId as string | undefined) ??
    (data._id as string | undefined);

  if (!notificationId) return;

  // Defer so the router/layout is mounted on cold start.
  setTimeout(() => {
    try {
      pushOnce({
        pathname: "/(root_screens)/notifViewer",
        params: {notificationId},
      });
    } catch {
      // navigation not ready — ignore
    }
  }, 0);
}
