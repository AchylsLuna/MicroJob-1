import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Send,
  Users,
} from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { EmployerDashboard } from "../employer/EmployerDashboard";
import { getUserApplications, getProfile } from "../../services/api";
import { jobsAPI } from "../../services/jobs";
import { ROUTES } from "../../utils/routes";
import { calculateProfileCompletion } from "../../lib/profileCompletion";

type DashboardApplication = {
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  appliedDate?: string;
  job?: {
    title?: string;
  };
};

interface StatCardProps {
  icon: ReactNode;
  title: string;
  count: number;
  helper: string;
  iconClass: string;
  onClick?: () => void;
}

function StatCard({ icon, title, count, helper, iconClass, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      className="ui-card flex min-h-[138px] flex-col justify-between rounded-2xl border-slate-200 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8CBE5] hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{count}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{helper}</p>
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
  const [interviewCount, setInterviewCount] = useState(0);
  const [hiredCount, setHiredCount] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

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
          province: profile?.province,
          phoneNumber: profile?.phoneNumber,
          linkedin: profile?.linkedin,
          jobPosition: profile?.jobPosition,
          companyName: profile?.companyName,
          experience: profile?.experience,
          workExperience: profile?.workExperience,
          totalExperience: profile?.totalExperience,
          resumeUrl: profile?.resumeUrl,
          resumeFileName: profile?.resumeFileName,
          skills: profile?.skills,
        });

        setProfileCompletion(completionStatus.percentage);
        setIsProfileComplete(completionStatus.percentage === 100);
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to load profile:", error);
        setProfileCompletion(0);
        setIsProfileComplete(false);
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
        const hired = applications.filter((app) => ["Hired", "Accepted"].includes(String(app.status || ""))).length;
        
        setApplicationCount(total);
        setInterviewCount(interviews);
        setHiredCount(hired);

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
        
        const jobs = jobsResponse.data;

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

  const handleActivityClick = () => {
    navigate(ROUTES.worker.appliedJobs);
  };

  return (
    <div className="ui-page px-4 pb-16 md:px-0">
      <div className="ui-page-header">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">Worker workspace</p>
          <h1 className="ui-page-title mt-1">Work overview</h1>
          <p className="ui-page-subtitle">Track applications and find your next opportunity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.worker.appliedJobs)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Send className="h-4 w-4" />
            My applications
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.worker.findJobs)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163F75]"
          >
            <BriefcaseBusiness className="h-4 w-4" />
            Find jobs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Send className="h-5 w-5" />}
          title="Applications"
          count={isStatsLoading ? 0 : applicationCount}
          helper="All submitted applications"
          iconClass="bg-[#EAF2FC] text-[#1C4D8D]"
          onClick={() => navigate(ROUTES.worker.appliedJobs)}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          title="Interviews"
          count={isStatsLoading ? 0 : interviewCount}
          helper="Scheduled or completed interviews"
          iconClass="bg-sky-50 text-sky-700"
          onClick={() => navigate(ROUTES.worker.appliedJobs)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Hired"
          count={isStatsLoading ? 0 : hiredCount}
          helper="Successful applications"
          iconClass="bg-emerald-50 text-emerald-700"
          onClick={() => navigate(ROUTES.worker.appliedJobs)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#CFE0F5] bg-[#F5F9FE] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Profile strength</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isProfileComplete ? "Your profile is ready for employers." : "A complete profile improves job matching."}
                </p>
              </div>
              {isProfileComplete ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /> : null}
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#1C4D8D]">{profileLoading ? "Loading..." : `${profileCompletion}% complete`}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-[#1C4D8D] transition-all"
                style={{ width: `${profileLoading ? 0 : profileCompletion}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.worker.profile)}
              className="mt-5 inline-flex text-sm font-semibold text-[#1C4D8D] transition hover:text-[#163F75]"
            >
              {isProfileComplete ? "View profile" : "Complete profile"}
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
                  onClick={handleActivityClick}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] ${
                      activity.type === "success"
                        ? "bg-[#D1FAE5]"
                        : activity.type === "info"
                        ? "bg-[#1C4D8D]/10"
                        : "bg-[#F1F5F9]"
                    }`}
                  >
                    {activity.type === "success" && <CheckCircle2 className="h-5 w-5 text-[#10B981]" />}
                    {activity.type === "info" && <Clock className="h-5 w-5 text-[#1C4D8D]" />}
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
