import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CompactBottomNavigation, { type CompactNavigationItem } from './CompactBottomNavigation';
import { useAppSession } from '../contexts/AppSessionContext';
import { isNavigationTabActive } from './navigationState';
import type { EmployerTab } from './tabNavigation';

type Props = { activeTab?: string; onTabPress?: (tab: string) => void };

export default function EmployerNavigation({ activeTab = 'Home', onTabPress }: Props) {
  const { t } = useTranslation('common');
  const session = useAppSession();
  const initials = session.navigationProfileInitials;
  const items = useMemo<CompactNavigationItem<EmployerTab>[]>(() => [
    { key: 'Home', label: t('employerNav.home'), icon: 'home-outline', activeIcon: 'home' },
    { key: 'Applications', label: t('employerNav.applicants'), icon: 'clipboard-outline', activeIcon: 'clipboard' },
    { key: 'Post Job', label: t('employerNav.postJob'), icon: 'add', activeIcon: 'add', emphasized: true },
    { key: 'Messages', label: t('employerNav.messages'), icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
    { key: 'Profile', label: t('employerNav.profile'), icon: 'person-outline', activeIcon: 'person', profileInitials: initials },
  ], [initials, t]);

  return <CompactBottomNavigation items={items} activeKey={activeTab as EmployerTab} onSelect={(tab) => onTabPress?.(tab)} isActive={(current, item) => isNavigationTabActive(current, item)} />;
}
