import React, { useMemo } from 'react';
import CompactBottomNavigation, { type CompactNavigationItem } from './CompactBottomNavigation';
import { useAppSession } from '../contexts/AppSessionContext';
import { isNavigationTabActive } from './navigationState';
import type { WorkerTab } from './tabNavigation';

type Props = { activeTab?: string; onTabPress?: (tab: string) => void; messageBadgeCount?: number };

export default function Navigation({ activeTab = 'Home', onTabPress, messageBadgeCount }: Props) {
  const session = useAppSession();
  const unread = typeof messageBadgeCount === 'number' ? messageBadgeCount : session.unreadMessageCount;
  const initials = session.navigationProfileInitials;
  const items = useMemo<CompactNavigationItem<WorkerTab>[]>(() => [
    { key: 'Home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'Jobs', label: 'Jobs', icon: 'briefcase-outline', activeIcon: 'briefcase' },
    { key: 'EWallet', label: 'E-Wallet', icon: 'wallet-outline', activeIcon: 'wallet' },
    { key: 'Messages', label: 'Messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badge: unread },
    { key: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person', profileInitials: initials },
  ], [initials, unread]);

  return <CompactBottomNavigation items={items} activeKey={activeTab as WorkerTab} onSelect={(tab) => onTabPress?.(tab)} isActive={(current, item) => isNavigationTabActive(current, item)} />;
}
