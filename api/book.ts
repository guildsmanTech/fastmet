import api from "@/lib/axios";
import {ActiveBooking, CompletedBooking, RequestedDriver} from "@/types/book";

export const getUserBookings = async (
  status: string,
  page = 1,
  limit = 5,
): Promise<{
  bookings: CompletedBooking;
  nextPage: number | null;
}> => {
  const res = await api.get<{
    bookings: CompletedBooking;
    nextPage: number | null;
  }>(`/booking/filters/by-status`, {params: {status, page, limit}});

  return res.data;
};

export const getBookingById = async (
  bookingId: string,
): Promise<ActiveBooking> => {
  const res = await api.get(`/booking/${bookingId}`);
  return res.data;
};

export const getBookingOffers = async (
  bookingId: string,
): Promise<{
  bookingId: string;
  status: string;
  bookingType?: string;
  offers: RequestedDriver[];
}> => {
  const res = await api.get(`/booking/${bookingId}/offers`);
  return res.data;
};

export const getBookingsCounts = async () => {
  const res = await api.get(`/booking/stats/counts`);
  return res.data;
};

export const rateDriver = async (bookingId: string, rating: number) => {
  const res = await api.patch(`/booking/rate-driver/${bookingId}`, {rating});
  return res.data;
};

export const getRecentBookings = async (limit = 5) => {
  const res = await api.get(`/booking/recent/${limit}`);
  return res.data;
};

export const rescheduleBooking = async (
  bookingId: string,
  newScheduledTime: string,
) => {
  const res = await api.patch(`/booking/reschedule/${bookingId}`, {
    newScheduledTime,
  });
  return res.data;
};
