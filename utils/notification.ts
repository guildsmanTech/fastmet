export interface NotificationConfig {
  icon: string; // Ionicons name
  color: string; // Hex color
  label: string; // Display label
}

export enum NOTIFICATION_TYPES {
  driver_offer = "driver_offer",
  booking_expired = "booking_expired",
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
  booking_force_completed_admin = "booking_force_completed_admin",
  voucher_released_admin = "voucher_released_admin",
  report = "report",
  report_reply = "report_reply",
}

export const NOTIFICATION_CONFIG: Record<
  NOTIFICATION_TYPES,
  NotificationConfig
> = {
  [NOTIFICATION_TYPES.driver_offer]: {
    icon: "car",
    color: "#22C55E", // green
    label: "New Driver Offer",
  },
  [NOTIFICATION_TYPES.booking_expired]: {
    icon: "close-circle",
    color: "#EF4444", // red
    label: "Booking Expired",
  },
  [NOTIFICATION_TYPES.scheduled_choose_driver]: {
    icon: "people",
    color: "#3B82F6", // blue
    label: "Choose Driver",
  },
  [NOTIFICATION_TYPES.scheduled_no_drivers]: {
    icon: "alert-circle",
    color: "#F59E0B", // amber
    label: "No Drivers Yet",
  },
  [NOTIFICATION_TYPES.scheduled_auto_assign_warning]: {
    icon: "time",
    color: "#F97316", // orange
    label: "Auto-Assign Warning",
  },
  [NOTIFICATION_TYPES.scheduled_auto_assigned]: {
    icon: "checkmark-circle",
    color: "#10B981", // green
    label: "Driver Assigned",
  },
  [NOTIFICATION_TYPES.scheduled_auto_cancelled]: {
    icon: "close-circle",
    color: "#DC2626", // red
    label: "Booking Cancelled",
  },
  [NOTIFICATION_TYPES.driver_unavailable]: {
    icon: "alert-circle",
    color: "#DC2626", // red
    label: "Driver Unavailable",
  },
  [NOTIFICATION_TYPES.driver_declined_reschedule]: {
    icon: "time",
    color: "#F97316",
    label: "Driver Declined New Time",
  },
  [NOTIFICATION_TYPES.driver_confirmed_reschedule]: {
    icon: "checkmark-circle",
    color: "#10B981",
    label: "Driver Confirmed",
  },
  [NOTIFICATION_TYPES.driver_started_scheduled_trip]: {
    icon: "navigate",
    color: "#10B981", // green
    label: "Trip Started",
  },
  [NOTIFICATION_TYPES.booking_cancelled_admin]: {
    icon: "close-circle",
    color: "#DC2626", // red
    label: "Booking Cancelled",
  },
  [NOTIFICATION_TYPES.booking_force_completed_admin]: {
    icon: "checkmark-circle",
    color: "#10B981", // green
    label: "Booking Completed",
  },
  [NOTIFICATION_TYPES.voucher_released_admin]: {
    icon: "ticket",
    color: "#8B5CF6", // purple
    label: "Voucher Released",
  },
  [NOTIFICATION_TYPES.report]: {
    icon: "flag",
    color: "#DC2626",
    label: "New Report",
  },
  [NOTIFICATION_TYPES.report_reply]: {
    icon: "chatbox",
    color: "#3B82F6",
    label: "Report Reply",
  },
};
// Default fallback for unknown notification types
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  icon: "notifications",
  color: "#6B7280", // gray
  label: "Notification",
};

// Helper function to get notification config with fallback
export const getNotificationConfig = (
  type: NOTIFICATION_TYPES,
): NotificationConfig => {
  return NOTIFICATION_CONFIG[type] || DEFAULT_NOTIFICATION_CONFIG;
};
