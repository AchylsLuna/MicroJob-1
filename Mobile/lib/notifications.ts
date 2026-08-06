import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  actorName: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  accentColor: string;
  accentBackground: string;
};

const FALLBACK_TIMESTAMP = () => new Date().toISOString();

export const getNotificationId = (item: any): string =>
  String(
    item?.id ||
      item?.notification?._id ||
      item?._id ||
      item?.applicationId ||
      item?.entityId ||
      `${item?.jobId || item?.payoutRequestId || item?.ticketId || 'notification'}-${item?.updatedAt || item?.createdAt || FALLBACK_TIMESTAMP()}`,
  );

const getActorName = (item: any): string => {
  const actor = item?.actor;
  if (actor && typeof actor === 'object') {
    const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (actor.email) return String(actor.email);
  }
  return '';
};

const getAppearance = (type: string) => {
  switch (type) {
    case 'application':
      return { icon: 'briefcase-outline' as const, accentColor: '#1C4D8D', accentBackground: '#EAF2FF' };
    case 'payout':
    case 'payment':
      return { icon: 'wallet-outline' as const, accentColor: '#047857', accentBackground: '#ECFDF5' };
    case 'support':
      return { icon: 'help-buoy-outline' as const, accentColor: '#7C3AED', accentBackground: '#F3E8FF' };
    case 'interview':
      return { icon: 'calendar-outline' as const, accentColor: '#B45309', accentBackground: '#FEF3C7' };
    case 'account':
      return { icon: 'shield-checkmark-outline' as const, accentColor: '#0F766E', accentBackground: '#CCFBF1' };
    case 'message':
      return { icon: 'chatbubble-ellipses-outline' as const, accentColor: '#1C4D8D', accentBackground: '#DBEAFE' };
    default:
      return { icon: 'notifications-outline' as const, accentColor: '#475569', accentBackground: '#EEF2F7' };
  }
};

const normalizeApplicationPayload = (item: any) => ({
  id: getNotificationId(item),
  type: 'application',
  title: item?.title || (item?.applicantName ? 'New application' : `Application ${item?.status || 'updated'}`),
  message:
    item?.message ||
    (item?.applicantName
      ? `${item.applicantName} applied for ${item?.jobTitle || 'your job'}.`
      : `Your application for ${item?.jobTitle || 'the job'} is now ${item?.status || 'updated'}.`),
  createdAt: item?.updatedAt || item?.createdAt || FALLBACK_TIMESTAMP(),
  readAt: item?.readAt || null,
  actorName: item?.applicantName || '',
});

export const normalizeNotificationItem = (raw: any): NotificationListItem => {
  const item = raw?.notification || raw;

  const normalized = item?.title || item?.message
    ? {
        id: getNotificationId(item),
        type: String(item?.type || 'system'),
        title: String(item?.title || 'Notification'),
        message: String(item?.message || 'You have a new update.'),
        createdAt: item?.createdAt || item?.updatedAt || FALLBACK_TIMESTAMP(),
        readAt: item?.readAt || null,
        actorName: getActorName(item),
      }
    : normalizeApplicationPayload(item);

  const appearance = getAppearance(normalized.type);

  return {
    ...normalized,
    icon: appearance.icon,
    accentColor: appearance.accentColor,
    accentBackground: appearance.accentBackground,
  };
};

export const formatNotificationTime = (value?: string) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
