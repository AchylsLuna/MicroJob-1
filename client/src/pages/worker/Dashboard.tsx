import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Send,
  Users,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { EmployerDashboard } from "../employer/EmployerDashboard";
import { getUserApplications } from "../../services/api";
import { ROUTES } from "../../utils/routes";

const vacancyData = [
  { month: "Week 01", accepted: 4, interviews: 3, rejected: 1 },
  { month: "Week 02", accepted: 7, interviews: 5, rejected: 2 },
  { month: "Week 03", accepted: 11, interviews: 8, rejected: 3 },
  { month: "Week 04", accepted: 14, interviews: 10, rejected: 4 },
  { month: "Week 05", accepted: 19, interviews: 14, rejected: 5 },
  { month: "Week 06", accepted: 24, interviews: 18, rejected: 6 },
  { month: "Week 07", accepted: 29, interviews: 22, rejected: 7 },
  { month: "Week 08", accepted: 27, interviews: 20, rejected: 6 },
  { month: "Week 09", accepted: 31, interviews: 24, rejected: 8 },
  { month: "Week 10", accepted: 36, interviews: 28, rejected: 9 },
];

const recentActivities = [
  {
    text: "Your application has been accepted for Senior Frontend Developer",
    time: "1m ago",
    type: "success",
  },
  { text: "Interview scheduled with Tech Corp on Friday at 2:00 PM", time: "15m ago", type: "info" },
  { text: "New message from HR Manager at Innovation Labs", time: "1h ago", type: "message" },
  { text: "Application viewed by Google Inc.", time: "2h ago", type: "view" },
];

const recommendedJobs = [
  {
    id: "rj-1",
    title: "Senior React Developer",
    company: "Tech Solutions Inc.",
    salary: "₱80,000 - ₱120,000",
    location: "Manila, PH",
    type: "Remote",
    posted: "2 days ago",
    logo: "TS",
  },
  {
    id: "rj-2",
    title: "Full Stack Developer",
    company: "Innovation Labs",
    salary: "₱70,000 - ₱100,000",
    location: "Cebu, PH",
    type: "Hybrid",
    posted: "5 days ago",
    logo: "IL",
  },
  {
    id: "rj-3",
    title: "Mobile Developer",
    company: "Digital Ventures",
    salary: "₱75,000 - ₱110,000",
    location: "Makati, PH",
    type: "On-site",
    posted: "1 week ago",
    logo: "DV",
  },
];

const skillCards = [
  { id: "react", label: "React", short: "R", bg: "from-[#EEF2FF]", border: "border-[#E0E7FF]", chip: "bg-[#4F46E5]" },
  { id: "node", label: "Node.js", short: "N", bg: "from-[#D1FAE5]", border: "border-[#A7F3D0]", chip: "bg-[#10B981]" },
  { id: "ts", label: "TypeScript", short: "TS", bg: "from-[#FEF3C7]", border: "border-[#FDE68A]", chip: "bg-[#F59E0B]" },
];

interface StatCardProps {
  icon: ReactNode;
  title: string;
  count: number;
  bgColor: string;
  change?: string;
  onClick?: () => void;
}

function StatCard({ icon, title, count, bgColor, change, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      className={`${bgColor} relative min-h-[196px] overflow-hidden rounded-[24px] p-6 text-left text-white shadow-[0_12px_30px_rgba(28,77,141,0.25)] transition-transform duration-300 hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between">
          <div className="rounded-[16px] bg-white/20 p-4 shadow-lg backdrop-blur-sm">{icon}</div>
          {change && (
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[12px] font-semibold backdrop-blur-sm">
              <ArrowUpRight className="h-3 w-3" />
              {change}
            </div>
          )}
        </div>
        <p className="text-[15px] text-white/90">{title}</p>
        <p className="mt-2 text-[44px] font-bold leading-none tracking-tight">{count}</p>
      </div>
    </button>
  );
}

export function Dashboard() {
  const { user } = useAuth();

  if (user?.accountType === "employer") {
    return <EmployerDashboard />;
  }

  const navigate = useNavigate();
  const [applicationCount, setApplicationCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"accepted" | "interviews" | "rejected">("accepted");
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const latestVacancy = vacancyData[vacancyData.length - 1];

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      setIsStatsLoading(true);
      try {
        const applications = await getUserApplications();
        if (!isMounted) return;
        const total = Array.isArray(applications) ? applications.length : 0;
        const interviews = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Reviewed").length
          : 0;
        setApplicationCount(total);
        setInterviewCount(interviews);
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error?.message || "Failed to load dashboard stats.");
      } finally {
        if (isMounted) setIsStatsLoading(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleViewAllActivities = () => {
    navigate(ROUTES.worker.notifications);
  };

  const handleViewAllJobs = () => {
    navigate(ROUTES.worker.findJobs);
  };

  const handleJobClick = (jobId: string) => {
    navigate(ROUTES.worker.jobDetails(jobId));
  };

  const handleActivityClick = (activity: { type: string }) => {
    if (activity.type === "message") {
      navigate(ROUTES.worker.messages);
      return;
    }
    navigate(ROUTES.worker.appliedJobs);
  };

  const handleStatClick = (statTitle: string) => {
    switch (statTitle) {
      case "Interviews Schedule":
      case "Application Sent":
        navigate(ROUTES.worker.appliedJobs);
        return;
      case "E-wallet":
        navigate(ROUTES.worker.eWallet);
        return;
      case "Unread Messages":
        navigate(ROUTES.worker.messages);
        return;
      default:
        return;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-7 w-7 text-white" />}
          title="Interviews Schedule"
          count={isStatsLoading ? 0 : interviewCount}
          bgColor="bg-gradient-to-br from-[#4988C4] via-[#2F74B8] to-[#1C4D8D]"
          change="+12%"
          onClick={() => handleStatClick("Interviews Schedule")}
        />
        <StatCard
          icon={<Send className="h-7 w-7 text-white" />}
          title="Application Sent"
          count={isStatsLoading ? 0 : applicationCount}
          bgColor="bg-gradient-to-br from-[#1C4D8D] via-[#1A3F78] to-[#0F2954]"
          change="+8%"
          onClick={() => handleStatClick("Application Sent")}
        />
        <StatCard
          icon={<Wallet className="h-7 w-7 text-white" />}
          title="E-wallet"
          count={0}
          bgColor="bg-gradient-to-br from-[#4988C4] via-[#2F74B8] to-[#1C4D8D]"
          change="+5%"
          onClick={() => handleStatClick("E-wallet")}
        />
        <StatCard
          icon={<Mail className="h-7 w-7 text-white" />}
          title="Unread Messages"
          count={0}
          bgColor="bg-gradient-to-br from-[#1C4D8D] via-[#1A3F78] to-[#0F2954]"
          change="+3%"
          onClick={() => handleStatClick("Unread Messages")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-[20px] border border-[#DFE7F6] bg-gradient-to-br from-[#EEF2FF] to-white p-6 text-center shadow-[0_10px_30px_rgba(79,70,229,0.08)]">
            <div className="relative mx-auto mb-4 h-[120px] w-[120px]">
              <svg className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="54" stroke="#DDE7FF" strokeWidth="8" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="url(#profileProgressGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="339.292"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="profileProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[40px] font-bold leading-none text-[#4F46E5]">100</p>
                  <p className="mt-1 text-[16px] text-[#6B7280]">%</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
              <p className="text-[18px] font-semibold text-[#111827]">Profile Verified</p>
            </div>
            <p className="mt-2 text-[13px] text-[#6B7280]">All requirements completed</p>
            <button
              type="button"
              onClick={() => navigate(`?tab=verification`)}
              className="mt-4 text-[13px] font-semibold text-[#4F46E5] hover:text-[#4338CA]"
            >
              View verification steps
            </button>
          </div>

          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Tech Stack</h3>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[12px] text-[#475569]">3 Skills</span>
            </div>
            <div className="space-y-3">
              {skillCards.map((skill) => (
                <div
                  key={skill.id}
                  className={`flex items-center gap-3 rounded-[12px] border ${skill.border} bg-gradient-to-r ${skill.bg} to-transparent p-3`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${skill.chip}`}>
                    <span className="text-[12px] font-bold text-white">{skill.short}</span>
                  </div>
                  <span className="text-[14px] font-medium text-[#111827]">{skill.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Recent Activities</h3>
              <button
                type="button"
                className="text-[13px] font-medium text-[#4F46E5] hover:text-[#4338CA]"
                onClick={handleViewAllActivities}
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <button
                  key={index}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-[12px] p-3 text-left transition-colors hover:bg-[#F8FAFC]"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] ${
                      activity.type === "success"
                        ? "bg-[#D1FAE5]"
                        : activity.type === "info"
                        ? "bg-[#DBEAFE]"
                        : activity.type === "message"
                        ? "bg-[#FEF3C7]"
                        : "bg-[#F1F5F9]"
                    }`}
                  >
                    {activity.type === "success" && <CheckCircle2 className="h-5 w-5 text-[#10B981]" />}
                    {activity.type === "info" && <Clock className="h-5 w-5 text-[#3B82F6]" />}
                    {activity.type === "message" && <Mail className="h-5 w-5 text-[#F59E0B]" />}
                    {activity.type === "view" && <Users className="h-5 w-5 text-[#64748B]" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] leading-relaxed text-[#111827]">{activity.text}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                      <Clock className="h-3 w-3" />
                      {activity.time}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Vacancy Stats</h3>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 font-medium ${
                    selectedFilter === "accepted" ? "bg-[#4F46E5] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("accepted")}
                >
                  Accepted
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 font-medium ${
                    selectedFilter === "interviews"
                      ? "bg-[#4F46E5] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("interviews")}
                >
                  Interviews
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 font-medium ${
                    selectedFilter === "rejected" ? "bg-[#4F46E5] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("rejected")}
                >
                  Rejected
                </button>
                <select
                  className="h-10 rounded-[10px] border border-[#E5E7EB] px-3 text-[13px] text-[#6B7280]"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Last 3 Months</option>
                </select>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={282}>
              <LineChart data={vacancyData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
                <Tooltip />
                <Legend />
                {selectedFilter === "accepted" && (
                  <Line type="monotone" dataKey="accepted" stroke="#6366F1" strokeWidth={2.5} name="Accepted" />
                )}
                {selectedFilter === "interviews" && (
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    name="Interviews"
                  />
                )}
                {selectedFilter === "rejected" && (
                  <Line type="monotone" dataKey="rejected" stroke="#EF4444" strokeWidth={2.5} name="Rejected" />
                )}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-4 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#6366F1]" />
                <span className="font-semibold text-[#111827]">{latestVacancy.accepted}</span>
                <span className="text-[#6B7280]">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                <span className="font-semibold text-[#111827]">{latestVacancy.interviews}</span>
                <span className="text-[#6B7280]">Interviews</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
                <span className="font-semibold text-[#111827]">{latestVacancy.rejected}</span>
                <span className="text-[#6B7280]">Rejected</span>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Recommended Jobs</h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-[#4F46E5] hover:text-[#4338CA]"
                onClick={handleViewAllJobs}
              >
                View all
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recommendedJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleJobClick(job.id)}
                  className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#C7D8F9] hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-[12px] font-bold text-white">
                      {job.logo}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-1 text-[10px] text-[#64748B]">
                      <Clock className="h-3 w-3" />
                      {job.posted}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold text-[#111827]">{job.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-[#64748B]">
                    <Building2 className="h-3.5 w-3.5" />
                    {job.company}
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-[#10B981]">{job.salary}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-[#EEF2F7] pt-3">
                    <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        job.type === "Remote"
                          ? "bg-[#DBEAFE] text-[#1E40AF]"
                          : job.type === "Hybrid"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#D1FAE5] text-[#065F46]"
                      }`}
                    >
                      {job.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
