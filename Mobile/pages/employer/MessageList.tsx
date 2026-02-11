import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

// Conversation summary type
interface ConversationSummary {
  userId: string;
  name: string;
  lastMessage: string;
  lastTime: string;
}

interface MessageListProps {
  onOpenChat: (userId: string) => void;
  isEmployer?: boolean;
}

export default function MessageList({ onOpenChat, isEmployer }: MessageListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Transform backend conversations to summary list
      const convs: ConversationSummary[] = Object.entries(data.conversations || {}).map(
        ([userId, msgs]: [string, unknown]) => {
          const arr = Array.isArray(msgs) ? msgs as any[] : [];
          const last = arr[arr.length - 1];
          return {
            userId,
            name: last?.senderName || last?.receiverName || 'User',
            lastMessage: last?.content || '',
            lastTime: last?.createdAt ? new Date(last.createdAt).toLocaleString() : '',
          };
        }
      );
      setConversations(convs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConversations(); }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages</Text>
      <FlatList
        data={conversations}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => onOpenChat(item.userId)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.lastMessage}>{item.lastMessage}</Text>
            <Text style={styles.time}>{item.lastTime}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb', padding: 16, marginTop: 60 },
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
  name: { fontSize: 16, fontWeight: '700', color: '#0a2847' },
  lastMessage: { fontSize: 13, color: '#64748b', marginTop: 4 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
