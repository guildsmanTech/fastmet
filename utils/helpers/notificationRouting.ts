import {queryClient} from "@/lib/queryClient";
import {PENDING_REPORTS_AGAINST_ME_KEY} from "@/queries/reportQueries";
import {pushOnce} from "@/utils/helpers/navigation";
import {openChat} from "@/utils/helpers/openChat";
import {router} from "expo-router";

type NotificationData = Record<string, unknown> | undefined | null;

/**
 * CLIENT APP - Push Notification Routing Handler
 * 
 * This function handles all push notification taps and routes to the appropriate screen.
 * See NOTIFICATION_ROUTING_GUIDE.md in backend for how to add new routes.
 * 
 * Current supported targets:
 * - "searchingDriver": Navigate back to driver search screen (for driver offers)
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

  // Driver offer notification → navigate back to searchingDriver page
  if (target === "searchingDriver") {
    const bookingId = data.bookingId as string | undefined;
    if (bookingId) {
      setTimeout(() => {
        try {
          router.push({
            pathname: "/(root_screens)/booking/searchingDriver",
            params: {bookingId},
          });
        } catch {
          // navigation not ready — ignore
        }
      }, 0);
    }
    return;
  }

  const type = data.type as string | undefined;
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
