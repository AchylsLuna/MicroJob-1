import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  MessageSquare, 
  MoreVertical,
  MapPin,
  CalendarDays,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { getMyJobs } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  date: string;
  status: "Open" | "Hold" | "Closed";
  matchPercentage: number;
  matchQuality: "Strong Match" | "Good Match" | "Fair Match";
  salary: string;
  candidatesApplied: number;
  completedInterviews: number;
  tags: {
    workLocation: string;
    workType: string;
    experience: string;
    positions: string;
  };
  createdBy: string;
}

export function JobsManagement() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapStatus = (status?: string): JobPosting["status"] => {
    switch (status) {
      case "Available":
        return "Open";
      case "In Progress":
        return "Hold";
      case "Completed":
      case "Cancelled":
        return "Closed";
      default:
        return "Open";
    }
  };

  const getMatchQuality = (percentage: number): JobPosting["matchQuality"] => {
    if (percentage >= 80) return "Strong Match";
    if (percentage >= 50) return "Good Match";
    return "Fair Match";
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const mapJob = (job: any): JobPosting => {
    const applicantsCount = Array.isArray(job.applicants) ? job.applicants.length : 0;
    const matchPercentage = Math.min(100, applicantsCount * 7 + 30);
    const workTypeLabel =
      job.jobType === "Part-time"
        ? "Part Time"
        : job.jobType === "Freelance"
        ? "Freelance"
        : job.jobType === "Remote"
        ? "Remote"
        : "Full Time";
    const workLocationLabel = job.jobType === "Remote" ? "Remote" : "On Site";

    return {
      id: job._id,
      title: job.title || "Untitled Job",
      department: job.category?.name || "General",
      location: job.location || "Remote",
      date: formatDate(job.createdAt),
      status: mapStatus(job.status),
      matchPercentage,
      matchQuality: getMatchQuality(matchPercentage),
      salary: job.salary || "—",
      candidatesApplied: applicantsCount,
      completedInterviews: Math.max(0, Math.floor(applicantsCount / 3)),
      tags: {
        workLocation: workLocationLabel,
        workType: workTypeLabel,
        experience: "Entry level",
        positions: "1 Position",
      },
      createdBy: "You",
    };
  };

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getMyJobs();
        if (!isMounted) return;
        const mapped = Array.isArray(data) ? data.map(mapJob) : [];
        setJobs(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        const message = error?.message || "Failed to load job postings.";
        setLoadError(message);
        toast.error(message);
        setJobs([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-green-100 text-green-700";
      case "Hold":
        return "bg-gray-100 text-gray-700";
      case "Closed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 50) return "text-purple-600";
    return "text-orange-600";
  };

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <div>
          <h1 className="ui-page-title">Jobs Management</h1>
          <p className="ui-page-subtitle">
            Track job postings, candidate matches, and hiring progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.employer.applications)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Users className="w-4 h-4" />
            View Applications
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">Loading job postings...</p>
          </div>
        )}
        {loadError && !isLoading && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && jobs.map((job) => (
          <div
            key={job.id}
            className="ui-card p-6 transition-all hover:shadow-lg"
          >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(job.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {job.status}
                    </span>
                    <span className="text-xs text-slate-500">{job.department}</span>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Job Title */}
                <div className="mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-base">⚛</span>
                    </div>
                    <div>
                      <h3 className="mb-1 text-base font-semibold text-slate-900">{job.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {job.date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Percentage */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#E5E7EB"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke={job.matchPercentage >= 80 ? "#3B82F6" : job.matchPercentage >= 50 ? "#A855F7" : "#F59E0B"}
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - job.matchPercentage / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${getMatchColor(job.matchPercentage)}`}>
                        {job.matchPercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{job.matchQuality}</p>
                    <p className="text-xs text-slate-500">Match quality</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <TrendingUp className="w-4 h-4 text-[#9CA3AF]" />
                      Salary
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.salary}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-[#9CA3AF]" />
                      Candidates Applied
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.candidatesApplied}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <MessageSquare className="w-4 h-4 text-[#9CA3AF]" />
                      Completed Interview
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.completedInterviews}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700">
                    {job.tags.workLocation}
                  </span>
                  <span className="rounded px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700">
                    {job.tags.workType}
                  </span>
                  <span className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                    {job.tags.experience}
                  </span>
                  <span className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                    {job.tags.positions}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Created by <span className="font-semibold text-slate-900">{job.createdBy}</span>
                  </span>
                  <button
                    onClick={() => navigate(ROUTES.employer.applications)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#1C4D8D] hover:text-[#0F2954]"
                  >
                    View details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
          </div>
        ))}
        {!isLoading && !loadError && jobs.length === 0 && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">No job postings found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
