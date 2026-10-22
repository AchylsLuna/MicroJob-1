import { useQuery } from "@tanstack/react-query";
import { getJobs, getUserApplications } from "../../services/api";
import { queryKey } from "../../lib/queryKeys";

type Params = {
  /**
   * The signed-in worker viewing the list, or undefined for a signed-out
   * visitor. Included in the query key — without it, two different workers
   * applying the same filters would share one cache entry, and the second
   * to sign in on a device would see the first worker's application
   * statuses rendered as their own.
   */
  userId?: string;
  search?: string;
  category?: string;
  city?: string;
  location?: string;
  /** False while the worker's initial location is still resolving. */
  enabled: boolean;
};

/**
 * The job list plus the viewer's application statuses, which are always needed
 * together — a job card renders differently once you have applied to it.
 *
 * Wraps the existing `getJobs` and `getUserApplications` service functions
 * rather than replacing them. Results stay raw here; the page maps them into
 * its view model, so this hook has no opinion about presentation.
 *
 * `refetchOnWindowFocus` is enabled for this query specifically — the job list
 * goes stale while a tab sits in the background, and it replaces two duplicated
 * hand-rolled window focus listeners the page used to register.
 */
export function useWorkerJobs({ userId, search, category, city, location, enabled }: Params) {
  return useQuery({
    queryKey: queryKey("jobs", userId ?? null, { search, category, city, location }),
    queryFn: async () => {
      const [jobs, applications] = await Promise.all([
        getJobs({
          search: search || undefined,
          category: category || undefined,
          city: city || undefined,
          location: location || undefined,
          excludeOwn: true,
        }),
        getUserApplications(),
      ]);
      return { jobs, applications };
    },
    enabled,
    refetchOnWindowFocus: true,
  });
}
