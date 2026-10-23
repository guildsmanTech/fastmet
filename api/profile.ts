import api from "@/lib/axios";

export type ActiveRejectionResponse = {
  success: boolean;
  adminNote: string;
};

export const getActiveRejection = async (): Promise<ActiveRejectionResponse> => {
  const res = await api.get<ActiveRejectionResponse>("/rejection");
  return res.data;
};
