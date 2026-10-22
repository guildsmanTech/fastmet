export type BookingSettingsSnapshot = {
  enterRadiusMeters: number;
  exitRadiusMeters: number;
  driverNoShowMinutes: number;
  clientNoShowMinutes: number;
  reportWindowDays: number;
  /** Highest tip (whole pesos) the customer can add to one booking. */
  maxTip: number;
};

export const BOOKING_SETTINGS_FALLBACK: BookingSettingsSnapshot = {
  enterRadiusMeters: 50,
  exitRadiusMeters: 65,
  driverNoShowMinutes: 50,
  clientNoShowMinutes: 20,
  reportWindowDays: 5,
  maxTip: 500,
};

export async function fetchBookingSettings(): Promise<BookingSettingsSnapshot> {
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  const res = await fetch(`${baseUrl}/api/app-config/booking-settings`);
  if (!res.ok) throw new Error("Failed to fetch booking settings");
  const data = await res.json();
  const settings = data?.settings;
  if (!settings) return BOOKING_SETTINGS_FALLBACK;
  return {
    enterRadiusMeters:
      settings.enterRadiusMeters ?? BOOKING_SETTINGS_FALLBACK.enterRadiusMeters,
    exitRadiusMeters:
      settings.exitRadiusMeters ?? BOOKING_SETTINGS_FALLBACK.exitRadiusMeters,
    driverNoShowMinutes:
      settings.driverNoShowMinutes ??
      BOOKING_SETTINGS_FALLBACK.driverNoShowMinutes,
    clientNoShowMinutes:
      settings.clientNoShowMinutes ??
      BOOKING_SETTINGS_FALLBACK.clientNoShowMinutes,
    reportWindowDays:
      settings.reportWindowDays ?? BOOKING_SETTINGS_FALLBACK.reportWindowDays,
    maxTip: settings.maxTip ?? BOOKING_SETTINGS_FALLBACK.maxTip,
  };
}
