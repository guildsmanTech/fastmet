import { formatDate } from "@/utils/helpers/date";
import { IoniconName, NOTIFICATION_TYPES } from "@/utils/notification";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Text, View } from "react-native";

type NotifData = Record<string, any>;
type RouteStop = { name?: string; address?: string };
type Detail = { icon: IoniconName; label: string; value?: string | null };

const formatWhen = (value: unknown) =>
  value ? formatDate(String(value)) : null;

const stopAddress = (stop: RouteStop) =>
  stop.address && stop.address !== stop.name
    ? stop.address.replace(", Philippines", "")
    : null;

const hasRating = (rating: unknown): rating is number =>
  typeof rating === "number" && rating > 0;

/** Booking ref and pickup time, shown on every booking notification. */
const bookingRows = (data: NotifData, withPickupTime = true): Detail[] => [
  {
    icon: "receipt-outline",
    label: "Booking",
    value: data.bookingRef ? `#${data.bookingRef}` : null,
  },
  {
    icon: "calendar-outline",
    label: "Pickup time",
    value: withPickupTime ? formatWhen(data.scheduledDate) : null,
  },
];

// ─── Building blocks ────────────────────────────────────────────────────────

/** Tinted callout: what happened and what to do next. */
export const StatusBanner = ({
  icon,
  color,
  title,
  subtitle,
}: {
  icon: IoniconName;
  color: string;
  title: string;
  subtitle?: string;
}) => (
  <View
    className="flex-row items-center p-4 rounded-2xl border"
    style={{ backgroundColor: `${color}12`, borderColor: `${color}33` }}
  >
    <View
      className="justify-center items-center mr-4 rounded-full size-11"
      style={{ backgroundColor: color }}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </View>
    <View className="flex-1">
      <Text className="text-sm font-bold text-gray-900">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-xs leading-5 text-gray-600">
          {subtitle}
        </Text>
      ) : null}
    </View>
  </View>
);

/** Label/value rows; rows without a value are skipped. */
export const DetailsCard = ({ rows }: { rows: Detail[] }) => {
  const visible = rows.filter((row) => !!row.value);
  if (visible.length === 0) return null;

  return (
    <View className="px-4 bg-gray-50 rounded-2xl border border-gray-200">
      {visible.map((row, index) => (
        <View
          key={row.label}
          className={`flex-row items-center py-3 ${index > 0 ? "border-t border-gray-200" : ""}`}
        >
          <Ionicons name={row.icon} size={18} color="#6B7280" />
          <Text className="ml-3 text-sm text-gray-500">{row.label}</Text>
          <Text className="flex-1 ml-3 text-sm font-semibold text-right text-gray-900">
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const DeliveryRouteCard = ({
  pickUp,
  dropOff,
}: {
  pickUp?: RouteStop;
  dropOff?: RouteStop;
}) => {
  const stops = [
    { stop: pickUp, label: "Pick-up", icon: "location", bg: "bg-green-500" },
    { stop: dropOff, label: "Drop-off", icon: "flag", bg: "bg-red-500" },
  ].filter((entry) => !!entry.stop?.name) as {
    stop: RouteStop;
    label: string;
    icon: IoniconName;
    bg: string;
  }[];

  if (stops.length === 0) return null;

  return (
    <View className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
      <Text className="mb-4 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        Delivery Route
      </Text>
      {stops.map(({ stop, label, icon, bg }, index) => (
        <View key={label} className="flex-row items-start">
          <View className="items-center mr-3">
            <View
              className={`justify-center items-center rounded-full size-10 ${bg}`}
            >
              <Ionicons name={icon} size={20} color="#FFFFFF" />
            </View>
            {index < stops.length - 1 && (
              <View className="w-0.5 h-10 bg-gray-300 my-1" />
            )}
          </View>
          <View className="flex-1 pt-1">
            <Text className="mb-1 text-xs text-gray-500">{label}</Text>
            <Text className="text-base font-semibold text-gray-900">
              {stop.name}
            </Text>
            {stopAddress(stop) && (
              <Text className="mt-0.5 text-sm text-gray-500">
                {stopAddress(stop)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const DriverAvatar = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <Ionicons name="person-circle" size={size} color="#F7931E" />
  );

const DriverRow = ({
  name,
  rating,
  photo,
}: {
  name?: string;
  rating?: unknown;
  photo?: string;
}) => (
  <View className="flex-row items-center">
    <DriverAvatar uri={photo} size={52} />
    <View className="flex-1 ml-3">
      <Text className="text-base font-bold text-gray-900 capitalize">
        {name || "Driver"}
      </Text>
      {hasRating(rating) && (
        <View className="flex-row items-center mt-1">
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text className="ml-1 text-sm font-semibold text-gray-700">
            {rating.toFixed(1)}
          </Text>
        </View>
      )}
    </View>
  </View>
);

/** Banner, booking details and route: the layout most notifications share. */
const BookingNotice = ({
  data,
  color,
  icon,
  title,
  subtitle,
  rows = [],
  withPickupTime = true,
}: {
  data: NotifData;
  color: string;
  icon: IoniconName;
  title: string;
  subtitle?: string;
  rows?: Detail[];
  withPickupTime?: boolean;
}) => (
  <View className="gap-4">
    <StatusBanner icon={icon} color={color} title={title} subtitle={subtitle} />
    <DetailsCard rows={[...rows, ...bookingRows(data, withPickupTime)]} />
    <DeliveryRouteCard pickUp={data.pickUp} dropOff={data.dropOff} />
  </View>
);

// ─── Type-specific content ──────────────────────────────────────────────────

const DriverOfferContent = ({
  data,
  color,
}: {
  data: NotifData;
  color: string;
}) => {
  const drivers = Object.entries(
    (data.drivers ?? {}) as Record<string, NotifData>,
  );
  const count = drivers.length;

  return (
    <View className="gap-4">
      <StatusBanner
        icon="people"
        color={color}
        title={
          count === 0
            ? "These offers were withdrawn"
            : `${count} driver${count > 1 ? "s" : ""} offered`
        }
        subtitle={
          count === 0
            ? "Drivers can still offer on your booking until pickup."
            : "Choose your preferred driver before the pickup time."
        }
      />
      {count > 0 && (
        <View
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: `${color}0D`, borderColor: `${color}26` }}
        >
          <Text
            className="mb-4 text-xs font-semibold tracking-wide uppercase"
            style={{ color }}
          >
            Drivers who offered
          </Text>
          {drivers.map(([driverId, driver], index) => (
            <View
              key={driverId}
              className={index > 0 ? "pt-4 mt-4 border-t border-gray-200" : ""}
            >
              <DriverRow
                name={driver.driverName}
                rating={driver.driverRating}
                photo={driver.driverProfilePicture}
              />
            </View>
          ))}
        </View>
      )}
      <DetailsCard rows={bookingRows(data)} />
      <DeliveryRouteCard pickUp={data.pickUp} dropOff={data.dropOff} />
    </View>
  );
};

const ScheduledAutoAssignedContent = ({
  data,
  color,
}: {
  data: NotifData;
  color: string;
}) => (
  <View className="gap-4">
    <View
      className="p-5 rounded-2xl border"
      style={{ backgroundColor: `${color}0D`, borderColor: `${color}26` }}
    >
      <Text
        className="mb-4 text-xs font-semibold tracking-wide uppercase"
        style={{ color }}
      >
        Your assigned driver
      </Text>
      <View className="flex-row items-center">
        <View className="flex-1">
          <DriverRow
            name={data.driverName}
            rating={data.driverRating}
            photo={data.driverProfilePicture}
          />
        </View>
        <View
          className="justify-center items-center rounded-full size-9"
          style={{ backgroundColor: color }}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        </View>
      </View>
    </View>
    <DetailsCard rows={bookingRows(data)} />
    <DeliveryRouteCard pickUp={data.pickUp} dropOff={data.dropOff} />
  </View>
);

/**
 * Details for a notification type. Unknown types fall back to
 * `DefaultContent`.
 */
export const NotificationContent = ({
  type,
  data,
  color,
}: {
  type: string;
  data: NotifData;
  color: string;
}) => {
  const notice = (
    icon: IoniconName,
    title: string,
    subtitle?: string,
    rows?: Detail[],
  ) => (
    <BookingNotice
      data={data}
      color={color}
      icon={icon}
      title={title}
      subtitle={subtitle}
      rows={rows}
    />
  );

  switch (type) {
    case NOTIFICATION_TYPES.driver_offer:
      return <DriverOfferContent data={data} color={color} />;
    case NOTIFICATION_TYPES.scheduled_auto_assigned:
      return <ScheduledAutoAssignedContent data={data} color={color} />;
    case NOTIFICATION_TYPES.booking_expired:
      return notice(
        "hourglass",
        "No driver accepted in time",
        "Requests expire after 10 minutes. You can book again anytime.",
      );
    case NOTIFICATION_TYPES.booking_cancelled:
      return notice(
        "time",
        data.reason === "driver_did_not_start"
          ? "Your driver didn't start in time"
          : "Your booking was cancelled",
        "Please book again. Any voucher you used is available again.",
      );
    case NOTIFICATION_TYPES.scheduled_choose_driver:
      return notice(
        "hand-left",
        "Action required",
        "Choose your preferred driver from the offers before pickup.",
      );
    case NOTIFICATION_TYPES.scheduled_no_drivers:
      return notice(
        "search",
        "No drivers have offered yet",
        "You can reschedule or cancel if your plans change.",
      );
    case NOTIFICATION_TYPES.scheduled_auto_assign_warning:
      return notice(
        "timer",
        "Choose within the next hour",
        "Otherwise we'll assign the highest-rated driver who offered.",
      );
    case NOTIFICATION_TYPES.scheduled_auto_cancelled:
      return notice(
        "calendar-clear",
        "No drivers were available",
        "We cancelled your scheduled booking. You can book again anytime.",
      );
    case NOTIFICATION_TYPES.driver_unavailable:
      return notice(
        "person-remove",
        "Your driver was removed",
        "Your booking is open to other drivers again. You can wait, reschedule, or cancel.",
      );
    case NOTIFICATION_TYPES.driver_declined_reschedule:
      return notice(
        "calendar",
        data.reason === "timeout"
          ? "Your driver didn't confirm the new time"
          : "Your driver can't make the new time",
        "Your booking is open to other drivers again.",
      );
    case NOTIFICATION_TYPES.driver_confirmed_reschedule:
      return (
        <BookingNotice
          data={data}
          color={color}
          icon="checkmark-circle"
          title="Your driver is keeping this booking"
          subtitle="They'll pick up at the new time."
          withPickupTime={!data.newScheduledTime}
          rows={[
            {
              icon: "time-outline",
              label: "New pickup time",
              value: formatWhen(data.newScheduledTime),
            },
          ]}
        />
      );
    case NOTIFICATION_TYPES.driver_started_scheduled_trip:
      return notice(
        "navigate",
        "Your driver is on the way",
        "Track the delivery live from the Active tab.",
      );
    case NOTIFICATION_TYPES.booking_cancelled_admin:
      return notice(
        "headset",
        "Cancelled by FastMet support",
        "Contact support if you have questions about this booking.",
      );
    case NOTIFICATION_TYPES.booking_cancelled_driver_unavailable:
      return notice(
        "alert-circle",
        "Your driver can't continue",
        "We cancelled this booking so you can book again right away.",
      );
    case NOTIFICATION_TYPES.driver_account_restricted:
      return notice(
        "shield",
        "Your driver's account was restricted",
        "They can still finish your current delivery. Contact support if you have concerns.",
      );
    case NOTIFICATION_TYPES.booking_force_completed_admin:
      return notice(
        "checkmark-done-circle",
        "Marked as completed by support",
        "No action needed. Contact support if this doesn't look right.",
      );
    case NOTIFICATION_TYPES.voucher_released_admin:
      return notice(
        "ticket",
        "Your voucher is available again",
        "It was released from this booking. Use it on your next delivery.",
      );
    case NOTIFICATION_TYPES.report:
      return (
        <StatusBanner
          icon="flag"
          color={color}
          title="A report was filed"
          subtitle="Open the report to see the details and respond."
        />
      );
    case NOTIFICATION_TYPES.report_reply:
      return (
        <StatusBanner
          icon="chatbubbles"
          color={color}
          title="New reply on your report"
          subtitle="Open the report to read the full conversation."
        />
      );
    default:
      return <DefaultContent data={data} />;
  }
};

// Ids and routing keys are not for display.
const HIDDEN_KEYS = /(^_id$|Id$|Ids$|^target$)/;

// Default fallback for unknown notification types
export const DefaultContent = ({ data }: { data: NotifData }) => {
  const displayableData = Object.entries(data).filter(
    ([key, value]) =>
      !HIDDEN_KEYS.test(key) &&
      value !== null &&
      value !== undefined &&
      typeof value !== "object",
  );

  if (displayableData.length === 0) return null;

  return (
    <View className="p-4 bg-gray-50 rounded-xl border border-gray-200">
      {displayableData.map(([key, value], index) => (
        <View key={key}>
          <View className="py-2">
            <Text className="mb-1 text-xs text-gray-500">
              {key
                .replace(/_/g, " ")
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
            <Text className="text-base font-semibold text-gray-900">
              {String(value)}
            </Text>
          </View>
          {index < displayableData.length - 1 && (
            <View className="h-px bg-gray-200" />
          )}
        </View>
      ))}
    </View>
  );
};
