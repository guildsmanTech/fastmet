import api from "@/lib/axios";
import {ApprovalStatus} from "@/store/slices/authSlice";

export type FaceVerificationResult =
  | {
      success: true;
      result: "approved";
      registrationStep: number;
      approvalStatus: ApprovalStatus;
    }
  | {
      success: true;
      result: "flagged";
      // True when every scan attempt failed; picks the review message.
      attemptsExhausted: boolean;
      registrationStep: number;
      approvalStatus: ApprovalStatus;
    }
  | {
      success: true;
      result: "retry";
      attemptsLeft: number | null;
      message: string;
    };

export const startFaceVerification = async (): Promise<string> => {
  const res = await api.post<{success: boolean; sessionId: string}>(
    "/face-verification/session",
  );
  return res.data.sessionId;
};

export const completeFaceVerification = async (
  sessionId: string,
): Promise<FaceVerificationResult> => {
  const res = await api.post<FaceVerificationResult>(
    "/face-verification/complete",
    {sessionId},
  );
  return res.data;
};
