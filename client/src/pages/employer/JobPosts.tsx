import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/jobs";

interface JobItem {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: string;
  status?: string;
  applicants?: string[];
  category?: { _id?: string; name?: string } | string;
  createdAt?: string;
  urgent?: boolean;
}

const JobPosts: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await jobsAPI.getMyJobs();
        setJobs(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load job posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  return (
    <div>
      <div className="bg-gradient-to-r from-sky-600 to-sky-400 text-white p-8 mb-8">
        <h1 className="text-4xl font-extrabold mb-2">My Job Posts</h1>
        <p className="text-sky-100 text-lg">Manage the jobs you have posted</p>
      </div>

      <div className="px-8 pb-20">
        {loading && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 text-gray-600">
            Loading your job posts...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 mb-6">
            {error}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-sky-100">
            <div className="text-5xl mb-4">📌</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Job Posts Yet</h3>
            <p className="text-gray-600">Create your first job post to start receiving applications.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map((job) => {
            const categoryName = typeof job.category === "object" ? job.category?.name : "";
            return (
            <div key={job._id} className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {job.location}
                  </p>
                  {categoryName && (
                    <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700">
                      {categoryName}
                    </span>
                  )}
                  {job.urgent && (
                    <span className="inline-block mt-2 ml-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                      Urgent
                    </span>
                  )}
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  {job.status || "Available"}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
                <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold">
                  {job.jobType}
                </span>
                <span className="text-green-600 font-semibold">{job.salary}</span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>Applicants: {job.applicants?.length || 0}</span>
                <div className="flex items-center gap-3">
                  <span>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}</span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg bg-sky-100 text-white text-xs font-semibold hover:bg-sky-700"
                    onClick={() => navigate("/employer/post-job", { state: { job } })}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default JobPosts;
