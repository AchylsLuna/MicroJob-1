import { useEffect, useState } from "react";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, Star } from "lucide-react";
import { toast } from "../../microjobs/lib/toast";
import { useSearchParams } from "react-router-dom";

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isOwn: boolean;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  online: boolean;
}

const contacts: Contact[] = [
  {
    id: "support",
    name: "Micro Jobs Support",
    company: "Support Team",
    avatar: "MJ",
    lastMessage: "Hi! How can we help you today?",
    lastMessageTime: "now",
    unread: 0,
    online: true,
  },
  {
    id: "1",
    name: "Sarah Chen",
    company: "Tech Solutions Inc.",
    avatar: "SC",
    lastMessage: "Thanks for your application! We'd like to schedule an interview.",
    lastMessageTime: "2m ago",
    unread: 2,
    online: true,
  },
  {
    id: "2",
    name: "Michael Rodriguez",
    company: "Innovation Labs",
    avatar: "MR",
    lastMessage: "Can you share your portfolio?",
    lastMessageTime: "1h ago",
    unread: 1,
    online: true,
  },
  {
    id: "3",
    name: "Emily Watson",
    company: "Digital Ventures",
    avatar: "EW",
    lastMessage: "Your profile looks great!",
    lastMessageTime: "3h ago",
    unread: 0,
    online: false,
  },
  {
    id: "4",
    name: "David Kim",
    company: "Google Philippines",
    avatar: "DK",
    lastMessage: "We're impressed with your experience.",
    lastMessageTime: "5h ago",
    unread: 0,
    online: false,
  },
  {
    id: "5",
    name: "Jessica Martinez",
    company: "Microsoft",
    avatar: "JM",
    lastMessage: "Looking forward to our meeting!",
    lastMessageTime: "1d ago",
    unread: 0,
    online: true,
  },
];

const messageHistory: { [key: string]: Message[] } = {
  support: [
    { id: "1", senderId: "support", text: "Welcome to Micro Jobs live chat! How can we help?", time: "Now", isOwn: false },
  ],
  "1": [
    { id: "1", senderId: "1", text: "Hi Jonas! I reviewed your application for the Senior React Developer position.", time: "10:30 AM", isOwn: false },
    { id: "2", senderId: "me", text: "Hello Sarah! Thank you for reaching out.", time: "10:32 AM", isOwn: true },
    { id: "3", senderId: "1", text: "Your experience with React and TypeScript is impressive. We'd love to move forward with the next steps.", time: "10:33 AM", isOwn: false },
    { id: "4", senderId: "me", text: "That's great to hear! I'm very interested in the position.", time: "10:35 AM", isOwn: true },
    { id: "5", senderId: "1", text: "Thanks for your application! We'd like to schedule an interview.", time: "10:36 AM", isOwn: false },
  ],
  "2": [
    { id: "1", senderId: "2", text: "Hello! I'm the hiring manager at Innovation Labs.", time: "Yesterday", isOwn: false },
    { id: "2", senderId: "me", text: "Hi Michael! Nice to meet you.", time: "Yesterday", isOwn: true },
    { id: "3", senderId: "2", text: "Can you share your portfolio?", time: "1h ago", isOwn: false },
  ],
};

export function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedContact, setSelectedContact] = useState<Contact>(contacts[0]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setSearchQuery(query);
    const contactId = searchParams.get("contact");
    if (contactId) {
      const match = contacts.find((contact) => contact.id === contactId);
      if (match) {
        setSelectedContact(match);
      }
    }
  }, [searchParams]);

  const handleSendMessage = () => {
    if (messageText.trim()) {
      toast.success("Message sent!");
      setMessageText("");
    }
  };

  const handleAttachment = () => {
    toast.info("Opening file picker...");
  };

  const handleCall = () => {
    toast.info(`Starting voice call with ${selectedContact.name}...`);
  };

  const handleVideoCall = () => {
    toast.info(`Starting video call with ${selectedContact.name}...`);
  };

  const handleStarConversation = () => {
    toast.success("Conversation starred");
  };

  const handleMoreOptions = () => {
    toast.info("Opening more options...");
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMessages = messageHistory[selectedContact.id] || [];

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
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => {
                  setSelectedContact(contact);
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set("contact", contact.id);
                  setSearchParams(nextParams);
                }}
                className={`p-4 border-b border-[#E5E7EB] cursor-pointer transition-colors hover:bg-[#F9FAFB] ${
                  selectedContact.id === contact.id ? "bg-[#E8F2F8]" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[14px]">
                      {contact.avatar}
                    </div>
                    {contact.online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#10B981] border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[14px] font-semibold text-[#111827] truncate">{contact.name}</h4>
                      <span className="text-[11px] text-[#9CA3AF]">{contact.lastMessageTime}</span>
                    </div>
                    <p className="text-[12px] text-[#6B7280] mb-1 truncate">{contact.company}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-[#9CA3AF] truncate flex-1">{contact.lastMessage}</p>
                      {contact.unread > 0 && (
                        <div className="ml-2 bg-[#1C4D8D] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {contact.unread}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[14px]">
                  {selectedContact.avatar}
                </div>
                {selectedContact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-white rounded-full"></div>
                )}
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#111827]">{selectedContact.name}</h3>
                <p className="text-[12px] text-[#6B7280]">{selectedContact.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCall}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <Phone className="w-5 h-5 text-[#6B7280]" />
              </button>
              <button
                onClick={handleVideoCall}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <Video className="w-5 h-5 text-[#6B7280]" />
              </button>
              <button
                onClick={handleStarConversation}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <Star className="w-5 h-5 text-[#6B7280]" />
              </button>
              <button
                onClick={handleMoreOptions}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F9FAFB] min-h-0">
            {currentMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] md:max-w-[60%] ${message.isOwn ? "order-2" : "order-1"}`}>
                  <div
                    className={`rounded-[16px] px-4 py-3 ${
                      message.isOwn
                        ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white"
                        : "bg-white text-[#111827] border border-[#E5E7EB]"
                    }`}
                  >
                    <p className="text-[14px] leading-relaxed">{message.text}</p>
                  </div>
                  <p className={`text-[11px] text-[#9CA3AF] mt-1 ${message.isOwn ? "text-right" : "text-left"}`}>
                    {message.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-[#E5E7EB] bg-white">
            <div className="flex items-center gap-3">
              <button
                onClick={handleAttachment}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <Paperclip className="w-5 h-5 text-[#6B7280]" />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white p-3 rounded-[10px] hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!messageText.trim()}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
