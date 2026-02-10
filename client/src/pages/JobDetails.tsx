import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { jobsAPI } from "../services/jobs";
import { useAuth } from "../hooks/useAuth";

const JobDetails: React.FC = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const authUser = useAuth();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  
  // Check if user came from applied jobs page or if job status was passed
  const isApplied = location.state?.isApplied || !!appliedStatus;
  const applicationStatus = location.state?.status || appliedStatus;

  const handleApplyClick = () => {
    setShowApplyModal(true);
  };

  const handleApplySubmit = async () => {
    if (!jobId) return;
    try {
      await jobsAPI.applyForJob(jobId, {
        resume: resumeFile?.name,
        coverLetter,
      });
      setAppliedStatus("Pending");
      setShowApplyModal(false);
      setResumeFile(null);
      setCoverLetter("");
      navigate("/worker/applied-jobs", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to apply.");
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-100 text-yellow-700";
      case "Reviewed": return "bg-blue-100 text-blue-700";
      case "Accepted": return "bg-green-100 text-green-700";
      case "Rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await jobsAPI.getJobById(jobId);
        setJob(response.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load job details.");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  const jobData = useMemo(() => {
    if (!job) {
      return null;
    }

    return {
      id: job._id,
      title: job.title,
      location: job.location,
      jobType: job.jobType,
      postedTime: job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "",
      salary: job.salary,
      salaryPeriod: "Fixed Payment",
      deadline: job.deadline ? new Date(job.deadline).toLocaleDateString() : "",
      totalApplicants: `${job.applicants?.length || 0} applicants`,
      description: job.description,
      responsibilities: job.responsibilities || [],
      requirements: job.requirements || [],
      skills: job.skills || [],
      urgent: Boolean(job.urgent || job.isUrgent),
      jobPoster: job.jobPoster,
    };
  }, [job]);

  const authUserId = authUser?.id || (authUser as any)?._id;
  const isOwnJob = !!authUserId && (jobData?.jobPoster?._id || jobData?.jobPoster?.id) === authUserId;

  return (
    <div>
      {/* Header */}
      <div className="bg-white px-8 py-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
          {loading && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-gray-600 mb-6">
              Loading job details...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 mb-6">
              {error}
            </div>
          )}

          {!loading && !jobData && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-gray-600">
              Job not found.
            </div>
          )}

          {jobData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Content */}
            <div className="lg:col-span-2">
              {/* Job Header Card */}
              <div className="bg-white rounded-2xl p-8 shadow-sm mb-6">
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{jobData.title}</h2>

                    <div className="flex items-center gap-4 text-sm mb-4">
                      <span className="flex items-center gap-1 text-gray-600">
                        📍 {jobData.location}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {jobData.jobType}
                      </span>
                      {jobData.urgent ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                          Urgent
                        </span>
                      ) : null}
                      <span className="text-gray-500">⏰ {jobData.postedTime}</span>
                    </div>

                    {jobData.jobPoster && (
                      <p className="text-sm text-gray-500 mb-4">
                        Posted by {jobData.jobPoster.firstName} {jobData.jobPoster.lastName}
                      </p>
                    )}

                    {/* Salary */}
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-green-600 font-bold text-2xl">💵 {jobData.salary}</span>
                      <span className="text-gray-500">{jobData.salaryPeriod}</span>
                    </div>

                    {/* Apply Button */}
                    {isOwnJob ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600">
                        You posted this job
                      </div>
                    ) : isApplied ? (
                      <div className="flex items-center gap-3">
                        <span className={`px-6 py-3 rounded-xl text-sm font-semibold ${getStatusColor(applicationStatus)}`}>
                          Application {applicationStatus}
                        </span>
                        <button
                          onClick={() => navigate(-1)}
                          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200"
                        >
                          Back to Applications
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleApplyClick}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-lg"
                      >
                        Apply Now
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Job Description */}
              <div className="bg-white rounded-2xl p-8 shadow-sm mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Job Description</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{jobData.description}</p>
              </div>

              {/* Responsibilities */}
              <div className="bg-white rounded-2xl p-8 shadow-sm mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Responsibilities</h3>
                <ul className="space-y-3">
                  {jobData.responsibilities.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-gray-700">
                      <span className="text-blue-600 font-bold mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Requirements */}
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Requirements</h3>
                <ul className="space-y-3">
                  {jobData.requirements.map((req: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-gray-700">
                      <span className="text-blue-600 font-bold mt-1">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Job Overview */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Job Overview</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      📅
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Application Deadline</p>
                      <p className="font-bold text-gray-900">{jobData.deadline}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                      👥
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Total Applicants</p>
                      <p className="font-bold text-gray-900">{jobData.totalApplicants}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      📋
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Job Type</p>
                      <p className="font-bold text-gray-900">{jobData.jobType}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Required Skills */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {jobData.skills.map((skill: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
            </>
          )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && jobData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Apply for {jobData.title}</h2>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Resume Upload */}
            <div className="mb-6">
              <label className="block text-gray-900 font-semibold mb-3">Upload Resume</label>
              <div
                onClick={() => document.getElementById("resume-input")?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition"
              >
                <input
                  id="resume-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="text-4xl mb-2">📄</div>
                <p className="text-gray-600 font-semibold">
                  {resumeFile ? resumeFile.name : "Click to upload PDF or DOC"}
                </p>
              </div>
            </div>

            {/* Cover Letter */}
            <div className="mb-6">
              <label className="block text-gray-900 font-semibold mb-3">Cover Letter</label>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell us why you're interested in this position..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
                rows={5}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleApplySubmit}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Submit Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetails;
