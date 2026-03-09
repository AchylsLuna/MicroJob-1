import { ArrowLeft, MapPin, Briefcase, DollarSign, Clock, Building2, Users, Calendar, Share2, Bookmark, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "../lib/toast";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { applyForJob, getJobDetails } from "../services/api";
import { ROUTES } from "../utils/routes";

type ApiJob = {
  _id: string;
  title: string;
  description: string;
  location?: string;
  salary?: string;
  jobType?: string;
  deadline?: string;
  createdAt?: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  applicants?: string[];
  jobPoster?: { _id?: string; firstName?: string; lastName?: string; email?: string };
};

export function JobDetails() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const benefits = [
    "Competitive salary and performance bonuses",
    "Health insurance coverage",
    "Flexible working hours",
    "Work from home options",
    "Professional development opportunities",
    "Collaborative and innovative work environment",
    "Modern office facilities",
  ];

  useEffect(() => {
    let isMounted = true;
    const loadJob = async () => {
      if (!jobId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getJobDetails(jobId);
        if (!isMounted) return;
        setJob(data as ApiJob);
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || "Failed to load job details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJob();
    return () => {
      isMounted = false;
    };
  }, [jobId]);

  useEffect(() => {
    setHasApplied(false);
    setIsSaved(false);
  }, [jobId]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleApply = async () => {
    if (!job?._id) return;
    try {
      await applyForJob(job._id);
      setHasApplied(true);
      toast.success("Application submitted successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to apply.");
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast.success(isSaved ? "Job removed from saved" : "Job saved successfully!");
  };

  const handleShare = () => {
    toast.success("Job link copied to clipboard!");
  };

  const handleMessageEmployer = async () => {
    if (!job?._id) {
      toast.error("Job information not available");
      return;
    }
    
    const employerId = typeof job.jobPoster === 'object' && job.jobPoster?._id 
      ? job.jobPoster._id 
      : null;
    
    if (!employerId) {
      toast.error("Employer information not available");
      return;
    }

    const employerName = `${job.jobPoster?.firstName || ""} ${job.jobPoster?.lastName || ""}`.trim() || "Employer";

    const initialMessage = `Hi ${employerName}, I'm interested in the ${job.title} position. I would like to discuss this opportunity further.`;
    const params = new URLSearchParams({
      contact: `${employerId}::${job._id}`,
      startUser: employerId,
      jobId: job._id,
      startName: employerName,
      source: "job-details",
      draft: initialMessage,
    });
    navigate(`/worker/messages?${params.toString()}`);
  };

  const handleCompanyProfile = () => {
    const employerId = typeof job?.jobPoster === "object" ? job.jobPoster?._id : null;
    if (!employerId) {
      toast.error("Employer profile is not available for this job.");
      return;
    }
    navigate(`${ROUTES.publicProfile(employerId)}?viewAs=employer`);
  };

  const companyName =
    job?.jobPoster
      ? `${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim() || job.jobPoster.email || "MicroJobs"
      : "MicroJobs";

  const companyLogo = companyName.charAt(0) || "M";
  const postedDaysAgo = job?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const deadlineLabel = job?.deadline ? new Date(job.deadline).toLocaleDateString() : "—";

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111827] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to jobs
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Header */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            {isLoading && (
              <div className="text-[#6B7280] text-[14px]">Loading job details...</div>
            )}
            {loadError && !isLoading && (
              <div className="text-[#B91C1C] text-[14px]">{loadError}</div>
            )}
            {!isLoading && !loadError && job && (
              <div className="flex items-start gap-4 mb-4">
              <div className="w-20 h-20 rounded-[16px] bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[24px] shadow-lg flex-shrink-0">
                {companyLogo}
              </div>
              <div className="flex-1">
                <h1 className="text-[28px] font-bold text-[#111827] mb-2">{job.title}</h1>
                <button
                  onClick={handleCompanyProfile}
                  className="text-[16px] text-[#1C4D8D] hover:text-[#0F2954] font-semibold mb-3 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  {companyName}
                </button>
                <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#6B7280]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {job.location || "Remote"}
                  </div>
                  <span className="text-[#D1D5DB]">•</span>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {job.jobType || "Fulltime"}
                  </div>
                  <span className="text-[#D1D5DB]">•</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Posted {postedDaysAgo} days ago
                  </div>
                </div>
              </div>
            </div>
            )}

            {job && (
              <div className="flex items-center gap-2 mb-4">
              <span className="bg-[#DBEAFE] text-[#1E40AF] px-4 py-2 rounded-[10px] text-[13px] font-semibold">
                {job.jobType || "Fulltime"}
              </span>
              <span className="bg-[#FEF3C7] text-[#92400E] px-4 py-2 rounded-[10px] text-[13px] font-semibold">
                Entry Level
              </span>
            </div>
            )}

            {job && (
              <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-6 h-6 text-[#10B981]" />
              <p className="text-[24px] font-bold text-[#10B981]">{job.salary || "—"}</p>
              <span className="text-[14px] text-[#6B7280]">per month</span>
            </div>
            )}

            {job && (
              <div className="flex items-center gap-3">
              {hasApplied ? (
                <button
                  disabled
                  className="flex-1 bg-[#D1FAE5] text-[#065F46] font-semibold py-4 px-6 rounded-[12px] flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Application Submitted
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  className="flex-1 bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300"
                >
                  Apply Now
                </button>
              )}
              <button
                onClick={handleMessageEmployer}
                className="p-4 rounded-[12px] transition-all bg-gradient-to-br from-[#10B981] to-[#059669] text-white hover:shadow-lg"
                title="Message employer"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                onClick={handleSave}
                className={`p-4 rounded-[12px] transition-all ${
                  isSaved
                    ? "bg-[#1C4D8D] text-white hover:bg-[#0F2954]"
                    : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
                }`}
                title={isSaved ? "Remove from saved" : "Save job"}
              >
                <Bookmark className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
              </button>
              <button
                onClick={handleShare}
                className="p-4 bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] rounded-[12px] hover:bg-[#F3F4F6] transition-colors"
                title="Share job"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>
            )}
          </div>

          {/* Job Description */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-[20px] font-bold text-[#111827] mb-4">Job Description</h2>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">{job?.description || "No description provided."}</p>
          </div>

          {/* Responsibilities */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-[20px] font-bold text-[#111827] mb-4">Responsibilities</h2>
            <ul className="space-y-3">
              {(job?.responsibilities?.length ? job.responsibilities : ["No responsibilities provided."]).map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-[14px] text-[#6B7280]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1C4D8D] mt-2 flex-shrink-0"></div>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Requirements */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-[20px] font-bold text-[#111827] mb-4">Requirements</h2>
            <ul className="space-y-3">
              {(job?.requirements?.length ? job.requirements : ["No requirements provided."]).map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-[14px] text-[#6B7280]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1C4D8D] mt-2 flex-shrink-0"></div>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-[20px] font-bold text-[#111827] mb-4">Benefits</h2>
            <ul className="space-y-3">
              {benefits.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-[14px] text-[#6B7280]">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-6 shadow-sm sticky top-6">
            <h3 className="text-[18px] font-bold text-[#1e293b] mb-4">Job Overview</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#1C4D8D]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#6B7280] mb-1">Application Deadline</p>
                  <p className="text-[14px] font-semibold text-[#111827]">{deadlineLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#6B7280] mb-1">Total Applicants</p>
                  <p className="text-[14px] font-semibold text-[#111827]">{job?.applicants?.length || 0} applicants</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#6B7280] mb-1">Experience Level</p>
                  <p className="text-[14px] font-semibold text-[#111827]">Entry Level</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#6B7280] mb-1">Job Type</p>
                  <p className="text-[14px] font-semibold text-[#111827]">{job?.jobType || "Fulltime"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Required Skills */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
            <h3 className="text-[18px] font-bold text-[#111827] mb-4">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {(job?.skills?.length ? job.skills : ["No skills listed"]).map((skill, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] text-[#1C4D8D] rounded-[10px] text-[13px] font-semibold border border-[#E0E7FF]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
