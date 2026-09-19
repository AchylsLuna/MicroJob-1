/**
 * Query-key vocabulary for TanStack Query.
 *
 * The domain names are deliberately identical to the `DataDomain` union in
 * `Mobile/lib/dataRefresh.ts`. Keeping one vocabulary across both platforms
 * means a mutation's invalidation logic reads the same on web and mobile, and
 * that mobile's existing `inferMutationDomains(url)` table maps straight onto
 * `queryClient.invalidateQueries({ queryKey: [domain] })`.
 *
 * Keys are always `[domain, ...params]`, so invalidating a bare domain clears
 * every query underneath it.
 */
export type DataDomain =
  | "session"
  | "profile"
  | "jobs"
  | "applications"
  | "savedJobs"
  | "wallet"
  | "messages"
  | "notifications"
  | "reviews"
  | "support"
  | "settings";

export const queryKey = (domain: DataDomain, ...params: unknown[]) =>
  [domain, ...params] as const;
