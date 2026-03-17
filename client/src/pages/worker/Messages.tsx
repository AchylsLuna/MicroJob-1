import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Ban,
  ChevronLeft,
  Ellipsis,
  MoreVertical,
  Search,
  Send,
  Smile,
  SquarePen,
  Trash2,
} from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ROUTES } from "../../utils/routes";
import { 
  getConversations, 
  getArchivedConversations,
  getConversationWithUser, 
  sendMessage, 
  editMessage,
  blockUser, 
  archiveConversation, 
  deleteConversation,
  markMessagesAsRead
} from "../../services/api";

interface Message {
  _id: string;
  sender: { _id: string; firstName?: string; lastName?: string };
  receiver: { _id: string; firstName?: string; lastName?: string };
  content: string;
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
  job?: { _id: string; title: string };
}

interface Contact {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  jobId: string | null;
  jobTitle: string | null;
  lastMessage: string;
  lastMessageAt: string;
}

const getInitials = (name: string): string => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatMessageDay = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return "Today";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const formatHandle = (name: string): string => {
  const normalized = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "");
  return `@${normalized || "user"}`;
};

const pickArray = <T,>(...candidates: any[]): T[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return [];
};

const getStoredAuthUser = () => {
  const raw =
    localStorage.getItem("auth_user") ||
    localStorage.getItem("current_user") ||
    localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getCurrentUserIdFromStorage = () => {
  const parsed = getStoredAuthUser();
  return parsed?.id || parsed?._id || "";
};

const getUserName = (user: unknown): string => {
  if (!user || typeof user !== "object") return "";
  const record = user as { firstName?: string; lastName?: string };
  const fullName = `${String(record.firstName || "").trim()} ${String(record.lastName || "").trim()}`.trim();
  return fullName;
};

export function Messages() {
  const navigate = useNavigate();
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
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const listMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startChatHandledRef = useRef(false);
  const prefilledDraftHandledRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const supportSource = searchParams.get("source") || "";
  const supportStartUserId = supportSource === "support-center" ? (searchParams.get("startUser") || "") : "";

  const supportDisplayNameFor = (otherUserId: string, fallbackName: string) =>
    supportStartUserId && String(otherUserId) === String(supportStartUserId)
      ? "Admin Support"
      : fallbackName;

  useEffect(() => {
    setCurrentUserId(getCurrentUserIdFromStorage());

    const handleAuthUserUpdated = () => {
      setCurrentUserId(getCurrentUserIdFromStorage());
    };
    window.addEventListener("auth_user_updated", handleAuthUserUpdated);

    loadArchivedConversations();
    loadConversations();

    return () => {
      window.removeEventListener("auth_user_updated", handleAuthUserUpdated);
    };
  }, []);

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
    });
    socketRef.current = socket;
    socket.emit("register", currentUserId);

    const handleIncomingMessage = (incoming: any) => {
      const message = incoming?.data || incoming;
      const senderId = String(message?.sender?._id || message?.sender || "");
      const receiverId = String(message?.receiver?._id || message?.receiver || "");
      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      const messageJobId = message?.job?._id || message?.job || null;
      const conversationId = `${otherUserId}::${messageJobId || "general"}`;
      const senderName = getUserName(message?.sender);
      const receiverName = getUserName(message?.receiver);

      setContacts((prev) => {
        const existing = prev.find((item) => item.conversationId === conversationId);
        const resolvedName =
          senderId === currentUserId
            ? receiverName || existing?.otherUserName || "User"
            : senderName || existing?.otherUserName || "User";
        const otherUserName = supportDisplayNameFor(otherUserId, resolvedName);
        const updated: Contact = {
          conversationId,
          otherUserId,
          otherUserName,
          jobId: messageJobId,
          jobTitle: message?.job?.title || existing?.jobTitle || null,
          lastMessage: message?.content || existing?.lastMessage || "",
          lastMessageAt: message?.createdAt || new Date().toISOString(),
        };
        const filtered = prev.filter((item) => item.conversationId !== conversationId);
        return [updated, ...filtered];
      });
      setArchivedContacts((prev) => prev.filter((item) => item.conversationId !== conversationId));

      const isCurrentConversation =
        selectedContact &&
        selectedContact.otherUserId === otherUserId &&
        (selectedContact.jobId || "") === (messageJobId || "");

      if (isCurrentConversation) {
        setMessages((prev) => {
          const normalizedId = String(message?._id || "");
          if (normalizedId && prev.some((item) => item._id === normalizedId)) return prev;
          return [...prev, message as Message];
        });
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

    socket.on("new_message", handleIncomingMessage);
    socket.on("new_message_echo", handleIncomingMessage);
    socket.on("message_edited", handleMessageEdited);

    return () => {
      socket.off("new_message", handleIncomingMessage);
      socket.off("new_message_echo", handleIncomingMessage);
      socket.off("message_edited", handleMessageEdited);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, selectedContact]);

  useEffect(() => {
    if (!selectedContact) return;
    const interval = window.setInterval(() => {
      getConversationWithUser(selectedContact.otherUserId, selectedContact.jobId || undefined)
        .then((response: any) => {
          const messagesArray = pickArray<Message>(
            response?.messages,
            response?.data?.messages,
            response?.meta?.messages,
            response?.data,
            response
          );
          setMessages(messagesArray);
        })
        .catch(() => {
          // polling fallback only; ignore transient errors
        });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [selectedContact]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations();
      loadArchivedConversations();
    }, 10000);
    return () => window.clearInterval(interval);
  }, []);

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
    const startName = searchParams.get("startName") || "Employer";
    const source = searchParams.get("source") || "";
    const draft = searchParams.get("draft") || "";
    const isFromJobDetails =
      source === "job-details" ||
      (Boolean(draft) && Boolean(startUserId) && Boolean(startJobId));

    if (contactId && contacts.length > 0) {
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
  }, [searchParams, contacts]);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
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
        otherUserName: supportDisplayNameFor(contact.otherUserId, contact.otherUserName || "User"),
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
      toast.error(error.message || 'Failed to load conversations');
      setContacts([]); // Ensure contacts is set to empty array on error
    } finally {
      setLoading(false);
    }
  };

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
      toast.error("You can only edit a message within 30 seconds.");
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
      toast.error("Message cannot be empty.");
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
      toast.success("Message updated");
    } catch (error: any) {
      toast.error(error?.message || "Unable to edit message");
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setShowMoreMenu(false);
    
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
        } catch (e) {
          // Ignore marking errors
        }
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error(error.message || 'Failed to load messages');
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact) return;
    
    try {
      setSending(true);
      await sendMessage({
        receiverId: selectedContact.otherUserId,
        content: messageText.trim(),
        jobId: selectedContact.jobId || undefined,
      });
      
      setMessageText("");
      
      // Reload messages to show the sent message
      const response: any = await getConversationWithUser(selectedContact.otherUserId, selectedContact.jobId || undefined);
      const messagesArray = pickArray<Message>(
        response?.messages,
        response?.data?.messages,
        response?.meta?.messages,
        response?.data,
        response
      );
      setMessages(messagesArray);
      
      // Reload conversations to update last message
      await loadConversations();
      
      toast.success("Message sent!");
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedContact) return;
    
    if (!confirm(`Are you sure you want to block ${selectedContact.otherUserName}? They will no longer be able to send you messages.`)) {
      return;
    }
    
    try {
      await blockUser(selectedContact.otherUserId);
      toast.success(`${selectedContact.otherUserName} has been blocked`);
      setShowMoreMenu(false);
      
      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to block user');
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedContact) return;
    
    try {
      await archiveConversation(selectedContact.otherUserId, selectedContact.jobId || undefined);
      toast.success("Conversation archived");
      setShowMoreMenu(false);

      const archivedConversationId = `${selectedContact.otherUserId}::${selectedContact.jobId || "general"}`;
      setContacts((prev) => prev.filter((contact) => contact.conversationId !== archivedConversationId));

      await loadArchivedConversations();
      
      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to archive conversation');
    }
  };

  const handleUnarchiveConversation = async () => {
    if (!selectedContact) return;

    try {
      await archiveConversation(selectedContact.otherUserId, selectedContact.jobId || undefined, false);
      toast.success("Conversation moved to inbox");
      setShowMoreMenu(false);

      const conversationId = `${selectedContact.otherUserId}::${selectedContact.jobId || "general"}`;
      setArchivedContacts((prev) => prev.filter((contact) => contact.conversationId !== conversationId));
      await loadConversations();
      await loadArchivedConversations();
      setShowArchived(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to unarchive conversation');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedContact) return;
    
    if (!confirm(`Are you sure you want to delete this conversation with ${selectedContact.otherUserName}? This will permanently remove all messages for both users.`)) {
      return;
    }
    
    try {
      await deleteConversation(selectedContact.otherUserId, selectedContact.jobId || undefined);
      toast.success("Conversation deleted");
      setShowMoreMenu(false);
      
      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete conversation');
    }
  };

  const handleAttachment = () => {
    toast.info("More composer actions coming soon...");
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

  const handleViewProfile = () => {
    if (!selectedContact?.otherUserId) return;
    navigate(`${ROUTES.publicProfile(selectedContact.otherUserId)}?viewAs=worker`);
  };

  // Ensure contacts is always an array before filtering
  const archivedSet = new Set(archivedContacts.map((contact) => contact.conversationId));
  const contactsArray = Array.isArray(showArchived ? archivedContacts : contacts)
    ? (showArchived ? archivedContacts : contacts.filter((contact) => !archivedSet.has(contact.conversationId)))
    : [];
  const canInjectSelectedContact =
    selectedContact &&
    !contactsArray.some((contact) => contact.conversationId === selectedContact.conversationId) &&
    (showArchived ? archivedSet.has(selectedContact.conversationId) : !archivedSet.has(selectedContact.conversationId));
  const effectiveContacts = canInjectSelectedContact ? [selectedContact as Contact, ...contactsArray] : contactsArray;

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

  const messageRows = useMemo(() => {
    const rows: Array<{ type: "divider"; label: string } | { type: "message"; message: Message }> = [];
    let previousDay = "";

    orderedMessages.forEach((message) => {
      const currentDay = new Date(message.createdAt).toDateString();
      if (currentDay !== previousDay) {
        rows.push({
          type: "divider",
          label: formatMessageDay(message.createdAt),
        });
        previousDay = currentDay;
      }
      rows.push({ type: "message", message });
    });

    return rows;
  }, [orderedMessages]);

  if (loading) {
    return (
      <div className="mx-auto flex h-[calc(100vh-160px)] min-h-[640px] max-w-[1341px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#1C4D8D] border-t-transparent" />
          <p className="text-[#6B7280]">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto h-[calc(100vh-160px)] min-h-[640px] max-w-[1341px] pt-1">
      <div className="flex h-full overflow-hidden rounded-[20px] border border-[#DDE2EB] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
        <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col border-r border-[#E5E7EB] bg-white md:w-[34%] md:min-w-[320px] md:max-w-[460px]`}>
          <div className="border-b border-[#E5E7EB] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[28px] font-semibold leading-none text-[#111827] md:text-[30px]">Inbox Chat</h3>
                <span className="rounded-full bg-[#1983F6] px-3 py-1 text-[12px] font-semibold text-white">
                  {effectiveContacts.length}
                </span>
              </div>
              <div className="relative flex items-center gap-2" ref={listMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContact(null);
                    setMessages([]);
                    setShowListMenu(false);
                    setShowMoreMenu(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DCE7] text-[#4B5563] transition hover:bg-[#F5F7FB]"
                  title="New message"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowListMenu((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DCE7] text-[#4B5563] transition hover:bg-[#F5F7FB]"
                  title="List options"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
                {showListMenu ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[#E5E7EB] bg-white py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                    <button
                      type="button"
                      onClick={toggleArchiveMode}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-[#374151] hover:bg-[#F5F7FB]"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchived ? "Back To Inbox" : "View Archived"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-[#D8DEE8] bg-white py-3 pl-11 pr-4 text-[14px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#4E8FD1] focus:ring-2 focus:ring-[#4E8FD1]/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {filteredContacts.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-[15px] text-[#9AA3B2]">
                <span>No conversations yet.</span>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isActive = selectedContact?.conversationId === contact.conversationId;
                return (
                  <button
                    key={contact.conversationId}
                    type="button"
                    onClick={() => {
                      handleSelectContact(contact);
                      setShowListMenu(false);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set("contact", contact.conversationId);
                      setSearchParams(nextParams);
                    }}
                    className={`w-full border-b border-[#EDF1F6] px-4 py-4 text-left transition hover:bg-[#F8FBFF] ${
                      isActive ? "bg-[#EAF2FD]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {!isActive ? <span className="mt-4 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#E11D48]" /> : <span className="mt-4 h-2.5 w-2.5 flex-shrink-0" />}
                      <div className="relative mt-0.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4F97D9] to-[#1F5DAB] text-[14px] font-bold text-white">
                          {getInitials(contact.otherUserName)}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#1D9BF0]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold leading-tight text-[#111827] md:text-[16px]">
                              {contact.otherUserName}
                            </p>
                            <p className="truncate text-[15px] leading-tight text-[#4B5563] md:text-[16px]">
                              {formatHandle(contact.otherUserName)}
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-[13px] text-[#6B7280]">
                            {formatTime(contact.lastMessageAt)}
                          </span>
                        </div>
                        {contact.jobTitle ? (
                          <p className="mt-1 truncate text-[13px] text-[#6B7280]">Re: {contact.jobTitle}</p>
                        ) : null}
                        <p className="mt-2 line-clamp-2 text-[13px] text-[#4B5563]">{contact.lastMessage || "No messages yet"}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={`${selectedContact ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#F9FAFC]`}>
          {!selectedContact ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-[16px] text-[#9AA3B2]">
              Select a conversation to start messaging.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContact(null);
                      setMessages([]);
                      setShowMoreMenu(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7DCE7] text-[#4B5563] transition hover:bg-[#F5F7FB] md:hidden"
                    title="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4F97D9] to-[#1F5DAB] text-[14px] font-bold text-white">
                      {getInitials(selectedContact.otherUserName)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#1D9BF0]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-[#111827]">{selectedContact.otherUserName}</p>
                    <p className="truncate text-[14px] text-[#4B5563]">{formatHandle(selectedContact.otherUserName)}</p>
                  </div>
                </div>

                  <div className="flex items-center gap-2">
                  {showArchived ? (
                    <button
                      type="button"
                      onClick={handleUnarchiveConversation}
                      className="hidden rounded-full border border-[#D7DCE7] px-4 py-2 text-[14px] font-medium text-[#111827] transition hover:bg-[#F5F7FB] md:block"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleArchiveConversation}
                      className="hidden rounded-full border border-[#D7DCE7] px-4 py-2 text-[14px] font-medium text-[#111827] transition hover:bg-[#F5F7FB] md:block"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleViewProfile}
                    className="hidden rounded-full bg-[#1983F6] px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-[#0B74E7] md:block"
                  >
                    View Profile
                  </button>
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu((prev) => !prev)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DCE7] text-[#374151] transition hover:bg-[#F5F7FB]"
                      title="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {showMoreMenu ? (
                      <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-[#E5E7EB] bg-white py-2 shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
                        <button
                          type="button"
                          onClick={handleBlockUser}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Ban className="h-4 w-4" />
                          Block User
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteConversation}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Conversation
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFD] px-5 py-5">
                {orderedMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[#9CA3AF]">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messageRows.map((row, index) => {
                      if (row.type === "divider") {
                        return (
                          <div key={`divider-${index}`} className="py-1">
                            <div className="mx-auto w-full max-w-[420px] rounded-[10px] border border-[#DDE2EB] bg-[#F3F5F9] px-3 py-1 text-center text-[12px] font-medium text-[#6B7280]">
                              {row.label}
                            </div>
                          </div>
                        );
                      }

                      const message = row.message;
                      const isOwn = currentUserId && message.sender._id === currentUserId;
                      const isEditing = editingMessageId === message._id;

                      return (
                        <div key={message._id || `message-${index}`} className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}>
                          {!isOwn ? (
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F97D9] to-[#1F5DAB] text-[12px] font-bold text-white">
                              {getInitials(selectedContact.otherUserName)}
                            </div>
                          ) : null}
                          <div className={`flex max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                            {isOwn ? (
                              <div className="mb-1 text-[12px] text-[#6B7280]">{formatMessageTime(message.createdAt)}</div>
                            ) : null}
                            {!isOwn ? (
                              <div className="mb-1 flex items-center gap-2 text-[13px] text-[#6B7280]">
                                <span className="font-semibold text-[#111827]">{selectedContact.otherUserName}</span>
                                <span>{formatMessageTime(message.createdAt)}</span>
                              </div>
                            ) : null}
                            <div
                              className={`rounded-[14px] px-4 py-3 ${
                                isOwn
                                  ? "bg-[#1983F6] text-white"
                                  : "border border-[#DDE2EB] bg-white text-[#111827]"
                              }`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full rounded-[8px] border border-[#D1D5DB] px-3 py-2 text-[14px] text-[#111827]"
                                    disabled={isEditingSaving}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditMessage}
                                      className="rounded bg-[#E5E7EB] px-2 py-1 text-[12px] text-[#374151]"
                                      disabled={isEditingSaving}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveEditMessage}
                                      className="rounded bg-[#1C4D8D] px-2 py-1 text-[12px] text-white"
                                      disabled={isEditingSaving}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[14px] leading-relaxed">{message.content}</p>
                              )}
                            </div>
                            <div className={`mt-1 flex items-center gap-2 text-[11px] text-[#9CA3AF] ${isOwn ? "justify-end" : "justify-start"}`}>
                              {message.isEdited ? <span>(edited)</span> : null}
                              {isOwn && !isEditing && canEditMessage(message) ? (
                                <button
                                  type="button"
                                  onClick={() => beginEditMessage(message)}
                                  className="font-medium text-[#1C4D8D] hover:underline"
                                >
                                  Edit
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-[#E5E7EB] bg-white px-5 py-4">
                <textarea
                  placeholder="Enter message"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!sending) {
                        handleSendMessage();
                      }
                    }
                  }}
                  disabled={sending}
                  className="min-h-[88px] w-full resize-none rounded-[12px] border border-[#DDE2EB] bg-[#FBFCFE] px-4 py-3 text-[15px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#4E8FD1] focus:ring-2 focus:ring-[#4E8FD1]/20 disabled:opacity-60"
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAttachment}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DCE7] text-[#4B5563] transition hover:bg-[#F5F7FB]"
                      title="Emoji"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleAttachment}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DCE7] text-[#4B5563] transition hover:bg-[#F5F7FB]"
                      title="More actions"
                    >
                      <Ellipsis className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    className="inline-flex min-w-[112px] items-center justify-center gap-2 rounded-full bg-[#1983F6] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0B74E7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        Send
                        <Send className="h-4 w-4" />
                      </>
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
