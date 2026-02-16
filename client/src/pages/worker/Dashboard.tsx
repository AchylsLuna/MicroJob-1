import { Calendar, Send, Wallet, Mail, TrendingUp, MapPin, Building2, Briefcase, CheckCircle2, Clock, Users, ArrowUpRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "../../microjobs/lib/toast";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../microjobs/contexts/AuthContext";
import { EmployerDashboard } from "../employer";
import { getUserApplications } from "../../services/api";

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
  { text: "Your application has been accepted for Senior Frontend Developer", time: "1m ago", type: "success" },
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
    description: "We're looking for an experienced React developer to join our growing team. Work on cutting-edge projects with modern tech stack.",
    location: "Manila, PH",
    type: "Remote",
    posted: "2 days ago",
    applicants: 24,
    logo: "TS"
  },
  {
    id: "rj-2",
    title: "Full Stack Developer",
    company: "Innovation Labs",
    salary: "₱70,000 - ₱100,000",
    description: "Join our dynamic team building next-generation SaaS products. Experience with React, Node.js, and AWS required.",
    location: "Cebu, PH",
    type: "Hybrid",
    posted: "5 days ago",
    applicants: 18,
    logo: "IL"
  },
  {
    id: "rj-3",
    title: "Mobile Developer",
    company: "Digital Ventures",
    salary: "₱75,000 - ₱110,000",
    description: "Build amazing mobile experiences with React Native. Competitive salary and benefits package included.",
    location: "Makati, PH",
    type: "On-site",
    posted: "1 week ago",
    applicants: 31,
    logo: "DV"
  },
];

const featuredCompanies = [
  { name: "Google Philippines", vacancies: 24, employees: "10,000+", industry: "Technology", logo: "GP" },
  { name: "Microsoft", vacancies: 18, employees: "5,000+", industry: "Software", logo: "MS" },
  { name: "Amazon Web Services", vacancies: 32, employees: "8,000+", industry: "Cloud Services", logo: "AWS" },
  { name: "Meta Platforms", vacancies: 15, employees: "3,000+", industry: "Social Media", logo: "MP" },
];

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  bgColor: string;
  change?: string;
  onClick?: () => void;
}

function StatCard({ icon, title, count, bgColor, change, onClick }: StatCardProps) {
  return (
    <div 
      className={`${bgColor} rounded-[20px] p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 relative overflow-hidden cursor-pointer`}
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-[16px] p-4 shadow-lg">
            {icon}
          </div>
          {change && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              <span className="text-[12px] font-semibold">{change}</span>
            </div>
          )}
        </div>
        <p className="text-[14px] opacity-90 mb-2">{title}</p>
        <p className="text-[36px] font-bold tracking-tight">{count}</p>
      </div>
    </div>
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
    navigate("/dashboard/notifications");
  };

  const handleViewAllJobs = () => {
    navigate("/dashboard/find-jobs");
  };

  const handleExploreCompanies = () => {
    navigate("/dashboard/find-jobs");
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/dashboard/job-details-new/${jobId}`);
  };

  const handleCompanyClick = (companyName: string) => {
    navigate(`/dashboard/find-jobs?q=${encodeURIComponent(companyName)}`);
  };

  const handleActivityClick = (activity: { text: string; type: string }) => {
    if (activity.type === "message") {
      navigate("/dashboard/messages");
      return;
    }
    navigate("/dashboard/applied-jobs");
  };

  const handleStatClick = (statTitle: string) => {
    switch (statTitle) {
      case "Interviews Schedule":
      case "Application Sent":
        navigate("/dashboard/applied-jobs");
        return;
      case "E-wallet":
        navigate("/dashboard/e-wallet");
        return;
      case "Unread Messages":
        navigate("/dashboard/messages");
        return;
      default:
        toast.info(`Viewing details for: ${statTitle}`);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="w-7 h-7 text-white" />}
          title="Interviews Schedule"
          count={isStatsLoading ? 0 : interviewCount}
          bgColor="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D]"
          change="+12%"
          onClick={() => handleStatClick("Interviews Schedule")}
        />
        <StatCard
          icon={<Send className="w-7 h-7 text-white" />}
          title="Application Sent"
          count={isStatsLoading ? 0 : applicationCount}
          bgColor="bg-gradient-to-br from-[#1C4D8D] to-[#0F2954]"
          change="+8%"
          onClick={() => handleStatClick("Application Sent")}
        />
        <StatCard
          icon={<Wallet className="w-7 h-7 text-white" />}
          title="E-wallet"
          count={0}
          bgColor="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D]"
          change="+5%"
          onClick={() => handleStatClick("E-wallet")}
        />
        <StatCard
          icon={<Mail className="w-7 h-7 text-white" />}
          title="Unread Messages"
          count={0}
          bgColor="bg-gradient-to-br from-[#1C4D8D] to-[#0F2954]"
          change="+3%"
          onClick={() => handleStatClick("Unread Messages")}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Verification Status */}
          <div className="bg-gradient-to-br from-[#EEF2FF] to-white rounded-[16px] border border-[#E0E7FF] p-6 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="relative mx-auto w-[120px] h-[120px] mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="#E0E7FF"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="339.292"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[36px] font-bold text-[#4F46E5]">100</p>
                  <p className="text-[16px] text-[#6B7280]">%</p>
                </div>
              </div>
            </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            <p className="text-[16px] font-semibold text-[#111827]">Profile Verified</p>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-2">All requirements completed</p>
          <button
            onClick={() => navigate("/dashboard/settings?tab=verification")}
            className="mt-4 text-[12px] font-semibold text-[#4F46E5] hover:text-[#4338CA]"
          >
            View verification steps
          </button>
        </div>

          {/* Tech Stack */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[#111827]">Tech Stack</h3>
              <span className="text-[12px] text-[#6B7280] bg-gray-100 px-2 py-1 rounded-full">3 Skills</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#EEF2FF] to-transparent rounded-[10px] border border-[#E0E7FF]">
                <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center">
                  <span className="text-white text-[12px] font-bold">R</span>
                </div>
                <span className="text-[14px] font-medium text-[#111827]">React</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#D1FAE5] to-transparent rounded-[10px] border border-[#A7F3D0]">
                <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center">
                  <span className="text-white text-[12px] font-bold">N</span>
                </div>
                <span className="text-[14px] font-medium text-[#111827]">Node.js</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#FEF3C7] to-transparent rounded-[10px] border border-[#FDE68A]">
                <div className="w-8 h-8 rounded-lg bg-[#F59E0B] flex items-center justify-center">
                  <span className="text-white text-[12px] font-bold">TS</span>
                </div>
                <span className="text-[14px] font-medium text-[#111827]">TypeScript</span>
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[#111827]">Recent Activities</h3>
              <button className="text-[12px] text-[#4F46E5] hover:text-[#4338CA] font-medium" onClick={handleViewAllActivities}>View all</button>
            </div>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-[10px] transition-colors cursor-pointer" onClick={() => handleActivityClick(activity)}>
                  <div className={`rounded-[10px] w-10 h-10 flex-shrink-0 flex items-center justify-center ${
                    activity.type === 'success' ? 'bg-[#D1FAE5]' :
                    activity.type === 'info' ? 'bg-[#DBEAFE]' :
                    activity.type === 'message' ? 'bg-[#FEF3C7]' :
                    'bg-[#F3F4F6]'
                  }`}>
                    {activity.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#10B981]" />}
                    {activity.type === 'info' && <Clock className="w-5 h-5 text-[#3B82F6]" />}
                    {activity.type === 'message' && <Mail className="w-5 h-5 text-[#F59E0B]" />}
                    {activity.type === 'view' && <TrendingUp className="w-5 h-5 text-[#6B7280]" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] text-[#111827] leading-relaxed">{activity.text}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vacancy Stats Chart */}
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-[#111827]">Vacancy Stats</h3>
              <div className="flex items-center gap-4 text-[12px]">
                <button
                  className={`px-3 py-1.5 rounded-full ${
                    selectedFilter === "accepted" ? "bg-[#4F46E5] text-white" : "text-[#6B7280] hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedFilter("accepted")}
                >
                  Accepted
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full ${
                    selectedFilter === "interviews" ? "bg-[#4F46E5] text-white" : "text-[#6B7280] hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedFilter("interviews")}
                >
                  Interviews
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full ${
                    selectedFilter === "rejected" ? "bg-[#4F46E5] text-white" : "text-[#6B7280] hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedFilter("rejected")}
                >
                  Rejected
                </button>
                <select className="px-3 py-1.5 border border-[#E5E7EB] rounded-[8px] text-[#6B7280] cursor-pointer" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Last 3 Months</option>
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={vacancyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
                <Tooltip />
                <Legend />
                {selectedFilter === "accepted" && (
                  <Line type="monotone" dataKey="accepted" stroke="#6366F1" strokeWidth={2} name="Accepted" />
                )}
                {selectedFilter === "interviews" && (
                  <Line type="monotone" dataKey="interviews" stroke="#10B981" strokeWidth={2} name="Interviews" />
                )}
                {selectedFilter === "rejected" && (
                  <Line type="monotone" dataKey="rejected" stroke="#EF4444" strokeWidth={2} name="Rejected" />
                )}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-end gap-4 mt-4 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6366F1]"></div>
                <span className="text-[#111827] font-semibold">{latestVacancy.accepted}</span>
                <span className="text-[#6B7280]">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
                <span className="text-[#111827] font-semibold">{latestVacancy.interviews}</span>
                <span className="text-[#6B7280]">Interviews</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
                <span className="text-[#111827] font-semibold">{latestVacancy.rejected}</span>
                <span className="text-[#6B7280]">Rejected</span>
              </div>
            </div>
          </div>

          {/* Recommended Jobs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-semibold text-[#111827]">Recommended Jobs</h3>
              <button className="text-[14px] text-[#4F46E5] hover:text-[#4338CA] font-medium flex items-center gap-1" onClick={handleViewAllJobs}>
                View All
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedJobs.map((job, index) => (
                <div key={index} className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 hover:shadow-lg hover:border-[#4F46E5] transition-all duration-300 cursor-pointer group" onClick={() => handleJobClick(job.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white font-bold text-[14px] shadow-md">
                      {job.logo}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#6B7280] bg-gray-100 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {job.posted}
                    </div>
                  </div>
                  <h4 className="text-[15px] font-bold text-[#111827] mb-1 group-hover:text-[#4F46E5] transition-colors">{job.title}</h4>
                  <p className="text-[13px] text-[#6B7280] mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {job.company}
                  </p>
                  <p className="text-[14px] font-bold text-[#10B981] mb-3">{job.salary}</p>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed mb-4 line-clamp-2">{job.description}</p>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                    <div className="flex items-center gap-1 text-[12px] text-[#6B7280]">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <Users className="w-3 h-3" />
                        {job.applicants}
                      </div>
                      <span className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold ${
                        job.type === 'Remote' ? 'bg-[#DBEAFE] text-[#1E40AF]' :
                        job.type === 'Hybrid' ? 'bg-[#FEF3C7] text-[#92400E]' :
                        'bg-[#D1FAE5] text-[#065F46]'
                      }`}>
                        {job.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Companies */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-semibold text-[#111827]">Featured Companies</h3>
          <button className="text-[14px] text-[#4F46E5] hover:text-[#4338CA] font-medium flex items-center gap-1" onClick={handleExploreCompanies}>
            Explore All
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredCompanies.map((company, index) => (
            <div key={index} className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-lg hover:border-[#4F46E5] transition-all duration-300 cursor-pointer group" onClick={() => handleCompanyClick(company.name)}>
              <div className="w-16 h-16 rounded-[12px] bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center mb-4 group-hover:from-[#4F46E5] group-hover:to-[#7C3AED] transition-all duration-300">
                <span className="text-[20px] font-bold text-[#111827] group-hover:text-white transition-colors">{company.logo}</span>
              </div>
              <h4 className="text-[16px] font-bold text-[#111827] mb-1 group-hover:text-[#4F46E5] transition-colors">{company.name}</h4>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-[#10B981]" />
                <p className="text-[14px] font-semibold text-[#10B981]">{company.vacancies} Vacancies</p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#6B7280] mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>{company.employees} employees</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                <Building2 className="w-3.5 h-3.5" />
                <span>{company.industry}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
