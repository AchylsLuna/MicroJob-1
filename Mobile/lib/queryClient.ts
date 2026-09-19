import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client for the mobile app.
 *
 * Mirrors the web defaults in `client/src/lib/queryClient.ts` so the two
 * platforms behave the same way. `lib/api.ts` already handles token refresh and
 * retry-on-401, so a single retry is enough here — more would only delay
 * surfacing a genuine failure.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});
