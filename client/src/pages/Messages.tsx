import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import './Messages.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

type UserRef = string | { _id?: string; firstName?: string; lastName?: string };

interface ConversationSummary {
  conversationId: string;
  userId: string;
  name: string;
  jobId: string | null;
  jobTitle: string | null;
  lastMessage: string;
  lastTime: string;
  sortTime: number;
}

interface ChatMessage {
  _id: string;
  sender: UserRef;
  receiver: UserRef;
  content: string;
  createdAt: string;
}

interface MessageLocationState {
  userId?: string;
  name?: string;
  jobId?: string;
  jobTitle?: string;
  prefill?: string;
}

const getTimestamp = (value: unknown): number => {
  if (typeof value !== 'string' || !value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getUserId = (user: UserRef | null | undefined): string => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  return typeof user._id === 'string' ? user._id : '';
};

const getUserName = (user: unknown): string => {
  if (!user || typeof user !== 'object') return '';
  const record = user as { firstName?: unknown; lastName?: unknown };
  const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : '';
  return `${firstName} ${lastName}`.trim();
};

const buildConversationId = (userId: string, jobId: string | null) => `${userId}::${jobId || 'general'}`;

const mapConversations = (rawConversations: unknown): ConversationSummary[] => {
  // New API shape: [{ conversationId, otherUserId, otherUserName, jobId, jobTitle, ... }]
  if (Array.isArray(rawConversations)) {
    return rawConversations
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const userId = typeof record.otherUserId === 'string' ? record.otherUserId : '';
        if (!userId) return null;
        const jobId = typeof record.jobId === 'string' ? record.jobId : null;
        const lastMessageAt = typeof record.lastMessageAt === 'string' ? record.lastMessageAt : '';
        const sortTime = getTimestamp(lastMessageAt);
        const lastTime = sortTime ? new Date(lastMessageAt).toLocaleString() : '';
        return {
          conversationId:
            typeof record.conversationId === 'string' && record.conversationId
              ? record.conversationId
              : buildConversationId(userId, jobId),
          userId,
          name:
            typeof record.otherUserName === 'string' && record.otherUserName.trim()
              ? record.otherUserName.trim()
              : 'User',
          jobId,
          jobTitle: typeof record.jobTitle === 'string' ? record.jobTitle : null,
          lastMessage: typeof record.lastMessage === 'string' ? record.lastMessage : '',
          lastTime,
          sortTime,
        } satisfies ConversationSummary;
      })
      .filter((conversation): conversation is ConversationSummary => Boolean(conversation))
      .sort((a, b) => b.sortTime - a.sortTime);
  }

  // Legacy API shape: { [otherUserId]: Message[] }
  if (rawConversations && typeof rawConversations === 'object') {
    return Object.entries(rawConversations as Record<string, unknown>)
      .map(([userId, rawMessages]) => {
        const messageArray = Array.isArray(rawMessages) ? rawMessages : [];
        const sorted = [...messageArray].sort(
          (a, b) =>
            getTimestamp((b as Record<string, unknown>)?.createdAt) -
            getTimestamp((a as Record<string, unknown>)?.createdAt)
        );
        const latest = sorted[0] as Record<string, unknown> | undefined;
        const lastAt = latest?.createdAt;
        const sortTime = getTimestamp(lastAt);
        const lastTime = sortTime && typeof lastAt === 'string' ? new Date(lastAt).toLocaleString() : '';
        const fallbackName = getUserName(latest?.sender) || getUserName(latest?.receiver) || 'User';

        return {
          conversationId: buildConversationId(userId, null),
          userId,
          name: fallbackName,
          jobId: null,
          jobTitle: null,
          lastMessage: typeof latest?.content === 'string' ? latest.content : '',
          lastTime,
          sortTime,
        } satisfies ConversationSummary;
      })
      .sort((a, b) => b.sortTime - a.sortTime);
  }

  return [];
};

export default function Messages() {
  const location = useLocation();
  const locationState = (location.state as MessageLocationState | null) || null;
  const stateSignatureRef = useRef<string>('');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; firstName?: string; lastName?: string; email?: string }>>([]);
  const [showBlockedPanel, setShowBlockedPanel] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [archivedConvs, setArchivedConvs] = useState<Array<any>>([]);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);

  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      if (!raw) return '';
      const user = JSON.parse(raw) as { id?: string; _id?: string };
      return user.id || user._id || '';
    } catch {
      return '';
    }
  }, []);

  const socketRef = useRef<Socket | null>(null);

  // Helper to build a normalized jobId from a message's job field
  const extractJobId = (jobField: any): string | null => {
    if (!jobField) return null;
    if (typeof jobField === 'string') return jobField;
    if (typeof jobField === 'object') return jobField._id || null;
    return null;
  };

  // Handle an incoming message payload from socket
  const handleIncomingMessage = (payload: any) => {
    if (!payload) return;
    const msg = payload && payload._doc ? payload._doc : payload; // mongoose doc or plain
    const senderId = getUserId(msg.sender);
    const receiverId = getUserId(msg.receiver);
    const jobId = extractJobId(msg.job);
    const otherUserId = senderId === currentUserId ? receiverId : senderId;
    if (!otherUserId) return;

    const convId = buildConversationId(otherUserId, jobId);
    const name = senderId === currentUserId ? getUserName(msg.receiver) || 'User' : getUserName(msg.sender) || 'User';
    const jobTitle = msg.job?.title || null;
    const lastMessage = msg.content || '';
    const lastTime = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
    const sortTime = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();

    setConversations((prev) => {
      const existingIndex = prev.findIndex((c) => c.conversationId === convId);
      const updatedConv = {
        conversationId: convId,
        userId: otherUserId,
        name,
        jobId,
        jobTitle,
        lastMessage,
        lastTime,
        sortTime,
      } as ConversationSummary;

      // Move to top or add
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy.splice(existingIndex, 1);
        return [updatedConv, ...copy];
      }
      return [updatedConv, ...prev];
    });

    // If this conversation is currently open, append message
    if (otherUserId === selectedUserId && (jobId || '') === (selectedJobId || '')) {
      setMessages((prev) => [...prev, { _id: msg._id || String(Date.now()), sender: msg.sender, receiver: msg.receiver, content: msg.content, createdAt: msg.createdAt }]);
    }
  };

  useEffect(() => {
    // determine socket URL: prefer explicit env, else derive from API_BASE or origin
    const socketUrl = (import.meta.env.VITE_SOCKET_URL as string) || (API_BASE && API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/?$/, '') : window.location.origin);
    const socket = io(socketUrl, {
      withCredentials: true,
    });
    socketRef.current = socket;

    const raw = localStorage.getItem('auth_user');
    try {
      const user = raw ? JSON.parse(raw) : null;
      const userId = user?.id || user?._id;
      if (userId) {
        socket.emit('register', userId);
      }
    } catch {
      // ignore
    }

    socket.on('new_message', (payload: any) => {
      handleIncomingMessage(payload);
    });

    socket.on('new_message_echo', (payload: any) => {
      handleIncomingMessage(payload);
    });

    socket.on('user_blocked', (payload: any) => {
      // You were blocked by someone
      const blockerId = payload?.blockerId;
      setInfoMessage(`You were blocked by a user (${blockerId}).`);
      // Optionally remove conversation with that blocker
      if (blockerId) {
        setConversations((prev) => prev.filter((c) => c.userId !== String(blockerId)));
        if (selectedUserId === String(blockerId)) {
          setSelectedUserId(null);
          setSelectedJobId(null);
          setMessages([]);
        }
      }
    });

    socket.on('user_unblocked', (payload: any) => {
      const unblockedBy = payload?.unblockedBy;
      setInfoMessage(`A user (${unblockedBy}) has unblocked you.`);
    });

    return () => {
      try {
        socket.disconnect();
      } catch (e) {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, selectedUserId, selectedJobId]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/messages/conversations`, {
        credentials: 'include',
      });
      const data = (await response.json()) as { conversations?: unknown };
      setConversations(mapConversations(data.conversations));
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/messages/blocked`, { credentials: 'include' });
      if (!resp.ok) return setBlockedUsers([]);
      const data = await resp.json();
      setBlockedUsers(Array.isArray(data.blocked) ? data.blocked : []);
    } catch (err) {
      console.warn('Failed to fetch blocked users', err);
      setBlockedUsers([]);
    }
  }, []);

  const fetchArchivedConversations = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/messages/archived`, { credentials: 'include' });
      if (!resp.ok) return setArchivedConvs([]);
      const data = await resp.json();
      setArchivedConvs(Array.isArray(data.archived) ? data.archived : []);
    } catch (err) {
      console.warn('Failed to fetch archived conversations', err);
      setArchivedConvs([]);
    }
  }, []);

  const unblockUser = async (userId: string) => {
    try {
      await fetch(`${API_BASE}/messages/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: userId }),
      });
      setBlockedUsers((prev) => prev.filter((u) => String(u.id) !== String(userId)));
      setInfoMessage('User unblocked');
    } catch (err) {
      console.warn('Unblock failed', err);
    }
  };

  const fetchMessages = useCallback(async (otherUserId: string, jobId: string | null) => {
    setLoadingMessages(true);
    // do not set a visible error here; failures should silently clear messages
    try {
      const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
      const response = await fetch(`${API_BASE}/messages/conversation/${otherUserId}${query}`, {
        credentials: 'include',
      });
      const data = (await response.json()) as { messages?: unknown };
      const messageList = Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
      setMessages(messageList);

      // Keep unread markers in sync for the active thread.
      await fetch(`${API_BASE}/messages/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ otherUserId, ...(jobId ? { jobId } : {}) }),
      });
    } catch (err) {
      // silence the error from being shown in the UI; log for debugging
      console.warn('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!locationState?.userId) return;
    const jobId = locationState.jobId || null;
    const signature = buildConversationId(locationState.userId, jobId);

    if (stateSignatureRef.current === signature) return;
    stateSignatureRef.current = signature;

    setSelectedUserId(locationState.userId);
    setSelectedJobId(jobId);

    if (locationState.prefill) {
      setInput((prev) => (prev ? prev : locationState.prefill || ''));
    }

    setConversations((prev) => {
      if (prev.some((conv) => conv.conversationId === signature)) {
        return prev;
      }

      return [
        {
          conversationId: signature,
          userId: locationState.userId || '',
          name: locationState.name || 'User',
          jobId,
          jobTitle: locationState.jobTitle || null,
          lastMessage: '',
          lastTime: '',
          sortTime: Date.now(),
        },
        ...prev,
      ];
    });
  }, [locationState]);

  useEffect(() => {
    if (!selectedUserId) return;
    fetchMessages(selectedUserId, selectedJobId);
  }, [fetchMessages, selectedJobId, selectedUserId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const content = input.trim();
    if (!content) return;

    setError(null);
    try {
      const payload: { receiverId: string; content: string; jobId?: string } = {
        receiverId: selectedUserId,
        content,
      };
      if (selectedJobId) payload.jobId = selectedJobId;

      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // try to read server error message
        let msg = 'Failed to send message.';
        try {
          const body = await response.json();
          if (body && body.message) msg = body.message;
        } catch (e) {
          // ignore parse errors
        }
        setError(msg);
        return;
      }

      setInput('');
      await fetchMessages(selectedUserId, selectedJobId);
      await fetchConversations();
    } catch {
      setError('Failed to send message.');
    }
  };

  // Archive conversation for current user
  const archiveConversationAction = async (archive = true) => {
    if (!selectedUserId) return;
    try {
      await fetch(`${API_BASE}/messages/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: selectedUserId, jobId: selectedJobId, archive }),
      });
      // remove from visible conversations when archiving
      if (archive) {
        setConversations((prev) => prev.filter((c) => c.conversationId !== `${selectedUserId}::${selectedJobId || 'general'}`));
        setSelectedUserId(null);
        setSelectedJobId(null);
        setMessages([]);
      } else {
        // if unarchive, simply refetch conversations
        await fetchConversations();
      }
    } catch (err) {
      console.warn('Archive conversation failed', err);
    }
  };

  // Delete conversation for both users
  const deleteConversationAction = async () => {
    if (!selectedUserId) return;
    if (!window.confirm('Delete this conversation for both users? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/messages/conversation`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: selectedUserId, jobId: selectedJobId }),
      });
      setConversations((prev) => prev.filter((c) => c.conversationId !== `${selectedUserId}::${selectedJobId || 'general'}`));
      setSelectedUserId(null);
      setSelectedJobId(null);
      setMessages([]);
      // refresh blocked list
      try { await fetchBlockedUsers(); } catch {}
    } catch (err) {
      console.warn('Delete conversation failed', err);
    }
  };

  // Block the other user
  const blockUserAction = async () => {
    if (!selectedUserId) return;
    if (!window.confirm('Block this user? They will not be able to message you.')) return;
    try {
      await fetch(`${API_BASE}/messages/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: selectedUserId }),
      });
      // remove from UI
      setConversations((prev) => prev.filter((c) => c.conversationId !== `${selectedUserId}::${selectedJobId || 'general'}`));
      setSelectedUserId(null);
      setSelectedJobId(null);
      setMessages([]);
    } catch (err) {
      console.warn('Block user failed', err);
    }
  };

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.userId === selectedUserId &&
          (conversation.jobId || '') === (selectedJobId || '')
      ) || null,
    [conversations, selectedJobId, selectedUserId]
  );

  const hasSelectedConversation = Boolean(selectedUserId);

  return (
    <div className="messages-root h-full">
      <div className="messages-sidebar">
        <h2>Messages</h2>
        <div style={{ padding: '0 32px 12px 32px' }}>
          <button
            onClick={async () => {
              const next = !showBlockedPanel;
              setShowBlockedPanel(next);
              if (next) await fetchBlockedUsers();
            }}
            className="px-3 py-1 rounded-lg bg-gray-100 text-sm text-gray-700"
          >
            Blocked ({blockedUsers.length})
          </button>
          <button
            onClick={async () => {
              const next = !showArchivedPanel;
              setShowArchivedPanel(next);
              if (next) await fetchArchivedConversations();
            }}
            style={{ marginLeft: 8 }}
            className="px-3 py-1 rounded-lg bg-gray-100 text-sm text-gray-700"
          >
            Archived ({archivedConvs.length})
          </button>
        </div>
        {loading ? (
          <div className="messages-loading">Loading...</div>
        ) : (
          <ul className="messages-list">
            {conversations.map((conversation) => (
              <li
                key={conversation.conversationId}
                className={
                  selectedUserId === conversation.userId &&
                  (selectedJobId || '') === (conversation.jobId || '')
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  setSelectedUserId(conversation.userId);
                  setSelectedJobId(conversation.jobId);
                }}
              >
                <div className="messages-list-name">{conversation.name}</div>
                {conversation.jobTitle && <div className="messages-list-job">Job: {conversation.jobTitle}</div>}
                <div className="messages-list-last">{conversation.lastMessage}</div>
                <div className="messages-list-time">{conversation.lastTime}</div>
              </li>
            ))}
            {conversations.length === 0 && <div className="messages-empty">No conversations yet.</div>}
          </ul>
        )}
        {showBlockedPanel && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f4f6' }}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Blocked Users</h3>
            {blockedUsers.length === 0 ? (
              <div className="messages-empty">No blocked users.</div>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-white p-2 rounded-lg">
                    <div>{(u.firstName || '') + ' ' + (u.lastName || '')}</div>
                    <div>
                      <button onClick={() => unblockUser(u.id)} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm">Unblock</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {showArchivedPanel && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f4f6' }}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Archived Conversations</h3>
            {archivedConvs.length === 0 ? (
              <div className="messages-empty">No archived conversations.</div>
            ) : (
              <div className="space-y-2">
                {archivedConvs.map((c: any) => (
                  <div key={c.conversationId} className="flex items-center justify-between bg-white p-2 rounded-lg">
                    <div>
                      <div className="font-semibold">{c.otherUserName || 'User'}</div>
                      {c.jobTitle && <div className="text-xs text-gray-500">Job: {c.jobTitle}</div>}
                      <div className="text-xs text-gray-400">{c.lastMessage}</div>
                    </div>
                    <div>
                      <button onClick={async () => {
                        await archiveConversationAction(false);
                        await fetchArchivedConversations();
                        await fetchConversations();
                      }} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm">Unarchive</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="messages-main">
        {infoMessage && (
          <div style={{ padding: '12px 24px', background: '#fffbeb', color: '#92400e', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>{infoMessage}</div>
              <button onClick={() => setInfoMessage(null)} className="text-sm text-gray-600">Dismiss</button>
            </div>
          </div>
        )}
        {hasSelectedConversation ? (
          <>
            <div className="messages-chat-header">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div className="messages-chat-name">{selectedConversation?.name || locationState?.name || 'User'}</div>
                  {(selectedConversation?.jobTitle || locationState?.jobTitle) && (
                    <div className="messages-chat-job">
                      About job: {selectedConversation?.jobTitle || locationState?.jobTitle}
                    </div>
                  )}
                </div>
                <div style={{display: 'flex', gap: 8}}>
                  <button
                    onClick={() => archiveConversationAction(true)}
                    className="px-3 py-1 rounded-lg bg-gray-100 text-sm text-gray-700"
                    title="Archive conversation"
                  >
                    Archive
                  </button>
                  <button
                    onClick={deleteConversationAction}
                    className="px-3 py-1 rounded-lg bg-red-50 text-sm text-red-700"
                    title="Delete conversation for both users"
                  >
                    Delete
                  </button>
                  <button
                    onClick={blockUserAction}
                    className="px-3 py-1 rounded-lg bg-yellow-50 text-sm text-yellow-700"
                    title="Block user"
                  >
                    Block
                  </button>
                </div>
              </div>
            </div>

            <div className="messages-chat">
              {loadingMessages ? (
                <div className="messages-loading">Loading...</div>
              ) : (
                <ul className="messages-chat-list">
                  {messages.map((message) => {
                    const senderId = getUserId(message.sender);
                    const isMine = currentUserId ? senderId === currentUserId : senderId !== selectedUserId;
                    return (
                      <li key={message._id} className={isMine ? 'my-msg' : 'their-msg'}>
                        <div className="msg-content">{message.content}</div>
                        <div className="msg-time">{new Date(message.createdAt).toLocaleTimeString()}</div>
                      </li>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="messages-empty">No messages yet. Send your inquiry to start this conversation.</div>
                  )}
                </ul>
              )}
            </div>

            <form className="messages-input-row" onSubmit={sendMessage}>
              <input
                className="messages-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a message..."
              />
              <button className="messages-send-btn" type="submit">
                Send
              </button>
            </form>
            {error && <div className="messages-error">{error}</div>}
          </>
        ) : (
          <div className="messages-empty">Select a conversation to start chatting.</div>
        )}
      </div>
    </div>
  );
}
