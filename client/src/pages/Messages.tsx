import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
import './Messages.css';

interface ConversationSummary {
  userId: string;
  name: string;
  lastMessage: string;
  lastTime: string;
}

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt: string;
  senderName?: string;
  receiverName?: string;
}

interface MessageLocationState {
  userId?: string;
  name?: string;
  jobId?: string;
}

export default function Messages() {
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const getToken = () => localStorage.getItem('auth_token') || localStorage.getItem('token');

  const upsertConversation = useCallback((userId: string, name?: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((conv) => conv.userId === userId);
      if (idx === -1) {
        return [
          {
            userId,
            name: name || 'User',
            lastMessage: '',
            lastTime: '',
          },
          ...prev,
        ];
      }
      if (name && prev[idx].name === 'User') {
        const next = [...prev];
        next[idx] = { ...next[idx], name };
        return next;
      }
      return prev;
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        setConversations([]);
        return;
      }
      const res = await fetch(`${API_BASE}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to load conversations');
      }
      const convs: ConversationSummary[] = Object.entries(data.conversations || {}).map(
        ([userId, msgs]: [string, any]) => {
          const arr = Array.isArray(msgs) ? msgs : [];
          const last = arr[arr.length - 1];
          const name = last?.sender === userId ? last?.senderName : last?.receiverName;
          return {
            userId,
            name: name || last?.senderName || last?.receiverName || 'User',
            lastMessage: last?.content || '',
            lastTime: last?.createdAt ? new Date(last.createdAt).toLocaleString() : '',
          };
        }
      );
      setConversations((prev) => {
        const seen = new Set(convs.map((conv) => conv.userId));
        const merged = [...convs];
        prev.forEach((conv) => {
          if (!seen.has(conv.userId)) {
            merged.unshift(conv);
          }
        });
        return merged;
      });
    } catch (error) {
      console.error('Failed to load conversations', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (userId: string) => {
    setLoadingMessages(true);
    try {
      const token = getToken();
      if (!token) {
        setMessages([]);
        return;
      }
      const res = await fetch(`${API_BASE}/messages/conversation/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to load messages');
      }
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedUserId) return;
    fetchMessages(selectedUserId);
  }, [selectedUserId, fetchMessages]);

  useEffect(() => {
    const state = (location.state || {}) as MessageLocationState;
    if (state.userId) {
      setSelectedUserId(state.userId);
      upsertConversation(state.userId, state.name);
    }
  }, [location.state, upsertConversation]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUserId) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId: selectedUserId, content: input }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to send message');
      }
      setInput('');
      await Promise.all([fetchMessages(selectedUserId), fetchConversations()]);
      upsertConversation(selectedUserId);
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  return (
    <div className="messages-root">
      <div className="messages-sidebar">
        <h2>Messages</h2>
        {loading ? (
          <div className="messages-loading">Loading...</div>
        ) : (
          <ul className="messages-list">
            {conversations.map((conv) => (
              <li
                key={conv.userId}
                className={selectedUserId === conv.userId ? 'active' : ''}
                onClick={() => setSelectedUserId(conv.userId)}
              >
                <div className="messages-list-name">{conv.name}</div>
                <div className="messages-list-last">{conv.lastMessage}</div>
                <div className="messages-list-time">{conv.lastTime}</div>
              </li>
            ))}
            {conversations.length === 0 && <div className="messages-empty">No conversations yet.</div>}
          </ul>
        )}
      </div>
      <div className="messages-main">
        {selectedUserId ? (
          <>
            <div className="messages-chat">
              {loadingMessages ? (
                <div className="messages-loading">Loading...</div>
              ) : (
                <ul className="messages-chat-list">
                  {messages.map((msg) => (
                    <li
                      key={msg._id}
                      className={msg.sender === selectedUserId ? 'their-msg' : 'my-msg'}
                    >
                      <div className="msg-content">{msg.content}</div>
                      <div className="msg-time">{new Date(msg.createdAt).toLocaleTimeString()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form className="messages-input-row" onSubmit={sendMessage}>
              <input
                className="messages-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button className="messages-send-btn" type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="messages-empty">Select a conversation to start chatting.</div>
        )}
      </div>
    </div>
  );
}
