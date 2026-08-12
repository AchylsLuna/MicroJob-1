import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, CalendarDays, ClipboardList, MapPin, Star } from "lucide-react";
import { jobsAPI } from "../../services/jobs";
import { getEligibleReviews, type ApplicationStatus, type ReviewEligibilityItem } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { RatingDialog, type RatingTarget } from "../../components/reviews/RatingDialog";

interface JobData {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: string;
  description: string;
  deadline?: string;
  status?: string;
  jobPoster?: { firstName?: string; lastName?: string; companyName?: string };
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

const formatMinimumPay = (value?: string) => {
  const amount = Number(String(value || "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return value || "Pay not specified";
  return `₱${amount.toLocaleString("en-PH")} minimum`;
};

const AppliedJobs: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status") || "All";
  const initialFilter = FILTER_OPTIONS.includes(requestedStatus as "All" | ApplicationStatus)
    ? requestedStatus as "All" | ApplicationStatus
    : "All";
  const [selectedFilter, setSelectedFilter] = useState<"All" | ApplicationStatus>(initialFilter);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewEligibility, setReviewEligibility] = useState<Record<string, ReviewEligibilityItem>>({});
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);

  const loadReviewEligibility = async () => {
    try {
      const response = await getEligibleReviews();
      setReviewEligibility(Object.fromEntries((response?.asWorker || []).map((item) => [item.applicationId, item])));
    } catch {
      setReviewEligibility({});
    }
  };

  useEffect(() => { void loadReviewEligibility(); }, []);

  useEffect(() => {
    setSelectedFilter(initialFilter);
  }, [initialFilter]);

  const updateFilter = (filter: "All" | ApplicationStatus) => {
    setSelectedFilter(filter);
    const next = new URLSearchParams(searchParams);
    if (filter === "All") next.delete("status");
    else next.set("status", filter);
    setSearchParams(next, { replace: true });
  };

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
      case "Interviewed": return "bg-sky-100 text-sky-700";
      case "Offer Sent": return "bg-[#EAF2FC] text-[#1C4D8D]";
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
    <div className="ui-page px-4 pb-16 md:px-0">
      <div className="ui-page-header">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">Application tracker</p>
          <h1 className="ui-page-title mt-1">My applications</h1>
          <p className="ui-page-subtitle">Follow each application from submission to hiring.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.worker.findJobs)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-5 text-sm font-semibold text-white transition hover:bg-[#163F75]"
        >
          <BriefcaseBusiness className="h-4 w-4" />
          Find jobs
        </button>
      </div>

      <div className="ui-card flex flex-col gap-3 rounded-2xl border-slate-200 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold text-slate-900">
            {loading ? "Loading applications..." : `${applications.length} ${applications.length === 1 ? "application" : "applications"}`}
          </p>
          <p className="mt-1 text-sm text-slate-500">Filter by the stage you want to review.</p>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Status</span>
          <select
            value={selectedFilter}
            onChange={(event) => updateFilter(event.target.value as "All" | ApplicationStatus)}
            className="h-11 min-w-48 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#1C4D8D] focus:ring-2 focus:ring-blue-100"
          >
            {FILTER_OPTIONS.map((filter) => <option key={filter} value={filter}>{filter}</option>)}
          </select>
        </label>
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
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8CBE5] hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1C4D8D] text-lg font-bold text-white">
                    {application.job?.title?.charAt(0) || "J"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-slate-900">{application.job?.title || "Unavailable job"}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {application.job?.jobPoster?.companyName ||
                            `${application.job?.jobPoster?.firstName || ""} ${application.job?.jobPoster?.lastName || ""}`.trim() ||
                            "Employer"}
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(application.status)}`}>
                        {application.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#EAF2FC] px-3 py-1 text-xs font-semibold text-[#1C4D8D]">
                        {application.job?.jobType || "Job"}
                      </span>
                      <span className="text-sm font-bold text-emerald-700">
                        {formatMinimumPay(application.job?.salary)}
                      </span>
                    </div>

                    <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-500">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="line-clamp-1">{application.job?.location || "Location not specified"}</span>
                    </p>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {application.job?.description || "Open the job to review its complete details."}
                    </p>

                    <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Applied {new Date(application.appliedDate || application.createdAt || Date.now()).toLocaleDateString()}
                        </span>
                        {application.job?.deadline ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Deadline {new Date(application.job.deadline).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                      {reviewEligibility[application._id]?.canReview ? (
                        <button
                          type="button"
                          onClick={() => {
                            const poster = application.job?.jobPoster;
                            setRatingTarget({
                              applicationId: application._id,
                              name: poster?.companyName || `${poster?.firstName || ""} ${poster?.lastName || ""}`.trim() || "Employer",
                              jobTitle: application.job?.title || "Completed job",
                              roleLabel: "employer",
                            });
                          }}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          <Star className="h-4 w-4" /> Rate Employer
                        </button>
                      ) : reviewEligibility[application._id]?.existingReview ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <Star className="h-4 w-4 fill-emerald-600" /> Review submitted
                        </span>
                      ) : null}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.worker.jobDetails(application.job?._id), { 
                            state: { isApplied: true, status: application.status }
                          });
                        }}
                        className="h-10 rounded-xl bg-[#1C4D8D] px-5 text-sm font-semibold text-white transition hover:bg-[#163F75]"
                      >
                        View details
                      </button>
                      </div>
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
                      onClick={() => updateFilter("All")}
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
      {ratingTarget ? (
        <RatingDialog target={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={loadReviewEligibility} />
      ) : null}
    </div>
  );
};

export default AppliedJobs;
