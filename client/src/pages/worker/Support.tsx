import { useEffect, useState } from "react";
import { MessageSquare, Mail, Phone, HelpCircle, Book, Video, Send, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: "account" | "payments" | "jobs" | "technical";
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "How do I create a job posting?",
    answer: "To create a job posting, navigate to the Employer Dashboard and click on 'Post New Job'. Fill in the required details such as job title, description, requirements, and salary range. Once submitted, your job posting will be reviewed and published within 24 hours.",
    category: "jobs",
  },
  {
    id: "2",
    question: "How do I withdraw money from my e-wallet?",
    answer: "Go to the E-Wallet page, click on the 'Withdraw' button, enter the amount you want to withdraw, and select your bank account. Withdrawals are processed within 1-3 business days.",
    category: "payments",
  },
  {
    id: "3",
    question: "How do I verify my account?",
    answer: "To verify your account, go to Settings > Personal Information and upload a valid government-issued ID. Our team will review your submission within 24-48 hours.",
    category: "account",
  },
  {
    id: "4",
    question: "What payment methods are supported?",
    answer: "We support bank transfers, credit/debit cards, GCash, and PayMaya for topping up your e-wallet. Withdrawals can be made to any Philippine bank account.",
    category: "payments",
  },
  {
    id: "5",
    question: "How do I edit my profile?",
    answer: "Navigate to Settings or click on 'Welcome back Jonas' in the sidebar to access your profile. From there, you can edit your personal information, work experience, and upload your CV/Resume.",
    category: "account",
  },
  {
    id: "6",
    question: "Why is my job posting pending?",
    answer: "All job postings go through a review process to ensure they meet our quality standards and community guidelines. This typically takes 12-24 hours. You'll receive a notification once your posting is approved.",
    category: "jobs",
  },
  {
    id: "7",
    question: "How do I contact applicants?",
    answer: "Go to Applications Management, click on an applicant's profile, and use the 'Message' button to start a conversation. You can also schedule interviews directly from the application details page.",
    category: "jobs",
  },
  {
    id: "8",
    question: "What are the platform fees?",
    answer: "We charge a 5% service fee on all completed job payments. There are no fees for posting jobs or creating an account. Withdrawal fees depend on your chosen payment method.",
    category: "payments",
  },
  {
    id: "9",
    question: "How do I reset my password?",
    answer: "Click on 'Forgot Password' on the sign-in page. Enter your email address, and we'll send you a link to reset your password. Make sure to check your spam folder if you don't see the email.",
    category: "account",
  },
  {
    id: "10",
    question: "My page is not loading properly",
    answer: "Try clearing your browser cache and cookies. Make sure you're using the latest version of your browser. If the issue persists, contact our support team with details about your browser and device.",
    category: "technical",
  },
];

export function Support() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "account" | "payments" | "jobs" | "technical">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setSearchQuery(query);
  }, [searchParams]);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supportForm.name || !supportForm.email || !supportForm.subject || !supportForm.message) {
      toast.error("Please fill in all fields");
      return;
    }

    toast.success("Support ticket submitted successfully! We'll get back to you within 24 hours.");
    setSupportForm({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  const toggleFAQ = (id: string) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = categoryFilter === "all" || faq.category === categoryFilter;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-semibold text-[32px] text-[#111827] mb-2">How can we help you?</h1>
        <p className="text-[16px] text-[#6B7280]">
          Get help, find answers, or contact our support team
        </p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Live Chat</h3>
          <p className="text-[14px] text-[#6B7280] mb-4">
            Chat with our support team in real-time
          </p>
          <button
            onClick={() => navigate("/dashboard/messages?contact=support")}
            className="w-full bg-[#1C4D8D] text-white font-medium py-2 rounded-[8px] hover:bg-[#0F2954] transition-all text-[14px]"
          >
            Start Chat
          </button>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-[#10B981]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Email Support</h3>
          <p className="text-[14px] text-[#6B7280] mb-4">
            support@microjobs.ph
          </p>
          <a
            href="mailto:support@microjobs.ph"
            className="w-full block text-center bg-white border border-[#E5E7EB] text-[#1C4D8D] font-medium py-2 rounded-[8px] hover:bg-gray-50 transition-all text-[14px]"
          >
            Send Email
          </a>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center mb-4">
            <Phone className="w-6 h-6 text-[#F59E0B]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Phone Support</h3>
          <p className="text-[14px] text-[#6B7280] mb-4">
            +63 2 8123 4567
          </p>
          <a
            href="tel:+6328123456"
            className="w-full block text-center bg-white border border-[#E5E7EB] text-[#1C4D8D] font-medium py-2 rounded-[8px] hover:bg-gray-50 transition-all text-[14px]"
          >
            Call Now
          </a>
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-br from-[#1C4D8D] to-[#4988C4] rounded-[16px] p-6 text-white cursor-pointer hover:shadow-lg transition-shadow">
          <Book className="w-8 h-8 mb-3" />
          <h3 className="text-[20px] font-semibold mb-2">Knowledge Base</h3>
          <p className="text-[14px] opacity-90 mb-4">
            Browse our comprehensive guides and tutorials
          </p>
          <button
            onClick={() => toast.info("Opening knowledge base...")}
            className="text-[14px] font-medium underline hover:no-underline"
          >
            View Articles →
          </button>
        </div>

        <div className="bg-gradient-to-br from-[#10B981] to-[#34D399] rounded-[16px] p-6 text-white cursor-pointer hover:shadow-lg transition-shadow">
          <Video className="w-8 h-8 mb-3" />
          <h3 className="text-[20px] font-semibold mb-2">Video Tutorials</h3>
          <p className="text-[14px] opacity-90 mb-4">
            Watch step-by-step video guides
          </p>
          <button
            onClick={() => toast.info("Opening video tutorials...")}
            className="text-[14px] font-medium underline hover:no-underline"
          >
            Watch Videos →
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-6 h-6 text-[#1C4D8D]" />
          <h2 className="text-[24px] font-semibold text-[#111827]">Frequently Asked Questions</h2>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              setSearchParams(value ? { q: value } : {});
            }}
            placeholder="Search FAQs..."
            className="w-full pl-10 pr-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
              categoryFilter === "all"
                ? "bg-[#1C4D8D] text-white"
                : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setCategoryFilter("account")}
            className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
              categoryFilter === "account"
                ? "bg-[#1C4D8D] text-white"
                : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setCategoryFilter("payments")}
            className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
              categoryFilter === "payments"
                ? "bg-[#1C4D8D] text-white"
                : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setCategoryFilter("jobs")}
            className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
              categoryFilter === "jobs"
                ? "bg-[#1C4D8D] text-white"
                : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
            }`}
          >
            Jobs
          </button>
          <button
            onClick={() => setCategoryFilter("technical")}
            className={`px-4 py-2 rounded-[8px] font-medium text-[14px] whitespace-nowrap transition-all ${
              categoryFilter === "technical"
                ? "bg-[#1C4D8D] text-white"
                : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
            }`}
          >
            Technical
          </button>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {filteredFAQs.map((faq) => (
            <div
              key={faq.id}
              className="border border-[#E5E7EB] rounded-[12px] overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(faq.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-[16px] font-medium text-[#111827] text-left">
                  {faq.question}
                </span>
                {openFAQ === faq.id ? (
                  <ChevronUp className="w-5 h-5 text-[#6B7280] shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#6B7280] shrink-0" />
                )}
              </button>
              {openFAQ === faq.id && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-[14px] text-[#6B7280] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFAQs.length === 0 && (
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[14px] text-[#6B7280]">No FAQs found matching your search</p>
          </div>
        )}
      </div>

      {/* Support Ticket Form */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <h2 className="text-[24px] font-semibold text-[#111827] mb-2">Submit a Support Ticket</h2>
        <p className="text-[14px] text-[#6B7280] mb-6">
          Can't find what you're looking for? Send us a message and we'll get back to you within 24 hours.
        </p>

        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-medium text-[#111827] mb-2">
                Name
              </label>
              <input
                type="text"
                value={supportForm.name}
                onChange={(e) => setSupportForm({ ...supportForm, name: e.target.value })}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[14px] font-medium text-[#111827] mb-2">
                Email
              </label>
              <input
                type="email"
                value={supportForm.email}
                onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-medium text-[#111827] mb-2">
              Subject
            </label>
            <input
              type="text"
              value={supportForm.subject}
              onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })}
              placeholder="Brief description of your issue"
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium text-[#111827] mb-2">
              Message
            </label>
            <textarea
              value={supportForm.message}
              onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
              placeholder="Describe your issue in detail..."
              rows={6}
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full md:w-auto bg-[#1C4D8D] text-white font-semibold py-3 px-8 rounded-[12px] hover:bg-[#0F2954] transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit Ticket
          </button>
        </form>
      </div>

      {/* Business Hours */}
      <div className="bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] rounded-[16px] border border-[#E5E7EB] p-6">
        <h3 className="text-[18px] font-semibold text-[#111827] mb-4">Business Hours</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[14px] text-[#6B7280] mb-2">
              <span className="font-medium text-[#111827]">Monday - Friday:</span> 9:00 AM - 6:00 PM
            </p>
            <p className="text-[14px] text-[#6B7280] mb-2">
              <span className="font-medium text-[#111827]">Saturday:</span> 10:00 AM - 4:00 PM
            </p>
            <p className="text-[14px] text-[#6B7280]">
              <span className="font-medium text-[#111827]">Sunday:</span> Closed
            </p>
          </div>
          <div>
            <p className="text-[14px] text-[#6B7280] mb-2">
              <span className="font-medium text-[#111827]">Average Response Time:</span> 2-4 hours
            </p>
            <p className="text-[14px] text-[#6B7280]">
              <span className="font-medium text-[#111827]">Emergency Support:</span> 24/7 for premium users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
