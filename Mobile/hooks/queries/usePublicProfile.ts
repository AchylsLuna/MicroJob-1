// Must be the lib/storage wrapper, not the raw AsyncStorage package: on native
// it reads auth_token from expo-secure-store, so bypassing it would send an
// unauthenticated request on device.
import storage from '../../lib/storage';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, asObject } from '../../lib/api';
import { API_URL } from '../../config';
import type { DataDomain } from '../../lib/dataRefresh';

/**
 * Query keys are `[domain, ...params]`, where `domain` is one of the same
 * `DataDomain` values `lib/dataRefresh.ts` publishes. That shared vocabulary is
 * what lets `queryClientBridge` invalidate migrated screens off the existing
 * mutation events without any per-screen wiring.
 */
export const queryKey = (domain: DataDomain, ...params: unknown[]) => [domain, ...params] as const;

/**
 * Mirrors `client/src/hooks/queries/usePublicProfile.ts` so the same screen
 * behaves the same way on both platforms.
 *
 * `refetchInterval` replaces a hand-rolled `setInterval`, and brings the
 * behaviour the manual version lacked: requests are cancelled on unmount rather
 * than resolving into an `isMounted` guard.
 */
export function usePublicProfile<TProfile extends { profile?: unknown }>(
  userId: string | undefined,
  viewAs: string,
) {
  return useQuery({
    queryKey: queryKey('profile', userId, viewAs),
    queryFn: async () => {
      const token = await storage.getItem('auth_token');
      const result = await apiRequest(
        `${API_URL}/auth/profiles/${userId}?viewAs=${viewAs}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        'Failed to load profile.',
      );

      if (!result.ok) throw new Error(result.message || 'Failed to load profile.');

      const payload = asObject<TProfile>(result.data) || asObject<TProfile>(result.raw);
      if (!payload?.profile) throw new Error('Profile not found.');
      return payload;
    },
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}
