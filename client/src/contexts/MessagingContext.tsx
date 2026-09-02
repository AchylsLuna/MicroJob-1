import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  getArchivedConversations,
  getBlockedUsers,
  getConversations,
} from '../services/api';

export interface ChatMessage {
  _id: string;
  sender: { _id: string; firstName?: string; lastName?: string };
  receiver: { _id: string; firstName?: string; lastName?: string };
  content: string;
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
  job?: { _id: string; title: string };
  read?: boolean;
  clientMessageId?: string;
  /** Client-only: optimistic send in flight. */
  pending?: boolean;
  /** Client-only: optimistic send failed; tap to remove and retry. */
  failed?: boolean;
}

export interface Contact {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  // Admin/Support accounts are platform staff and expose no public profile.
  otherUserIsStaff?: boolean;
  jobId: string | null;
  jobTitle: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
}

export interface BlockedUser {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/**
 * Thread-level socket events. The provider already folds these into the
 * conversation lists; subscribers use them to update the open thread's message
 * array, which stays owned by whichever surface (page or dock) is showing it.
 */
export type ChatEvent =
  | 'new_message'
  | 'new_message_echo'
  | 'message_edited'
  | 'messages_read'
  | 'peer_typing'
  | 'conversation_deleted'
  | 'connect';

type MessagingContextValue = {
  contacts: Contact[];
  archivedContacts: Contact[];
  blockedUsers: BlockedUser[];
  unreadTotal: number;
  realtimeStatus: RealtimeStatus;
  loading: boolean;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setArchivedContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<BlockedUser[]>>;
  /** Returns the freshly fetched inbox list, so a caller can act on it (e.g.
   *  select a default contact) without racing the state update. */
  refreshConversations: () => Promise<Contact[]>;
  refreshArchived: () => Promise<Contact[]>;
  refreshBlocked: () => Promise<void>;
  /** Zero a thread's unread badge locally, without waiting for a refetch. */
  markConversationRead: (conversationId: string) => void;
  /** Register a socket listener. Returns an unsubscribe. */
  subscribe: (event: ChatEvent, handler: (payload: any) => void) => () => void;
  emit: (event: string, payload: unknown) => void;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export const conversationIdOf = (otherUserId: string, jobId?: string | null) =>
  `${otherUserId}::${jobId || 'general'}`;

const pickArray = <T,>(...candidates: any[]): T[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
};

const getUserName = (user: unknown): string => {
  if (!user || typeof user !== 'object') return '';
  const record = user as { firstName?: string; lastName?: string };
  return `${String(record.firstName || '').trim()} ${String(record.lastName || '').trim()}`.trim();
};

// Matches the resolution order the Messages page used before the socket moved
// here: an explicit socket URL wins, then the dev proxy target, then the API
// base with its trailing /api stripped, and finally the current origin.
const resolveSocketUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
  const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET as string | undefined;
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  const derivedFromApiBase = apiBase && /^https?:\/\//.test(apiBase) ? apiBase.replace(/\/api\/?$/, '') : undefined;
  return explicitSocketUrl || proxyTarget || derivedFromApiBase || window.location.origin;
};

// The safety net for a socket that dropped between the "connect" resync and the
// next one. Slower than a primary poll because the socket does the real work.
const POLL_INTERVAL_MS = 20_000;

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [archivedContacts, setArchivedContacts] = useState<Contact[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const archivedIdsRef = useRef(new Set<string>());
  // Handlers live in a ref keyed by event so the socket effect binds once per
  // user instead of re-binding whenever a consumer mounts or unmounts.
  const listenersRef = useRef(new Map<ChatEvent, Set<(payload: any) => void>>());

  useEffect(() => {
    archivedIdsRef.current = new Set(archivedContacts.map((contact) => contact.conversationId));
  }, [archivedContacts]);

  const refreshConversations = useCallback(async (): Promise<Contact[]> => {
    if (!currentUserId) {
      setContacts([]);
      return [];
    }
    try {
      setLoading(true);
      const response: any = await getConversations();
      const conversations = pickArray<Contact>(
        response?.conversations,
        response?.data?.conversations,
        response?.meta?.conversations,
        response?.data,
        response,
      );
      const inboxOnly = conversations.filter((contact) => !archivedIdsRef.current.has(contact.conversationId));
      setContacts(inboxOnly);
      return inboxOnly;
    } catch {
      // The poll retries; a transient inbox fetch failure must not blank the
      // list the user is already reading.
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const refreshArchived = useCallback(async (): Promise<Contact[]> => {
    if (!currentUserId) {
      setArchivedContacts([]);
      return [];
    }
    try {
      const response: any = await getArchivedConversations();
      const archived = pickArray<Contact>(
        response?.archived,
        response?.data?.archived,
        response?.meta?.archived,
        response?.data,
        response,
      );
      // Set the ref here rather than leaving it to the effect below: the inbox
      // fetch is chained off this promise and would otherwise read a stale set
      // on first load, letting archived threads back into the inbox.
      archivedIdsRef.current = new Set(archived.map((contact) => contact.conversationId));
      setArchivedContacts(archived);
      return archived;
    } catch {
      setArchivedContacts([]);
      return [];
    }
  }, [currentUserId]);

  const refreshBlocked = useCallback(async () => {
    if (!currentUserId) {
      setBlockedUsers([]);
      return;
    }
    try {
      const response: any = await getBlockedUsers();
      setBlockedUsers(pickArray<BlockedUser>(
        response?.blocked,
        response?.data?.blocked,
        response?.meta?.blocked,
        response?.data,
        response,
      ));
    } catch {
      setBlockedUsers([]);
    }
  }, [currentUserId]);

  const emitToListeners = useCallback((event: ChatEvent, payload: any) => {
    const handlers = listenersRef.current.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Messaging listener for "${event}" failed:`, error);
      }
    });
  }, []);

  const subscribe = useCallback((event: ChatEvent, handler: (payload: any) => void) => {
    const handlers = listenersRef.current.get(event) || new Set<(payload: any) => void>();
    handlers.add(handler);
    listenersRef.current.set(event, handlers);
    return () => {
      handlers.delete(handler);
    };
  }, []);

  const emit = useCallback((event: string, payload: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const markConversationRead = useCallback((conversationId: string) => {
    setContacts((prev) => prev.map((contact) => (
      contact.conversationId === conversationId ? { ...contact, unreadCount: 0 } : contact
    )));
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setContacts([]);
      setArchivedContacts([]);
      setBlockedUsers([]);
      return;
    }
    void refreshArchived().then(() => refreshConversations());
    void refreshBlocked();
  }, [currentUserId, refreshArchived, refreshBlocked, refreshConversations]);

  useEffect(() => {
    if (!currentUserId) return;

    const socket = io(resolveSocketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    setRealtimeStatus('connecting');

    const handleConnect = () => {
      setRealtimeStatus('live');
      socket.emit('register', currentUserId);
      void refreshConversations();
      void refreshArchived();
      void refreshBlocked();
      emitToListeners('connect', null);
    };

    // Folds an inbound message into the conversation list: the thread jumps to
    // the top, its preview updates, and its unread count grows unless the
    // message is our own. Whether a thread is *open* is a per-surface concern,
    // so subscribers zero the count themselves via markConversationRead.
    const handleIncomingMessage = (incoming: any) => {
      const message = incoming?.data || incoming;
      const senderId = String(message?.sender?._id || message?.sender || '');
      const receiverId = String(message?.receiver?._id || message?.receiver || '');
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const messageJobId = message?.job?._id || message?.job || null;
      const conversationId = conversationIdOf(otherUserId, messageJobId);
      const isFromSelf = senderId === currentUserId;

      setContacts((prev) => {
        const existing = prev.find((item) => item.conversationId === conversationId);
        const resolvedName = isFromSelf
          ? getUserName(message?.receiver) || existing?.otherUserName || ''
          : getUserName(message?.sender) || existing?.otherUserName || '';
        const updated: Contact = {
          conversationId,
          otherUserId,
          otherUserName: resolvedName,
          otherUserIsStaff: existing?.otherUserIsStaff,
          jobId: messageJobId,
          jobTitle: message?.job?.title || existing?.jobTitle || null,
          lastMessage: message?.content || existing?.lastMessage || '',
          lastMessageAt: message?.createdAt || new Date().toISOString(),
          unreadCount: isFromSelf ? 0 : (existing?.unreadCount || 0) + 1,
        };
        return [updated, ...prev.filter((item) => item.conversationId !== conversationId)];
      });
      setArchivedContacts((prev) => prev.filter((item) => item.conversationId !== conversationId));

      emitToListeners('new_message', message);
    };

    const handleMessageEdited = (incoming: any) => {
      const message = incoming?.data || incoming;
      if (!message?._id) {
        return;
      }
      const senderId = String(message?.sender?._id || message?.sender || '');
      const receiverId = String(message?.receiver?._id || message?.receiver || '');
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const conversationId = conversationIdOf(otherUserId, message?.job?._id || message?.job || null);

      const patchPreview = (prev: Contact[]) => prev.map((contact) => (
        contact.conversationId === conversationId
          ? {
              ...contact,
              lastMessage: message.content,
              lastMessageAt: message.editedAt || message.createdAt || new Date().toISOString(),
            }
          : contact
      ));
      setContacts(patchPreview);
      setArchivedContacts(patchPreview);

      emitToListeners('message_edited', message);
    };

    const handleConversationDeleted = (incoming: any) => {
      const payload = incoming?.data || incoming;
      const otherUserId = String(payload?.otherUserId || '');
      if (!otherUserId) return;
      const conversationId = conversationIdOf(otherUserId, payload?.jobId || null);
      setContacts((current) => current.filter((contact) => contact.conversationId !== conversationId));
      setArchivedContacts((current) => current.filter((contact) => contact.conversationId !== conversationId));
      emitToListeners('conversation_deleted', payload);
    };

    const handleMessagesRead = (incoming: any) => emitToListeners('messages_read', incoming?.data || incoming);
    const handlePeerTyping = (incoming: any) => emitToListeners('peer_typing', incoming?.data || incoming);

    socket.on('connect', handleConnect);
    socket.on('connect_error', () => setRealtimeStatus('offline'));
    socket.on('reconnect_attempt', () => setRealtimeStatus('reconnecting'));
    socket.on('disconnect', () => setRealtimeStatus('reconnecting'));
    socket.on('new_message', handleIncomingMessage);
    socket.on('new_message_echo', handleIncomingMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('messages_read', handleMessagesRead);
    socket.on('peer_typing', handlePeerTyping);
    socket.on('conversation_deleted', handleConversationDeleted);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUserId, emitToListeners, refreshArchived, refreshBlocked, refreshConversations]);

  useEffect(() => {
    if (!currentUserId) return;
    const interval = window.setInterval(() => {
      void refreshConversations();
      void refreshArchived();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [currentUserId, refreshArchived, refreshConversations]);

  // Other surfaces (the bottom-nav badge, the archive/delete flows) announce a
  // change through this window event rather than importing the provider.
  useEffect(() => {
    const handleRefresh = () => {
      void refreshConversations();
    };
    window.addEventListener('messages-refresh', handleRefresh);
    return () => window.removeEventListener('messages-refresh', handleRefresh);
  }, [refreshConversations]);

  const unreadTotal = useMemo(
    () => contacts.reduce((total, contact) => total + (contact.unreadCount || 0), 0),
    [contacts],
  );

  const value = useMemo<MessagingContextValue>(() => ({
    contacts,
    archivedContacts,
    blockedUsers,
    unreadTotal,
    realtimeStatus,
    loading,
    setContacts,
    setArchivedContacts,
    setBlockedUsers,
    refreshConversations,
    refreshArchived,
    refreshBlocked,
    markConversationRead,
    subscribe,
    emit,
  }), [
    contacts,
    archivedContacts,
    blockedUsers,
    unreadTotal,
    realtimeStatus,
    loading,
    refreshConversations,
    refreshArchived,
    refreshBlocked,
    markConversationRead,
    subscribe,
    emit,
  ]);

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) throw new Error('useMessaging must be used within a MessagingProvider');
  return context;
}
