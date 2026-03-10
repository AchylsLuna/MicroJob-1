import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/jobs";
import { isInvalidTokenError } from "../../utils/authSession";
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
        const status = err?.response?.status;
        const message = err?.response?.data?.message || err?.message;
        const hasSession = Boolean(localStorage.getItem("auth_user") || localStorage.getItem("current_user"));
        if (isInvalidTokenError({ status, message, path: "/jobs/mine", hasToken: hasSession })) {
          return;
        }
        setError(message || "Failed to load job posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      {loading && (
        <div className="ui-card p-6 text-sm text-slate-600">
          Loading your job posts...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="ui-card p-12 text-center">
          <div className="mb-4 text-4xl">📌</div>
          <h3 className="mb-2 text-2xl font-bold text-slate-900">No Job Posts Yet</h3>
          <p className="text-base text-slate-500">Create your first job post to start receiving applications.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {jobs.map((job) => {
          const categoryName = typeof job.category === "object" ? job.category?.name : "";
          return (
            <div key={job._id} className="ui-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{job.location}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoryName && (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                        {categoryName}
                      </span>
                    )}
                    {job.urgent && (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        Urgent
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    job.status === "Closed"
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {job.status || "Available"}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                  {job.jobType}
                </span>
                <span className="font-semibold text-emerald-600">{job.salary}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <div className="flex flex-wrap items-center gap-4">
                  <span>Applicants: {job.applicants?.length || 0}</span>
                  <span>Positions: {(job as any).positionsNeeded || 1}</span>
                  <span>Hired: {(job as any).hiredCount || 0}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1">{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}</span>
                  {job.status === "Closed" ? (
                    <>
                      <button
                        type="button"
                        className="h-10 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                        onClick={async () => {
                          try {
                            await jobsAPI.changeJobStatus(job._id, "Available");
                            const resp = await jobsAPI.getMyJobs();
                            setJobs(resp.data || []);
                          } catch (e: any) {
                            console.warn("Failed to reopen job", e);
                          }
                        }}
                      >
                        Reopen
                      </button>
                      <button
                        type="button"
                        className="h-10 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700"
                        onClick={() => setJobToDelete(job)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="h-10 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                        onClick={() => navigate(ROUTES.employer.postJob, { state: { job } })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="h-10 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700"
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
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Are you sure?</h3>
            <p className="mb-6 text-sm text-slate-500">Are you sure you want to delete this post?</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setJobToDelete(null)}
                disabled={deleting}
              >
                No
              </button>
              <button
                type="button"
                className="h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
                onClick={async () => {
                  if (!jobToDelete) return;
                  setDeleting(true);
                  try {
                    await jobsAPI.deleteJob(jobToDelete._id);
                    const resp = await jobsAPI.getMyJobs();
                    setJobs(resp.data || []);
                    setJobToDelete(null);
                  } catch (e) {
                    console.warn("Failed to delete job", e);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPosts;
