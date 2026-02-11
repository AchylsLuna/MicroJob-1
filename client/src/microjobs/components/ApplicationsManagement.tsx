import { useEffect, useState } from "react";
import { Search, Filter, Calendar, FileText, User as UserIcon, Mail, ExternalLink, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "../lib/toast";
import { getEmployerApplications, updateApplicationStatus } from "../../services/api";

type ApplicationStatus = "all" | "under-review" | "pending" | "reviewing" | "interviewed" | "accepted" | "rejected";

interface Application {
  id: string;
  jobId: string;
  name: string;
  email: string;
  position: string;
  company: string;
  coverLetter: string;
  appliedDate: string;
  status: Exclude<ApplicationStatus, "all">;
}

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
      case "under-review":
        return {
          bg: "bg-[#DBEAFE]",
          text: "text-[#1E40AF]",
          label: "Under Review",
        };
      case "pending":
        return {
          bg: "bg-[#E0E7FF]",
          text: "text-[#5B21B6]",
          label: "Pending Review",
        };
      case "reviewing":
        return {
          bg: "bg-[#FEF3C7]",
          text: "text-[#92400E]",
          label: "Reviewing",
        };
      case "interviewed":
        return {
          bg: "bg-[#DBEAFE]",
          text: "text-[#1E40AF]",
          label: "Interviewed",
        };
      case "accepted":
        return {
          bg: "bg-[#D1FAE5]",
          text: "text-[#065F46]",
          label: "Accepted",
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
}

function ApplicationCard({ application, onStatusChange }: ApplicationCardProps) {
  const initials = getInitials(application.name);
  const avatarColor = getAvatarColor(application.name);

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
              <button className="flex items-center gap-1 text-[#2563EB] text-[14px] font-medium hover:text-[#1D4ED8] transition-colors">
                <FileText className="w-4 h-4" />
                Resume
                <ExternalLink className="w-3 h-3" />
              </button>
              <button className="flex items-center gap-1 text-[#2563EB] text-[14px] font-medium hover:text-[#1D4ED8] transition-colors">
                <UserIcon className="w-4 h-4" />
                View Profile
              </button>
            </div>

            {/* Status Dropdown */}
            <select
              value={application.status}
              onChange={(e) => onStatusChange(application.id, e.target.value as Exclude<ApplicationStatus, "all">)}
              className="px-4 py-2 border border-[#D1D5DB] rounded-lg text-[14px] text-[#374151] bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
            >
              <option value="under-review">Under Review</option>
              <option value="pending">Pending Review</option>
              <option value="reviewing">Reviewing</option>
              <option value="interviewed">Interviewed</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplicationsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus>("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4;

  const handleStatusChange = async (id: string, newStatus: Exclude<ApplicationStatus, "all">) => {
    const previous = applications.find(app => app.id === id)?.status;
    setApplications((apps) =>
      apps.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );

    const statusLabels: Record<Exclude<ApplicationStatus, "all">, string> = {
      "under-review": "Under Review",
      "pending": "Pending Review",
      "reviewing": "Reviewing",
      "interviewed": "Interviewed",
      "accepted": "Accepted",
      "rejected": "Rejected",
    };

    const backendStatus =
      newStatus === "accepted"
        ? "Accepted"
        : newStatus === "rejected"
        ? "Rejected"
        : newStatus === "pending"
        ? "Pending"
        : "Reviewed";

    try {
      await updateApplicationStatus(id, backendStatus);
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
        return "pending";
      case "Reviewed":
        return "under-review";
      case "Accepted":
        return "accepted";
      case "Rejected":
        return "rejected";
      default:
        return "under-review";
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
      name: applicantName,
      email: applicant.email || "—",
      position: job.title || "Untitled Job",
      company: companyName,
      coverLetter: app.coverLetter || "No cover letter provided.",
      appliedDate: formatDate(app.createdAt || app.appliedDate),
      status: mapStatus(app.status),
    };
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
              <option value="under-review">Under Review</option>
              <option value="pending">Pending Review</option>
              <option value="reviewing">Reviewing</option>
              <option value="interviewed">Interviewed</option>
              <option value="accepted">Accepted</option>
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
