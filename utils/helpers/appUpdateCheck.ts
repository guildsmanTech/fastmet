import api from "@/lib/axios";
import {useAppStore} from "@/store/useAppStore";
import {
  evaluateBuild,
  INSTALLED_BUILD,
  isUpdateCheckEnabled,
  UpdateDecision,
} from "@/utils/appVersion";

type UpdateStatus = {
  decision: UpdateDecision;
  deferred: boolean;
  minBuild: number;
  latestBuild: number;
  storeUrl: string;
};

const TIMEOUT_MS = 5000;
// Upper bound for the whole check: the axios interceptor can return a promise
// that never settles (e.g. after a forced logout).
const HARD_TIMEOUT_MS = 8000;

let inFlight: Promise<void> | null = null;

async function fetchLoggedIn(): Promise<UpdateStatus> {
  const res = await api.get("/auth/app-version", {timeout: TIMEOUT_MS});
  return res.data;
}

async function fetchLoggedOut(): Promise<UpdateStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_BASE_URL}/api/app-config/app-version`,
      {signal: controller.signal},
    );
    if (!res.ok) throw new Error(`app-version ${res.status}`);
    const data = await res.json();
    const policy = data.client as {
      latestBuild: number;
      minBuild: number;
      storeUrl: string;
    };
    return {
      decision: evaluateBuild(INSTALLED_BUILD, policy.latestBuild, policy.minBuild),
      deferred: false,
      ...policy,
    };
  } finally {
    clearTimeout(timer);
  }
}

function apply(status: UpdateStatus) {
  const store = useAppStore.getState();
  const {decision, deferred, minBuild, latestBuild, storeUrl} = status;

  if (decision === "force") {
    store.setUpdateRequired({minBuild, latestBuild, storeUrl, deferred});
    store.setSoftUpdate(null);
    return;
  }

  store.setUpdateRequired(null);
  store.setSoftUpdate(
    decision === "soft" && latestBuild !== store.dismissedSoftBuild
      ? {latestBuild, storeUrl}
      : null,
  );
}

/**
 * Fetches the update policy and updates the store. Fails open: on any error
 * the previous state is kept (nothing on first load, and a known force is
 * never cleared by a network failure). Safe to call from anywhere.
 */
export function runUpdateCheck(): Promise<void> {
  if (!isUpdateCheckEnabled()) return Promise.resolve();
  if (inFlight) return inFlight;

  const check = (async () => {
    try {
      const status = useAppStore.getState().token
        ? await fetchLoggedIn()
        : await fetchLoggedOut();
      if (status && typeof status.decision === "string") apply(status);
    } catch {
      // keep previous state
    }
  })();

  const hardTimeout = new Promise<void>((resolve) =>
    setTimeout(resolve, HARD_TIMEOUT_MS),
  );

  inFlight = Promise.race([check, hardTimeout]).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
