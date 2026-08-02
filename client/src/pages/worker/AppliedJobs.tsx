import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, ClipboardList } from "lucide-react";
import { jobsAPI } from "../../services/jobs";
import type { ApplicationStatus } from "../../services/api";
import { ROUTES } from "../../utils/routes";

interface JobData {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: "Fulltime" | "Freelance" | "Remote" | "Part-time";
  description: string;
  skills?: string[];
  applicants?: string[];
  deadline?: string;
}

interface Application {
  _id: string;
  status: ApplicationStatus;
  appliedDate: string;
  createdAt?: string;
  job: JobData;
}

const FILTER_OPTIONS: Array<"All" | ApplicationStatus> = [
  "All",
  "Applied",
  "Shortlisted",
  "Interview Scheduled",
  "Interviewed",
  "Offer Sent",
  "Hired",
  "Rejected",
  "Withdrawn",
];

const AppliedJobs: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<"All" | ApplicationStatus>("All");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError(null);
      try {
        const statusParam = selectedFilter === "All" ? undefined : selectedFilter;
        const response = await jobsAPI.getUserApplications(statusParam);
        setApplications(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load applications.");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [selectedFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Applied": return "bg-slate-100 text-slate-700";
      case "Shortlisted": return "bg-blue-100 text-blue-700";
      case "Interview Scheduled": return "bg-cyan-100 text-cyan-700";
      case "Interviewed": return "bg-indigo-100 text-indigo-700";
      case "Offer Sent": return "bg-fuchsia-100 text-fuchsia-700";
      case "Hired": return "bg-green-100 text-green-700";
      case "Rejected": return "bg-red-100 text-red-700";
      case "Withdrawn": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const filteredApplications = applications;
  const emptyStateLabel =
    selectedFilter === "All" ? "Application tracker" : `${selectedFilter} stage`;
  const emptyStateTitle =
    selectedFilter === "All" ? "No applications yet" : `No applications in ${selectedFilter}`;
  const emptyStateDescription =
    selectedFilter === "All"
      ? "Once you apply for jobs, they will appear here with status updates, interview progress, and hiring decisions."
      : `You do not have any applications in the ${selectedFilter} stage right now. Browse more roles or switch back to all applications.`;

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setSelectedFilter(filter)}
            aria-pressed={selectedFilter === filter}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              selectedFilter === filter
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div>
          {/* Job Cards */}
          {loading && (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-gray-600">
              Loading applications...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredApplications.map((application) => (
              <article
                key={application._id}
                className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg transition border border-gray-200 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  {/* Company Logo */}
                  <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                    {application.job?.title?.charAt(0) || "J"}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{application.job?.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{application.job?.location}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(application.status)}`}>
                        {application.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {application.job?.jobType}
                      </span>
                      <span className="text-green-600 font-semibold text-sm">{application.job?.salary}</span>
                      <span className="text-gray-500 text-sm">/ month</span>
                    </div>

                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                      {application.job?.description}
                    </p>

                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">Required Skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {(application.job?.skills || []).map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 mt-5 pt-4 border-t border-gray-200 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>🕒 Applied {new Date(application.appliedDate || application.createdAt || Date.now()).toLocaleDateString()}</span>
                        <span>👥 {application.job?.applicants?.length || 0} applicants</span>
                        <span>📅 Deadline: {application.job?.deadline ? new Date(application.job.deadline).toLocaleDateString() : "N/A"}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.worker.jobDetails(application.job?._id), { 
                            state: { isApplied: true, status: application.status }
                          });
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Empty State */}
          {!loading && filteredApplications.length === 0 && (
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white px-8 py-12 text-center shadow-sm sm:px-12">
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <div className="mb-4 flex h-18 w-18 items-center justify-center rounded-[20px] bg-[#1C4D8D]/[0.06] text-[#1C4D8D]">
                  <ClipboardList className="h-8 w-8" />
                </div>

                <div className="mb-4 inline-flex items-center rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-medium text-[#64748B]">
                  {emptyStateLabel}
                </div>

                <h3 className="max-w-xl text-[28px] font-bold tracking-[-0.02em] text-[#111827] sm:text-[32px]">
                  {emptyStateTitle}
                </h3>

                <p className="mt-3 max-w-xl text-[16px] leading-7 text-[#6B7280]">
                  {emptyStateDescription}
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => navigate(ROUTES.worker.findJobs)}
                    className="inline-flex items-center gap-2 rounded-[14px] bg-[#1C4D8D] px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
                  >
                    <BriefcaseBusiness className="h-4 w-4" />
                    Browse Jobs
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {selectedFilter !== "All" ? (
                    <button
                      onClick={() => setSelectedFilter("All")}
                      className="inline-flex items-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white px-5 py-3 text-[15px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
                    >
                      Show All Applications
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default AppliedJobs;
