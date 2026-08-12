import React from 'react';
import Navigation from '../../components/navigation';
import NotificationFeedView from '../../components/NotificationFeedView';
import useNotificationFeed from '../../hooks/useNotificationFeed';
import type { NotificationListItem } from '../../lib/notifications';

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
  messageBadgeCount?: number;
  onDismissLiveNotification?: (notificationId: string) => void;
  onBack?: () => void;
  onOpenNotification?: (item: NotificationListItem) => void;
};

export default function NotificationsInbox({
  activeTab = 'Home', onTabPress, liveNotifications = [], messageBadgeCount = 0,
  onDismissLiveNotification, onBack, onOpenNotification = () => undefined,
}: Props) {
  const feed = useNotificationFeed(liveNotifications, onDismissLiveNotification);
  return <NotificationFeedView
    {...feed}
    onRefresh={() => void feed.load(true)}
    onRetry={() => void feed.load()}
    onBack={onBack}
    onOpenNotification={onOpenNotification}
    onSetRead={(item, read) => void feed.setRead(item, read)}
    onRemove={(item) => void feed.remove(item)}
    onMarkAllRead={() => void feed.markAllRead()}
    onClearRead={() => void feed.clearRead()}
    footer={<Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />}
  />;
}
