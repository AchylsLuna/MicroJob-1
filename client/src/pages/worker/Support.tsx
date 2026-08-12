import { useEffect, useMemo, useRef, useState } from "react";
import {
  Book,
  ChevronDown,
  ChevronUp,
  Clock3,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "../../lib/toast";
import { useAuth } from "../../hooks/useAuth";
import {
  createSupportTicket,
  getSupportAgents,
  getSupportTicket,
  getSupportTickets,
  replyToSupportTicket,
  type SupportTicket,
} from "../../services/api";
import { ROUTES } from "../../utils/routes";

const faqs = [
  {
    id: "account-verify",
    question: "How do I verify my account?",
    answer: "Go to settings and complete your identity details. Verification items remain visible until they are reviewed.",
    category: "account",
  },
  {
    id: "payout-time",
    question: "How long do payouts take?",
    answer: "Payout requests are reviewed manually. Once approved, you can track each request in your wallet history.",
    category: "payments",
  },
  {
    id: "application-status",
    question: "Why did my application stage change?",
    answer: "Employers now move applications through explicit pipeline stages such as Shortlisted, Interview Scheduled, Offer Sent, and Hired.",
    category: "jobs",
  },
  {
    id: "messages",
    question: "Can I contact an employer directly?",
    answer: "Yes. Use the Messages area from job details or your application workflow to contact the employer directly.",
    category: "jobs",
  },
  {
    id: "security",
    question: "How do I secure my account?",
    answer: "Use a strong password, enable MFA in settings, and review active sessions regularly from your account settings.",
    category: "account",
  },
];

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getStatusClasses = (status: SupportTicket["status"]) => {
  switch (status) {
    case "open":
      return "bg-[#1C4D8D]/10 text-[#1C4D8D]";
    case "in_progress":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "waiting_user":
      return "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]";
    case "resolved":
      return "bg-[#D1FAE5] text-[#047857]";
    case "closed":
      return "bg-[#F3F4F6] text-[#6B7280]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
};

const getPriorityClasses = (priority?: SupportTicket["priority"]) => {
  switch (priority) {
    case "urgent":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "high":
      return "bg-[#FFEDD5] text-[#C2410C]";
    case "medium":
      return "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]";
    default:
      return "bg-[#ECFDF5] text-[#047857]";
  }
};

const extractTickets = (response: any): SupportTicket[] => {
  if (Array.isArray(response?.tickets)) return response.tickets as SupportTicket[];
  if (Array.isArray(response?.data)) return response.data as SupportTicket[];
  if (Array.isArray(response)) return response as SupportTicket[];
  return [];
};

const extractTicket = (response: any): SupportTicket | undefined => {
  if (response?.ticket && typeof response.ticket === "object") return response.ticket as SupportTicket;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data as SupportTicket;
  }
  return undefined;
};

export function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "account" | "payments" | "jobs">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isOpeningMessages, setIsOpeningMessages] = useState(false);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    category: "general",
    priority: "medium" as NonNullable<SupportTicket["priority"]>,
    message: "",
  });
  const supportFormRef = useRef<HTMLFormElement>(null);

  const prepareSecurityEscalation = () => {
    setSupportForm((current) => ({
      ...current,
      subject: current.subject || "Security escalation",
      category: "account",
      priority: "urgent",
    }));
    supportFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("support-subject")?.focus(), 250);
  };

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket._id === selectedTicketId) || null,
    [selectedTicketId, tickets],
  );

  const loadTickets = async (selectedId?: string | null, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setIsLoadingTickets(true);
    try {
      const response = await getSupportTickets();
      const nextTickets = extractTickets(response as any);
      setTickets(nextTickets);
      if (nextTickets.length > 0) {
        setSelectedTicketId(selectedId || nextTickets[0]._id);
      } else {
        setSelectedTicketId(null);
      }
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "Failed to load support tickets.");
      }
    } finally {
      if (!silent) setIsLoadingTickets(false);
    }
  };

  const loadTicketDetails = async (ticketId: string, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      const response = await getSupportTicket(ticketId);
      const ticket = extractTicket(response as any);
      if (!ticket) return;
      setTickets((current) =>
        current.map((item) => (item._id === ticketId ? ticket : item)),
      );
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "Failed to load ticket details.");
      }
    }
  };

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setSearchQuery(query);
  }, [searchParams]);

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetails(selectedTicketId);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadTickets(selectedTicketId, { silent: true });
    }, 10000);
    return () => window.clearInterval(id);
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const id = window.setInterval(() => {
      loadTicketDetails(selectedTicketId, { silent: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [selectedTicketId]);

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory = categoryFilter === "all" || faq.category === categoryFilter;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSubmitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createSupportTicket({
        subject: supportForm.subject.trim(),
        category: supportForm.category,
        priority: supportForm.priority,
        message: supportForm.message.trim(),
      });
      const ticket = extractTicket(response as any);
      if (ticket) {
        setTickets((current) => [ticket, ...current.filter((item) => item._id !== ticket._id)]);
        setSelectedTicketId(ticket._id);
      } else {
        await loadTickets();
      }
      setSupportForm({ subject: "", category: "general", priority: "medium", message: "" });
      toast.success("Support ticket submitted.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicketId || !replyDraft.trim()) return;
    setIsReplying(true);
    try {
      const response = await replyToSupportTicket(selectedTicketId, { message: replyDraft.trim() });
      const updatedTicket = extractTicket(response as any);
      if (updatedTicket) {
        setTickets((current) =>
          current.map((item) => (item._id === updatedTicket._id ? updatedTicket : item)),
        );
      } else {
        await loadTicketDetails(selectedTicketId);
      }
      setReplyDraft("");
      toast.success("Reply sent.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send reply.");
    } finally {
      setIsReplying(false);
    }
  };

  const handleOpenSupportMessages = async () => {
    setIsOpeningMessages(true);
    try {
      const response = await getSupportAgents();
      const agents = Array.isArray((response as any)?.agents)
        ? ((response as any).agents as Array<{ _id: string; displayName?: string; firstName?: string; lastName?: string; email?: string }>)
        : Array.isArray((response as any)?.data)
        ? ((response as any).data as Array<{ _id: string; displayName?: string; firstName?: string; lastName?: string; email?: string }>)
        : [];

      const target = agents[0];
      if (!target?._id) {
        toast.error("No support admin is available right now.");
        return;
      }

      const displayName = "Admin Support";

      const messageRoute = window.location.pathname.startsWith("/employer")
        ? ROUTES.employer.messages
        : ROUTES.worker.messages;

      const params = new URLSearchParams({
        contact: `${target._id}::general`,
        startUser: target._id,
        startName: displayName,
        source: "support-center",
      });
      navigate(`${messageRoute}?${params.toString()}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to open support messages.");
    } finally {
      setIsOpeningMessages(false);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] gap-6">
        <div className="space-y-6">
          <div className="bg-[#1C4D8D] rounded-[20px] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-36 -mt-36" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-[32px] font-semibold mb-2">Support Center</h1>
                <p className="text-[15px] text-white/85 max-w-[620px]">
                  Search FAQs, open a support ticket, and track each reply in a single thread.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-[16px] px-5 py-4 min-w-[240px]">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/65">Signed in as</p>
                <p className="text-[18px] font-semibold mt-1">
                  {`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "MicroJobs user"}
                </p>
                <p className="text-[13px] text-white/75 mt-1">{user?.email || "Support replies will appear here."}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <div className="w-12 h-12 rounded-[12px] bg-[#1C4D8D]/[0.08] flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-[#1C4D8D]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Message Support</h3>
              <p className="text-[14px] text-[#6B7280] mb-4">Use the messaging workspace for urgent conversations with the support team.</p>
              <button
                onClick={() => void handleOpenSupportMessages()}
                disabled={isOpeningMessages}
                className="w-full bg-[#1C4D8D] text-white font-medium py-2 rounded-[8px] hover:opacity-90 transition-all text-[14px] disabled:opacity-60"
              >
                {isOpeningMessages ? "Opening..." : "Open Messages"}
              </button>
            </div>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <div className="w-12 h-12 rounded-[12px] bg-[#DCFCE7] flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-[#15803D]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Email Support</h3>
              <p className="text-[14px] text-[#6B7280] mb-4">support@microjobs.ph</p>
              <a
                href="mailto:support@microjobs.ph"
                className="w-full block text-center bg-white border border-[#E5E7EB] text-[#1C4D8D] font-medium py-2 rounded-[8px] hover:bg-gray-50 transition-all text-[14px]"
              >
                Send Email
              </a>
            </div>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <div className="w-12 h-12 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-[#B45309]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Security Escalation</h3>
              <p className="text-[14px] text-[#6B7280] mb-4">Account compromise, payout disputes, and identity concerns.</p>
              <button type="button" onClick={prepareSecurityEscalation} className="min-h-11 w-full border border-[#E5E7EB] text-[#1C4D8D] font-medium py-2 rounded-[8px] hover:bg-gray-50 transition-all text-[14px]">
                Escalate Issue
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="w-6 h-6 text-[#1C4D8D]" />
              <h2 className="text-[24px] font-semibold text-[#111827]">Frequently Asked Questions</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchQuery(value);
                    setSearchParams(value ? { q: value } : {});
                  }}
                  placeholder="Search FAQs..."
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["all", "account", "payments", "jobs"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategoryFilter(item)}
                    className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
                      categoryFilter === item
                        ? "bg-[#1C4D8D] text-white"
                        : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
                    }`}
                  >
                    {item === "all" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredFAQs.map((faq) => (
                <div key={faq.id} className="border border-[#E5E7EB] rounded-[12px] overflow-hidden">
                  <button
                    onClick={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-[16px] font-medium text-[#111827] text-left">{faq.question}</span>
                    {openFAQ === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-[#6B7280] shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#6B7280] shrink-0" />
                    )}
                  </button>
                  {openFAQ === faq.id ? (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-[14px] text-[#6B7280] leading-relaxed">{faq.answer}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <h2 className="text-[24px] font-semibold text-[#111827] mb-2">Submit a Support Ticket</h2>
            <p className="text-[14px] text-[#6B7280] mb-6">
              Create a ticket for payout issues, account access, application disputes, or platform bugs.
            </p>

            <form ref={supportFormRef} onSubmit={handleSubmitTicket} className="space-y-4" aria-label="Submit a support ticket">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="support-subject" className="block text-[14px] font-medium text-[#111827] mb-2">Subject</label>
                  <input
                    id="support-subject"
                    type="text"
                    value={supportForm.subject}
                    onChange={(event) => setSupportForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Brief description of the issue"
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="support-category" className="block text-[14px] font-medium text-[#111827] mb-2">Category</label>
                  <select
                    id="support-category"
                    value={supportForm.category}
                    onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
                  >
                    <option value="general">General</option>
                    <option value="payments">Payments</option>
                    <option value="account">Account</option>
                    <option value="jobs">Jobs</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="support-priority" className="block text-[14px] font-medium text-[#111827] mb-2">Priority</label>
                  <select
                    id="support-priority"
                    value={supportForm.priority}
                    onChange={(event) =>
                      setSupportForm((current) => ({
                        ...current,
                        priority: event.target.value as NonNullable<SupportTicket["priority"]>,
                      }))
                    }
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="bg-[#F8FAFC] rounded-[12px] border border-[#E5E7EB] px-4 py-3">
                  <p className="text-[12px] uppercase tracking-[0.14em] text-[#6B7280]">Reply Destination</p>
                  <p className="text-[15px] font-semibold text-[#111827] mt-1">{user?.email || "Signed-in email"}</p>
                </div>
              </div>

              <div>
                <label htmlFor="support-message" className="block text-[14px] font-medium text-[#111827] mb-2">Message</label>
                <textarea
                  id="support-message"
                  value={supportForm.message}
                  onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Describe the issue, the expected result, and any dates or references we should review."
                  rows={6}
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto bg-[#1C4D8D] text-white font-semibold py-3 px-8 rounded-[12px] hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Ticket className="w-5 h-5 text-[#1C4D8D]" />
              <h2 className="text-[20px] font-semibold text-[#111827]">Your Tickets</h2>
            </div>

            {isLoadingTickets ? (
              <div className="py-8 text-center text-[14px] text-[#6B7280]">Loading ticket history...</div>
            ) : tickets.length === 0 ? (
              <div className="py-8 text-center">
                <LifeBuoy className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-[15px] font-medium text-[#111827]">No tickets yet</p>
                <p className="text-[13px] text-[#6B7280] mt-1">Submit a ticket to start a support thread.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => {
                  const latestMessage = ticket.messages?.[ticket.messages.length - 1];
                  return (
                    <button
                      key={ticket._id}
                      onClick={() => setSelectedTicketId(ticket._id)}
                      className={`w-full text-left rounded-[14px] border p-4 transition-colors ${
                        selectedTicketId === ticket._id
                          ? "border-[#1C4D8D] bg-[#1C4D8D]/[0.06]"
                          : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#111827] line-clamp-1">{ticket.subject}</p>
                          <p className="text-[12px] text-[#6B7280] mt-1">{formatDate(ticket.updatedAt || ticket.createdAt)}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusClasses(ticket.status)}`}>
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${getPriorityClasses(ticket.priority)}`}>
                          {ticket.priority || "low"}
                        </span>
                        <span className="text-[12px] text-[#6B7280] inline-flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5" />
                          {ticket.messageCount || ticket.messages?.length || 0} messages
                        </span>
                      </div>
                      <p className="text-[13px] text-[#6B7280] line-clamp-2">{latestMessage?.body || "No messages yet."}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Book className="w-5 h-5 text-[#1C4D8D]" />
              <h2 className="text-[20px] font-semibold text-[#111827]">Ticket Thread</h2>
            </div>

            {!selectedTicket ? (
              <div className="py-8 text-center text-[14px] text-[#6B7280]">Select a ticket to review the thread.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[14px] bg-[#F8FAFC] border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[17px] font-semibold text-[#111827]">{selectedTicket.subject}</p>
                      <p className="text-[13px] text-[#6B7280] mt-1">Opened {formatDate(selectedTicket.createdAt)}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${getStatusClasses(selectedTicket.status)}`}>
                      {selectedTicket.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {(selectedTicket.messages || []).map((message) => {
                    const isAdmin = message.actorRole === "admin";
                    return (
                      <div
                        key={message._id}
                        className={`rounded-[14px] p-4 border ${
                          isAdmin
                            ? "bg-[#1C4D8D]/[0.06] border-[#1C4D8D]/20"
                            : "bg-[#F9FAFB] border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {isAdmin ? (
                              <ShieldCheck className="w-4 h-4 text-[#1C4D8D]" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-[#6B7280]" />
                            )}
                            <p className="text-[13px] font-semibold text-[#111827]">
                              {isAdmin ? "Support Team" : "You"}
                            </p>
                          </div>
                          <p className="text-[12px] text-[#6B7280]">{formatDate(message.createdAt)}</p>
                        </div>
                        <p className="text-[14px] leading-relaxed text-[#374151]">{message.body}</p>
                      </div>
                    );
                  })}
                </div>

                {selectedTicket.status === "closed" ? (
                  <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#6B7280]">
                    This ticket is closed. Open a new ticket if you need further help.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      rows={4}
                      placeholder="Add more detail or reply to support..."
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleReply}
                      disabled={isReplying || !replyDraft.trim()}
                      className="w-full bg-[#1C4D8D] text-white font-semibold py-3 px-4 rounded-[12px] hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {isReplying ? "Sending reply..." : "Reply to Ticket"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
