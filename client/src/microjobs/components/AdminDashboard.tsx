import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Clock,
  DollarSign,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../hooks/useAdminData";
import { toast } from "../lib/toast";

function AdminDashboardContent() {
  const {
    isLoading,
    loadError,
    stats,
    jobs,
    formatCurrency,
    formatSalary,
    formatDateFromObjectId,
    getJobStatusColor,
  } = useAdminData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const parseSalary = (value?: string) => {
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const amount = Number.parseFloat(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  };

  const totalApplicants = useMemo(
    () => jobs.reduce((sum, job) => sum + (job.applicants?.length ?? 0), 0),
    [jobs],
  );

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "Available" || job.status === "In Progress").length,
    [jobs],
  );

  const totalBudget = useMemo(
    () => jobs.reduce((sum, job) => sum + parseSalary(job.salary), 0),
    [jobs],
  );

  const statusOptions = useMemo(() => {
    const options = new Set<string>();
    jobs.forEach((job) => {
      if (job.status) options.add(job.status);
    });
    return ["all", ...Array.from(options)];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !normalizedSearch ||
        job.title.toLowerCase().includes(normalizedSearch) ||
        (job.location || "").toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  const visibleJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime && bTime) return bTime - aTime;
      return b._id.localeCompare(a._id);
    });
  }, [filteredJobs]);

  const pendingReviewLabel = stats.pendingUsers > 0 ? "Awaiting action" : "All clear";
  const getCompanyName = (job: (typeof jobs)[number]) => {
    const poster = job.jobPoster;
    if (!poster || typeof poster === "string") return "—";
    return `${poster.firstName || ""} ${poster.lastName || ""}`.trim() || poster.email || "—";
  };

  useEffect(() => {
    if (!openMenuId) return;
    const handleWindowClick = () => setOpenMenuId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openMenuId]);

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section id="dashboard" className="space-y-4 scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#E8F2FF] flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Total Jobs</p>
            <p className="text-[28px] font-bold text-[#111827]">{isLoading ? "—" : stats.totalJobs}</p>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#E6F7EE] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#059669]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Active Jobs</p>
            <p className="text-[28px] font-bold text-[#111827]">{isLoading ? "—" : activeJobs}</p>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#F1E7FF] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#7C3AED]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Applications</p>
            <p className="text-[28px] font-bold text-[#111827]">{isLoading ? "—" : totalApplicants}</p>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#FFF1E6] flex items-center justify-center">
                <Eye className="w-6 h-6 text-[#EA580C]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Total Views</p>
            <p className="text-[28px] font-bold text-[#111827]">{isLoading ? "—" : stats.totalUsers}</p>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#FCE7F3] flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#DB2777]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Total Budget</p>
            <p className="text-[28px] font-bold text-[#111827]">
              {isLoading ? "—" : formatCurrency(totalBudget)}
            </p>
          </div>

          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-[14px] bg-[#E8F2FF] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">Pending Review</p>
            <p className="text-[28px] font-bold text-[#111827]">{isLoading ? "—" : stats.pendingUsers}</p>
            <span className="inline-flex items-center mt-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#DBEAFE] text-[#1D4ED8]">
              {pendingReviewLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#111827]">Jobs & Applications Overview</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Track recent job postings and application activity.
          </p>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <h3 className="text-[18px] font-semibold text-[#111827]">Job Postings</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search jobs..."
                  className="w-full h-10 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All Status" : status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">Job Title</th>
                  <th className="py-3 pr-4 font-medium">Location</th>
                  <th className="py-3 pr-4 font-medium">Salary</th>
                  <th className="py-3 pr-4 font-medium">Applicants</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Posted</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                      Loading job postings...
                    </td>
                  </tr>
                )}

                {!isLoading && visibleJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                      No jobs match the current filters.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  visibleJobs.map((job) => {
                    const postedDate = job.createdAt
                      ? new Date(job.createdAt).toLocaleDateString()
                      : formatDateFromObjectId(job._id);
                    return (
                      <tr key={job._id} className="border-b border-[#F3F4F6]">
                        <td className="py-3 pr-4">
                          <div className="text-[#111827] font-medium">{job.title}</div>
                          <div className="text-[12px] text-[#6B7280]">{getCompanyName(job)}</div>
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#94A3B8]" />
                            <span>{job.location || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[#111827]">{formatSalary(job.salary)}</td>
                        <td className="py-3 pr-4 text-[#111827]">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#94A3B8]" />
                            <span>{job.applicants?.length ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                              getJobStatusColor(job.status)
                            }`}
                          >
                            {job.status || "—"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#94A3B8]" />
                            <span>{postedDate}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuId((prev) => (prev === job._id ? null : job._id));
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F3F4F6]"
                              aria-label="Open job actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openMenuId === job._id && (
                              <div
                                className="absolute right-0 mt-2 w-44 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-10"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Link
                                  to={`/dashboard/job-details/${job._id}`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                                >
                                  <Eye className="w-4 h-4 text-[#64748B]" />
                                  View Details
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    toast.info("Edit job is coming soon.");
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#111827] hover:bg-[#F8FAFC]"
                                >
                                  <Pencil className="w-4 h-4 text-[#64748B]" />
                                  Edit Job
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    toast.info("Delete job is coming soon.");
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Job
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <AdminGate allowedRoles={["superadmin", "admin"]}>
      <AdminDashboardContent />
    </AdminGate>
  );
}
