import React, { useEffect, useMemo, useState } from "react";
import { jobsAPI } from "../../services/jobs";

interface ApplicationItem {
  _id: string;
  status: "Pending" | "Reviewed" | "Accepted" | "Rejected";
  createdAt?: string;
  job: {
    _id: string;
    title: string;
  };
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    phoneNumber?: string;
  };
  coverLetter?: string;
  resume?: string;
  employerReadAt?: string | null;
}

const Applications: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

  const jobOptions = useMemo(() => {
    const unique = new Map<string, string>();
    applications.forEach((app) => {
      if (app.job?._id) unique.set(app.job._id, app.job.title);
    });
    return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {};
        if (statusFilter !== "All") params.status = statusFilter;
        if (jobFilter !== "All") params.jobId = jobFilter;
        if (search) params.search = search;
        const response = await jobsAPI.getEmployerApplications(params);
        setApplications(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load applications.");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchApplications, 300);
    return () => clearTimeout(debounce);
  }, [statusFilter, jobFilter, search]);

  const handleStatusChange = async (applicationId: string, status: string) => {
    try {
      await jobsAPI.updateApplicationStatus(applicationId, status);
      setApplications((prev) =>
        prev.map((app) => (app._id === applicationId ? { ...app, status: status as ApplicationItem["status"] } : app))
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update status.");
    }
  };

  const markEmployerRead = async (applicationId: string) => {
    try {
      await jobsAPI.markEmployerRead(applicationId);
      setApplications((prev) => prev.map((a) => (a._id === applicationId ? { ...a, employerReadAt: new Date().toISOString() } : a)));
    } catch (err) {
      console.warn('Failed to mark employer notification read', err);
    }
  };

  return (
    <div className="px-8 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500 text-sm">Manage candidate applications and update statuses</p>
        </div>
      </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
              </div>
              <div className="flex gap-3">
                <select
                  className="px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <select
                  className="px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white"
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                >
                  <option value="All">All Jobs</option>
                  {jobOptions.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {loading && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-gray-600">
                Loading applications...
              </div>
            )}

            {!loading && applications.length === 0 && (
              <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center text-gray-600">
                No applications found.
              </div>
            )}

            {applications.map((app) => (
              <div key={app._id} onClick={() => { if (!app.employerReadAt) markEmployerRead(app._id); }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold">
                      {(app.applicant?.firstName?.[0] || "").toUpperCase()}
                      {(app.applicant?.lastName?.[0] || "").toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {app.applicant?.firstName} {app.applicant?.lastName}
                      </h3>
                      {!app.employerReadAt && (
                        <div className="inline-block ml-2 w-2 h-2 bg-blue-600 rounded-full" />
                      )}
                      <p className="text-sm text-gray-500">{app.applicant?.email}</p>
                      <p className="text-sm text-gray-700 mt-2">
                        Applied for: <span className="font-semibold">{app.job?.title}</span>.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                    {app.status}
                  </span>
                </div>

                {app.coverLetter && (
                  <p className="text-sm text-gray-600 mt-4 leading-relaxed">{app.coverLetter}</p>
                )}

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>🕒 {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ""}</span>
                    <button className="text-blue-600 font-semibold">Resume</button>
                    <button
                      className="text-blue-600 font-semibold"
                      onClick={() => setSelectedApplicantId(selectedApplicantId === app._id ? null : app._id)}
                    >
                      View Profile
                    </button>
                  </div>
                  <select
                    className="mt-3 md:mt-0 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold bg-white"
                    value={app.status}
                    onChange={(e) => handleStatusChange(app._id, e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {selectedApplicantId === app._id && (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
                    <p className="font-semibold">Applicant Details</p>
                    <div className="mt-2 space-y-1">
                      <p>Name: {app.applicant?.firstName} {app.applicant?.lastName}</p>
                      <p>Email: {app.applicant?.email}</p>
                      {app.applicant?.phoneNumber && <p>Phone: {app.applicant.phoneNumber}</p>}
                      {app.applicant?.role && <p>Role: {app.applicant.role}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
    </div>
  );
};

export default Applications;
