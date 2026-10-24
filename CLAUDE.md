# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FastMet **client** (customer) app — an on-demand delivery/booking app (book a vehicle, receive driver offers, track the driver, chat, pay via cash/GCash). Expo SDK 54 / React Native 0.81 (New Architecture, React Compiler enabled), expo-router with typed routes, TypeScript strict. A separate backend serves REST (`/api/client/*`) and Socket.IO at `EXPO_PUBLIC_BASE_URL`.

## Commands

```bash
npm install
npx expo start            # dev server (requires a dev client build; uses expo-dev-client)
npm run android           # expo run:android (native build; android/ is gitignored/generated)
npm run ios
npm run lint              # expo lint (eslint-config-expo flat config)
npx tsc --noEmit          # type-check
eas build --profile development|preview|production   # channels match profile names (expo-updates)
```

There is no test suite. Verify changes with `npm run lint` and `npx tsc --noEmit`.

Note: the root layout refuses to render on emulators (`!Device.isDevice`) — the app must run on a physical device.

Env vars (`.env`): `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_ANDROID_MAP_KEY`, `EXPO_PUBLIC_IOS_MAP_KEY`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `GOOGLE_SERVICES_JSON`. App config is in `app.config.js` (not app.json).

## Architecture

Imports use the `@/` alias for the repo root.

**Routing (`app/`)** — expo-router route groups. `app/_layout.tsx` fetches `/api/app-config/pre-registration` on boot and uses `Stack.Protected` to show either `(pre_registration)` only or the normal app: `(drawer)` (main UI; `book` is the initial route, with `(tabs)` for request/chats/notification), `(auth)` (OTP login, profile/ID registration, banned/suspended/deactivated screens), `(root_screens)` (booking flow: services → additionalInfo → paymentMethod → searchingDriver, plus chat `message`, announcements), `(public_screens)`. Guests can use the `book` screen; other drawer items require login (`useAuthGuard`, `NotLoggedInModal`).

**Data layer** — layered by folder:
- `api/` — plain async functions calling the shared axios instance (`lib/axios.ts`, baseURL `${EXPO_PUBLIC_BASE_URL}/api/client`).
- `queries/` and `mutations/` — TanStack Query hooks wrapping `api/`. Mutations typically invalidate query keys and show `react-native-toast-message` toasts. Shared `queryClient` lives in `lib/queryClient.ts` and is imported directly by non-React code (socket handlers, helpers) to `setQueriesData`/`invalidateQueries`.
- Key query keys to keep in sync: `["userBookings", status, limit]` (infinite), `["userBooking", id]`, `["userBookingCounts"]`, `["notifications"]`, `["bookingQuote", ...]`, `["bookingSettings"]`.
- A few public endpoints (vehicles, booking types, pre-reg config) are fetched with raw `fetch` against `${EXPO_PUBLIC_BASE_URL}/api/...` (not `/api/client`).

**Auth/session (`lib/axios.ts`)** — request interceptor attaches the bearer token from the Zustand store. Response interceptor handles server flags: `403 deviceBanned` / `accountDeactivated` → route to the matching `(auth)` screen; `401 sessionDisplaced` → logout; `401 tokenExpired` → single-flight refresh via `ensureFreshToken()` (shared promise also used by the socket) then retry; other 401 → `performLogout()`. Handled cases return a never-resolving promise, so callers won't see those errors. `useSyncAuthMeta` re-syncs `registrationStep`/`approvalStatus` from the server on launch.

**State (`store/`)** — one Zustand store `useAppStore` composed from slices in `store/slices/` (auth, book, bookingType, chat, vehicle, notification, liveEta, loading). Only auth/profile fields are persisted (`partialize`), to `expo-secure-store` via `store/secureStorage.ts`. `bookSlice` holds the in-progress booking (pickup/dropoff, vehicle, booking type, quote state, payment). `useDriverLocationStore` is a separate store for live driver location.

**Pricing/quotes** — prices are server-computed. `hooks/useBookingQuote.ts` debounces quote requests keyed by `quoteKeyOf(buildQuoteBody(...))` (`utils/helpers/quote.ts`); logged-in users get a time-limited `quoteId` price lock (re-quoted when near expiry), guests get an estimate. Route polylines come separately from `fetchRoutePreview`. Pickup/dropoff service-area validation lives in `utils/constants.ts` (`isWithinAllowedPickupBounds`, `isDropOffAllowed`, etc.).

**Realtime (`sockets/`)** — `socket.ts` keeps a singleton Socket.IO client recreated when the token changes. `context/SocketProvider.tsx` connects when logged in, reconnects on app foreground, refreshes the token on `"Authentication failed"`, and registers every handler. Each handler in `sockets/handlers/` is a function `(socket) => cleanup` that subscribes to one server event and patches React Query caches / store / shows toasts. **When adding a socket event, write a handler in this style and register + clean it up in `SocketProvider`.** Notification cache updates go through `updateNotificationHelper` in `utils/helpers/query.ts`.

**Push notifications** — `hooks/usePushNotification.ts` + `utils/helpers/pushRegistration.ts`; tap routing in `utils/helpers/notificationRouting.ts` (stored notifications open `notifViewer` via `data.notificationId`). Every notification type has an entry (icon, color, label, action) in `utils/notification.ts` and a details layout in `NotificationContent` (`components/NotifContentUI.tsx`); `DefaultContent` is only the fallback for unknown types. The `notificationCreated` socket handler keeps the list and badge live for all types.

**Styling** — NativeWind (Tailwind v3) `className` on RN components. Custom theme in `tailwind.config.js`: colors `lightPrimary` `#FFA840`, `darkPrimary` `#ED8718`, `secondary` `#0F2535`; fonts `font-montserrat` / `font-montserrat-bold`. Tailwind `content` only scans `app/` and `components/`.

**Monitoring** — Sentry initialized in `app/_layout.tsx` (root component wrapped with `Sentry.wrap`).

## Conventions

- Commit messages follow Conventional Commits with a scope, e.g. `feat(booking): ...`, `refactor(auth): ...`.
- Shared types live in `types/`; zod schemas in `schemas/`.
