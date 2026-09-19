import { subscribeDataRefresh } from './dataRefresh';
import { queryClient } from './queryClient';

/**
 * Bridges the existing `dataRefresh` pub-sub into TanStack Query.
 *
 * `lib/api.ts` already publishes a refresh event after every mutation, tagged
 * with the domains that mutation touched (see `inferMutationDomains`). Because
 * query keys are `[domain, ...params]`, each published domain maps directly
 * onto an `invalidateQueries` call.
 *
 * This is what lets the migration happen screen by screen instead of in one
 * flag-day rewrite: screens still using `subscribeDataRefresh` keep working
 * untouched, migrated screens get invalidated through the same event, and
 * neither ends up refetching twice. `dataRefresh.ts` itself is deliberately
 * left unmodified and should only be removed once no direct consumers remain.
 *
 * Call once, at app start. Returns an unsubscribe function.
 */
export const startQueryClientBridge = () =>
  subscribeDataRefresh((event) => {
    for (const domain of event.domains) {
      void queryClient.invalidateQueries({ queryKey: [domain] });
    }
  });
