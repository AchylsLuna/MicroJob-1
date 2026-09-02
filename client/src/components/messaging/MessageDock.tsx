import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronLeft, MessagesSquare, Send } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useMessaging, conversationIdOf, type Contact, type ChatMessage } from "../../contexts/MessagingContext";
import { getConversationWithUser, markMessagesAsRead, sendMessage } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";
import { formatDate } from "../../lib/formatters";

type DockView = "collapsed" | "list" | "thread";

// Persists only whether the dock is open, not which thread — a stale thread
// selection surviving a hard reload would be more confusing than useful.
const OPEN_STORAGE_KEY = "microjobs-messaging-dock-open";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

function formatRelativeTime(t: TFunction, dateString: string): string {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t("messages.time.now");
  if (minutes < 60) return t("messages.time.minutesAgo", { count: minutes });
  if (hours < 24) return t("messages.time.hoursAgo", { count: hours });
  if (days < 7) return t("messages.time.daysAgo", { count: days });
  return formatDate(date);
}

const pickArray = <T,>(...candidates: any[]): T[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
};

/**
 * A LinkedIn-style "chat heads" dock: a collapsed bar on every authenticated
 * page that expands to a conversation list and, from there, into a single
 * open thread — all without navigating away from whatever the worker or
 * employer is doing. It reads the shared connection from MessagingContext
 * (never opens its own socket) and intentionally supports only read + reply;
 * editing, archiving, blocking, and deleting stay page-only features of the
 * full /messages route, one tap away via "Open full view".
 */
export function MessageDock() {
  const { t } = useTranslation("worker");
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { contacts, unreadTotal, subscribe, emit, markConversationRead } = useMessaging();

  const [view, setView] = useState<DockView>("collapsed");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const selectedContactRef = useRef<Contact | null>(null);
  const selectionRequestRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingActiveRef = useRef(false);
  const typingStopTimeoutRef = useRef<number | null>(null);
  // True only while the open thread is actually on screen. The socket
  // subscription below is registered before this component's early return and
  // keeps a selected thread across a collapse, so without this guard a dock
  // that is collapsed — or hidden because the full Messages page is open —
  // would silently mark arriving messages as read and the user would never
  // see them.
  const threadVisibleRef = useRef(false);
  const currentUserId = user?.id || "";

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    if (window.localStorage.getItem(OPEN_STORAGE_KEY) === "1") setView("list");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPEN_STORAGE_KEY, view === "collapsed" ? "0" : "1");
  }, [view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [messages, prefersReducedMotion]);

  const normalizedRole = String(user?.role || "").toLowerCase();
  const isEmployerView =
    user?.accountType === "employer" ||
    normalizedRole === "employer" ||
    normalizedRole === "doctor" ||
    normalizedRole === "hire";
  const isAdminView = normalizedRole === "admin" || normalizedRole === "superadmin";
  const fullMessagesRoute = isAdminView
    ? ROUTES.admin.messages
    : isEmployerView
      ? ROUTES.employer.messages
      : ROUTES.worker.messages;

  // The full /messages page already gives this exact experience full-screen;
  // stacking the dock on top of it would just duplicate the same thread.
  const isOnMessagesPage = ([
    ROUTES.worker.messages,
    ROUTES.employer.messages,
    ROUTES.admin.messages,
    ROUTES.doctor.messages,
  ] as string[]).includes(location.pathname);

  useEffect(() => {
    threadVisibleRef.current = view === "thread" && !isOnMessagesPage;
  }, [view, isOnMessagesPage]);

  const openThread = useCallback(async (contact: Contact) => {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    selectedContactRef.current = contact;
    setSelectedContact(contact);
    setView("thread");
    markConversationRead(contact.conversationId);

    try {
      const response: any = await getConversationWithUser(contact.otherUserId, contact.jobId || undefined);
      const messagesArray = pickArray<ChatMessage>(
        response?.messages,
        response?.data?.messages,
        response?.meta?.messages,
        response?.data,
        response,
      );
      if (selectionRequestRef.current !== requestId) return;
      setMessages(messagesArray);
      if (messagesArray.length > 0) {
        await markMessagesAsRead(contact.otherUserId, contact.jobId || undefined).catch(() => undefined);
      }
    } catch {
      if (selectionRequestRef.current === requestId) setMessages([]);
    }
  }, [markConversationRead]);

  const closeThread = useCallback(() => {
    selectedContactRef.current = null;
    setSelectedContact(null);
    setMessages([]);
    setMessageText("");
    typingActiveRef.current = false;
    if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
    setView("list");
  }, []);

  const emitTyping = useCallback((isTyping: boolean) => {
    const active = selectedContactRef.current;
    if (!active) return;
    emit("typing", { toUserId: active.otherUserId, jobId: active.jobId || null, isTyping });
  }, [emit]);

  const handleComposerChange = useCallback((value: string) => {
    setMessageText(value);
    if (value.trim()) {
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        emitTyping(true);
      }
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = window.setTimeout(() => {
        typingActiveRef.current = false;
        emitTyping(false);
      }, 2500);
    } else if (typingActiveRef.current) {
      typingActiveRef.current = false;
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      emitTyping(false);
    }
  }, [emitTyping]);

  const handleSend = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !selectedContact || sending) return;

    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      if (typingStopTimeoutRef.current) window.clearTimeout(typingStopTimeoutRef.current);
      emitTyping(false);
    }

    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      _id: `pending-${clientMessageId}`,
      sender: { _id: currentUserId },
      receiver: { _id: selectedContact.otherUserId },
      content: trimmed,
      createdAt: new Date().toISOString(),
      clientMessageId,
      pending: true,
      job: selectedContact.jobId ? { _id: selectedContact.jobId, title: selectedContact.jobTitle || "" } : undefined,
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");

    try {
      setSending(true);
      const response: any = await sendMessage({
        receiverId: selectedContact.otherUserId,
        content: trimmed,
        jobId: selectedContact.jobId || undefined,
        clientMessageId,
      });
      const delivered = response?.data;
      if (delivered?._id) {
        setMessages((prev) => prev.map((item) => (item.clientMessageId === clientMessageId ? (delivered as ChatMessage) : item)));
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((item) => (item.clientMessageId === clientMessageId ? { ...item, pending: false, failed: true } : item)),
      );
      toast.error(error?.message || t("messages.toast.sendFailed"));
    } finally {
      setSending(false);
    }
  }, [messageText, selectedContact, sending, currentUserId, t, emitTyping]);

  // Reacts to the shared socket only for whatever thread is currently open
  // here — the conversation list itself is already kept in sync by the
  // provider, same as the full Messages page.
  useEffect(() => {
    const handleIncoming = (message: any) => {
      const senderId = String(message?.sender?._id || message?.sender || "");
      const receiverId = String(message?.receiver?._id || message?.receiver || "");
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const messageJobId = message?.job?._id || message?.job || null;
      const active = selectedContactRef.current;
      const isCurrent = Boolean(
        active && active.otherUserId === otherUserId && (active.jobId || "") === (messageJobId || ""),
      );
      if (!isCurrent) return;

      setMessages((prev) => {
        const normalizedId = String(message?._id || "");
        if (normalizedId && prev.some((item) => item._id === normalizedId)) return prev;
        const incomingClientId = message?.clientMessageId ? String(message.clientMessageId) : null;
        if (incomingClientId) {
          const optimisticIndex = prev.findIndex((item) => item.pending && item.clientMessageId === incomingClientId);
          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = message as ChatMessage;
            return next;
          }
        }
        return [...prev, message as ChatMessage];
      });
      const isFromSelf = senderId === currentUserId;
      // Only claim the message as read when the thread is genuinely on screen.
      // The provider counts every inbound message as unread, so when the dock
      // is collapsed or hidden we deliberately leave the badge alone.
      if (!isFromSelf && threadVisibleRef.current) {
        markConversationRead(active!.conversationId);
        void markMessagesAsRead(otherUserId, messageJobId || undefined).catch(() => undefined);
      }
      setPeerTyping(false);
    };

    const handleEdited = (message: any) => {
      if (!message?._id) return;
      setMessages((prev) =>
        prev.map((item) =>
          item._id === message._id
            ? { ...item, content: message.content, isEdited: true, editedAt: message.editedAt || new Date().toISOString() }
            : item,
        ),
      );
    };

    const handleRead = (payload: any) => {
      const readerId = String(payload?.readerId || "");
      const active = selectedContactRef.current;
      if (!readerId || !active || active.otherUserId !== readerId) return;
      if ((active.jobId || null) !== (payload?.jobId || null)) return;
      setMessages((prev) => prev.map((item) => (String(item.sender?._id) === currentUserId ? { ...item, read: true } : item)));
    };

    const handleTyping = (payload: any) => {
      const fromUserId = String(payload?.fromUserId || "");
      const active = selectedContactRef.current;
      if (!active || fromUserId !== active.otherUserId) return;
      if ((active.jobId || null) !== (payload?.jobId || null)) return;
      setPeerTyping(Boolean(payload?.isTyping));
    };

    const handleDeleted = (payload: any) => {
      const otherUserId = String(payload?.otherUserId || "");
      if (!otherUserId) return;
      const conversationId = conversationIdOf(otherUserId, payload?.jobId || null);
      if (selectedContactRef.current?.conversationId === conversationId) closeThread();
    };

    const unsubscribers = [
      subscribe("new_message", handleIncoming),
      subscribe("new_message_echo", handleIncoming),
      subscribe("message_edited", handleEdited),
      subscribe("messages_read", handleRead),
      subscribe("peer_typing", handleTyping),
      subscribe("conversation_deleted", handleDeleted),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [subscribe, currentUserId, closeThread, markConversationRead]);

  if (!user || isOnMessagesPage) return null;

  const isExpanded = view !== "collapsed";

  const panelBody = view === "thread" && selectedContact ? (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={closeThread}
          aria-label={t("messages.dock.backAria")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-[12px] font-bold text-white">
          {getInitials(selectedContact.otherUserName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-900">{selectedContact.otherUserName}</p>
          {peerTyping ? (
            <p className="text-[12px] font-medium text-[#1C4D8D]">{t("messages.typing")}</p>
          ) : selectedContact.jobTitle ? (
            <p className="truncate text-[12px] text-slate-400">{t("messages.reJob", { jobTitle: selectedContact.jobTitle })}</p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFD] px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[13px] text-slate-400">
            {t("messages.noMessagesYet")}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const isOwn = Boolean(currentUserId && message.sender._id === currentUserId);
              return (
                <div key={message._id || `message-${index}`} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      isOwn
                        ? message.failed
                          ? "border border-red-300 bg-red-50 text-red-700"
                          : "bg-[#1C4D8D] text-white"
                        : "border border-slate-200 bg-white text-slate-900"
                    } ${message.pending ? "opacity-60" : ""}`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={messageText}
            onChange={(event) => handleComposerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!sending) void handleSend();
              }
            }}
            placeholder={t("messages.dock.composerPlaceholder")}
            rows={1}
            disabled={sending}
            aria-label={t("messages.composerAria")}
            className="min-h-[40px] max-h-24 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 outline-none transition focus:border-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]/20 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!messageText.trim() || sending}
            aria-label={t("messages.sendAria")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  ) : (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-[15px] font-bold text-slate-900">{t("messages.dock.title")}</p>
        <button
          type="button"
          onClick={() => setView("collapsed")}
          aria-label={t("messages.dock.collapseAria")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MessagesSquare className="h-6 w-6 text-slate-300" />
            <p className="text-[13px] text-slate-400">{t("messages.dock.emptyInbox")}</p>
          </div>
        ) : (
          contacts.map((contact) => {
            const hasUnread = (contact.unreadCount || 0) > 0;
            return (
              <button
                key={contact.conversationId}
                type="button"
                onClick={() => void openThread(contact)}
                className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-[12px] font-bold text-white">
                  {getInitials(contact.otherUserName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[13px] leading-tight text-slate-900 ${hasUnread ? "font-bold" : "font-semibold"}`}>
                      {contact.otherUserName}
                    </p>
                    <span className="whitespace-nowrap text-[11px] text-slate-400">{formatRelativeTime(t, contact.lastMessageAt)}</span>
                  </div>
                  <p className={`mt-0.5 line-clamp-1 text-[12px] ${hasUnread ? "font-medium text-slate-700" : "text-slate-500"}`}>
                    {contact.lastMessage || t("messages.noMessagesPreview")}
                  </p>
                </div>
                {hasUnread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1C4D8D]" /> : null}
              </button>
            );
          })
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate(fullMessagesRoute)}
        className="border-t border-slate-100 px-4 py-3 text-center text-[13px] font-semibold text-[#1C4D8D] transition hover:bg-slate-50"
      >
        {t("messages.dock.openFullView")}
      </button>
    </>
  );

  return (
    <>
      {/* Collapsed trigger — a floating button above the mobile bottom nav,
          a docked bar flush with the viewport edge on desktop. */}
      <button
        type="button"
        onClick={() => setView(isExpanded ? "collapsed" : "list")}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t("messages.dock.collapseAria") : t("messages.dock.expandAria")}
        className={`fixed bottom-24 right-4 z-[45] flex items-center gap-2 rounded-full bg-[#1C4D8D] px-4 py-3 text-white shadow-[0_10px_28px_rgba(28,77,141,0.35)] transition hover:opacity-95 lg:bottom-0 lg:right-6 lg:rounded-b-none lg:rounded-t-2xl lg:px-5 lg:py-3 lg:shadow-[0_-6px_20px_rgba(15,23,42,0.14)] ${
          isExpanded ? "hidden lg:flex" : "flex"
        }`}
      >
        <MessagesSquare className="h-4 w-4" />
        <span className="hidden text-[13px] font-semibold sm:inline">{t("messages.dock.title")}</span>
        {unreadTotal > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#1C4D8D]">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </button>

      {/* Desktop docked panel */}
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            className="fixed bottom-0 right-6 z-[45] hidden h-[480px] max-h-[calc(100dvh-6rem)] w-[360px] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)] lg:flex"
            role="dialog"
            aria-label={t("messages.dock.title")}
          >
            {panelBody}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Mobile full sheet */}
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end bg-slate-950/40 lg:hidden"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            onMouseDown={(event) => event.target === event.currentTarget && setView("collapsed")}
            role="presentation"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="flex h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={t("messages.dock.title")}
            >
              {panelBody}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
