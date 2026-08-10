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
import { getUserApplications, getProfile } from "../../services/api";
import { jobsAPI } from "../../services/jobs";
import { ROUTES } from "../../utils/routes";
import { calculateProfileCompletion, getCompletionColor } from "../../lib/profileCompletion";

type VacancyFilter = "accepted" | "interviews" | "rejected";
type VacancyPeriod = "thisMonth" | "lastMonth" | "last3Months";

type ApplicationTimelineItem = {
  status?: string;
  createdAt?: string;
};

type DashboardApplication = {
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  appliedDate?: string;
  timeline?: ApplicationTimelineItem[];
  job?: {
    title?: string;
  };
};

type VacancyChartPoint = {
  label: string;
  accepted: number;
  interviews: number;
  rejected: number;
};

type VacancyBucket = {
  label: string;
  start: Date;
  endExclusive: Date;
};

const VACANCY_PERIOD_OPTIONS: Array<{ value: VacancyPeriod; label: string }> = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "last3Months", label: "Last 3 Months" },
];

const ACCEPTED_STATUSES = new Set(["Hired", "Accepted"]);
const INTERVIEW_STATUSES = new Set(["Interview Scheduled", "Interviewed"]);
const REJECTED_STATUSES = new Set(["Rejected"]);

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findFirstStatusDate(application: DashboardApplication, statuses: Set<string>) {
  const timeline = Array.isArray(application.timeline) ? application.timeline : [];
  const timelineMatch = timeline
    .map((item) => ({
      status: String(item?.status || "").trim(),
      createdAt: parseDateValue(item?.createdAt),
    }))
    .filter((item): item is { status: string; createdAt: Date } => Boolean(item.status && item.createdAt))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .find((item) => statuses.has(item.status));

  if (timelineMatch) {
    return timelineMatch.createdAt;
  }

  const currentStatus = String(application.status || "").trim();
  if (!statuses.has(currentStatus)) {
    return null;
  }

  return (
    parseDateValue(application.updatedAt) ??
    parseDateValue(application.appliedDate) ??
    parseDateValue(application.createdAt)
  );
}

function buildWeeklyBuckets(monthDate: Date): VacancyBucket[] {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const nextMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const buckets: VacancyBucket[] = [];

  let cursor = monthStart;
  let weekIndex = 1;

  while (cursor < nextMonthStart) {
    const endExclusive = new Date(cursor);
    endExclusive.setDate(endExclusive.getDate() + 7);

    if (endExclusive > nextMonthStart) {
      endExclusive.setTime(nextMonthStart.getTime());
    }

    buckets.push({
      label: `Week ${String(weekIndex).padStart(2, "0")}`,
      start: new Date(cursor),
      endExclusive,
    });

    cursor = endExclusive;
    weekIndex += 1;
  }

  return buckets;
}

function buildMonthlyBuckets(now: Date): VacancyBucket[] {
  return Array.from({ length: 3 }, (_, index) => {
    const bucketStart = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);
    return {
      label: bucketStart.toLocaleDateString(undefined, { month: "short" }),
      start: bucketStart,
      endExclusive: new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 1),
    };
  });
}

function buildVacancyChartData(applications: DashboardApplication[], period: VacancyPeriod) {
  const now = new Date();
  const buckets =
    period === "last3Months"
      ? buildMonthlyBuckets(now)
      : buildWeeklyBuckets(
          period === "lastMonth"
            ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
            : new Date(now.getFullYear(), now.getMonth(), 1)
        );

  if (!buckets.length) {
    return {
      data: [] as VacancyChartPoint[],
      totals: { accepted: 0, interviews: 0, rejected: 0 },
    };
  }

  const rangeStartMs = buckets[0].start.getTime();
  const rangeEndMs = buckets[buckets.length - 1].endExclusive.getTime();

  const acceptedTimes = applications
    .map((application) => findFirstStatusDate(application, ACCEPTED_STATUSES)?.getTime() ?? null)
    .filter((value): value is number => value !== null && value >= rangeStartMs && value < rangeEndMs)
    .sort((left, right) => left - right);

  const interviewTimes = applications
    .map((application) => findFirstStatusDate(application, INTERVIEW_STATUSES)?.getTime() ?? null)
    .filter((value): value is number => value !== null && value >= rangeStartMs && value < rangeEndMs)
    .sort((left, right) => left - right);

  const rejectedTimes = applications
    .map((application) => findFirstStatusDate(application, REJECTED_STATUSES)?.getTime() ?? null)
    .filter((value): value is number => value !== null && value >= rangeStartMs && value < rangeEndMs)
    .sort((left, right) => left - right);

  let acceptedIndex = 0;
  let interviewIndex = 0;
  let rejectedIndex = 0;

  const totals = {
    accepted: 0,
    interviews: 0,
    rejected: 0,
  };

  const data = buckets.map((bucket) => {
    const bucketEndMs = bucket.endExclusive.getTime();

    while (acceptedIndex < acceptedTimes.length && acceptedTimes[acceptedIndex] < bucketEndMs) {
      totals.accepted += 1;
      acceptedIndex += 1;
    }

    while (interviewIndex < interviewTimes.length && interviewTimes[interviewIndex] < bucketEndMs) {
      totals.interviews += 1;
      interviewIndex += 1;
    }

    while (rejectedIndex < rejectedTimes.length && rejectedTimes[rejectedIndex] < bucketEndMs) {
      totals.rejected += 1;
      rejectedIndex += 1;
    }

    return {
      label: bucket.label,
      accepted: totals.accepted,
      interviews: totals.interviews,
      rejected: totals.rejected,
    };
  });

  return { data, totals };
}

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
  return user?.accountType === "employer" ? <EmployerDashboard /> : <WorkerDashboardContent />;
}

function WorkerDashboardContent() {
  const navigate = useNavigate();
  const [applicationCount, setApplicationCount] = useState(0);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [interviewCount, setInterviewCount] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<VacancyFilter>("accepted");
  const [selectedPeriod, setSelectedPeriod] = useState<VacancyPeriod>("thisMonth");
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isProfileVerified, setIsProfileVerified] = useState(false);

  // Fetch profile data
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const profile = await getProfile();
        if (!isMounted) return;
        
        // Use the new profile completion calculator
        const completionStatus = calculateProfileCompletion({
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          avatarUrl: profile?.avatarUrl,
          profilePhotoName: profile?.profilePhotoName,
          about: profile?.about,
          city: profile?.city,
          country: profile?.country,
          province: profile?.province,
          address: profile?.address,
          phoneNumber: profile?.phoneNumber,
          linkedin: profile?.linkedin,
          email: profile?.email,
          jobPosition: profile?.jobPosition,
          companyName: profile?.companyName,
          startDate: profile?.startDate,
          endDate: profile?.endDate,
          experience: profile?.experience,
          education: profile?.education,
          resumeUrl: profile?.resumeUrl,
          resumeFileName: profile?.resumeFileName,
          skills: profile?.skills,
        });

        setProfileCompletion(completionStatus.percentage);
        setIsProfileVerified(completionStatus.percentage === 100);
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to load profile:", error);
        setProfileCompletion(0);
        setIsProfileVerified(false);
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch jobs and applications
  useEffect(() => {
    let isMounted = true;
    
    const loadStats = async () => {
      setIsStatsLoading(true);
      try {
        const applicationsResponse = await getUserApplications();
        if (!isMounted) return;
        
        const applications = (
          Array.isArray(applicationsResponse) ? applicationsResponse : (applicationsResponse as any)?.data || []
        ) as DashboardApplication[];
        const total = applications.length;
        const interviews = applications.filter((app) => ["Interview Scheduled", "Interviewed"].includes(String(app.status || ""))).length;
        
        setApplications(applications);
        setApplicationCount(total);
        setInterviewCount(interviews);

        // Build recent activities from applications
        const activities = applications.slice(0, 4).map((app) => {
          const status = app.status || "Applied";
          const statusMap: Record<string, { text: string; type: string }> = {
            "Applied": { text: "Application submitted", type: "info" },
            "Shortlisted": { text: "Application shortlisted", type: "success" },
            "Interview Scheduled": { text: "Interview scheduled", type: "info" },
            "Interviewed": { text: "Interview completed", type: "info" },
            "Offer Sent": { text: "Offer received", type: "success" },
            "Hired": { text: "Application accepted", type: "success" },
            "Rejected": { text: "Application rejected", type: "view" },
            "Withdrawn": { text: "Application withdrawn", type: "view" },
            "Pending": { text: "Application submitted", type: "info" },
            "Reviewed": { text: "Application reviewed", type: "info" },
            "Terms": { text: "Offer received", type: "success" },
          };
          const statusInfo = statusMap[status] || { text: "Application updated", type: "info" };
          return {
            text: `${statusInfo.text} for ${app.job?.title || "a job"}`,
            time: app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Just now",
            type: statusInfo.type,
            activity: app,
          };
        });
        setRecentActivities(activities);
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to load applications:", error);
        setApplications([]);
        toast.error(error?.message || "Failed to load dashboard stats.");
      } finally {
        if (isMounted) setIsStatsLoading(false);
      }
    };

    const loadJobs = async () => {
      setJobsLoading(true);
      try {
        const jobsResponse = await jobsAPI.getRecommendedJobs(6);
        if (!isMounted) return;
        
        const jobs = Array.isArray(jobsResponse.data) ? jobsResponse.data : jobsResponse.data?.data || [];

        // Transform jobs for display
        const transformedJobs = jobs.slice(0, 3).map((job: any) => ({
          id: job._id,
          title: job.title,
          company: job.jobPoster?.firstName ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ""}` : "Company",
          salary: job.salary ? `₱${job.salary}` : "Negotiable",
          location: job.location || "Remote",
          type: job.jobType || "Full-time",
          posted: job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "Recently",
          logo: (job.title && job.title[0]) || "J",
          matchPercentage: Number(job.match?.percentage || 0),
          matchLevel: job.match?.level || "Potential match",
          matchReasons: Array.isArray(job.match?.reasons) ? job.match.reasons : [],
        }));
        
        setRecommendedJobs(transformedJobs);
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to load jobs:", error);
        toast.error(error?.message || "Failed to load recommended jobs.");
        setRecommendedJobs([]);
      } finally {
        if (isMounted) setJobsLoading(false);
      }
    };

    loadStats();
    loadJobs();
    
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

  const vacancyStats = buildVacancyChartData(applications, selectedPeriod);
  const vacancyAxisMax = Math.max(1, ...vacancyStats.data.map((point) => point[selectedFilter]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-7 w-7 text-white" />}
          title="Interviews Schedule"
          count={isStatsLoading ? 0 : interviewCount}
          bgColor="bg-[#1C4D8D]"
          change="+12%"
          onClick={() => handleStatClick("Interviews Schedule")}
        />
        <StatCard
          icon={<Send className="h-7 w-7 text-white" />}
          title="Application Sent"
          count={isStatsLoading ? 0 : applicationCount}
          bgColor="bg-[#1C4D8D]"
          change="+8%"
          onClick={() => handleStatClick("Application Sent")}
        />
        <StatCard
          icon={<Wallet className="h-7 w-7 text-white" />}
          title="E-wallet"
          count={0}
          bgColor="bg-[#1C4D8D]"
          change="+5%"
          onClick={() => handleStatClick("E-wallet")}
        />
        <StatCard
          icon={<Mail className="h-7 w-7 text-white" />}
          title="Unread Messages"
          count={0}
          bgColor="bg-[#1C4D8D]"
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
                  stroke={getCompletionColor(profileCompletion)}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(profileCompletion / 100) * 339.292} ${339.292}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  style={{ transition: 'stroke 0.3s ease, stroke-dasharray 0.3s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[40px] font-bold leading-none" style={{ color: getCompletionColor(profileCompletion) }}>{profileLoading ? 0 : profileCompletion}</p>
                  <p className="mt-1 text-[16px]" style={{ color: getCompletionColor(profileCompletion) }}>%</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {isProfileVerified && <CheckCircle2 className="h-5 w-5 text-[#10B981]" />}
              <p className="text-[18px] font-semibold text-[#111827]">{isProfileVerified ? "Profile Verified" : "Profile Incomplete"}</p>
            </div>
            <p className="mt-2 text-[13px]" style={{ color: getCompletionColor(profileCompletion) }}>
              {isProfileVerified ? "All requirements completed" : "Complete your profile to increase visibility"}
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.worker.profile)}
              className="mt-4 text-[13px] font-semibold text-[#1C4D8D] hover:opacity-80"
            >
              {isProfileVerified ? "View profile" : "Complete profile"}
            </button>
          </div>

          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Recent Activities</h3>
              <button
                type="button"
                className="text-[13px] font-medium text-[#1C4D8D] hover:opacity-80"
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
                        ? "bg-[#1C4D8D]/10"
                        : activity.type === "message"
                        ? "bg-[#FEF3C7]"
                        : "bg-[#F1F5F9]"
                    }`}
                  >
                    {activity.type === "success" && <CheckCircle2 className="h-5 w-5 text-[#10B981]" />}
                    {activity.type === "info" && <Clock className="h-5 w-5 text-[#1C4D8D]" />}
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
                    selectedFilter === "accepted" ? "bg-[#1C4D8D] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("accepted")}
                >
                  Accepted
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 font-medium ${
                    selectedFilter === "interviews"
                      ? "bg-[#1C4D8D] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("interviews")}
                >
                  Interviews
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 font-medium ${
                    selectedFilter === "rejected" ? "bg-[#1C4D8D] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                  onClick={() => setSelectedFilter("rejected")}
                >
                  Rejected
                </button>
                <select
                  className="h-10 rounded-[10px] border border-[#E5E7EB] px-3 text-[13px] text-[#6B7280]"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as VacancyPeriod)}
                >
                  {VACANCY_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={282}>
              <LineChart data={vacancyStats.data}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B7280" }} />
                <YAxis allowDecimals={false} domain={[0, vacancyAxisMax]} tick={{ fontSize: 12, fill: "#6B7280" }} />
                <Tooltip />
                <Legend />
                {selectedFilter === "accepted" && (
                  <Line
                    type="monotone"
                    dataKey="accepted"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    name="Accepted"
                    dot={{ r: 4, strokeWidth: 3, fill: "#FFFFFF" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {selectedFilter === "interviews" && (
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    name="Interviews"
                    dot={{ r: 4, strokeWidth: 3, fill: "#FFFFFF" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {selectedFilter === "rejected" && (
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    name="Rejected"
                    dot={{ r: 4, strokeWidth: 3, fill: "#FFFFFF" }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-4 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#6366F1]" />
                <span className="font-semibold text-[#111827]">{vacancyStats.totals.accepted}</span>
                <span className="text-[#6B7280]">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                <span className="font-semibold text-[#111827]">{vacancyStats.totals.interviews}</span>
                <span className="text-[#6B7280]">Interviews</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
                <span className="font-semibold text-[#111827]">{vacancyStats.totals.rejected}</span>
                <span className="text-[#6B7280]">Rejected</span>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827]">Recommended Jobs</h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-[#1C4D8D] hover:opacity-80"
                onClick={handleViewAllJobs}
              >
                View all
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            {jobsLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 animate-pulse">
                    <div className="mb-3 h-10 w-10 rounded-[10px] bg-[#E5E7EB]" />
                    <div className="h-5 w-3/4 rounded bg-[#E5E7EB]" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-[#E5E7EB]" />
                  </div>
                ))}
              </div>
            ) : recommendedJobs.length === 0 ? (
              <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] p-6 text-center">
                <p className="text-[14px] text-[#6B7280]">No jobs available at the moment. Check back later!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recommendedJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleJobClick(job.id)}
                  className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#C7D8F9] hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#1C4D8D] text-[12px] font-bold text-white">
                      {job.logo}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        {job.matchPercentage}% Match
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
                        <Clock className="h-3 w-3" />
                        {job.posted}
                      </span>
                    </div>
                  </div>
                  <p className="text-[15px] font-semibold text-[#111827]">{job.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-[#64748B]">
                    <Building2 className="h-3.5 w-3.5" />
                    {job.company}
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-[#10B981]">{job.salary}</p>
                  {job.matchReasons.length ? (
                    <p className="mt-2 line-clamp-1 text-[11px] text-[#64748B]">{job.matchReasons.join(" · ")}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between border-t border-[#EEF2F7] pt-3">
                    <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        job.type === "Remote"
                          ? "bg-[#1C4D8D]/10 text-[#1C4D8D]"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
