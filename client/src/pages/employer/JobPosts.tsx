import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/jobs";
import { ROUTES } from "../../utils/routes";

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
  const [jobToDelete, setJobToDelete] = useState<JobItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div>
        <h2 className="font-semibold text-[20px] text-[#111827]">My Job Posts</h2>
        <p className="text-[14px] text-[#6B7280] mt-1">Manage the jobs you have posted.</p>
      </div>

      <div>
        {loading && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-gray-600">
            Loading your job posts...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 mb-6">
            {error}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">📌</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Job Posts Yet</h3>
            <p className="text-gray-600">Create your first job post to start receiving applications.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map((job) => {
            const categoryName = typeof job.category === "object" ? job.category?.name : "";
            return (
            <div key={job._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
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
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${job.status === 'Closed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
                <div className="flex items-center gap-4">
                  <span>Applicants: {job.applicants?.length || 0}</span>
                  <span>Positions: { (job as any).positionsNeeded || 1 }</span>
                  <span>Hired: { (job as any).hiredCount || 0 }</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}</span>
                  {job.status === 'Closed' ? (
                    <>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg bg-yellow-500 text-white text-xs font-semibold hover:bg-yellow-600"
                        onClick={async () => {
                          try {
                            await jobsAPI.changeJobStatus(job._id, 'Available');
                            // refresh
                            const resp = await jobsAPI.getMyJobs();
                            setJobs(resp.data || []);
                          } catch (e: any) {
                            console.warn('Failed to reopen job', e);
                          }
                        }}
                      >
                        Reopen
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                        onClick={() => setJobToDelete(job)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg bg-sky-500 text-sky-100 text-xs font-semibold hover:bg-sky-700"
                        onClick={() => navigate(ROUTES.employer.postJob, { state: { job } })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                        onClick={() => setJobToDelete(job)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
      {jobToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Are you sure?</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this post?</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                onClick={() => setJobToDelete(null)}
                disabled={deleting}
              >
                No
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold"
                onClick={async () => {
                  if (!jobToDelete) return;
                  setDeleting(true);
                  try {
                    await jobsAPI.deleteJob(jobToDelete._id);
                    const resp = await jobsAPI.getMyJobs();
                    setJobs(resp.data || []);
                    setJobToDelete(null);
                  } catch (e) {
                    console.warn('Failed to delete job', e);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPosts;
