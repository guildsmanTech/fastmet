import {
  getBookingById,
  getBookingsCounts,
  getRecentBookings,
  getUserBookings,
} from "@/api/book";
import {fetchRoutePreview, isClientPricingError} from "@/api/pricing";
import {LocationDetails} from "@/types/book";
import {decodePolyline} from "@/utils/helpers/polyline";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

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

/**
 * Route line for the map only (no price). The server caches it per
 * origin/destination/toll, so a later price quote reuses the same lookup.
 * Vehicle-independent, so changing vehicle or services never refetches it.
 */
export const routePreviewQueryKey = (
  pickUp: LocationDetails | null,
  dropOff: LocationDetails | null,
  allowExpressway: boolean,
) =>
  [
    "routePreview",
    pickUp?.coords.lat,
    pickUp?.coords.lng,
    dropOff?.coords.lat,
    dropOff?.coords.lng,
    allowExpressway,
  ] as const;

export const useRoutePreview = (
  pickUp: LocationDetails | null,
  dropOff: LocationDetails | null,
  allowExpressway = false,
) => {
  return useQuery({
    queryKey: routePreviewQueryKey(pickUp, dropOff, allowExpressway),
    queryFn: async () => {
      const route = await fetchRoutePreview(
        pickUp!.coords,
        dropOff!.coords,
        allowExpressway,
      );
      return {coordinates: decodePolyline(route.polyline)};
    },
    enabled: !!pickUp && !!dropOff,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    // Keep the old line on screen while a toll toggle loads the new one.
    placeholderData: keepPreviousData,
    retry: (count, err) => count < 1 && !isClientPricingError(err),
  });
};

export const useRecentBookings = (limit: number) => {
  return useQuery({
    queryKey: ["recentBookings", limit],
    queryFn: () => getRecentBookings(limit),
  });
};
