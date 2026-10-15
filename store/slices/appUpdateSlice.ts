import {StateCreator} from "zustand";

export type UpdateRequired = {
  minBuild: number;
  latestBuild: number;
  storeUrl: string;
  // True while a trip is in progress: show a banner, block after the trip.
  deferred: boolean;
};

export type SoftUpdate = {
  latestBuild: number;
  storeUrl: string;
};

export interface AppUpdateSlice {
  updateRequired: UpdateRequired | null;
  softUpdate: SoftUpdate | null;
  // Persisted: "Later" on the soft prompt hides it until a newer latestBuild.
  dismissedSoftBuild: number | null;
  setUpdateRequired: (value: UpdateRequired | null) => void;
  setSoftUpdate: (value: SoftUpdate | null) => void;
  dismissSoftUpdate: () => void;
}

export const createAppUpdateSlice: StateCreator<AppUpdateSlice> = (
  set,
  get,
) => ({
  updateRequired: null,
  softUpdate: null,
  dismissedSoftBuild: null,
  setUpdateRequired: (value) => set({updateRequired: value}),
  setSoftUpdate: (value) => set({softUpdate: value}),
  dismissSoftUpdate: () =>
    set({
      dismissedSoftBuild: get().softUpdate?.latestBuild ?? null,
      softUpdate: null,
    }),
});
