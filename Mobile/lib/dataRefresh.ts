export type DataDomain =
  | 'session'
  | 'profile'
  | 'jobs'
  | 'applications'
  | 'savedJobs'
  | 'wallet'
  | 'messages'
  | 'notifications'
  | 'reviews'
  | 'support'
  | 'settings';

export type DataRefreshEvent = {
  domains: DataDomain[];
  method: string;
  url: string;
  at: number;
};

const listeners = new Set<(event: DataRefreshEvent) => void>();

export const inferMutationDomains = (url: string): DataDomain[] => {
  const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();
  const domains = new Set<DataDomain>();
  if (/\/auth\/(me|profile|account|password|mfa|mobile-role)/.test(path)) domains.add('profile');
  if (/\/auth\/(login|logout|register|session)/.test(path)) domains.add('session');
  if (/\/jobs(?:\/|$)/.test(path)) domains.add('jobs');
  if (/\/applications|\/job-offers|\/interviews/.test(path)) {
    domains.add('applications');
    domains.add('jobs');
    domains.add('notifications');
  }
  if (/\/saved-jobs/.test(path)) domains.add('savedJobs');
  if (/\/payment/.test(path)) {
    domains.add('wallet');
    domains.add('profile');
    domains.add('notifications');
  }
  if (/\/messages/.test(path)) {
    domains.add('messages');
    domains.add('notifications');
  }
  if (/\/notifications|\/alerts/.test(path)) domains.add('notifications');
  if (/\/reviews/.test(path)) {
    domains.add('reviews');
    domains.add('profile');
  }
  if (/\/support/.test(path)) domains.add('support');
  if (/\/settings|\/privacy|\/payment-methods/.test(path)) domains.add('settings');
  return [...domains];
};

export const publishDataRefresh = (event: DataRefreshEvent) => {
  for (const listener of listeners) listener(event);
};

export const subscribeDataRefresh = (listener: (event: DataRefreshEvent) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
