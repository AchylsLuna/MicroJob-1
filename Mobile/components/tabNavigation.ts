import { CommonActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

export const WORKER_TABS = ['Home', 'Jobs', 'EWallet', 'Messages', 'Profile'] as const;
export const EMPLOYER_TABS = ['Home', 'Applications', 'Post Job', 'Messages', 'Profile'] as const;

export type WorkerTab = (typeof WORKER_TABS)[number];
export type EmployerTab = (typeof EMPLOYER_TABS)[number];

type Role = 'worker' | 'employer';
type TabForRole<R extends Role> = R extends 'worker' ? WorkerTab : EmployerTab;

const tabSets = {
  worker: new Set<string>(WORKER_TABS),
  employer: new Set<string>(EMPLOYER_TABS),
};

const tabContainers = {
  worker: 'WorkerTabs',
  employer: 'EmployerTabs',
} as const;

export const isRoleTab = <R extends Role>(role: R, value: unknown): value is TabForRole<R> =>
  tabSets[role].has(String(value || ''));

export const navigateToRoleTab = <R extends Role>(
  navigation: NavigationProp<ParamListBase>,
  role: R,
  tab: TabForRole<R>,
) => {
  let target: NavigationProp<ParamListBase> | undefined = navigation;
  while (target) {
    const state = target.getState?.();
    if (state?.routeNames?.includes(tab)) {
      const activeRoute = state.routes[state.index];
      if (activeRoute?.name !== tab) {
        target.dispatch(CommonActions.navigate(
          String(tab),
          role === 'worker' && tab === 'Jobs' ? { initialCategory: null } : undefined,
        ));
      }
      return;
    }
    target = target.getParent?.();
  }

  navigation.dispatch(CommonActions.navigate(tabContainers[role], { screen: tab }));
};
