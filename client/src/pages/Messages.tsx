import React, { useEffect, useState } from 'react';
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

export default function Messages() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const convs: ConversationSummary[] = Object.entries(data.conversations || {}).map(
        ([userId, msgs]: [string, any]) => {
          const arr = Array.isArray(msgs) ? msgs : [];
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
      setLoading(false);
    };
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/messages/conversation/${selectedUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [selectedUserId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUserId) return;
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverId: selectedUserId, content: input }),
    });
    setInput('');
    // Refresh messages
    const res = await fetch(`${API_BASE}/messages/conversation/${selectedUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMessages(data.messages || []);
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
