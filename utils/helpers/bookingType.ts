import {BookingType} from "@/store/slices/bookSlice";
import {BookingTypeConfig} from "@/types/bookingType";

/** Customer-facing name of the chosen option: the sub-option (e.g. Priority) or the booking type itself (e.g. Pooling). */
export const getBookingOptionName = (
  configs: BookingTypeConfig[],
  bookingType: BookingType | null,
): string | null => {
  if (!bookingType) return null;
  const config = configs.find((c) => c.key === bookingType.type);
  if (!config) return null;
  if (config.subOptions?.length > 0) {
    return (
      config.subOptions.find((s) => s.key === bookingType.value)?.name ??
      config.name
    );
  }
  return config.name;
};

/** First auto-selectable active booking type (skips schedule — needs user date). */
export const deriveDefaultBookingType = (
  configs: BookingTypeConfig[],
): BookingType | null => {
  const first = configs
    .filter((c) => c.isActive && c.key !== "schedule")
    .sort((a, b) => a.order - b.order)[0];

  if (!first) return null;

  if (first.subOptions.length > 0) {
    const firstSub = first.subOptions
      .filter((s) => s.isActive)
      .sort((a, b) => a.order - b.order)[0];

    if (!firstSub) return null;

    return {
      type: first.key,
      value: firstSub.key,
    };
  }

  return {
    type: first.key,
    value: first.key.toUpperCase(),
  };
};
