import {UserAddress} from "@/types/user";
import {StateCreator} from "zustand";
import type {LiveEtaSlice} from "./liveEtaSlice";
import {useDriverLocationStore} from "../useDriverLocationStore";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AuthSlice {
  phoneNumber: string;
  id: string | null;
  registrationStep: number;
  approvalStatus: ApprovalStatus;
  name: string;
  email: string | null;
  token: string | null;
  refreshToken: string | null;
  gender: "male" | "female" | null;
  address: UserAddress | null;
  profilePictureUrl: string;
  preRegistered: boolean;

  setAuthData: (
    data: Partial<Omit<AuthSlice, "setAuthData" | "logout">>,
  ) => void;
  logout: () => void;
}

export const createAuthSlice: StateCreator<
  AuthSlice & LiveEtaSlice,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  phoneNumber: "",
  id: null,
  registrationStep: 1,
  approvalStatus: "pending",
  name: "",
  email: null,
  token: null,
  refreshToken: null,
  gender: null,
  address: null,
  profilePictureUrl: "",
  preRegistered: false,

  setAuthData: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),

  logout: () => {
    get().clearLiveEtaCache();
    // Clear all driver location cache entries on logout as safety net
    useDriverLocationStore.getState().clearDriverLocationCache();
    set({
      phoneNumber: "",
      id: null,
      name: "",
      email: null,
      token: null,
      refreshToken: null,
      address: null,
      gender: null,
      registrationStep: 1,
      approvalStatus: "pending",
      profilePictureUrl: "",
      preRegistered: false,
    });
  },
});
