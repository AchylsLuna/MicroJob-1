import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/jobs";
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
  status: "Pending" | "Shortlisted" | "Terms" | "Hired";
  appliedDate: string;
  job: JobData;
}

const AppliedJobs: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = ["All", "Pending", "Shortlisted", "Terms", "Hired"];

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
      case "Pending": return "bg-yellow-100 text-yellow-700";
      case "Shortlisted": return "bg-blue-100 text-blue-700";
      case "Terms": return "bg-indigo-100 text-indigo-700";
      case "Hired": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const filteredApplications = applications;

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
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
              <div
                key={application._id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition cursor-pointer border border-gray-200"
                onClick={() => navigate(ROUTES.worker.jobDetails(application.job?._id), { 
                  state: { isApplied: true, status: application.status }
                })}
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

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>🕒 Applied {new Date(application.appliedDate).toLocaleDateString()}</span>
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
              </div>
            ))}
          </div>

          {/* Empty State */}
          {!loading && filteredApplications.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Applications Found</h3>
              <p className="text-gray-600 mb-6">
                You haven't applied to any jobs with this status yet.
              </p>
              <button
                onClick={() => navigate(ROUTES.worker.findJobs)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
              >
                Browse Jobs
              </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default AppliedJobs;
