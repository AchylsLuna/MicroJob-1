import { Calendar, Send, Wallet, Mail, TrendingUp, MapPin, Building2, Briefcase, CheckCircle2, Clock, Users, ArrowUpRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../contexts/ToastContext";
import { jobsAPI } from "../../services/jobs";
import { getUserProfile } from "../../services/api";

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

const sampleRecommendedJobs = [
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

const sampleFeaturedCompanies = [
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
      className={`${bgColor} rounded-[20px] p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 relative overflow-hidden cursor-pointer`}
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-[14px] p-3 shadow-lg">
            {icon}
          </div>
          {change && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              <span className="text-[12px] font-semibold">{change}</span>
            </div>
          )}
        </div>
        <p className="text-[13px] opacity-90 mb-1">{title}</p>
        <p className="text-[28px] font-bold tracking-tight">{count}</p>
      </div>
    </div>
  );
}

export default function WorkerDashboard() {
  const authUser = useAuth();
  const user = authUser ? { ...authUser, accountType: authUser.role === 'hire' ? 'employer' : 'worker' } : null;

  // If employer, redirect to employer dashboard (use main Dashboard)
  if (user?.accountType === "employer") {
    return <Navigate to="/dashboard" replace />;
  }

  const navigate = useNavigate();
  const toast = useToast();
  const [applicationCount, setApplicationCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);
  const [workerBalance, setWorkerBalance] = useState<number | null>(null);
  const [employerBalance, setEmployerBalance] = useState<number | null>(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isProfileVerified, setIsProfileVerified] = useState(false);
  const [serverRecommendedJobs, setServerRecommendedJobs] = useState<any[]>([]);
  const [serverFeaturedCompanies, setServerFeaturedCompanies] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"accepted" | "interviews" | "rejected">("accepted");
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const latestVacancy = vacancyData[vacancyData.length - 1];

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      setIsStatsLoading(true);
      try {
        const resp = await jobsAPI.getUserApplications();
        const applications = resp?.data || [];
        if (!isMounted) return;
        const total = Array.isArray(applications) ? applications.length : 0;
        const interviews = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Reviewed").length
          : 0;
        setApplicationCount(total);
        setInterviewCount(interviews);
      } catch (error: any) {
        if (!isMounted) return;
        toast.showToast?.(error?.message || "Failed to load dashboard stats.", 'error');
      } finally {
        if (isMounted) setIsStatsLoading(false);
      }
    };
    loadStats();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  // Load profile, recommended jobs, featured companies and unread messages
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      try {
        // Profile (balances + compute completeness)
        const profileRes = await getUserProfile();
        const profile = profileRes.profile || {};
        if (!mounted) return;
        setEmployerBalance(profile.employerBalance ?? null);
        setWorkerBalance(profile.workerBalance ?? null);

        // compute profile completion similar to Dashboard logic
        const personal = {
          firstName: profile.firstName,
          lastName: profile.lastName,
          city: profile.city,
          province: profile.province,
          address: profile.address,
          phoneNumber: profile.phoneNumber,
          email: profile.email,
          facebook: profile.facebook,
          profilePhotoName: profile.profilePhotoName,
        };
        const experience = {
          jobPosition: profile.jobPosition,
          companyName: profile.companyName,
          startDate: profile.startDate,
          endDate: profile.endDate,
        };
        const hasPersonal = Boolean(personal.firstName && personal.lastName && personal.city && personal.province && personal.address && personal.phoneNumber && personal.email);
        const hasPhoto = Boolean(personal.profilePhotoName);
        const hasExperience = Boolean(experience.jobPosition && experience.companyName && experience.startDate && experience.endDate);
        const hasResume = false; // server profile may not include resume flag; leave false
        const totalChecks = 4;
        const completed = [hasPersonal, hasPhoto, hasExperience, hasResume].filter(Boolean).length;
        const completionPercent = Math.round((completed / totalChecks) * 100);
        setProfileCompletion(completionPercent);
        setIsProfileVerified(completed === totalChecks);

        // Skills: try local storage fallback first
        try {
          const storedRaw = localStorage.getItem('profile_settings');
          if (storedRaw) {
            const parsed = JSON.parse(storedRaw);
            const skills = parsed?.skills || parsed?.techStack || [];
            if (Array.isArray(skills) && skills.length > 0) {
              setSkillsList(skills);
            }
          }
        } catch (e) {
          // ignore
        }

        // fetch jobs and compute recommended/featured
        try {
          const jobsResp = await jobsAPI.getJobs({ excludeOwn: true });
          const jobs = jobsResp?.data || [];
          if (!mounted) return;
          // fetch user's applications to exclude applied jobs
          const appsResp = await jobsAPI.getUserApplications();
          const apps = appsResp?.data || [];
          const appliedIds = new Set((apps || []).map((a: any) => a.job?._id).filter(Boolean));
          const filtered = jobs.filter((j: any) => !appliedIds.has(j._id));

          const mapped = filtered.slice(0, 6).map((job: any) => ({
            id: job._id,
            title: job.title,
            company: job.jobPoster?.companyName || job.companyName || job.company || 'Company',
            salary: job.salary || job.salaryRange || '',
            description: job.description || job.summary || '',
            location: job.location || job.city || '',
            type: job.jobType || job.type || 'Remote',
            posted: job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Recently',
            applicants: job.applicantsCount ?? 0,
            logo: (job.jobPoster?.companyName || job.companyName || '').split(' ').map((w:any)=>w[0]).join('').slice(0,2).toUpperCase() || 'CO',
          }));

          setServerRecommendedJobs(mapped.slice(0,3));

          // featured companies: group by company
          const companyMap: Record<string, { name: string; vacancies: number }> = {};
          jobs.forEach((j: any) => {
            const name = j.jobPoster?.companyName || j.companyName || j.company || 'Unknown';
            companyMap[name] = companyMap[name] || { name, vacancies: 0 };
            companyMap[name].vacancies += 1;
          });
          const featured = Object.values(companyMap).sort((a,b)=>b.vacancies - a.vacancies).slice(0,4).map(c=>({ name: c.name, vacancies: c.vacancies, employees: '—', industry: '—', logo: c.name.split(' ').map((w:any)=>w[0]).join('').slice(0,2).toUpperCase() }));
          setServerFeaturedCompanies(featured);
        } catch (e) {
          // ignore job fetch errors
        }

        // conversations -> unread count approximation
        try {
          const token = localStorage.getItem('auth_token');
          const convRes = await fetch('/api/messages/conversations', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (convRes.ok) {
            const convData = await convRes.json();
            const conversations = convData.conversations || [];
            // use conversation count as unread/messages indicator
            if (mounted) setUnreadMessagesCount(conversations.length || 0);
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        // profile load failed
        console.warn('WorkerDashboard loadAll error', err);
      }
    };
    loadAll();
    return () => { mounted = false; };
  }, []);

  const displayRecommendedJobs = serverRecommendedJobs.length > 0 ? serverRecommendedJobs : sampleRecommendedJobs;
  const displayFeaturedCompanies = serverFeaturedCompanies.length > 0 ? serverFeaturedCompanies : sampleFeaturedCompanies;

  const handleViewAllActivities = () => {
    navigate("/notifications");
  };

  const handleViewAllJobs = () => {
    navigate("/find-jobs");
  };

  const handleExploreCompanies = () => {
    navigate("/find-jobs");
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/job-details/${jobId}`);
  };

  const handleCompanyClick = (companyName: string) => {
    navigate(`/find-jobs?q=${encodeURIComponent(companyName)}`);
  };

  const handleActivityClick = (activity: { text: string; type: string }) => {
    if (activity.type === "message") {
      navigate("/dashboard/messages");
      return;
    }
    navigate("/worker/applied-jobs");
  };

  const handleStatClick = (statTitle: string) => {
    switch (statTitle) {
      case "Interviews Schedule":
      case "Application Sent":
        navigate("/worker/applied-jobs");
        return;
      case "E-wallet":
        navigate("/e-wallet");
        return;
      case "Unread Messages":
        navigate("/messages");
        return;
      default:
        toast.showToast?.(`Viewing details for: ${statTitle}`, 'info');
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-4 py-4">
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
          count={workerBalance ? Number(workerBalance) : 0}
          bgColor="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D]"
          change="+5%"
          onClick={() => handleStatClick("E-wallet")}
        />
        <StatCard
          icon={<Mail className="w-7 h-7 text-white" />}
          title="Unread Messages"
          count={unreadMessagesCount}
          bgColor="bg-gradient-to-br from-[#1C4D8D] to-[#0F2954]"
          change="+3%"
          onClick={() => handleStatClick("Unread Messages")}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Verification Status */}
          <div className="bg-gradient-to-br from-[#EEF2FF] to-white rounded-[16px] border border-[#E0E7FF] p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="relative mx-auto w-[100px] h-[100px] mb-3">
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
                  <p className="text-[36px] font-bold text-[#4F46E5]">{profileCompletion}</p>
                  <p className="text-[16px] text-[#6B7280]">%</p>
                </div>
              </div>
            </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className={`w-5 h-5 ${isProfileVerified ? 'text-[#10B981]' : 'text-[#9CA3AF]'}`} />
            <p className="text-[16px] font-semibold text-[#111827]">{isProfileVerified ? 'Profile Verified' : 'Profile Incomplete'}</p>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-2">{isProfileVerified ? 'All requirements completed' : 'Complete your profile to improve visibility'}</p>
          <button
            onClick={() => navigate("/settings?tab=verification")}
            className="mt-4 text-[12px] font-semibold text-[#4F46E5] hover:text-[#4338CA]"
          >
            View verification steps
          </button>
        </div>

          {/* Tech Stack */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[#111827]">Skills</h3>
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
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 shadow-sm hover:shadow-md transition-shadow">
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
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4">
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
            <ResponsiveContainer width="100%" height={180}>
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
              {displayRecommendedJobs.map((job, index) => (
                <div key={index} className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 hover:shadow-lg hover:border-[#4F46E5] transition-all duration-300 cursor-pointer group" onClick={() => handleJobClick(job.id)}>
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
          <h3 className="text-[20px] font-semibold text-[#111827]">Most taken jobs</h3>
          <button className="text-[14px] text-[#4F46E5] hover:text-[#4338CA] font-medium flex items-center gap-1" onClick={handleExploreCompanies}>
            Explore All
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayFeaturedCompanies.map((company, index) => (
            <div key={index} className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 hover:shadow-lg hover:border-[#4F46E5] transition-all duration-300 cursor-pointer group" onClick={() => handleCompanyClick(company.name)}>
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
