import {
  fetchEstimate,
  fetchQuote,
  getPricingErrorMessage,
  isClientPricingError,
  QuoteRequestBody,
  QuoteResponse,
} from "@/api/pricing";
import {useAuth} from "@/hooks/useAuth";
import {queryClient} from "@/lib/queryClient";
import {useAppStore} from "@/store/useAppStore";
import {
  buildQuoteBody,
  QUOTE_EXPIRY_MARGIN_MS,
  quoteKeyOf,
} from "@/utils/helpers/quote";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {useEffect, useMemo, useState} from "react";

export const BOOKING_QUOTE_KEY = "bookingQuote";

const DEBOUNCE_MS = 300;
// Quotes live 10 min on the server; the Payment screen re-quotes if one is
// about to expire, so a few minutes of client cache is safe.
const STALE_MS = 3 * 60 * 1000;
const GC_MS = 5 * 60 * 1000;

function quoteQueryKey(isLoggedIn: boolean, key: string) {
  return [BOOKING_QUOTE_KEY, isLoggedIn, key] as const;
}

/**
 * Returns a still-usable cached quote for this key, or undefined.
 * Expired locks are dropped so the next query issues a fresh quoteId.
 */
function readCachedQuote(
  isLoggedIn: boolean,
  key: string,
): QuoteResponse | undefined {
  const cached = queryClient.getQueryData<QuoteResponse>(
    quoteQueryKey(isLoggedIn, key),
  );
  if (!cached?.routeData) return undefined;

  if (isLoggedIn) {
    if (!cached.quoteId || !cached.expiresAt) return undefined;
    if (cached.expiresAt - Date.now() <= QUOTE_EXPIRY_MARGIN_MS) {
      queryClient.removeQueries({queryKey: quoteQueryKey(isLoggedIn, key)});
      return undefined;
    }
  }

  return cached;
}

/**
 * Debounce network quotes, but apply immediately when that key is already cached
 * (vehicle / booking-type switch-back, swap reverse, etc.).
 */
function useQuoteQueryKey(
  key: string | null,
  isLoggedIn: boolean,
): string | null {
  const [debouncedKey, setDebouncedKey] = useState(key);

  useEffect(() => {
    if (!key) {
      setDebouncedKey(null);
      return;
    }

    if (readCachedQuote(isLoggedIn, key)) {
      setDebouncedKey(key);
      return;
    }

    const timer = setTimeout(() => setDebouncedKey(key), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, isLoggedIn]);

  return debouncedKey;
}

/**
 * Keeps the booking store's price in sync with the server.
 *
 * Whenever pickup, drop-off, vehicle, booking type or services change, the
 * server computes the price (and, when logged in, locks it behind a quoteId).
 * Nothing is priced on the device. Safe to mount on several screens: they
 * share one cached request. Cache hits restore the price with no loading flash.
 */
export function useBookingQuote() {
  const {isLoggedIn} = useAuth();

  const pickUp = useAppStore((s) => s.pickUp);
  const dropOff = useAppStore((s) => s.dropOff);
  const selectedVehicle = useAppStore((s) => s.selectedVehicle);
  const bookingType = useAppStore((s) => s.bookingType);
  const addedServices = useAppStore((s) => s.addedServices);

  const setQuoteLoading = useAppStore((s) => s.setQuoteLoading);
  const setQuoteReady = useAppStore((s) => s.setQuoteReady);
  const setQuoteError = useAppStore((s) => s.setQuoteError);
  const resetQuote = useAppStore((s) => s.resetQuote);

  const key = useMemo(() => {
    const body = buildQuoteBody({
      pickUp,
      dropOff,
      selectedVehicle,
      bookingType,
      addedServices,
    });
    return body ? quoteKeyOf(body) : null;
  }, [pickUp, dropOff, selectedVehicle, bookingType, addedServices]);

  const debouncedKey = useQuoteQueryKey(key, isLoggedIn);

  const query = useQuery<QuoteResponse>({
    queryKey: [BOOKING_QUOTE_KEY, isLoggedIn, debouncedKey],
    queryFn: () => {
      const body = JSON.parse(debouncedKey!) as QuoteRequestBody;
      return isLoggedIn ? fetchQuote(body) : fetchEstimate(body);
    },
    enabled: !!debouncedKey,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: (count, err) => count < 1 && !isClientPricingError(err),
    placeholderData: keepPreviousData,
  });

  const {data, error, isError, isPlaceholderData} = query;

  useEffect(() => {
    if (!key) {
      resetQuote();
      return;
    }

    // Instant restore when this exact quote is already in the client cache.
    const cached = readCachedQuote(isLoggedIn, key);
    if (cached) {
      setQuoteReady({
        key,
        quoteId: cached.quoteId,
        expiresAt: cached.expiresAt,
        routeData: cached.routeData,
      });
      return;
    }

    // Inputs just changed (debounce pending) or the answer is for old inputs.
    const settled = debouncedKey === key && !isPlaceholderData;

    if (settled && data) {
      setQuoteReady({
        key,
        quoteId: data.quoteId,
        expiresAt: data.expiresAt,
        routeData: data.routeData,
      });
    } else if (settled && isError) {
      setQuoteError(getPricingErrorMessage(error));
    } else {
      setQuoteLoading();
    }
  }, [
    key,
    debouncedKey,
    isLoggedIn,
    data,
    error,
    isError,
    isPlaceholderData,
    setQuoteReady,
    setQuoteError,
    setQuoteLoading,
    resetQuote,
  ]);

  return query;
}

/**
 * Fetches a brand-new locked quote for what is currently on screen and
 * stores it (also refreshing the shared cache). Used right before booking when
 * the previous quote expired or was rejected by the server.
 */
export async function requestFreshQuote(): Promise<
  QuoteResponse & {quoteId: string; expiresAt: number}
> {
  const state = useAppStore.getState();
  const body = buildQuoteBody(state);
  if (!body) throw new Error("Your booking details are incomplete.");

  const quote = await fetchQuote(body);
  if (!quote.quoteId || !quote.expiresAt) {
    throw new Error("We couldn't lock your price. Please try again.");
  }

  const key = quoteKeyOf(body);
  queryClient.setQueryData(quoteQueryKey(true, key), quote);
  useAppStore.getState().setQuoteReady({
    key,
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt,
    routeData: quote.routeData,
  });

  return quote as QuoteResponse & {quoteId: string; expiresAt: number};
}

/** Drops cached quotes (e.g. after one was redeemed or rejected). */
export function clearCachedQuotes() {
  queryClient.removeQueries({queryKey: [BOOKING_QUOTE_KEY]});
}
