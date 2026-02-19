import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

// Conversation summary type
interface ConversationSummary {
  conversationId: string;
  userId: string;
  name: string;
  lastMessage: string;
  lastTime: string;
}

interface MessageListProps {
  onOpenChat: (userId: string, name?: string) => void;
  isEmployer?: boolean;
  liveMessages?: any[];
}

export default function MessageList({ onOpenChat, isEmployer, liveMessages = [] }: MessageListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Server returns an array of conversation objects with otherUserId, otherUserName, lastMessage, lastMessageAt
      const convs: ConversationSummary[] = Array.isArray(data.conversations)
        ? data.conversations
            .map((c: any) => {
              const otherId = c.otherUserId || c.otherUser || c.userId || '';
              const convId = c.conversationId || `${otherId}::${c.jobId || 'general'}`;
              if (!otherId) return null;
              return {
                conversationId: convId,
                userId: otherId,
                name: c.otherUserName || (c.otherUser && (c.otherUser.firstName ? `${c.otherUser.firstName} ${c.otherUser.lastName || ''}`.trim() : undefined)) || 'User',
                lastMessage: c.lastMessage || '',
                lastTime: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '',
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

  const confirmAndDelete = (userId: string) => {
    Alert.alert('Delete conversation', 'Are you sure you want to delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(userId) },
    ]);
  };

  const handleDelete = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/messages/conversation`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to delete conversation', err);
      Alert.alert('Error', 'Unable to delete conversation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleArchive = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await fetch(`${API_URL}/messages/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId, archive: true }),
      });
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to archive conversation', err);
      Alert.alert('Error', 'Unable to archive conversation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBlock = async (userId: string) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await fetch(`${API_URL}/messages/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      });
      Alert.alert('Blocked', 'User has been blocked');
      await fetchConversations();
    } catch (err) {
      console.warn('Failed to block user', err);
      Alert.alert('Error', 'Unable to block user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkReadUnread = async (userId: string, markRead = true) => {
    setProcessingId(userId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await fetch(`${API_URL}/messages/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId, read: markRead }),
      });
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
      // use Alert as simple fallback (ActionSheet could be used for nicer UI)
      Alert.alert('Conversation options', undefined, options as any);
    } else {
      Alert.alert('Conversation options', undefined, options as any);
    }
  };

  useEffect(() => { fetchConversations(); }, []);

  // refresh when live messages arrive
  useEffect(() => {
    if (!liveMessages || liveMessages.length === 0) return;
    fetchConversations();
  }, [liveMessages]);

  // Poll for updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Refresh when app comes to foreground
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

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages</Text>
      <FlatList
        data={conversations}
        keyExtractor={item => item.conversationId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => (item.userId ? onOpenChat(item.userId, item.name) : Alert.alert('No user', 'Cannot open this conversation'))}
            onLongPress={() => (item.userId ? showOptions(item.userId) : null)}
            delayLongPress={400}
          >
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.lastMessage}>{item.lastMessage}</Text>
                <Text style={styles.time}>{item.lastTime}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmAndDelete(item.userId)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>{processingId === item.userId ? '...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#0a2847' },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#0a2847' },
  lastMessage: { fontSize: 13, color: '#64748b', marginTop: 4 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  deleteText: { color: '#ef4444', fontWeight: '700' },
});
