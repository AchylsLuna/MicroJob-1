import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSavedJobs,
  removeSavedJob,
  saveJobForLater,
  type SavedJobRecord,
} from "../services/api";

const CACHE_KEY = "saved_jobs_cache_v1";
export const SAVED_JOBS_EVENT = "saved-jobs-updated";

type SavedJobsEventDetail = {
  savedJobs: SavedJobRecord[];
};

const readSavedJobsCache = (): SavedJobRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSavedJobsCache = (savedJobs: SavedJobRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(savedJobs));
};

const broadcastSavedJobs = (savedJobs: SavedJobRecord[]) => {
  if (typeof window === "undefined") return;
  writeSavedJobsCache(savedJobs);
  window.dispatchEvent(
    new CustomEvent<SavedJobsEventDetail>(SAVED_JOBS_EVENT, {
      detail: { savedJobs },
    }),
  );
};

const normalizeSavedJobs = (payload: unknown): SavedJobRecord[] => {
  if (Array.isArray(payload)) return payload as SavedJobRecord[];
  if (payload && typeof payload === "object") {
    const record = payload as { savedJobs?: unknown; data?: unknown };
    if (Array.isArray(record.savedJobs)) return record.savedJobs as SavedJobRecord[];
    if (Array.isArray(record.data)) return record.data as SavedJobRecord[];
  }
  return [];
};

export function useSavedJobs() {
  const [savedJobs, setSavedJobs] = useState<SavedJobRecord[]>(() => readSavedJobsCache());
  const [isLoading, setIsLoading] = useState(savedJobs.length === 0);
  const [error, setError] = useState<string | null>(null);

  const syncSavedJobs = useCallback((nextSavedJobs: SavedJobRecord[]) => {
    setSavedJobs(nextSavedJobs);
    broadcastSavedJobs(nextSavedJobs);
  }, []);

  const refreshSavedJobs = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const response = await getSavedJobs();
      const nextSavedJobs = normalizeSavedJobs(response);
      syncSavedJobs(nextSavedJobs);
      setError(null);
      return nextSavedJobs;
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load saved jobs.");
      return readSavedJobsCache();
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [syncSavedJobs]);

  useEffect(() => {
    refreshSavedJobs(savedJobs.length === 0);
  }, [refreshSavedJobs, savedJobs.length]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleSavedJobsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<SavedJobsEventDetail>).detail;
      if (Array.isArray(detail?.savedJobs)) {
        setSavedJobs(detail.savedJobs);
        return;
      }
      setSavedJobs(readSavedJobsCache());
    };

    window.addEventListener(SAVED_JOBS_EVENT, handleSavedJobsUpdate as EventListener);
    return () => window.removeEventListener(SAVED_JOBS_EVENT, handleSavedJobsUpdate as EventListener);
  }, []);

  const save = useCallback(
    async (jobId: string) => {
      await saveJobForLater(jobId);
      await refreshSavedJobs(false);
    },
    [refreshSavedJobs],
  );

  const remove = useCallback(
    async (jobId: string) => {
      await removeSavedJob(jobId);
      const nextSavedJobs = savedJobs.filter((item) => String((item.job as any)?._id || item.job) !== String(jobId));
      syncSavedJobs(nextSavedJobs);
    },
    [savedJobs, syncSavedJobs],
  );

  const toggle = useCallback(
    async (jobId: string) => {
      const exists = savedJobs.some((item) => String((item.job as any)?._id || item.job) === String(jobId));
      if (exists) {
        await remove(jobId);
        return false;
      }
      await save(jobId);
      return true;
    },
    [remove, save, savedJobs],
  );

  const savedJobIds = useMemo(
    () => new Set(savedJobs.map((item) => String((item.job as any)?._id || item.job))),
    [savedJobs],
  );

  const isJobSaved = useCallback((jobId: string) => savedJobIds.has(String(jobId)), [savedJobIds]);

  return {
    savedJobs,
    savedJobIds,
    isLoading,
    error,
    isJobSaved,
    refreshSavedJobs,
    saveJob: save,
    removeSavedJob: remove,
    toggleSavedJob: toggle,
  };
}
