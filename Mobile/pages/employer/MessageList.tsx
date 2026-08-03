import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  AppState,
  AppStateStatus,
  TextInput,
  Image,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import TabTopNav from '../../components/TabTopNav';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

interface ConversationSummary {
  conversationId: string;
  userId: string;
  name: string;
  lastMessage: string;
  lastMessageAt?: string;
  unreadCount: number;
  isOnline: boolean;
  avatarUrl: string;
}

interface MessageListProps {
  onOpenChat: (userId: string, name?: string) => void;
  isEmployer?: boolean;
  liveMessages?: any[];
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
}

const buildAvatarUrl = (name: string, avatarUrl?: string) => {
  if (avatarUrl && avatarUrl.trim()) return avatarUrl;
  const safe = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${safe}&background=E5E7EB&color=111827&size=128`;
};

const formatConversationTime = (input?: string) => {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startOfNow.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff <= 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  }
  if (dayDiff === 1) {
    return 'YESTERDAY';
  }
  if (dayDiff < 7) {
    return `${dayDiff} DAYS AGO`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
};

export default function MessageList({
  onOpenChat,
  liveMessages = [],
  onOpenNotifications,
  notificationBadgeCount = 0,
}: MessageListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => {
      return item.name.toLowerCase().includes(query) || item.lastMessage.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to fetch conversations');
      const items = asList<any>(result.raw, ['conversations']);

      const convs: ConversationSummary[] = Array.isArray(items)
        ? items
            .map((c: any) => {
              const otherId = c.otherUserId || c.otherUser || c.userId || '';
              const convId = c.conversationId || `${otherId}::${c.jobId || 'general'}`;
              if (!otherId) return null;

              const otherUser = c.otherUser && typeof c.otherUser === 'object' ? c.otherUser : null;
              const displayName =
                c.otherUserName ||
                (otherUser?.firstName
                  ? `${otherUser.firstName} ${otherUser.lastName || ''}`.trim()
                  : undefined) ||
                'User';

              return {
                conversationId: convId,
                userId: String(otherId),
                name: displayName,
                lastMessage: c.lastMessage || 'Start a conversation',
                lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt || '',
                unreadCount: Number(c.unreadCount || c.unread || 0),
                isOnline: Boolean(c.otherUserOnline || otherUser?.isOnline || c.isOnline),
                avatarUrl: buildAvatarUrl(
                  displayName,
                  c.otherUserAvatar ||
                    otherUser?.avatarUrl ||
                    otherUser?.avatar ||
                    otherUser?.profileImage ||
                    otherUser?.photo,
                ),
              } as ConversationSummary;
            })
            .filter(Boolean) as ConversationSummary[]
        : [];

      setConversations(convs);
    } catch (err) {
      console.warn('Failed to fetch conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/conversation`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      }, 'Delete failed');
      if (!result.ok) throw new Error(result.message || 'Delete failed');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to delete conversation', err);
      toast.error('Unable to delete conversation.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleArchive = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId, archive: true }),
      }, 'Unable to archive conversation');
      if (!result.ok) throw new Error(result.message || 'Unable to archive conversation');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to archive conversation', err);
      toast.error('Unable to archive conversation.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBlock = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      }, 'Unable to block user');
      if (!result.ok) throw new Error(result.message || 'Unable to block user');
      toast.success('User has been blocked.');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to block user', err);
      toast.error('Unable to block user.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkReadUnread = async (userId: string, markRead = true) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId, read: markRead }),
      }, 'Unable to update read status');
      if (!result.ok) throw new Error(result.message || 'Unable to update read status');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to mark read/unread', err);
    } finally {
      setProcessingId(null);
    }
  };

  const showOptions = (userId: string) => {
    const options = [
      { text: 'Archive', onPress: () => handleArchive(userId) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(userId) },
      { text: 'Block', onPress: () => handleBlock(userId) },
      { text: 'Mark as Unread', onPress: () => handleMarkReadUnread(userId, false) },
      { text: 'Mark as Read', onPress: () => handleMarkReadUnread(userId, true) },
      { text: 'Cancel', style: 'cancel' },
    ];

    if (Platform.OS === 'ios') {
      Alert.alert('Conversation options', undefined, options as any);
    } else {
      Alert.alert('Conversation options', undefined, options as any);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!liveMessages || liveMessages.length === 0) return;
    fetchConversations();
  }, [liveMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const appState = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
  useEffect(() => {
    const handle = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchConversations();
      }
      appState.current = nextAppState;
    };
    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.container}>
      <TabTopNav
        title="Messages"
        showNotifications={Boolean(onOpenNotifications)}
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <View style={styles.searchWrap}>
        <Ionicons style={styles.searchIcon} name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations..."
          placeholderTextColor="#94A3B8"
          accessibilityLabel="Search conversations"
        />
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.conversationId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const timeLabel = formatConversationTime(item.lastMessageAt);
          const unread = item.unreadCount > 0 ? item.unreadCount : 0;

          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => (item.userId ? onOpenChat(item.userId, item.name) : toast.info('Cannot open this conversation.'))}
              onLongPress={() => (item.userId ? showOptions(item.userId) : null)}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${item.name}${unread ? `, ${unread} unread messages` : ''}`}
              accessibilityHint="Long press for conversation options"
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                {item.isOnline ? <View style={styles.onlineDot} /> : null}
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.timeText}>{timeLabel}</Text>
                </View>

                <View style={styles.rowBottom}>
                  <Text style={[styles.previewText, unread > 0 && styles.previewTextUnread]} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {processingId === item.userId ? <Text style={styles.processingText}>...</Text> : null}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={tokens.colors.brand} />
              <Text style={styles.emptyTitle}>Loading conversations</Text>
              <Text style={styles.emptyText}>Pulling your latest message threads.</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>Messages with workers and employers will appear here.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  searchWrap: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 12,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#DCE1E9',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
  },
  listContent: {
    paddingTop: 2,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D1D5DB',
  },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  nameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B8BFCC',
    letterSpacing: 0.7,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    flex: 1,
    fontSize: 15,
    color: '#94A3B8',
  },
  previewTextUnread: {
    color: tokens.colors.text,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8A8F9C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: tokens.colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginLeft: 68,
  },
  processingText: {
    marginLeft: 8,
    color: '#94A3B8',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    marginTop: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    ...tokens.shadow.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.text,
  },
});
