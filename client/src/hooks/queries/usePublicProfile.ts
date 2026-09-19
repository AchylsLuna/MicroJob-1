import { useQuery } from "@tanstack/react-query";
import { getPublicProfile } from "../../services/api";
import { queryKey } from "../../lib/queryKeys";

/**
 * Wraps the existing `getPublicProfile` API function — the service layer is
 * sound and is deliberately left untouched; only the calling convention moves
 * to TanStack Query.
 *
 * `refetchInterval` replaces the hand-rolled `setInterval` the page used to
 * run, and brings with it the behaviour the manual version lacked: the poll
 * pauses while the tab is in the background, and in-flight requests are
 * cancelled on unmount instead of resolving into an `isMounted` guard.
 */
export function usePublicProfile<TProfile>(userId: string | undefined, viewAs: "worker" | "employer") {
  return useQuery({
    queryKey: queryKey("profile", userId, viewAs),
    queryFn: () => getPublicProfile(userId as string, viewAs) as Promise<TProfile>,
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}
