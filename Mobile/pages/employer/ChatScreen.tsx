import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt: string;
  senderName?: string;
  receiverName?: string;
}

interface ChatScreenProps {
  userId: string;
  onBack: () => void;
}

export default function ChatScreen({ userId, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/messages/conversation/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, [userId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const token = await AsyncStorage.getItem('auth_token');
    await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverId: userId, content: input }),
    });
    setInput('');
    fetchMessages();
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>{'< Back'}</Text></TouchableOpacity>
        <Text style={styles.headerText}>Chat</Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={[styles.msgBubble, item.sender === userId ? styles.theirMsg : styles.myMsg]}>
            <Text style={styles.msgText}>{item.content}</Text>
            <Text style={styles.msgTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
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
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f5f7fb' },
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
  msgText: { color: '#0a2847', fontSize: 15 },
  msgTime: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, padding: 10, marginRight: 8 },
  sendBtn: { backgroundColor: '#0ea5e9', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 },
});
