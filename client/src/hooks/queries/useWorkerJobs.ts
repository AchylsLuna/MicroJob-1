import { useQuery } from "@tanstack/react-query";
import { getJobs, getUserApplications } from "../../services/api";
import { queryKey } from "../../lib/queryKeys";

type Params = {
  search?: string;
  category?: string;
  city?: string;
  /**
   * False while the worker's location is still resolving, or when a signed-in
   * worker has no city set — ranking depends on it, and the page shows a
   * directional empty state pointing at Settings instead of a job list.
   */
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
export function useWorkerJobs({ search, category, city, enabled }: Params) {
  return useQuery({
    queryKey: queryKey("jobs", { search, category, city }),
    queryFn: async () => {
      const [jobs, applications] = await Promise.all([
        getJobs({
          search: search || undefined,
          category: category || undefined,
          city: city || undefined,
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
