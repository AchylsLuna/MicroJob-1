import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  Ellipsis,
  MessagesSquare,
  MoreVertical,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ROUTES } from "../../utils/routes";
import { isStaffConversation } from "../../utils/staffConversation";
import { useAuth } from "../../contexts/AuthContext";
import { formatDate, getActiveDateLocale } from "../../lib/formatters";
import {
  getConversations,
  getArchivedConversations,
  getConversationWithUser,
  sendMessage,
  editMessage,
  blockUser,
  archiveConversation,
  deleteConversation,
  markMessagesAsRead,
} from "../../services/api";

// Consecutive messages from the same sender inside this window collapse into
// one avatar/name/time header instead of repeating on every bubble.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
// How long a peer's typing indicator stays up without a fresh "still typing" ping.
const TYPING_STALE_MS = 5000;
// How long after the user stops typing we tell the peer they've stopped.
const TYPING_STOP_DELAY_MS = 2500;

interface Message {
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

interface Contact {
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

const getInitials = (name: string): string => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatTime = (t: TFunction, dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("messages.time.now");
  if (minutes < 60) return t("messages.time.minutesAgo", { count: minutes });
  if (hours < 24) return t("messages.time.hoursAgo", { count: hours });
  if (days < 7) return t("messages.time.daysAgo", { count: days });
  return formatDate(date);
};

const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(getActiveDateLocale(), { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
};

const formatMessageDay = (t: TFunction, dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return t("messages.time.today");

  return formatDate(date, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const pickArray = <T,>(...candidates: any[]): T[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return [];
};

const getUserName = (user: unknown): string => {
  if (!user || typeof user !== "object") return "";
  const record = user as { firstName?: string; lastName?: string };
  const fullName = `${String(record.firstName || "").trim()} ${String(record.lastName || "").trim()}`.trim();
  return fullName;
};

export function Messages() {
  const { t } = useTranslation("worker");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [archivedContacts, setArchivedContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const currentUserId = user?.id || "";
  const listMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const startChatHandledRef = useRef(false);
  const prefilledDraftHandledRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const loadConversationsRef = useRef<() => Promise<void>>(async () => undefined);
  const typingStopTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const peerTypingClearTimeoutRef = useRef<number | null>(null);
  const supportSource = searchParams.get("source") || "";
  const supportStartUserId = supportSource === "support-center" ? (searchParams.get("startUser") || "") : "";

  const supportDisplayNameFor = useCallback((otherUserId: string, fallbackName: string) =>
    supportStartUserId && String(otherUserId) === String(supportStartUserId)
      ? t("messages.adminSupportName")
      : fallbackName, [supportStartUserId, t]);

  useEffect(() => {
    loadArchivedConversations();
    void loadConversationsRef.current();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
    const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET as string | undefined;
    const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
    const derivedFromApiBase = apiBase && /^https?:\/\//.test(apiBase)
      ? apiBase.replace(/\/api\/?$/, "")
      : undefined;
    const socketUrl = explicitSocketUrl || proxyTarget || derivedFromApiBase || window.location.origin;
    const socket = io(socketUrl, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    socket.emit("register", currentUserId);

    const synchronizeAfterConnect = () => {
      void loadConversationsRef.current();
      void loadArchivedConversations();
      if (!selectedContact) return;
      void getConversationWithUser(selectedContact.otherUserId, selectedContact.jobId || undefined)
        .then((response: any) => {
          const synchronized = pickArray<Message>(
            response?.messages,
            response?.data?.messages,
            response?.meta?.messages,
            response?.data,
            response,
          );
          setMessages(synchronized);
        })
        .catch(() => {
          // The polling safety net retries transient reconnect failures.
        });
    };
    socket.on("connect", synchronizeAfterConnect);

    const handleIncomingMessage = (incoming: any) => {
      const message = incoming?.data || incoming;
      const senderId = String(message?.sender?._id || message?.sender || "");
      const receiverId = String(message?.receiver?._id || message?.receiver || "");
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const messageJobId = message?.job?._id || message?.job || null;
      const conversationId = `${otherUserId}::${messageJobId || "general"}`;
      const senderName = getUserName(message?.sender);
      const receiverName = getUserName(message?.receiver);
      const isCurrentConversation = Boolean(
        selectedContact &&
        selectedContact.otherUserId === otherUserId &&
        (selectedContact.jobId || "") === (messageJobId || ""),
      );
      const isFromSelf = senderId === currentUserId;

      setContacts((prev) => {
        const existing = prev.find((item) => item.conversationId === conversationId);
        const resolvedName = isFromSelf
          ? receiverName || existing?.otherUserName || t("messages.userFallback")
          : senderName || existing?.otherUserName || t("messages.userFallback");
        const otherUserName = supportDisplayNameFor(otherUserId, resolvedName);
        const updated: Contact = {
          conversationId,
          otherUserId,
          otherUserName,
          otherUserIsStaff: isStaffConversation(
            { otherUserIsStaff: existing?.otherUserIsStaff, otherUserId },
            supportStartUserId,
          ),
          jobId: messageJobId,
          jobTitle: message?.job?.title || existing?.jobTitle || null,
          lastMessage: message?.content || existing?.lastMessage || "",
          lastMessageAt: message?.createdAt || new Date().toISOString(),
          unreadCount: isFromSelf || isCurrentConversation ? 0 : (existing?.unreadCount || 0) + 1,
        };
        const filtered = prev.filter((item) => item.conversationId !== conversationId);
        return [updated, ...filtered];
      });
      setArchivedContacts((prev) => prev.filter((item) => item.conversationId !== conversationId));

      if (isCurrentConversation) {
        setMessages((prev) => {
          const normalizedId = String(message?._id || "");
          if (normalizedId && prev.some((item) => item._id === normalizedId)) return prev;
          const incomingClientId = message?.clientMessageId ? String(message.clientMessageId) : null;
          if (incomingClientId) {
            const optimisticIndex = prev.findIndex((item) => item.pending && item.clientMessageId === incomingClientId);
            if (optimisticIndex !== -1) {
              const next = [...prev];
              next[optimisticIndex] = message as Message;
              return next;
            }
          }
          return [...prev, message as Message];
        });
        if (!isFromSelf) void markMessagesAsRead(otherUserId, messageJobId || undefined).catch(() => undefined);
        setPeerTyping(false);
      }
    };

    const handleMessageEdited = (incoming: any) => {
      const message = (incoming?.data || incoming) as Message;
      if (!message?._id) return;

      setMessages((prev) =>
        prev.map((item) =>
          item._id === message._id
            ? {
                ...item,
                content: message.content,
                isEdited: true,
                editedAt: message.editedAt || new Date().toISOString(),
              }
            : item
        )
      );

      const senderId = String((message as any)?.sender?._id || (message as any)?.sender || "");
      const receiverId = String((message as any)?.receiver?._id || (message as any)?.receiver || "");
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const messageJobId = (message as any)?.job?._id || (message as any)?.job || null;
      const conversationId = `${otherUserId}::${messageJobId || "general"}`;

      const patchPreview = (prev: Contact[]) =>
        prev.map((contact) =>
          contact.conversationId === conversationId
            ? {
                ...contact,
                lastMessage: message.content,
                lastMessageAt: message.editedAt || message.createdAt || new Date().toISOString(),
              }
            : contact
        );

      setContacts((prev) => patchPreview(prev));
      setArchivedContacts((prev) => patchPreview(prev));
    };

    const handleMessagesRead = (incoming: any) => {
      const payload = incoming?.data || incoming;
      const readerId = String(payload?.readerId || "");
      if (!readerId || !selectedContact || selectedContact.otherUserId !== readerId) return;
      const payloadJobId = payload?.jobId || null;
      if ((selectedContact.jobId || null) !== payloadJobId) return;
      setMessages((prev) =>
        prev.map((item) => (String(item.sender?._id) === currentUserId ? { ...item, read: true } : item)),
      );
    };

    const handlePeerTyping = (incoming: any) => {
      const payload = incoming?.data || incoming;
      const fromUserId = String(payload?.fromUserId || "");
      if (!selectedContact || fromUserId !== selectedContact.otherUserId) return;
      const payloadJobId = payload?.jobId || null;
      if ((selectedContact.jobId || null) !== payloadJobId) return;

      if (peerTypingClearTimeoutRef.current) window.clearTimeout(peerTypingClearTimeoutRef.current);
      if (payload?.isTyping) {
        setPeerTyping(true);
        peerTypingClearTimeoutRef.current = window.setTimeout(() => setPeerTyping(false), TYPING_STALE_MS);
      } else {
        setPeerTyping(false);
      }
    };

    socket.on("new_message", handleIncomingMessage);
    socket.on("new_message_echo", handleIncomingMessage);
    socket.on("message_edited", handleMessageEdited);
    socket.on("messages_read", handleMessagesRead);
    socket.on("peer_typing", handlePeerTyping);

    return () => {
      socket.off("connect", synchronizeAfterConnect);
      socket.off("new_message", handleIncomingMessage);
      socket.off("new_message_echo", handleIncomingMessage);
      socket.off("message_edited", handleMessageEdited);
      socket.off("messages_read", handleMessagesRead);
      socket.off("peer_typing", handlePeerTyping);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, selectedContact, supportDisplayNameFor, supportStartUserId, t]);

  // A single, slower safety net now that the socket does the real-time work —
  // covers a dropped connection between the "connect" resync and the next one.
  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadConversationsRef.current();
      void loadArchivedConversations();
      if (!selectedContact) return;
      getConversationWithUser(selectedContact.otherUserId, selectedContact.jobId || undefined)
        .then((response: any) => {
          const messagesArray = pickArray<Message>(
            response?.messages,
            response?.data?.messages,
            response?.meta?.messages,
            response?.data,
            response,
          );
          setMessages((prev) => {
            const pendingOnly = prev.filter((item) => item.pending || item.failed);
            return pendingOnly.length ? [...messagesArray, ...pendingOnly] : messagesArray;
          });
        })
        .catch(() => {
          // polling fallback only; ignore transient errors
        });
    }, 20000);
    return () => window.clearInterval(interval);
  }, [selectedContact]);

  useEffect(() => {
    // Keep message search local-only (do not persist to URL query string).
    if (searchParams.has("q")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("q");
      setSearchParams(nextParams, { replace: true });
      return;
    }

    const contactId = searchParams.get("contact");
    const startUserId = searchParams.get("startUser");
    const startJobId = searchParams.get("jobId");
    const startName = searchParams.get("startName") || t("messages.employerFallback");
    const source = searchParams.get("source") || "";
    const draft = searchParams.get("draft") || "";
    const isFromJobDetails =
      source === "job-details" ||
      (Boolean(draft) && Boolean(startUserId) && Boolean(startJobId));

    if (contactId && contacts.length > 0 && selectedContact?.conversationId !== contactId) {
      const match = contacts.find((contact) => contact.conversationId === contactId);
      if (match) {
        startChatHandledRef.current = true;
        handleSelectContact(match);
        return;
      }
    }

    if (!startChatHandledRef.current && startUserId) {
      const fallbackConversationId = contactId || `${startUserId}::${startJobId || 'general'}`;
      const fallbackContact: Contact = {
        conversationId: fallbackConversationId,
        otherUserId: startUserId,
        otherUserName: supportDisplayNameFor(startUserId, startName),
        jobId: startJobId || null,
        jobTitle: null,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
      };

      startChatHandledRef.current = true;
      handleSelectContact(fallbackContact);

      if (!contactId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("contact", fallbackConversationId);
        setSearchParams(nextParams);
      }
    }

    if (!prefilledDraftHandledRef.current && draft && isFromJobDetails) {
      setMessageText(draft);
      prefilledDraftHandledRef.current = true;

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("draft");
      nextParams.delete("source");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, contacts, setSearchParams, supportDisplayNameFor, selectedContact?.conversationId, t]);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(event.target as Node)) {
        setShowListMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [messages, prefersReducedMotion]);

  useEffect(() => {
    // Auto-grow the composer up to a cap instead of a fixed 88px block.
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [messageText]);

  useEffect(() => {
    // Reset typing state and any pending timers when the open thread changes.
    typingActiveRef.current = false;
    setPeerTyping(false);
    if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
    if (peerTypingClearTimeoutRef.current) window.clearTimeout(peerTypingClearTimeoutRef.current);
  }, [selectedContact?.conversationId]);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response: any = await getConversations();
      const conversationsArray = pickArray<Contact>(
        response?.conversations,
        response?.data?.conversations,
        response?.meta?.conversations,
        response?.data,
        response
      );
      const namedConversations = conversationsArray.map((contact) => ({
        ...contact,
        otherUserName: supportDisplayNameFor(contact.otherUserId, contact.otherUserName || t("messages.userFallback")),
      }));
      const archivedSet = new Set(archivedContacts.map((contact) => contact.conversationId));
      const inboxOnly = namedConversations.filter((contact) => !archivedSet.has(contact.conversationId));
      setContacts(inboxOnly);

      // Select first contact by default if none selected
      if (inboxOnly.length > 0 && !selectedContact) {
        handleSelectContact(inboxOnly[0]);
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      toast.error(error.message || t("messages.toast.loadConversationsFailed"));
      setContacts([]); // Ensure contacts is set to empty array on error
    } finally {
      setLoading(false);
    }
  }, [archivedContacts, selectedContact, supportDisplayNameFor, t]);
  loadConversationsRef.current = loadConversations;

  const loadArchivedConversations = async () => {
    try {
      const response: any = await getArchivedConversations();
      const archivedArray = pickArray<Contact>(
        response?.archived,
        response?.data?.archived,
        response?.meta?.archived,
        response?.data,
        response
      );
      setArchivedContacts(archivedArray);
    } catch {
      setArchivedContacts([]);
    }
  };

  const canEditMessage = (message: Message) => {
    if (!currentUserId || message.sender._id !== currentUserId) return false;
    const created = new Date(message.createdAt).getTime();
    if (Number.isNaN(created)) return false;
    return Date.now() - created <= 30 * 1000;
  };

  const beginEditMessage = (message: Message) => {
    if (!canEditMessage(message)) {
      toast.error(t("messages.toast.editWindowExpired"));
      return;
    }
    setEditingMessageId(message._id);
    setEditingText(message.content);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEditMessage = async () => {
    if (!editingMessageId) return;
    const nextContent = editingText.trim();
    if (!nextContent) {
      toast.error(t("messages.toast.emptyMessage"));
      return;
    }

    try {
      setIsEditingSaving(true);
      const response: any = await editMessage(editingMessageId, nextContent);
      const updated = response?.data || response?.message || response;

      setMessages((prev) =>
        prev.map((item) =>
          item._id === editingMessageId
            ? {
                ...item,
                content: updated?.content || nextContent,
                isEdited: true,
                editedAt: updated?.editedAt || new Date().toISOString(),
              }
            : item
        )
      );

      setEditingMessageId(null);
      setEditingText("");
      toast.success(t("messages.toast.messageUpdated"));
    } catch (error: any) {
      toast.error(error?.message || t("messages.toast.editFailed"));
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setShowMoreMenu(false);
    setContacts((prev) => prev.map((c) => (c.conversationId === contact.conversationId ? { ...c, unreadCount: 0 } : c)));

    try {
      const response: any = await getConversationWithUser(contact.otherUserId, contact.jobId || undefined);
      const messagesArray = pickArray<Message>(
        response?.messages,
        response?.data?.messages,
        response?.meta?.messages,
        response?.data,
        response
      );
      setMessages(messagesArray);

      // Mark messages as read
      if (messagesArray.length > 0) {
        try {
          await markMessagesAsRead(contact.otherUserId, contact.jobId || undefined);
          window.dispatchEvent(new Event("messages-refresh"));
        } catch (e) {
          // Ignore marking errors
        }
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error(error.message || t("messages.toast.loadMessagesFailed"));
      setMessages([]);
    }
  };

  const emitTyping = (isTyping: boolean) => {
    if (!selectedContact || !socketRef.current) return;
    socketRef.current.emit('typing', {
      toUserId: selectedContact.otherUserId,
      jobId: selectedContact.jobId || null,
      isTyping,
    });
  };

  const handleComposerChange = (value: string) => {
    setMessageText(value);
    if (!selectedContact) return;

    if (value.trim()) {
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        emitTyping(true);
      }
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = window.setTimeout(() => {
        typingActiveRef.current = false;
        emitTyping(false);
      }, TYPING_STOP_DELAY_MS);
    } else if (typingActiveRef.current) {
      typingActiveRef.current = false;
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      emitTyping(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !selectedContact) return;

    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      emitTyping(false);
    }

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: Message = {
      _id: `pending-${clientMessageId}`,
      sender: { _id: currentUserId },
      receiver: { _id: selectedContact.otherUserId },
      content: trimmed,
      createdAt: new Date().toISOString(),
      clientMessageId,
      pending: true,
      job: selectedContact.jobId ? { _id: selectedContact.jobId, title: selectedContact.jobTitle || "" } : undefined,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText("");

    try {
      setSending(true);
      await sendMessage({
        receiverId: selectedContact.otherUserId,
        content: trimmed,
        jobId: selectedContact.jobId || undefined,
        clientMessageId,
      });
      // Reconciliation happens via the "new_message_echo" socket event
      // matching this clientMessageId (see handleIncomingMessage above); the
      // 20s polling safety net covers a dropped socket.
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((item) => (item.clientMessageId === clientMessageId ? { ...item, pending: false, failed: true } : item)),
      );
      toast.error(error.message || t("messages.toast.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const retryFailedMessage = (message: Message) => {
    setMessages((prev) => prev.filter((item) => item._id !== message._id));
    setMessageText(message.content);
    composerRef.current?.focus();
  };

  const handleBlockUser = async () => {
    if (!selectedContact) return;

    if (!confirm(t("messages.confirm.blockUser", { name: selectedContact.otherUserName }))) {
      return;
    }

    try {
      await blockUser(selectedContact.otherUserId);
      toast.success(t("messages.toast.blockedSuccess", { name: selectedContact.otherUserName }));
      setShowMoreMenu(false);

      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || t("messages.toast.blockFailed"));
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedContact) return;

    try {
      await archiveConversation(selectedContact.otherUserId, selectedContact.jobId || undefined);
      toast.success(t("messages.toast.archiveSuccess"));
      setShowMoreMenu(false);

      const archivedConversationId = `${selectedContact.otherUserId}::${selectedContact.jobId || "general"}`;
      setContacts((prev) => prev.filter((contact) => contact.conversationId !== archivedConversationId));

      await loadArchivedConversations();

      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || t("messages.toast.archiveFailed"));
    }
  };

  const handleUnarchiveConversation = async () => {
    if (!selectedContact) return;

    try {
      await archiveConversation(selectedContact.otherUserId, selectedContact.jobId || undefined, false);
      toast.success(t("messages.toast.unarchiveSuccess"));
      setShowMoreMenu(false);

      const conversationId = `${selectedContact.otherUserId}::${selectedContact.jobId || "general"}`;
      setArchivedContacts((prev) => prev.filter((contact) => contact.conversationId !== conversationId));
      await loadConversations();
      await loadArchivedConversations();
      setShowArchived(false);
    } catch (error: any) {
      toast.error(error.message || t("messages.toast.unarchiveFailed"));
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedContact) return;

    if (!confirm(t("messages.confirm.removeConversation", { name: selectedContact.otherUserName }))) {
      return;
    }

    try {
      await deleteConversation(selectedContact.otherUserId, selectedContact.jobId || undefined);
      toast.success(t("messages.toast.deleteSuccess"));
      setShowMoreMenu(false);

      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || t("messages.toast.deleteFailed"));
    }
  };

  const toggleArchiveMode = async () => {
    const next = !showArchived;
    setShowArchived(next);
    setShowListMenu(false);
    if (next) {
      await loadArchivedConversations();
    }
    setSelectedContact(null);
    setMessages([]);
    setShowMoreMenu(false);
  };

  const canViewSelectedProfile =
    Boolean(selectedContact?.otherUserId) && !isStaffConversation(selectedContact, supportStartUserId);

  const handleViewProfile = () => {
    if (!selectedContact?.otherUserId) return;
    // Admin/Support has no public profile, so never navigate there.
    if (!canViewSelectedProfile) return;
    setShowMoreMenu(false);
    navigate(`${ROUTES.publicProfile(selectedContact.otherUserId)}?viewAs=worker`);
  };

  // Ensure contacts is always an array before filtering
  const archivedSet = useMemo(
    () => new Set(archivedContacts.map((contact) => contact.conversationId)),
    [archivedContacts],
  );
  const contactsArray = useMemo(
    () =>
      Array.isArray(showArchived ? archivedContacts : contacts)
        ? showArchived
          ? archivedContacts
          : contacts.filter((contact) => !archivedSet.has(contact.conversationId))
        : [],
    [archivedContacts, archivedSet, contacts, showArchived],
  );
  const canInjectSelectedContact =
    selectedContact &&
    !contactsArray.some((contact) => contact.conversationId === selectedContact.conversationId) &&
    (showArchived ? archivedSet.has(selectedContact.conversationId) : !archivedSet.has(selectedContact.conversationId));
  const effectiveContacts = useMemo(
    () => (canInjectSelectedContact ? [selectedContact as Contact, ...contactsArray] : contactsArray),
    [canInjectSelectedContact, contactsArray, selectedContact],
  );

  const unreadTotal = useMemo(
    () => contacts.reduce((sum, contact) => sum + (contact.unreadCount || 0), 0),
    [contacts],
  );

  const filteredContacts = useMemo(
    () =>
      effectiveContacts
        .filter(
          (contact) =>
            contact.otherUserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (contact.jobTitle && contact.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
          const aTime = new Date(a.lastMessageAt).getTime() || 0;
          const bTime = new Date(b.lastMessageAt).getTime() || 0;
          return bTime - aTime;
        }),
    [effectiveContacts, searchQuery]
  );

  const orderedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime() || 0;
        const bTime = new Date(b.createdAt).getTime() || 0;
        return aTime - bTime;
      }),
    [messages]
  );

  const lastOwnMessageId = useMemo(() => {
    for (let i = orderedMessages.length - 1; i >= 0; i -= 1) {
      if (currentUserId && orderedMessages[i].sender._id === currentUserId && !orderedMessages[i].pending) {
        return orderedMessages[i]._id;
      }
    }
    return null;
  }, [orderedMessages, currentUserId]);

  const messageRows = useMemo(() => {
    const rows: Array<
      | { type: "divider"; label: string }
      | { type: "message"; message: Message; showMeta: boolean }
    > = [];
    let previousDay = "";
    let previousMessage: Message | null = null;

    orderedMessages.forEach((message) => {
      const currentDay = new Date(message.createdAt).toDateString();
      if (currentDay !== previousDay) {
        rows.push({ type: "divider", label: formatMessageDay(t, message.createdAt) });
        previousDay = currentDay;
        previousMessage = null;
      }

      const sameSender = previousMessage?.sender._id === message.sender._id;
      const withinWindow =
        previousMessage != null &&
        Math.abs(new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime()) < GROUP_WINDOW_MS;
      rows.push({ type: "message", message, showMeta: !(sameSender && withinWindow) });
      previousMessage = message;
    });

    return rows;
  }, [orderedMessages, t]);

  if (loading) {
    return (
      <div className="mx-auto h-[calc(100dvh-120px)] min-h-[28rem] max-w-[1341px] pt-1 lg:h-[calc(100dvh-160px)]">
        <div className="flex h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex w-full flex-col border-r border-slate-100 md:w-[34%] md:min-w-[320px] md:max-w-[460px]">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="h-7 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-11 w-full animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1C4D8D] border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto h-[calc(100dvh-120px)] min-h-[28rem] max-w-[1341px] pt-1 lg:h-[calc(100dvh-160px)]">
      <div className="flex h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col border-r border-slate-100 bg-white md:w-[34%] md:min-w-[320px] md:max-w-[460px]`}>
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="ui-page-title text-[22px]">{t("messages.title")}</h1>
                {unreadTotal > 0 ? (
                  <span className="rounded-full bg-[#1C4D8D] px-2.5 py-0.5 text-[12px] font-semibold text-white">
                    {unreadTotal}
                  </span>
                ) : null}
              </div>
              <div className="relative" ref={listMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowListMenu((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  title={t("messages.listOptionsLabel")}
                  aria-label={t("messages.listOptionsLabel")}
                  aria-expanded={showListMenu}
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {showListMenu ? (
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
                    >
                      <button
                        type="button"
                        onClick={toggleArchiveMode}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                      >
                        <Archive className="h-4 w-4" />
                        {showArchived ? t("messages.backToInbox") : t("messages.viewArchived")}
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t("messages.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("messages.searchAria")}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {filteredContacts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <MessagesSquare className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-[15px] font-medium text-slate-500">
                  {showArchived ? t("messages.emptyArchived") : t("messages.emptyInbox")}
                </p>
              </div>
            ) : (
              filteredContacts.map((contact, index) => {
                const isActive = selectedContact?.conversationId === contact.conversationId;
                const hasUnread = (contact.unreadCount || 0) > 0;
                return (
                  <motion.button
                    key={contact.conversationId}
                    type="button"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.2 }}
                    onClick={() => {
                      handleSelectContact(contact);
                      setShowListMenu(false);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set("contact", contact.conversationId);
                      setSearchParams(nextParams);
                    }}
                    className={`w-full border-b border-slate-50 px-4 py-4 text-left transition hover:bg-slate-50 ${
                      isActive ? "bg-[#EAF2FD]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-4 h-2 w-2 flex-shrink-0 rounded-full ${hasUnread ? "bg-[#1C4D8D]" : ""}`} />
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-[14px] font-bold text-white">
                        {getInitials(contact.otherUserName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`truncate text-[15px] leading-tight text-slate-900 ${hasUnread ? "font-bold" : "font-semibold"}`}>
                            {contact.otherUserName}
                          </p>
                          <span className="whitespace-nowrap text-[12px] text-slate-400">
                            {formatTime(t, contact.lastMessageAt)}
                          </span>
                        </div>
                        {contact.jobTitle ? (
                          <p className="mt-0.5 truncate text-[12px] text-slate-400">{t("messages.reJob", { jobTitle: contact.jobTitle })}</p>
                        ) : null}
                        <p className={`mt-1 line-clamp-2 text-[13px] ${hasUnread ? "font-medium text-slate-700" : "text-slate-500"}`}>
                          {contact.lastMessage || t("messages.noMessagesPreview")}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        <div className={`${selectedContact ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#F9FAFC]`}>
          {!selectedContact ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <MessagesSquare className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-[15px] font-medium text-slate-500">{t("messages.noConversationSelected")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContact(null);
                      setMessages([]);
                      setShowMoreMenu(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:hidden"
                    title={t("messages.back")}
                    aria-label={t("messages.backAria")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C4D8D] text-[14px] font-bold text-white">
                    {getInitials(selectedContact.otherUserName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-slate-900">{selectedContact.otherUserName}</p>
                    {peerTyping ? (
                      <p className="text-[13px] font-medium text-[#1C4D8D]">{t("messages.typing")}</p>
                    ) : selectedContact.jobTitle ? (
                      <p className="truncate text-[13px] text-slate-400">{t("messages.reJob", { jobTitle: selectedContact.jobTitle })}</p>
                    ) : null}
                  </div>
                </div>

                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    title={t("messages.moreOptions")}
                    aria-label={t("messages.moreOptionsAria")}
                    aria-expanded={showMoreMenu}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {showMoreMenu ? (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                        className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
                      >
                        {showArchived ? (
                          <button
                            type="button"
                            onClick={handleUnarchiveConversation}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                          >
                            <Archive className="h-4 w-4" />
                            {t("messages.unarchive")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleArchiveConversation}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                          >
                            <Archive className="h-4 w-4" />
                            {t("messages.archive")}
                          </button>
                        )}
                        {canViewSelectedProfile ? (
                          <button
                            type="button"
                            onClick={handleViewProfile}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                          >
                            {t("messages.viewProfile")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleBlockUser}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-red-600 hover:bg-red-50"
                        >
                          <Ban className="h-4 w-4" />
                          {t("messages.blockUser")}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteConversation}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("messages.deleteConversation")}
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFD] px-5 py-5">
                {orderedMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                      <MessagesSquare className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-[14px] font-medium text-slate-500">{t("messages.noMessagesYet")}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {messageRows.map((row, index) => {
                      if (row.type === "divider") {
                        return (
                          <div key={`divider-${index}`} className="py-2">
                            <div className="mx-auto w-full max-w-[420px] rounded-full border border-slate-200 bg-white px-3 py-1 text-center text-[12px] font-medium text-slate-500">
                              {row.label}
                            </div>
                          </div>
                        );
                      }

                      const message = row.message;
                      const isOwn = Boolean(currentUserId && message.sender._id === currentUserId);
                      const isEditing = editingMessageId === message._id;
                      const isLastOwn = message._id === lastOwnMessageId;

                      return (
                        <motion.div
                          key={message._id || `message-${index}`}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"} ${row.showMeta ? "mt-3" : "mt-0.5"}`}
                        >
                          {!isOwn ? (
                            <div className="w-10 shrink-0">
                              {row.showMeta ? (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C4D8D] text-[12px] font-bold text-white">
                                  {getInitials(selectedContact.otherUserName)}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className={`flex max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                            {row.showMeta ? (
                              <div className={`mb-1 flex items-center gap-2 text-[12px] text-slate-400 ${isOwn ? "" : ""}`}>
                                {!isOwn ? <span className="font-semibold text-slate-700">{selectedContact.otherUserName}</span> : null}
                                <span>{formatMessageTime(message.createdAt)}</span>
                              </div>
                            ) : null}
                            <button
                              type="button"
                              disabled={!message.failed}
                              onClick={() => message.failed && retryFailedMessage(message)}
                              className={`rounded-2xl px-4 py-3 text-left transition ${
                                isOwn
                                  ? message.failed
                                    ? "border border-red-300 bg-red-50 text-red-700"
                                    : "bg-[#1C4D8D] text-white"
                                  : "border border-slate-200 bg-white text-slate-900"
                              } ${message.pending ? "opacity-60" : ""} ${message.failed ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {isEditing ? (
                                // The failed-only retry handler above is disabled whenever isEditing is
                                // true (edit only applies to persisted, non-failed messages), so clicks
                                // inside here never reach it — no stopPropagation needed.
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900"
                                    disabled={isEditingSaving}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditMessage}
                                      className="rounded bg-slate-200 px-2 py-1 text-[12px] text-slate-700"
                                      disabled={isEditingSaving}
                                    >
                                      {t("messages.editing.cancel")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveEditMessage}
                                      className="rounded bg-[#1C4D8D] px-2 py-1 text-[12px] text-white"
                                      disabled={isEditingSaving}
                                    >
                                      {t("messages.editing.save")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[14px] leading-relaxed">{message.content}</p>
                              )}
                            </button>
                            <div className={`mt-1 flex items-center gap-2 text-[11px] text-slate-400 ${isOwn ? "justify-end" : "justify-start"}`}>
                              {message.failed ? (
                                <span className="font-medium text-red-600">{t("messages.failedToSend")}</span>
                              ) : message.pending ? (
                                <span>{t("messages.sending")}</span>
                              ) : (
                                <>
                                  {message.isEdited ? <span>{t("messages.edited")}</span> : null}
                                  {isOwn && !isEditing && canEditMessage(message) ? (
                                    <button
                                      type="button"
                                      onClick={() => beginEditMessage(message)}
                                      className="font-medium text-[#1C4D8D] hover:underline"
                                    >
                                      {t("messages.edit")}
                                    </button>
                                  ) : null}
                                  {isOwn && isLastOwn ? (
                                    message.read ? (
                                      <span className="flex items-center gap-0.5 text-[#1C4D8D]">
                                        <CheckCheck className="h-3.5 w-3.5" /> {t("messages.read")}
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5">
                                        <Check className="h-3.5 w-3.5" /> {t("messages.sent")}
                                      </span>
                                    )
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 bg-white px-5 py-4">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={composerRef}
                    placeholder={t("messages.composerPlaceholder")}
                    value={messageText}
                    onChange={(e) => handleComposerChange(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!sending) {
                          handleSendMessage();
                        }
                      }
                    }}
                    disabled={sending}
                    maxLength={4000}
                    rows={1}
                    aria-label={t("messages.composerAria")}
                    className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    aria-label={t("messages.sendAria")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
