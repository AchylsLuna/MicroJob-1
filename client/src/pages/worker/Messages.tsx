import { useEffect, useState, useRef } from "react";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, Star, Archive, Trash2, Ban } from "lucide-react";
import { toast } from "../../lib/toast";
import { useSearchParams } from "react-router-dom";
import { 
  getConversations, 
  getConversationWithUser, 
  sendMessage, 
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

const pickArray = <T,>(...candidates: any[]): T[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return [];
};

export function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startChatHandledRef = useRef(false);
  const prefilledDraftHandledRef = useRef(false);

  useEffect(() => {
    // Get current user ID from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setCurrentUserId(parsed.id || parsed._id || '');
      } catch (e) {
        console.error('Failed to parse user from localStorage');
      }
    }

    loadConversations();
  }, []);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setSearchQuery(query);
    const contactId = searchParams.get("contact");
    const startUserId = searchParams.get("startUser");
    const startJobId = searchParams.get("jobId");
    const startName = searchParams.get("startName") || "Employer";
    const draft = searchParams.get("draft") || "";

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
        otherUserName: startName,
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

    if (!prefilledDraftHandledRef.current && draft) {
      setMessageText(draft);
      prefilledDraftHandledRef.current = true;
    }
  }, [searchParams, contacts]);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
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
      setContacts(conversationsArray);
      
      // Select first contact by default if none selected
      if (conversationsArray.length > 0 && !selectedContact) {
        handleSelectContact(conversationsArray[0]);
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      toast.error(error.message || 'Failed to load conversations');
      setContacts([]); // Ensure contacts is set to empty array on error
    } finally {
      setLoading(false);
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
      
      // Remove from contacts list and reload
      await loadConversations();
      setSelectedContact(null);
      setMessages([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to archive conversation');
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
    toast.info("File attachments coming soon...");
  };

  const handleCall = () => {
    if (selectedContact) {
      toast.info(`Voice calls coming soon...`);
    }
  };

  const handleVideoCall = () => {
    if (selectedContact) {
      toast.info(`Video calls coming soon...`);
    }
  };

  const handleStarConversation = () => {
    toast.info("Starring conversations coming soon...");
  };

  // Ensure contacts is always an array before filtering
  const contactsArray = Array.isArray(contacts) ? contacts : [];
  const effectiveContacts = selectedContact && !contactsArray.some((contact) => contact.conversationId === selectedContact.conversationId)
    ? [selectedContact, ...contactsArray]
    : contactsArray;

  const filteredContacts = effectiveContacts.filter(contact =>
    contact.otherUserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.jobTitle && contact.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="max-w-[1341px] mx-auto h-[calc(100vh-160px)] min-h-[640px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#6B7280]">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1341px] mx-auto h-[calc(100vh-160px)] min-h-[640px]">
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] overflow-hidden shadow-sm h-full flex">
        {/* Contacts Sidebar */}
        <div className="w-[340px] border-r border-[#E5E7EB] flex flex-col min-h-0">
          {/* Search */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  const nextParams = new URLSearchParams(searchParams);
                  if (value) {
                    nextParams.set("q", value);
                  } else {
                    nextParams.delete("q");
                  }
                  setSearchParams(nextParams);
                }}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] pl-10 pr-4 py-2.5 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
              />
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredContacts.length === 0 && (
              <div className="p-8 text-center text-[#9CA3AF]">
                <p>No conversations yet</p>
              </div>
            )}
            {filteredContacts.map((contact) => (
              <div
                key={contact.conversationId}
                onClick={() => {
                  handleSelectContact(contact);
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set("contact", contact.conversationId);
                  setSearchParams(nextParams);
                }}
                className={`p-4 border-b border-[#E5E7EB] cursor-pointer transition-colors hover:bg-[#F9FAFB] ${
                  selectedContact?.conversationId === contact.conversationId ? "bg-[#E8F2F8]" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[14px]">
                      {getInitials(contact.otherUserName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[14px] font-semibold text-[#111827] truncate">{contact.otherUserName}</h4>
                      <span className="text-[11px] text-[#9CA3AF]">{formatTime(contact.lastMessageAt)}</span>
                    </div>
                    {contact.jobTitle && (
                      <p className="text-[12px] text-[#6B7280] mb-1 truncate">Re: {contact.jobTitle}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{contact.lastMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center bg-[#F9FAFB]">
              <p className="text-[#9CA3AF]">Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[14px]">
                      {getInitials(selectedContact.otherUserName)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#111827]">{selectedContact.otherUserName}</h3>
                    {selectedContact.jobTitle && (
                      <p className="text-[12px] text-[#6B7280]">Re: {selectedContact.jobTitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCall}
                    className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                    title="Voice call"
                  >
                    <Phone className="w-5 h-5 text-[#6B7280]" />
                  </button>
                  <button
                    onClick={handleVideoCall}
                    className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                    title="Video call"
                  >
                    <Video className="w-5 h-5 text-[#6B7280]" />
                  </button>
                  <button
                    onClick={handleStarConversation}
                    className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                    title="Star conversation"
                  >
                    <Star className="w-5 h-5 text-[#6B7280]" />
                  </button>
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="w-5 h-5 text-[#6B7280]" />
                    </button>
                    {showMoreMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-2 z-50">
                        <button
                          onClick={handleArchiveConversation}
                          className="w-full px-4 py-2 text-left text-[14px] text-[#111827] hover:bg-[#F9FAFB] flex items-center gap-3"
                        >
                          <Archive className="w-4 h-4 text-[#6B7280]" />
                          Archive Conversation
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-4 py-2 text-left text-[14px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-3"
                        >
                          <Ban className="w-4 h-4" />
                          Block User
                        </button>
                        <button
                          onClick={handleDeleteConversation}
                          className="w-full px-4 py-2 text-left text-[14px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-3"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Conversation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F9FAFB] min-h-0">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#9CA3AF]">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isOwn = currentUserId && message.sender._id === currentUserId;
                      return (
                        <div
                          key={message._id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[80%] md:max-w-[60%] ${isOwn ? "order-2" : "order-1"}`}>
                            <div
                              className={`rounded-[16px] px-4 py-3 ${
                                isOwn
                                  ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white"
                                  : "bg-white text-[#111827] border border-[#E5E7EB]"
                              }`}
                            >
                              <p className="text-[14px] leading-relaxed">{message.content}</p>
                            </div>
                            <p className={`text-[11px] text-[#9CA3AF] mt-1 ${isOwn ? "text-right" : "text-left"}`}>
                              {formatMessageTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-[#E5E7EB] bg-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAttachment}
                    className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5 text-[#6B7280]" />
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !sending && handleSendMessage()}
                    disabled={sending}
                    className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white p-3 rounded-[10px] hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!messageText.trim() || sending}
                    title="Send message"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-5 h-5" />
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
