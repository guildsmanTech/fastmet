import type {Ionicons} from "@expo/vector-icons";
import type {Href} from "expo-router";
import type {ComponentProps} from "react";

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Button under the notification details. Drawer screens are dismissed to. */
export type NotificationAction =
  | {label: string; href: Href}
  | {label: string; opensReport: true};

export interface NotificationConfig {
  icon: IoniconName;
  color: string; // Hex color
  label: string; // Display label
  action?: NotificationAction;
}

export enum NOTIFICATION_TYPES {
  driver_offer = "driver_offer",
  booking_expired = "booking_expired",
  booking_cancelled = "booking_cancelled",
  scheduled_choose_driver = "scheduled_choose_driver",
  scheduled_no_drivers = "scheduled_no_drivers",
  scheduled_auto_assign_warning = "scheduled_auto_assign_warning",
  scheduled_auto_assigned = "scheduled_auto_assigned",
  scheduled_auto_cancelled = "scheduled_auto_cancelled",
  driver_unavailable = "driver_unavailable",
  driver_declined_reschedule = "driver_declined_reschedule",
  driver_confirmed_reschedule = "driver_confirmed_reschedule",
  driver_started_scheduled_trip = "driver_started_scheduled_trip",
  booking_cancelled_admin = "booking_cancelled_admin",
  booking_cancelled_driver_unavailable = "booking_cancelled_driver_unavailable",
  driver_account_restricted = "driver_account_restricted",
  booking_force_completed_admin = "booking_force_completed_admin",
  voucher_released_admin = "voucher_released_admin",
  report = "report",
  report_reply = "report_reply",
}

const VIEW_REQUEST: NotificationAction = {
  label: "View request",
  href: "/(drawer)/(tabs)/request?tab=pending",
};
const CHOOSE_DRIVER: NotificationAction = {
  label: "Choose a driver",
  href: "/(drawer)/(tabs)/request?tab=pending",
};
const VIEW_ACTIVE: NotificationAction = {
  label: "Track delivery",
  href: "/(drawer)/(tabs)/request?tab=active",
};
const VIEW_CANCELLED: NotificationAction = {
  label: "View cancelled bookings",
  href: "/(drawer)/(tabs)/request?tab=cancelled",
};
const BOOK_AGAIN: NotificationAction = {
  label: "Book again",
  href: "/(drawer)/book",
};
const VIEW_REPORT: NotificationAction = {
  label: "View report",
  opensReport: true,
};

export const NOTIFICATION_CONFIG: Record<
  NOTIFICATION_TYPES,
  NotificationConfig
> = {
  [NOTIFICATION_TYPES.driver_offer]: {
    icon: "people",
    color: "#2563EB", // blue
    label: "Driver Offers",
    action: {label: "Review offers", href: "/(drawer)/(tabs)/request?tab=pending"},
  },
  [NOTIFICATION_TYPES.booking_expired]: {
    icon: "hourglass",
    color: "#64748B", // slate
    label: "Booking Expired",
    action: BOOK_AGAIN,
  },
  [NOTIFICATION_TYPES.booking_cancelled]: {
    icon: "time",
    color: "#B45309", // amber-dark
    label: "Booking Cancelled",
    action: BOOK_AGAIN,
  },
  [NOTIFICATION_TYPES.scheduled_choose_driver]: {
    icon: "hand-left",
    color: "#4F46E5", // indigo
    label: "Choose Your Driver",
    action: CHOOSE_DRIVER,
  },
  [NOTIFICATION_TYPES.scheduled_no_drivers]: {
    icon: "search",
    color: "#D97706", // amber
    label: "No Offers Yet",
    action: VIEW_REQUEST,
  },
  [NOTIFICATION_TYPES.scheduled_auto_assign_warning]: {
    icon: "timer",
    color: "#EA580C", // orange
    label: "Auto-Assign Soon",
    action: CHOOSE_DRIVER,
  },
  [NOTIFICATION_TYPES.scheduled_auto_assigned]: {
    icon: "person-add",
    color: "#059669", // emerald
    label: "Driver Assigned",
    action: {label: "View booking", href: "/(drawer)/(tabs)/request?tab=pending"},
  },
  [NOTIFICATION_TYPES.scheduled_auto_cancelled]: {
    icon: "calendar-clear",
    color: "#DC2626", // red
    label: "Scheduled Booking Cancelled",
    action: VIEW_CANCELLED,
  },
  [NOTIFICATION_TYPES.driver_unavailable]: {
    icon: "person-remove",
    color: "#E11D48", // rose
    label: "Driver Unavailable",
    action: VIEW_REQUEST,
  },
  [NOTIFICATION_TYPES.driver_declined_reschedule]: {
    icon: "calendar",
    color: "#BE123C", // rose-dark
    label: "New Time Declined",
    action: VIEW_REQUEST,
  },
  [NOTIFICATION_TYPES.driver_confirmed_reschedule]: {
    icon: "calendar",
    color: "#0D9488", // teal
    label: "New Time Confirmed",
    action: {label: "View booking", href: "/(drawer)/(tabs)/request?tab=pending"},
  },
  [NOTIFICATION_TYPES.driver_started_scheduled_trip]: {
    icon: "navigate",
    color: "#16A34A", // green
    label: "Trip Started",
    action: VIEW_ACTIVE,
  },
  [NOTIFICATION_TYPES.booking_cancelled_admin]: {
    icon: "headset",
    color: "#DC2626", // red
    label: "Cancelled by Support",
    action: VIEW_CANCELLED,
  },
  [NOTIFICATION_TYPES.booking_cancelled_driver_unavailable]: {
    icon: "alert-circle",
    color: "#B91C1C", // red-dark
    label: "Driver Can't Continue",
    action: BOOK_AGAIN,
  },
  [NOTIFICATION_TYPES.driver_account_restricted]: {
    icon: "shield",
    color: "#CA8A04", // yellow
    label: "Delivery Update",
    action: VIEW_ACTIVE,
  },
  [NOTIFICATION_TYPES.booking_force_completed_admin]: {
    icon: "checkmark-done-circle",
    color: "#15803D", // green-dark
    label: "Completed by Support",
    action: {
      label: "View completed bookings",
      href: "/(drawer)/(tabs)/request?tab=completed",
    },
  },
  [NOTIFICATION_TYPES.voucher_released_admin]: {
    icon: "ticket",
    color: "#7C3AED", // violet
    label: "Voucher Released",
    action: {label: "View vouchers", href: "/(drawer)/voucher"},
  },
  [NOTIFICATION_TYPES.report]: {
    icon: "flag",
    color: "#DC2626",
    label: "New Report",
    action: VIEW_REPORT,
  },
  [NOTIFICATION_TYPES.report_reply]: {
    icon: "chatbubbles",
    color: "#0284C7", // sky
    label: "Report Reply",
    action: VIEW_REPORT,
  },
};

// Default fallback for unknown notification types
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  icon: "notifications",
  color: "#6B7280", // gray
  label: "Notification",
};

// Helper function to get notification config with fallback
export const getNotificationConfig = (type: string): NotificationConfig =>
  NOTIFICATION_CONFIG[type as NOTIFICATION_TYPES] ??
  DEFAULT_NOTIFICATION_CONFIG;
