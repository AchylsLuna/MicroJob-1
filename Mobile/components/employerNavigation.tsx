import React, { useMemo } from 'react';
import CompactBottomNavigation, { type CompactNavigationItem } from './CompactBottomNavigation';
import { useAppSession } from '../contexts/AppSessionContext';
import { isNavigationTabActive } from './navigationState';
import type { EmployerTab } from './tabNavigation';

type Props = { activeTab?: string; onTabPress?: (tab: string) => void };

export default function EmployerNavigation({ activeTab = 'Home', onTabPress }: Props) {
  const session = useAppSession();
  const initials = session.navigationProfileInitials;
  const items = useMemo<CompactNavigationItem<EmployerTab>[]>(() => [
    { key: 'Home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'Applications', label: 'Applicants', icon: 'clipboard-outline', activeIcon: 'clipboard' },
    { key: 'Post Job', label: 'Post Job', icon: 'add', activeIcon: 'add', emphasized: true },
    { key: 'Messages', label: 'Messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
    { key: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person', profileInitials: initials },
  ], [initials]);

  return <CompactBottomNavigation items={items} activeKey={activeTab as EmployerTab} onSelect={(tab) => onTabPress?.(tab)} isActive={(current, item) => isNavigationTabActive(current, item)} />;
}
