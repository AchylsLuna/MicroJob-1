import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNotificationTime, type NotificationListItem } from '../lib/notifications';
import { tokens } from '../theme/tokens';

type FeedTab = 'general' | 'applications';
type Props = {
  notifications: NotificationListItem[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  processingId: string | null;
  onRefresh: () => void;
  onRetry: () => void;
  onBack?: () => void;
  onOpenNotification: (item: NotificationListItem) => void;
  onSetRead: (item: NotificationListItem, read: boolean) => void;
  onRemove: (item: NotificationListItem) => void;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  footer: React.ReactNode;
};

const isApplication = (item: NotificationListItem) => ['application', 'interview'].includes(item.type.toLowerCase());

const groupForDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === today) return 'Today';
  if (day === today - 86_400_000) return 'Yesterday';
  return 'Earlier';
};

export default function NotificationFeedView(props: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('general');
  const filtered = useMemo(() => props.notifications.filter((item) => tab === 'applications' ? isApplication(item) : !isApplication(item)), [props.notifications, tab]);
  const groups = useMemo(() => ['Today', 'Yesterday', 'Earlier'].map((label) => ({ label, items: filtered.filter((item) => groupForDate(item.createdAt) === label) })).filter((group) => group.items.length), [filtered]);
  const unreadCount = props.notifications.filter((item) => !item.readAt).length;
  const readCount = props.notifications.length - unreadCount;

  const showBulkMenu = () => {
    const actions: Parameters<typeof Alert.alert>[2] = [];
    if (unreadCount) actions.push({ text: 'Mark all as read', onPress: props.onMarkAllRead });
    if (readCount) actions.push({ text: 'Clear read notifications', onPress: props.onClearRead, style: 'destructive' });
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Notification actions', unreadCount || readCount ? undefined : 'There are no notification actions available.', actions);
  };

  const showItemMenu = (item: NotificationListItem) => Alert.alert(item.title, undefined, [
    { text: item.readAt ? 'Mark as unread' : 'Mark as read', onPress: () => props.onSetRead(item, !item.readAt) },
    { text: 'Remove', style: 'destructive', onPress: () => Alert.alert('Remove notification?', 'This removes the update from your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => props.onRemove(item) },
    ]) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return <View style={styles.container}>
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 8 }]}>
      {props.onBack ? <TouchableOpacity style={styles.headerButton} onPress={props.onBack} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="arrow-back" size={23} color={tokens.colors.brandDark} /></TouchableOpacity> : <View style={styles.headerSpacer} />}
      <Text style={styles.headerTitle}>Notifications</Text>
      <TouchableOpacity
        style={[styles.headerButton, !props.notifications.length && styles.headerButtonDisabled]}
        onPress={showBulkMenu}
        disabled={!props.notifications.length || Boolean(props.processingId)}
        accessibilityRole="button"
        accessibilityLabel="Notification actions"
        accessibilityState={{ disabled: !props.notifications.length || Boolean(props.processingId) }}
      ><Ionicons name="ellipsis-horizontal" size={23} color={tokens.colors.brandDark} /></TouchableOpacity>
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['general', 'applications'] as const).map((value) => <TouchableOpacity key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value === 'general' ? 'General' : 'Applications'}</Text></TouchableOpacity>)}
    </View>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={tokens.colors.brand} />}>
      {props.loading ? <View accessibilityLabel="Loading notifications" style={styles.skeletonList}>{[0, 1, 2].map((index) => <View key={index} style={styles.skeletonRow}><View style={styles.skeletonIcon} /><View style={styles.skeletonBody}><View style={styles.skeletonTitle} /><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, styles.skeletonLineShort]} /></View></View>)}</View> : null}
      {!props.loading && props.error ? <View style={styles.stateCard}><Ionicons name="cloud-offline-outline" size={30} color={tokens.colors.textMuted} /><Text style={styles.emptyTitle}>Notifications unavailable</Text><Text style={styles.stateText}>{props.error}</Text><TouchableOpacity style={styles.retryButton} onPress={props.onRetry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> : null}
      {!props.loading && !props.error && filtered.length === 0 ? <View style={styles.stateCard}><View style={styles.emptyIcon}><Ionicons name="notifications-off-outline" size={34} color="#94A3B8" /></View><Text style={styles.emptyTitle}>{tab === 'applications' ? 'No application updates' : 'All quiet for now'}</Text><Text style={styles.stateText}>{tab === 'applications' ? 'Application and interview updates will appear here.' : 'Messages, payments, support, and account updates will appear here.'}</Text></View> : null}
      {groups.map((group) => <View key={group.label} style={styles.group}><Text style={styles.groupTitle}>{group.label}</Text>{group.items.map((item) => {
        const busy = props.processingId === item.id;
        return <TouchableOpacity key={item.id} style={[styles.row, !item.readAt && styles.rowUnread, busy && styles.rowBusy]} onPress={() => { if (!item.readAt) props.onSetRead(item, true); props.onOpenNotification(item); }} onLongPress={() => showItemMenu(item)} delayLongPress={350} disabled={busy} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.message}. ${item.readAt ? 'Read' : 'Unread'}`} accessibilityHint="Opens this update. Long press for more actions.">
          <View style={[styles.icon, { backgroundColor: item.accentBackground }]}><Ionicons name={item.icon} size={20} color={item.accentColor} /></View>
          <View style={styles.body}><View style={styles.titleRow}><Text style={styles.title} numberOfLines={1}>{item.title}</Text>{!item.readAt ? <View style={styles.unreadDot} /> : null}</View><Text style={styles.time}>{formatNotificationTime(item.createdAt)}</Text><Text style={styles.message} numberOfLines={2}>{item.message}</Text>{item.actorName ? <Text style={styles.actor} numberOfLines={1}>{item.actorName}</Text> : null}</View>
          <Ionicons name="chevron-forward" size={16} color={tokens.colors.textSubtle} />
        </TouchableOpacity>;
      })}</View>)}
    </ScrollView>
    {props.footer}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: { minHeight: 64, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  headerButtonDisabled: { opacity: 0.4 },
  headerSpacer: { width: 44 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 21, fontWeight: '800', color: tokens.colors.brandDark },
  tabs: { flexDirection: 'row', backgroundColor: tokens.colors.surface, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: tokens.colors.brand },
  tabText: { fontSize: 14, fontWeight: '700', color: tokens.colors.textMuted },
  tabTextActive: { color: tokens.colors.brand },
  scrollView: { flex: 1 }, scroll: { padding: 16, paddingBottom: 120, gap: 18 },
  group: { gap: 8 }, groupTitle: { fontSize: 12, fontWeight: '800', color: tokens.colors.onCanvasMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  row: { minHeight: 92, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowUnread: { borderColor: tokens.colors.brandMuted, backgroundColor: '#F7FAFF' }, rowBusy: { opacity: 0.55 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, title: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: tokens.colors.text },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.colors.brand }, time: { marginTop: 2, fontSize: 11, color: tokens.colors.textMuted },
  message: { marginTop: 5, fontSize: 13, lineHeight: 18, color: tokens.colors.onCanvasMuted }, actor: { marginTop: 4, fontSize: 11, fontWeight: '700', color: tokens.colors.brand },
  stateCard: { minHeight: 230, borderRadius: 20, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  skeletonList: { gap: 10 }, skeletonRow: { minHeight: 92, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11 },
  skeletonIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: tokens.colors.contentMuted }, skeletonBody: { flex: 1, gap: 8 }, skeletonTitle: { width: '52%', height: 14, borderRadius: 7, backgroundColor: tokens.colors.contentMuted }, skeletonLine: { width: '92%', height: 10, borderRadius: 5, backgroundColor: tokens.colors.contentMuted }, skeletonLineShort: { width: '68%' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: tokens.colors.contentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: tokens.colors.text, textAlign: 'center' }, stateText: { fontSize: 13, lineHeight: 19, color: tokens.colors.textMuted, textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' }, retryText: { color: tokens.colors.onBrand, fontWeight: '800' },
});
