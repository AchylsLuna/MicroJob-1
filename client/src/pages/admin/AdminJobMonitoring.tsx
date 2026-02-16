import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../microjobs/hooks/useAdminData";

function AdminJobMonitoringContent() {
  const {
    isLoading,
    loadError,
    jobs,
    categoriesById,
    getJobStatusColor,
    formatDateFromObjectId,
    formatSalary,
  } = useAdminData();

  const sortedJobs = [...jobs].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime && bTime) return bTime - aTime;
    return b._id.localeCompare(a._id);
  });

  const getPosterName = (job: typeof jobs[number]) => {
    const poster = job.jobPoster;
    if (!poster || typeof poster === "string") return "—";
    return `${poster.firstName || ""} ${poster.lastName || ""}`.trim() || poster.email || "—";
  };

  const getCategoryName = (job: typeof jobs[number]) => {
    if (!job.category) return "—";
    if (typeof job.category === "string") {
      return categoriesById.get(job.category)?.name || "—";
    }
    return job.category.name || "—";
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div>
          <h3 className="text-[18px] font-semibold text-[#111827]">Latest Job Posts</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Review new listings and track their current status.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="py-3 pr-4 font-medium">Job</th>
                <th className="py-3 pr-4 font-medium">Category</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Applicants</th>
                <th className="py-3 pr-4 font-medium">Posted By</th>
                <th className="py-3 pr-4 font-medium">Posted</th>
                <th className="py-3 font-medium">Salary</th>
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

              {!isLoading && sortedJobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                    No job postings available.
                  </td>
                </tr>
              )}

              {!isLoading &&
                sortedJobs.map((job) => {
                  const postedDate = job.createdAt
                    ? new Date(job.createdAt).toLocaleDateString()
                    : formatDateFromObjectId(job._id);
                  return (
                    <tr key={job._id} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4 text-[#111827] font-medium">{job.title}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{getCategoryName(job)}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                            getJobStatusColor(job.status)
                          }`}
                        >
                          {job.status || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#111827]">
                        {job.applicants?.length ?? 0}
                      </td>
                      <td className="py-3 pr-4 text-[#6B7280]">{getPosterName(job)}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{postedDate}</td>
                      <td className="py-3 text-[#111827]">{formatSalary(job.salary)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AdminJobMonitoring() {
  return (
    <AdminGate allowedRoles={["superadmin", "admin"]}>
      <AdminJobMonitoringContent />
    </AdminGate>
  );
}
