import { useEffect, useState } from "react";
import { Building2, MapPin, DollarSign, Calendar, Clock, FileText, Eye, Trash2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUserApplications, withdrawApplication } from "../../services/api";

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  companyLogo: string;
  location: string;
  salary: string;
  appliedDate: string;
  status: "Pending" | "Under Review" | "Interview Scheduled" | "Accepted" | "Rejected";
  interviewDate?: string;
  employerId?: string;
  employerName?: string;
}

export function AppliedJobs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();

  const handleViewDetails = (jobId: string) => {
    if (!jobId) {
      toast.error("Job details not available.");
      return;
    }
    navigate(`/dashboard/job-details/${jobId}`);
  };

  const handleWithdrawApplication = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    try {
      await withdrawApplication(appId);
      setApplications(applications.filter(a => a.id !== appId));
      toast.success(`Application for ${app?.jobTitle} withdrawn`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to withdraw application.");
    }
  };

  const handleViewApplication = (jobTitle: string) => {
    toast.info(`Viewing application details for: ${jobTitle}`);
  };

  const handleMessageEmployer = (app: Application) => {
    if (!app.employerId) {
      toast.error("Employer contact not available.");
      return;
    }
    navigate("/dashboard/messages", {
      state: { userId: app.employerId, name: app.employerName || app.company },
    });
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const mapStatus = (status?: string): Application["status"] => {
    switch (status) {
      case "Pending":
        return "Pending";
      case "Reviewed":
        return "Under Review";
      case "Accepted":
        return "Accepted";
      case "Rejected":
        return "Rejected";
      default:
        return "Under Review";
    }
  };

  const mapApplication = (app: any): Application => {
    const job = app.job || {};
    const poster = job.jobPoster || {};
    const companyName = `${poster.firstName || ""} ${poster.lastName || ""}`.trim() || poster.email || "MicroJobs";
    return {
      id: app._id,
      jobId: job._id || "",
      jobTitle: job.title || "Untitled Job",
      company: companyName,
      companyLogo: companyName.charAt(0) || "M",
      location: job.location || "Remote",
      salary: job.salary || "—",
      appliedDate: formatDate(app.appliedDate || app.createdAt),
      status: mapStatus(app.status),
      employerId: poster._id,
      employerName: companyName,
    };
  };

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getUserApplications();
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

  const getStatusColor = (status: Application["status"]) => {
    switch (status) {
      case "Pending":
        return "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]";
      case "Under Review":
        return "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]";
      case "Interview Scheduled":
        return "bg-[#E0E7FF] text-[#4F46E5] border-[#C7D2FE]";
      case "Accepted":
        return "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]";
      case "Rejected":
        return "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]";
    }
  };

  const getStatusIcon = (status: Application["status"]) => {
    switch (status) {
      case "Pending":
        return <Clock className="w-4 h-4" />;
      case "Under Review":
        return <FileText className="w-4 h-4" />;
      case "Interview Scheduled":
        return <Calendar className="w-4 h-4" />;
      case "Accepted":
        return <CheckCircle2 className="w-4 h-4" />;
      case "Rejected":
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const filteredApplications = applications.filter(app => {
    if (selectedStatus !== "all" && app.status !== selectedStatus) {
      return false;
    }
    if (!searchQuery) {
      return true;
    }
    const combined = `${app.jobTitle} ${app.company} ${app.location}`.toLowerCase();
    return combined.includes(searchQuery);
  });

  const statusCounts = {
    all: applications.length,
    Pending: applications.filter(a => a.status === "Pending").length,
    "Under Review": applications.filter(a => a.status === "Under Review").length,
    "Interview Scheduled": applications.filter(a => a.status === "Interview Scheduled").length,
    Accepted: applications.filter(a => a.status === "Accepted").length,
    Rejected: applications.filter(a => a.status === "Rejected").length,
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Status Filters */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
        <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Filter by Status</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedStatus("all")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "all"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            All Applications ({statusCounts.all})
          </button>
          <button
            onClick={() => setSelectedStatus("Pending")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "Pending"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            Pending ({statusCounts.Pending})
          </button>
          <button
            onClick={() => setSelectedStatus("Under Review")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "Under Review"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            Under Review ({statusCounts["Under Review"]})
          </button>
          <button
            onClick={() => setSelectedStatus("Interview Scheduled")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "Interview Scheduled"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            Interview ({statusCounts["Interview Scheduled"]})
          </button>
          <button
            onClick={() => setSelectedStatus("Accepted")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "Accepted"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            Accepted ({statusCounts.Accepted})
          </button>
          <button
            onClick={() => setSelectedStatus("Rejected")}
            className={`px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all ${
              selectedStatus === "Rejected"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            }`}
          >
            Rejected ({statusCounts.Rejected})
          </button>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {isLoading && (
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 text-center text-[#6B7280]">
            Loading applications...
          </div>
        )}
        {loadError && !isLoading && (
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 text-center text-[#B91C1C]">
            {loadError}
          </div>
        )}
        {filteredApplications.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-16 h-16 rounded-[14px] bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[18px] shadow-md flex-shrink-0">
                  {app.companyLogo}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-[20px] font-bold text-[#111827] mb-1">
                        {app.jobTitle}
                      </h3>
                      <p className="text-[14px] text-[#6B7280] flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4" />
                        {app.company}
                      </p>
                    </div>
                    <span
                      className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold border flex items-center gap-2 ${getStatusColor(
                        app.status
                      )}`}
                    >
                      {getStatusIcon(app.status)}
                      {app.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                      <MapPin className="w-4 h-4" />
                      {app.location}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-[#10B981] font-semibold">
                      <DollarSign className="w-4 h-4" />
                      {app.salary}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                      <Calendar className="w-4 h-4" />
                      Applied: {app.appliedDate}
                    </div>
                    {app.interviewDate && (
                      <div className="flex items-center gap-2 text-[13px] text-[#4F46E5] font-semibold">
                        <Clock className="w-4 h-4" />
                        {app.interviewDate}
                      </div>
                    )}
                  </div>

                  {app.status === "Interview Scheduled" && (
                    <div className="bg-gradient-to-r from-[#EEF2FF] to-transparent border border-[#E0E7FF] rounded-[12px] p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-semibold text-[#111827] mb-1">
                            Interview Scheduled
                          </h4>
                          <p className="text-[13px] text-[#6B7280]">
                            Your interview is scheduled for <span className="font-semibold text-[#4F46E5]">{app.interviewDate}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {app.status === "Accepted" && (
                    <div className="bg-gradient-to-r from-[#D1FAE5] to-transparent border border-[#A7F3D0] rounded-[12px] p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-[#10B981] flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-semibold text-[#111827] mb-1">
                            Congratulations! 🎉
                          </h4>
                          <p className="text-[13px] text-[#6B7280]">
                            Your application has been accepted. The company will contact you soon with next steps.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleViewDetails(app.jobId)}
                      className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold px-5 py-2.5 rounded-[10px] hover:shadow-lg transition-all duration-300 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Job Details
                    </button>
                    {app.employerId && (
                      <button
                        onClick={() => handleMessageEmployer(app)}
                        className="bg-white border border-[#C7D2FE] text-[#1C4D8D] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#EEF2FF] transition-colors flex items-center gap-2"
                      >
                        💬 Message Employer
                      </button>
                    )}
                    <button
                      onClick={() => handleViewApplication(app.jobTitle)}
                      className="bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#F9FAFB] transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Application
                    </button>
                    {app.status !== "Accepted" && app.status !== "Rejected" && (
                      <button
                        onClick={() => handleWithdrawApplication(app.id)}
                        className="bg-white border border-[#FEE2E2] text-[#EF4444] font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#FEE2E2] transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!isLoading && !loadError && filteredApplications.length === 0 && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-12 text-center">
          <FileText className="w-16 h-16 text-[#D1D5DB] mx-auto mb-4" />
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">No applications found</h3>
          <p className="text-[14px] text-[#6B7280] mb-4">
            {selectedStatus === "all"
              ? "You haven't applied to any jobs yet"
              : `No ${selectedStatus.toLowerCase()} applications`}
          </p>
          <button
            onClick={() => navigate("/dashboard/find-jobs")}
            className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold px-6 py-3 rounded-[10px] hover:shadow-lg transition-all duration-300"
          >
            Browse Jobs
          </button>
        </div>
      )}
    </div>
  );
}
