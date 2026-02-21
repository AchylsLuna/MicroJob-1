import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';

interface Message {
  _id: string;
  sender: any;
  receiver: any;
  content: string;
  createdAt: string;
  senderName?: string;
  receiverName?: string;
}

interface ChatScreenProps {
  userId: string;
  displayName?: string;
  onBack: () => void;
  liveMessages?: any[];
}

export default function ChatScreen({ userId, displayName: initialDisplayName, onBack, liveMessages = [] }: ChatScreenProps) {
  const [displayName, setDisplayName] = useState<string | undefined>(initialDisplayName);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const getEntityId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return String(value._id || value.id || value.userId || '');
    return String(value);
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/conversation/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load messages');
      const messageList = asList<Message>(result.raw, ['messages']);
      setMessages(messageList);
      // derive display name from messages if available
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const meId = parsedUser?._id || parsedUser?.id || parsedUser?.userId;
        setCurrentUserId(meId || null);
        const msgs = messageList || [];
        if (msgs.length > 0) {
          const first = msgs[0];
          const senderId = getEntityId(first?.sender);
          const receiverId = getEntityId(first?.receiver);
          const other = String(senderId) === String(meId) ? first.receiver : first.sender;
          const otherName = other?.firstName ? `${other.firstName} ${other.lastName || ''}`.trim() : (other?.senderName || other?.receiverName || undefined);
          if (otherName) setDisplayName(otherName);
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, [userId]);

  // Merge incoming live messages for this conversation
  useEffect(() => {
    if (!liveMessages || liveMessages.length === 0) return;
    // liveMessages is a list of payloads; find those related to this conversation
    const relevant = liveMessages.filter((p: any) => {
      try {
        const senderId = getEntityId(p?.sender || p?.senderId);
        const receiverId = getEntityId(p?.receiver || p?.receiverId);
        return String(senderId) === String(userId) || String(receiverId) === String(userId);
      } catch (e) { return false; }
    });
    if (relevant.length === 0) return;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => String(m._id)));
      const toAdd = [] as any[];
      for (const p of relevant) {
        const id = p?._id || p?.id || (p?._doc && p._doc._id) || `${Date.now()}-${Math.random()}`;
        if (existingIds.has(String(id))) continue;
        const sender = p?.sender?.firstName ? `${p.sender.firstName} ${p.sender.lastName || ''}`.trim() : (p?.senderName || 'User');
        const receiver = p?.receiver?.firstName ? `${p.receiver.firstName} ${p.receiver.lastName || ''}`.trim() : (p?.receiverName || 'User');
        toAdd.push({
          _id: id,
          sender: p?.sender || p?.senderId,
          receiver: p?.receiver || p?.receiverId,
          content: p?.content || (p?._doc && p._doc.content) || '',
          createdAt: p?.createdAt || new Date().toISOString(),
          senderName: sender,
          receiverName: receiver,
        });
      }
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, [liveMessages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const token = await AsyncStorage.getItem('auth_token');
    try {
      const result = await apiRequest(`${API_URL}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId: userId, content: input }),
      }, 'Unable to send message');
      if (!result.ok) {
        console.warn('Send message failed', result.status, result.raw);
        Alert && Alert.alert && Alert.alert('Send failed', result.message || 'Unable to send message');
        return;
      }
      setInput('');
      // refresh messages (server will also emit socket event)
      fetchMessages();
    } catch (err) {
      console.warn('Send message error', err);
      Alert && Alert.alert && Alert.alert('Send failed', 'Network error');
    }
  };

  useEffect(() => {
    // Optionally, poll for new messages every 10s
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>{'< Back'}</Text></TouchableOpacity>
          <Text style={styles.headerText}>{displayName || 'Chat'}</Text>
        </View>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1, backgroundColor: '#ffffff' }}
          data={messages}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            const isMine = String(getEntityId(item.sender)) === String(currentUserId);
            return (
            <View style={[styles.msgBubble, isMine ? styles.myMsg : styles.theirMsg]}>
              <Text style={[styles.msgText, isMine ? styles.myMsgText : styles.theirMsgText]}>{item.content}</Text>
              <Text style={styles.msgTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
            </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backBtn: { color: '#0a2847', fontWeight: '700', fontSize: 16, marginRight: 12 },
  headerText: { fontSize: 18, fontWeight: '700', color: '#0a2847' },
  msgBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  myMsg: {
    backgroundColor: '#0ea5e9',
    alignSelf: 'flex-end',
  },
  theirMsg: {
    backgroundColor: '#e5e7eb',
    alignSelf: 'flex-start',
  },
  msgText: { fontSize: 15 },
  myMsgText: { color: '#ffffff' },
  theirMsgText: { color: '#0a2847' },
  msgTime: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, padding: 10, marginRight: 8 },
  sendBtn: { backgroundColor: '#0ea5e9', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 },
});
