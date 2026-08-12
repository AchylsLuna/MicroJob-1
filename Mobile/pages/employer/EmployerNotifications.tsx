import React from 'react';
import EmployerNavigation from '../../components/employerNavigation';
import NotificationFeedView from '../../components/NotificationFeedView';
import useNotificationFeed from '../../hooks/useNotificationFeed';
import type { NotificationListItem } from '../../lib/notifications';

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
  onOpenNotification?: (item: NotificationListItem) => void;
};

export default function EmployerNotifications({ activeTab = 'Notifications', onTabPress, liveNotifications = [], onOpenNotification = () => undefined }: Props) {
  const feed = useNotificationFeed(liveNotifications);
  return <NotificationFeedView
    {...feed}
    onRefresh={() => void feed.load(true)}
    onRetry={() => void feed.load()}
    onOpenNotification={onOpenNotification}
    onSetRead={(item, read) => void feed.setRead(item, read)}
    onRemove={(item) => void feed.remove(item)}
    onMarkAllRead={() => void feed.markAllRead()}
    onClearRead={() => void feed.clearRead()}
    footer={<EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />}
  />;
}
