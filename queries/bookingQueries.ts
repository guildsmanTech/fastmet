import {
  getBookingById,
  getBookingsCounts,
  getRecentBookings,
  getUserBookings,
} from "@/api/book";
import {LocationDetails} from "@/types/book";
import {fetchDrivingDistance} from "@/utils/helpers/calculatePrice";
import {useInfiniteQuery, useQuery} from "@tanstack/react-query";

export const useUserBookings = (status: string, limit: number) => {
  return useInfiniteQuery({
    queryKey: ["userBookings", status, limit],
    queryFn: ({pageParam = 1}) => getUserBookings(status, pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
};

export const useBooking = (bookingId: string) => {
  return useQuery({
    queryKey: ["userBooking", bookingId],
    queryFn: () => getBookingById(bookingId),
    enabled: !!bookingId,
  });
};

export const useBookingCounts = () => {
  return useQuery({
    queryKey: ["userBookingCounts"],
    queryFn: () => getBookingsCounts(),
  });
};

/** Vehicle-independent: same OD+avoid shares cache for price + polyline. */
export const drivingDistanceQueryKey = (
  pickUp: LocationDetails | null,
  dropOff: LocationDetails | null,
  allowExpressway: boolean,
) =>
  [
    "drivingDistance",
    pickUp?.coords.lat,
    pickUp?.coords.lng,
    dropOff?.coords.lat,
    dropOff?.coords.lng,
    allowExpressway,
  ] as const;

export const useDrivingDistance = (
  pickUp: LocationDetails | null,
  dropOff: LocationDetails | null,
  allowExpressway = false,
) => {
  return useQuery({
    queryKey: drivingDistanceQueryKey(pickUp, dropOff, allowExpressway),
    queryFn: () => fetchDrivingDistance(pickUp!, dropOff!, allowExpressway),
    enabled: !!pickUp && !!dropOff,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  });
};

export const useRecentBookings = (limit: number) => {
  return useQuery({
    queryKey: ["recentBookings", limit],
    queryFn: () => getRecentBookings(limit),
  });
};
