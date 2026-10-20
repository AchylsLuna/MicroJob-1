import { useQuery } from "@tanstack/react-query";
import { getRecommendedJobs } from "../../services/api";
import { queryKey } from "../../lib/queryKeys";

type Params = {
  /**
   * The signed-in worker. Recommendations are ranked against this person's
   * profile, so the key is scoped per user for the same reason the job list is:
   * two workers on one device must never share a cache entry.
   */
  userId?: string;
  /** Server clamps this to 1..50 and defaults to 12. */
  limit?: number;
  /** False for signed-out visitors — the endpoint requires a token. */
  enabled: boolean;
};

/**
 * Personalised job recommendations from `GET /api/jobs/recommended`.
 *
 * The server already excludes expired jobs, the worker's own postings, and jobs
 * they have applied to, so nothing is re-filtered here — a second filter on the
 * client could only disagree with the tested server logic.
 *
 * Worth knowing about the response: a worker with an empty profile does **not**
 * get an empty list. Every candidate scores zero and the ranking falls through
 * to recency, so the endpoint returns recent jobs at 0%. Callers are expected
 * to treat an all-zero result as "no real matches yet" rather than presenting
 * it as personalised.
 *
 * `retry: false` because this is supplementary content: when it fails the
 * section disappears, and retrying only delays that while leaving a gap on the
 * page above the real search results.
 */
export function useRecommendedJobs({ userId, limit = 12, enabled }: Params) {
  return useQuery({
    queryKey: queryKey("jobs", userId ?? null, { recommended: true, limit }),
    queryFn: () => getRecommendedJobs(limit),
    enabled,
    retry: false,
  });
}
