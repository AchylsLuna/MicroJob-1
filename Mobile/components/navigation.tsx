import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CompactBottomNavigation, { type CompactNavigationItem } from './CompactBottomNavigation';
import { useAppSession } from '../contexts/AppSessionContext';
import { isNavigationTabActive } from './navigationState';
import type { WorkerTab } from './tabNavigation';

type Props = { activeTab?: string; onTabPress?: (tab: string) => void; messageBadgeCount?: number };

export default function Navigation({ activeTab = 'Jobs', onTabPress, messageBadgeCount }: Props) {
  const { t } = useTranslation('common');
  const session = useAppSession();
  const unread = typeof messageBadgeCount === 'number' ? messageBadgeCount : session.unreadMessageCount;
  const initials = session.navigationProfileInitials;
  const items = useMemo<CompactNavigationItem<WorkerTab>[]>(() => [
    { key: 'Jobs', label: t('workerNav.jobs'), icon: 'home-outline', activeIcon: 'home' },
    { key: 'EWallet', label: t('workerNav.eWallet'), icon: 'wallet-outline', activeIcon: 'wallet' },
    { key: 'Messages', label: t('workerNav.messages'), icon: 'chatbubble-outline', activeIcon: 'chatbubble', badge: unread },
    { key: 'Profile', label: t('workerNav.profile'), icon: 'person-outline', activeIcon: 'person', profileInitials: initials },
  ], [initials, unread, t]);

  return <CompactBottomNavigation items={items} activeKey={activeTab as WorkerTab} onSelect={(tab) => onTabPress?.(tab)} isActive={(current, item) => isNavigationTabActive(current, item)} />;
}
