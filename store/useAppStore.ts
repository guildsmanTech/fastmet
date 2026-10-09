import {UserAddress} from "@/types/user";
import {create} from "zustand";
import {persist} from "zustand/middleware";
import {createSecureStorage} from "./secureStorage";
import {ApprovalStatus, AuthSlice, createAuthSlice} from "./slices/authSlice";
import {
  BookingTypeSlice,
  createBookingTypeSlice,
} from "./slices/bookingTypeSlice";
import {BookSlice, createBookSlice} from "./slices/bookSlice";
import {ChatSlice, createChatSlice} from "./slices/chatSlice";
import {createLoadingSlice, LoadingSlice} from "./slices/loadingStore";
import {
  createNotificationSlice,
  NotificationSlice,
} from "./slices/notificationSlice";
import {createLiveEtaSlice, LiveEtaSlice} from "./slices/liveEtaSlice";
import {createVehicleSlice, VehicleSlice} from "./slices/vehicleSlice";

type PersistedAuth = {
  phoneNumber: string;
  token: string | null;
  refreshToken: string | null;
  id: string | null;
  registrationStep: number;
  approvalStatus: ApprovalStatus;
  name: string;
  profilePictureUrl: string;
  gender: "male" | "female" | null;
  address: UserAddress;
  preRegistered: boolean;
  email: string | null;
};

export type AppStore = BookSlice &
  LoadingSlice &
  AuthSlice &
  ChatSlice &
  VehicleSlice &
  NotificationSlice &
  BookingTypeSlice &
  LiveEtaSlice;

const secureStorage = createSecureStorage<PersistedAuth>();

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createBookSlice(...a),
      ...createLoadingSlice(...a),
      ...createAuthSlice(...a),
      ...createChatSlice(...a),
      ...createVehicleSlice(...a),
      ...createNotificationSlice(...a),
      ...createBookingTypeSlice(...a),
      ...createLiveEtaSlice(...a),
    }),
    {
      name: "fastmet-client-storage",
      storage: secureStorage,
      partialize: (state) => ({
        phoneNumber: state.phoneNumber,
        token: state.token,
        refreshToken: state.refreshToken,
        id: state.id,
        registrationStep: state.registrationStep,
        approvalStatus: state.approvalStatus,
        name: state.name,
        profilePictureUrl: state.profilePictureUrl,
        gender: state.gender,
        address: state.address,
        preRegistered: state.preRegistered,
        email: state.email ?? null,
      }),
    },
  ),
);
