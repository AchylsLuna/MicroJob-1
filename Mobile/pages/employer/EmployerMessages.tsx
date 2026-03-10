import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';

type Message = {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt: string;
};

type EmployerMessagesProps = {
  workerId: string;
  jobId?: string;
};

export default function EmployerMessages({ workerId, jobId }: EmployerMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const params = new URLSearchParams({ otherUserId: workerId });
      if (jobId) params.append('jobId', jobId);
      const result = await apiRequest(`${API_URL}/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load messages.');
      if (!result.ok) {
        setMessages([]);
        return;
      }
      const payload = asObject<{ messages?: Message[] }>(result.raw);
      setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, [workerId, jobId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const token = await AsyncStorage.getItem('auth_token');
    await apiRequest(`${API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverId: workerId, content: input, jobId }),
    }, 'Failed to send message.');
    setInput('');
    fetchMessages();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item._id}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const isWorker = item.sender === workerId;
          return (
            <View style={[styles.message, isWorker ? styles.left : styles.right]}>
              <Text style={[styles.text, isWorker ? styles.textLeft : styles.textRight]}>{item.content}</Text>
              <Text style={[styles.time, isWorker ? styles.timeLeft : styles.timeRight]}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchMessages}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  list: { padding: 16, paddingBottom: 80 },
  message: {
    marginBottom: 12,
    maxWidth: '80%',
    borderRadius: 12,
    padding: 10,
  },
  left: { backgroundColor: '#e5e7eb', alignSelf: 'flex-start' },
  right: { backgroundColor: '#0a2847', alignSelf: 'flex-end' },
  text: { fontSize: 15 },
  textLeft: { color: '#111' },
  textRight: { color: '#fff' },
  time: { fontSize: 10, marginTop: 2 },
  timeLeft: { color: '#64748b' },
  timeRight: { color: '#cbd5e1' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    backgroundColor: '#f9fafb',
  },
  sendBtn: {
    backgroundColor: '#0a2847',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
