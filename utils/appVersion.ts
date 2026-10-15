import * as Application from "expo-application";
import {Platform} from "react-native";

// Build = Android versionCode (EAS autoIncrement). The version name in
// app.config.js is always "1.0.0", so it can't tell builds apart.

export type UpdateDecision = "allow" | "soft" | "force";

function parseBuild(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const build = Number.parseInt(raw, 10);
  return Number.isSafeInteger(build) && build > 0 ? build : null;
}

export const INSTALLED_BUILD = parseBuild(Application.nativeBuildVersion);

/** The update check only runs on Android release builds with a known build. */
export const isUpdateCheckEnabled = () =>
  Platform.OS === "android" && !__DEV__ && INSTALLED_BUILD !== null;

export function evaluateBuild(
  build: number | null,
  latest: number,
  min: number,
): UpdateDecision {
  if (build === null) return "allow";
  if (build < min) return "force";
  if (build < latest) return "soft";
  return "allow";
}

/** Sent on every backend request (and the socket handshake) for the update gate + tracking. */
export function versionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {"x-app-platform": Platform.OS};
  if (INSTALLED_BUILD !== null) headers["x-app-build"] = String(INSTALLED_BUILD);
  return headers;
}

export const socketVersionAuth = () => ({
  appBuild: INSTALLED_BUILD,
  appPlatform: Platform.OS,
});
