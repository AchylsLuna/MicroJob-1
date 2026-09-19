import { QueryClient } from "@tanstack/react-query";

/**
 * Shared query client for the web app.
 *
 * Defaults are tuned for a dashboard that people leave open: a short stale
 * window so returning to a tab shows fresh data, but no refetch on every window
 * focus, which on this app would re-hit the API each time someone alt-tabs.
 *
 * Retries are limited to one. The API client already handles token refresh and
 * transient auth failures, so a longer retry chain mostly delays showing the
 * user a real error.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
