const normalize = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const aliases: Record<string, string> = {
  dashboard: 'home',
  jobs: 'jobs',
  findjobs: 'jobs',
  jobdetails: 'jobs',
  ewallet: 'ewallet',
  wallet: 'ewallet',
  messages: 'messages',
  inbox: 'messages',
  profile: 'profile',
  applications: 'applications',
  postjob: 'postjob',
  notifications: 'notifications',
  alerts: 'notifications',
};

export const normalizedNavigationTab = (value: unknown) => aliases[normalize(value)] || normalize(value);

export const isNavigationTabActive = (activeTab: unknown, screen: unknown) =>
  normalizedNavigationTab(activeTab) === normalizedNavigationTab(screen);
