import {useAppStore} from "@/store/useAppStore";
import {runUpdateCheck} from "@/utils/helpers/appUpdateCheck";
import {useEffect} from "react";
import {AppState} from "react-native";

const DEFERRED_POLL_MS = 60_000;

/** Runs the update check on launch, login/logout, resume, and every 60s while deferred by a trip. */
export function useAppUpdateCheck() {
  const token = useAppStore((state) => state.token);
  const deferred = useAppStore(
    (state) => state.updateRequired?.deferred === true,
  );

  // Also re-runs when the token changes (login, logout, refresh).
  useEffect(() => {
    void runUpdateCheck();
  }, [token]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void runUpdateCheck();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!deferred) return;
    const id = setInterval(() => void runUpdateCheck(), DEFERRED_POLL_MS);
    return () => clearInterval(id);
  }, [deferred]);
}
