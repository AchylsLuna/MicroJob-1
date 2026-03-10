import { useEffect, useState } from "react";
import { Search, Filter, Calendar, FileText, User as UserIcon, Mail, ExternalLink, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "../../lib/toast";
import { getEmployerApplications, updateApplicationStatus } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";

type ApplicationStatus = "all" | "shortlisted" | "interviewed" | "hired" | "rejected";

interface Application {
  id: string;
  jobId: string;
  applicantId: string;
  name: string;
  email: string;
  position: string;
  company: string;
  coverLetter: string;
  city?: string;
  province?: string;
  about?: string;
  totalExperience?: string;
  successRate?: string;
  jobsApplied?: number;
  projectsCompleted?: number;
  skills?: string[];
  resumeUrl?: string;
  resumeFileName?: string;
  resume?: string;
  appliedDate: string;
  status: Exclude<ApplicationStatus, "all">;
}

const toAbsoluteAssetUrl = (value?: string): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) {
    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const origin = apiBase.startsWith('http')
      ? apiBase.replace(/\/api\/?$/, '')
      : window.location.origin;
    return `${origin}${value}`;
  }
  return value;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-[#93C5FD]",
    "bg-[#A5B4FC]",
    "bg-[#C4B5FD]",
    "bg-[#F9A8D4]",
    "bg-[#FCA5A5]",
    "bg-[#FDBA74]",
    "bg-[#FCD34D]",
    "bg-[#BEF264]",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

interface StatusBadgeProps {
  status: Exclude<ApplicationStatus, "all">;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "shortlisted":
        return {
          bg: "bg-[#E0E7FF]",
          text: "text-[#5B21B6]",
          label: "Shortlisted",
        };
      case "interviewed":
        return {
          bg: "bg-[#DBEAFE]",
          text: "text-[#1E40AF]",
          label: "To Be Interview",
        };
      case "hired":
        return {
          bg: "bg-[#D1FAE5]",
          text: "text-[#065F46]",
          label: "Hired",
        };
      case "rejected":
        return {
          bg: "bg-[#FEE2E2]",
          text: "text-[#991B1B]",
          label: "Rejected",
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <span className={`${styles.bg} ${styles.text} px-3 py-1 rounded-full text-[12px] font-medium`}>
      {styles.label}
    </span>
  );
}

interface ApplicationCardProps {
  application: Application;
  onStatusChange: (id: string, status: Exclude<ApplicationStatus, "all">) => void;
  onMessage: (application: Application) => void;
  onViewPublicProfile: (application: Application) => void;
  isExpanded: boolean;
  onToggleProfile: (id: string) => void;
}

function ApplicationCard({
  application,
  onStatusChange,
  onMessage,
  onViewPublicProfile,
  isExpanded,
  onToggleProfile,
}: ApplicationCardProps) {
  const initials = getInitials(application.name);
  const avatarColor = getAvatarColor(application.name);
  const resolvedResumeUrl = toAbsoluteAssetUrl(application.resumeUrl || application.resume);

  return (
    <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`${avatarColor} rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0`}>
          <span className="text-[#1F2937] font-semibold text-[16px]">{initials}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h3 className="font-semibold text-[16px] text-[#111827]">{application.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[14px] text-[#6B7280]">{application.email}</span>
              </div>
            </div>
            <StatusBadge status={application.status} />
          </div>

          {/* Position */}
          <p className="text-[14px] text-[#4B5563] mb-3">
            Applied for: <span className="font-semibold text-[#111827]">{application.position}</span> at {application.company}
          </p>

          {/* Cover Letter */}
          <p className="text-[14px] text-[#6B7280] leading-relaxed mb-4">
            {application.coverLetter}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#6B7280] text-[14px]">
                <Calendar className="w-4 h-4" />
                <span>{application.appliedDate}</span>
              </div>
              {resolvedResumeUrl ? (
                <a
                  className="flex items-center gap-1 text-[#2563EB] text-[14px] font-medium hover:text-[#1D4ED8] transition-colors"
                  href={resolvedResumeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="w-4 h-4" />
                  Resume
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="flex items-center gap-1 text-[#94A3B8] text-[14px] font-medium">
                  <FileText className="w-4 h-4" />
                  No Resume
                </span>
              )}
              <button
                className="flex items-center gap-1 text-[#2563EB] text-[14px] font-medium hover:text-[#1D4ED8] transition-colors"
                onClick={() => onToggleProfile(application.id)}
              >
                <UserIcon className="w-4 h-4" />
                {isExpanded ? "Hide Profile" : "View Profile"}
              </button>
              <button
                className="flex items-center gap-1 text-[#0F766E] text-[14px] font-medium hover:text-[#115E59] transition-colors"
                onClick={() => onViewPublicProfile(application)}
              >
                <ExternalLink className="w-4 h-4" />
                Open Full Profile
              </button>
              {application.applicantId && (
                <button
                  className="flex items-center gap-1 text-[#2563EB] text-[14px] font-medium hover:text-[#1D4ED8] transition-colors"
                  onClick={() => onMessage(application)}
                >
                  💬 Message
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <select
              value={application.status}
              onChange={(e) => onStatusChange(application.id, e.target.value as Exclude<ApplicationStatus, "all">)}
              className="px-4 py-2 border border-[#D1D5DB] rounded-lg text-[14px] text-[#374151] bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
            >
              <option value="shortlisted">Shortlisted</option>
              <option value="interviewed">To Be Interview</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {isExpanded && (
            <div className="mt-4 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="rounded-[10px] bg-white border border-[#DBEAFE] px-3 py-2">
                  <p className="text-[11px] text-[#64748B]">Applied Jobs</p>
                  <p className="text-[16px] font-bold text-[#1D4ED8]">{application.jobsApplied ?? 0}</p>
                </div>
                <div className="rounded-[10px] bg-white border border-[#DBEAFE] px-3 py-2">
                  <p className="text-[11px] text-[#64748B]">Completed Jobs</p>
                  <p className="text-[16px] font-bold text-[#1D4ED8]">{application.projectsCompleted ?? 0}</p>
                </div>
                <div className="rounded-[10px] bg-white border border-[#DBEAFE] px-3 py-2">
                  <p className="text-[11px] text-[#64748B]">Success Rate</p>
                  <p className="text-[16px] font-bold text-[#1D4ED8]">{application.successRate || "0%"}</p>
                </div>
              </div>
              {application.city || application.province ? (
                <p className="text-[13px] text-[#475569] mb-1">
                  Location: {[application.city, application.province].filter(Boolean).join(', ')}
                </p>
              ) : null}
              {application.totalExperience ? (
                <p className="text-[13px] text-[#475569] mb-1">Experience: {application.totalExperience}</p>
              ) : null}
              {application.about ? <p className="text-[13px] text-[#475569]">About: {application.about}</p> : null}
              {application.skills && application.skills.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[12px] font-semibold text-[#334155] mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {application.skills.map((skill) => (
                      <span key={skill} className="px-2 py-1 rounded-full text-[11px] bg-[#E0E7FF] text-[#3730A3]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {resolvedResumeUrl ? (
                <div className="mt-3">
                  <a
                    href={resolvedResumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    Open Resume {application.resumeFileName ? `(${application.resumeFileName})` : ''}
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApplicationsManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus>("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const pageSize = 4;

  const handleStatusChange = async (id: string, newStatus: Exclude<ApplicationStatus, "all">) => {
    const previous = applications.find(app => app.id === id)?.status;
    setApplications((apps) =>
      apps.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );

    const statusLabels: Record<Exclude<ApplicationStatus, "all">, string> = {
      "shortlisted": "Shortlisted",
      "interviewed": "To Be Interview",
      "hired": "Hired",
      "rejected": "Rejected",
    };

    const backendStatus =
      newStatus === "hired"
        ? "Hired"
        : newStatus === "interviewed"
        ? "Interviewed"
        : newStatus === "rejected"
        ? "Rejected"
        : "Shortlisted";

    try {
      try {
        await updateApplicationStatus(id, backendStatus);
      } catch (innerError: any) {
        const needsLegacyFallback =
          newStatus === "interviewed" &&
          String(innerError?.message || "").includes("Invalid status");
        if (!needsLegacyFallback) {
          throw innerError;
        }
        await updateApplicationStatus(id, "Terms");
      }
      toast.success(`Application marked as ${statusLabels[newStatus].toLowerCase()}`, {
        description: "Candidate status has been updated.",
      });
    } catch (error: any) {
      if (previous) {
        setApplications((apps) =>
          apps.map((app) => (app.id === id ? { ...app, status: previous } : app))
        );
      }
      toast.error(error?.message || "Failed to update status.");
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const mapStatus = (status?: string): Exclude<ApplicationStatus, "all"> => {
    switch (status) {
      case "Pending":
      case "Reviewed":
      case "Shortlisted":
        return "shortlisted";
      case "Terms":
      case "Interviewed":
        return "interviewed";
      case "Accepted":
      case "Hired":
        return "hired";
      case "Rejected":
        return "rejected";
      default:
        return "shortlisted";
    }
  };

  const mapApplication = (app: any): Application => {
    const applicant = app.applicant || {};
    const job = app.job || {};
    const applicantName = `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim() || "Applicant";
    const companyName = job.company || "MicroJobs";
    return {
      id: app._id,
      jobId: job._id || "",
      applicantId: applicant._id || "",
      name: applicantName,
      email: applicant.email || "—",
      position: job.title || "Untitled Job",
      company: companyName,
      coverLetter: app.coverLetter || "No cover letter provided.",
      city: applicant.city || "",
      province: applicant.province || "",
      about: applicant.about || "",
      totalExperience: applicant.totalExperience || "",
      successRate: applicant.successRate || "0%",
      jobsApplied: typeof applicant.jobsApplied === "number" ? applicant.jobsApplied : 0,
      projectsCompleted: typeof applicant.projectsCompleted === "number" ? applicant.projectsCompleted : 0,
      skills: Array.isArray(applicant.skills) ? applicant.skills.map((skill: any) => skill?.name).filter(Boolean) : [],
      resumeUrl: applicant.resumeUrl || "",
      resumeFileName: applicant.resumeFileName || "",
      resume: app.resume || "",
      appliedDate: formatDate(app.createdAt || app.appliedDate),
      status: mapStatus(app.status),
    };
  };

  const handleToggleProfile = (applicationId: string) => {
    setExpandedApplicationId((prev) => (prev === applicationId ? null : applicationId));
  };

  const handleViewPublicProfile = (application: Application) => {
    if (!application.applicantId) {
      toast.error("Applicant profile is not available.");
      return;
    }
    navigate(`${ROUTES.publicProfile(application.applicantId)}?viewAs=worker`);
  };

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getEmployerApplications();
        if (!isMounted) return;
        const mapped = Array.isArray(data) ? data.map(mapApplication) : [];
        setApplications(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || "Failed to load applications.");
        setApplications([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadApplications();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMessageApplicant = (application: Application) => {
    if (!application.applicantId) return;
    const interviewPrefill = `Hi ${application.name}, this is regarding your application for ${application.position}. We would like to contact you for interview scheduling. Please let us know your availability.`;
    navigate(ROUTES.employer.messages, {
      state: {
        userId: application.applicantId,
        name: application.name,
        jobId: application.jobId,
        jobTitle: application.position,
        prefill: interviewPrefill,
      },
    });
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesJob =
      jobFilter === "all" ||
      app.jobId === jobFilter ||
      (!app.jobId && app.position === jobFilter);

    return matchesSearch && matchesStatus && matchesJob;
  });

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const pagedApplications = filteredApplications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const jobOptions = Array.from(
    new Map(applications.map((app) => [app.jobId || app.position, app.position])).entries(),
  ).map(([id, label]) => ({ id, label }));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, jobFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-12 pr-4 py-2.5 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus)}
              className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-10 pr-10 py-2.5 text-[14px] text-[#111827] outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interviewed">To Be Interview</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Job Filter */}
          <div className="relative min-w-[180px]">
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="w-full bg-white border border-[#D1D5DB] rounded-lg px-4 pr-10 py-2.5 text-[14px] text-[#111827] outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="all">All Jobs</option>
              {jobOptions.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-[16px]">Loading applications...</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-[16px]">{loadError}</p>
            <p className="text-[#9CA3AF] text-[14px] mt-2">Please try again later.</p>
          </div>
        ) : pagedApplications.length > 0 ? (
          pagedApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onStatusChange={handleStatusChange}
              onMessage={handleMessageApplicant}
                  onViewPublicProfile={handleViewPublicProfile}
              isExpanded={expandedApplicationId === application.id}
              onToggleProfile={handleToggleProfile}
            />
          ))
        ) : (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-[16px]">No applications found</p>
            <p className="text-[#9CA3AF] text-[14px] mt-2">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {filteredApplications.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="flex items-center gap-3 text-[14px] text-[#4F46E5] hover:text-[#4338CA] font-semibold disabled:text-[#94A3B8]"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to page {String(1).padStart(2, "0")}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="w-11 h-11 rounded-full border border-[#4F46E5] flex items-center justify-center text-[#4F46E5] hover:bg-[#EEF2FF] disabled:border-[#E5E7EB] disabled:text-[#94A3B8]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-[#4F46E5] text-white text-[14px] font-semibold hover:bg-[#4338CA] disabled:opacity-50"
            >
              Next Page
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[14px] text-[#6B7280]">
            <span>Page</span>
            <input
              type="text"
              inputMode="numeric"
              value={String(currentPage).padStart(2, "0")}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                if (!raw) {
                  setCurrentPage(1);
                  return;
                }
                const value = Number(raw);
                if (!Number.isNaN(value)) {
                  setCurrentPage(Math.min(Math.max(1, value), totalPages));
                }
              }}
              className="w-[72px] text-center border border-[#E5E7EB] rounded-full px-3 py-2 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            />
            <span>of {String(totalPages).padStart(2, "0")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
