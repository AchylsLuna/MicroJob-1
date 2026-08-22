import { useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Search,
  Send,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { EmployerDashboard } from "../employer/EmployerDashboard";
import { getCategories, getJobs, getUserApplications, getProfile } from "../../services/api";
import { jobsAPI } from "../../services/jobs";
import { ROUTES } from "../../utils/routes";
import { calculateProfileCompletion } from "../../lib/profileCompletion";
import { formatMinimumPay } from "../../lib/jobCompensation";
import { CategoryTile } from "../../components/ui/CategoryTile";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { JobCard } from "../../components/job/JobCard";
import { toJobCardData } from "../../components/job/jobCardModel";

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
  const [hasResume, setHasResume] = useState(false);
  const [hasLocation, setHasLocation] = useState(true);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string; count: number }>>([]);

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
        setHasResume(Boolean(profile?.resumeUrl || profile?.resumeFileName || profile?.resume));
        setHasLocation(Boolean(String(profile?.city || "").trim()));
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
        // Settled independently — recommended jobs, categories, and the
        // available-jobs list (used only for per-category counts) used to
        // share one Promise.all/catch, so one failing request silently
        // blanked all three sections instead of just the one that failed.
        const [jobsResult, categoriesResult, availableJobsResult] = await Promise.allSettled([
          jobsAPI.getRecommendedJobs(6),
          getCategories(),
          getJobs({ excludeOwn: true }),
        ]);
        if (!isMounted) return;

        if (jobsResult.status === "fulfilled") {
          const jobs = jobsResult.value.data;
          const transformedJobs = jobs.slice(0, 6).map((job: any) => ({
            id: job._id,
            title: job.title,
            company: job.jobPoster?.firstName ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ""}` : "Company",
            salary: formatMinimumPay(job.salary),
            location: job.location || "Location not specified",
            type: job.jobType || "Full-time",
            categoryId: typeof job.category === "string" ? undefined : job.category?._id,
            categoryName: typeof job.category === "string" ? job.category : job.category?.name,
            skills: Array.isArray(job.skills) ? job.skills : [],
            urgent: Boolean(job.urgent),
            matchPercentage: Number(job.match?.percentage || 0),
            matchLevel: job.match?.level || "Potential match",
          }));
          setRecommendedJobs(transformedJobs);
        } else {
          console.error("Failed to load recommended jobs:", jobsResult.reason);
          setRecommendedJobs([]);
        }

        if (categoriesResult.status === "rejected") console.error("Failed to load categories:", categoriesResult.reason);
        if (availableJobsResult.status === "rejected") console.error("Failed to load available jobs:", availableJobsResult.reason);

        const categoryRecords = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
        const availableJobs = availableJobsResult.status === "fulfilled" ? availableJobsResult.value : [];
        const allJobs = Array.isArray(availableJobs) ? availableJobs : [];
        const counts = allJobs.reduce<Record<string, number>>((result, job: any) => {
          const categoryId = typeof job?.category === "string" ? job.category : job?.category?._id;
          if (categoryId) result[String(categoryId)] = (result[String(categoryId)] || 0) + 1;
          return result;
        }, {});
        setCategories((Array.isArray(categoryRecords) ? categoryRecords : []).slice(0, 10).map((category: any) => ({
          _id: String(category._id || category.id || ""),
          name: String(category.name || "Category"),
          count: counts[String(category._id || category.id || "")] || 0,
        })));

        const allFailed = [jobsResult, categoriesResult, availableJobsResult].every((r) => r.status === "rejected");
        if (allFailed) toast.error("Failed to load recommended jobs.");
      } catch (error: any) {
        // Promise.allSettled never rejects, so this only catches a bug in the
        // handling above, not a network/API failure.
        if (!isMounted) return;
        console.error("Failed to load jobs:", error);
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

      <button
        type="button"
        onClick={() => navigate(ROUTES.worker.findJobs)}
        className="mx-auto flex min-h-14 w-full max-w-2xl items-center gap-3 rounded-full border border-slate-200 bg-white px-5 text-left text-sm font-semibold text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF1FB] text-[#1C4D8D]">
          <Search className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-slate-900">Search local jobs</span>
          <span className="block truncate text-xs font-medium text-slate-400">Skills, employers, or job titles</span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF1FB] text-[#1C4D8D]" aria-hidden>
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </span>
      </button>

      {!hasResume && !profileLoading ? (
        <section className="rounded-[24px] bg-[#255796] p-6 text-white shadow-[0_12px_32px_rgba(28,77,141,0.2)] lg:hidden">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><FileText className="h-6 w-6" aria-hidden /></span>
            <h2 className="text-xl font-extrabold">Upload your resume</h2>
          </div>
          <p className="mt-4 text-sm font-medium text-blue-100">Get matched with local employers across your community.</p>
          <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=resume`)} className="mt-5 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-[#1C4D8D]">Upload resume</button>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section>
          <SectionHeader title="Job Categories" onSeeAll={() => navigate(ROUTES.worker.findJobs)} seeAllLabel="Browse all" />
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => navigate(`${ROUTES.worker.findJobs}?category=${encodeURIComponent(category._id)}`)}
                className="shrink-0 snap-start"
              >
                <CategoryTile category={category} size="lg" showLabel count={category.count} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!hasLocation && !profileLoading ? (
        <section className="flex flex-col gap-4 rounded-2xl bg-[#EAF2FC] p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1C4D8D]"><MapPin className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="font-extrabold text-slate-950">Set your work location</h2><p className="mt-1 text-sm text-slate-500">Add your city or municipality to see nearby opportunities.</p></div>
          <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=personal`)} className="min-h-11 rounded-xl bg-[#1C4D8D] px-5 text-sm font-bold text-white">Open settings</button>
        </section>
      ) : null}

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
          onClick={() => navigate(`${ROUTES.worker.appliedJobs}?status=${encodeURIComponent("Interview Scheduled")}`)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Hired"
          count={isStatsLoading ? 0 : hiredCount}
          helper="Successful applications"
          iconClass="bg-emerald-50 text-emerald-700"
          onClick={() => navigate(`${ROUTES.worker.appliedJobs}?status=Hired`)}
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
            <SectionHeader title="Recommended Jobs" onSeeAll={handleViewAllJobs} seeAllLabel="View all" />
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
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
                {recommendedJobs.map((job, index) => (
                  <JobCard
                    key={job.id}
                    job={toJobCardData({
                      id: job.id,
                      title: job.title,
                      posterName: job.company,
                      location: job.location,
                      jobType: job.type,
                      salaryLabel: job.salary,
                      categoryId: job.categoryId,
                      categoryName: job.categoryName,
                      skills: job.skills,
                      urgent: job.urgent,
                      matchPercentage: job.matchPercentage,
                      matchLevel: job.matchLevel,
                    })}
                    variant="carousel"
                    showMatch
                    index={index}
                    onPress={() => handleJobClick(job.id)}
                    className="min-w-[240px] snap-start lg:min-w-0 lg:w-full"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
