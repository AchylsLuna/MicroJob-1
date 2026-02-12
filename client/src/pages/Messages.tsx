import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
import './Messages.css';
import { getAdminUsers, getUserList } from '../services/api';
import { useAuth } from '../hooks/useAuth';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [supportContacts, setSupportContacts] = useState<ConversationSummary[]>([]);
  const [employerContacts, setEmployerContacts] = useState<ConversationSummary[]>([]);
  const [workerContacts, setWorkerContacts] = useState<ConversationSummary[]>([]);
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
    let isMounted = true;
    const loadSupportContacts = async () => {
      try {
        const token = getToken();
        if (!token) {
          if (isMounted) {
            setSupportContacts([]);
            setEmployerContacts([]);
            setWorkerContacts([]);
          }
          return;
        }
        if (isAdmin) {
          const users = await getUserList();
          if (!isMounted) return;
          const mapped = (Array.isArray(users) ? users : [])
            .filter((u: any) => u?.role !== 'admin' && u?.role !== 'superadmin')
            .map((u: any) => ({
              userId: u._id,
              name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'User',
              lastMessage: u.role ? String(u.role).toUpperCase() : 'USER',
              lastTime: '',
              role: u.role || 'work',
            }));

          const employers = mapped.filter((u: any) => u.role === 'hire' || u.role === 'both');
          const workers = mapped.filter((u: any) => u.role === 'work');

          setEmployerContacts(employers);
          setWorkerContacts(workers);
          setSupportContacts([]);
          return;
        }

        const admins = await getAdminUsers();
        if (!isMounted) return;
        const mapped = (Array.isArray(admins) ? admins : []).map((admin: any) => ({
          userId: admin._id,
          name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email || 'Support',
          lastMessage: 'Support Team',
          lastTime: '',
        })) as ConversationSummary[];
        setSupportContacts(mapped);
        setEmployerContacts([]);
        setWorkerContacts([]);
      } catch (error) {
        if (isMounted) {
          setSupportContacts([]);
          setEmployerContacts([]);
          setWorkerContacts([]);
        }
      }
    };
    loadSupportContacts();
    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

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
        <h2>{isAdmin ? "Support Inbox" : "Messages"}</h2>
        <div className="messages-sidebar-scroll">
        {!isAdmin && supportContacts.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Support</div>
            <ul className="messages-list">
              {supportContacts.map((contact) => (
                <li
                  key={`support-${contact.userId}`}
                  className={selectedUserId === contact.userId ? 'active' : ''}
                  onClick={() => {
                    setSelectedUserId(contact.userId);
                    upsertConversation(contact.userId, contact.name);
                  }}
                >
                  <div className="messages-list-name">{contact.name}</div>
                  <div className="messages-list-last">{contact.lastMessage}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isAdmin && (employerContacts.length > 0 || workerContacts.length > 0) && (
          <div style={{ marginBottom: '12px' }}>
            {employerContacts.length > 0 && (
              <>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Employers</div>
                <ul className="messages-list">
                  {employerContacts.map((contact) => (
                    <li
                      key={`employer-${contact.userId}`}
                      className={selectedUserId === contact.userId ? 'active' : ''}
                      onClick={() => {
                        setSelectedUserId(contact.userId);
                        upsertConversation(contact.userId, contact.name);
                      }}
                    >
                      <div className="messages-list-name">{contact.name}</div>
                      <div className="messages-list-last">{contact.lastMessage}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {workerContacts.length > 0 && (
              <>
                <div style={{ fontSize: '12px', color: '#6b7280', margin: '10px 0 6px' }}>Workers</div>
                <ul className="messages-list">
                  {workerContacts.map((contact) => (
                    <li
                      key={`worker-${contact.userId}`}
                      className={selectedUserId === contact.userId ? 'active' : ''}
                      onClick={() => {
                        setSelectedUserId(contact.userId);
                        upsertConversation(contact.userId, contact.name);
                      }}
                    >
                      <div className="messages-list-name">{contact.name}</div>
                      <div className="messages-list-last">{contact.lastMessage}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
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
