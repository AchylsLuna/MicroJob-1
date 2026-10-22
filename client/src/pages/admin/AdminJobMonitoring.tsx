import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import { Eye, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { toast } from "../../lib/toast";
import { useAdminData } from "../../hooks/useAdminData";
import { deleteJob } from "../../services/api";
import { ConfirmDialog, Dialog } from "../../components/ui";
import { formatDate } from "../../lib/formatters";

function AdminJobMonitoringContent() {
  const { t } = useTranslation("admin");
  const { can } = useAdminPermissions();
  const {
    isLoading,
    loadError,
    jobs,
    categoriesById,
    getJobStatusColor,
    formatDateFromObjectId,
    formatSalary,
  } = useAdminData();

  const prefersReducedMotion = useReducedMotion();
  const [currentPage, setCurrentPage] = useState(1);
  const [deletedJobIds, setDeletedJobIds] = useState<Record<string, boolean>>({});
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const pageSize = 10;

  const sortedJobs = useMemo(
    () =>
      [...jobs]
      .filter((job) => !deletedJobIds[job._id])
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (aTime && bTime) return bTime - aTime;
        return b._id.localeCompare(a._id);
      }),
    [jobs, deletedJobIds]
  );

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sortedJobs.length);
  const paginatedJobs = sortedJobs.slice(pageStart, pageStart + pageSize);
  const selectedJob = jobs.find((job) => job._id === selectedJobId) || null;
  const canManageJobs = can("jobs.manage");

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedJobs.length]);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

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

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    try {
      await deleteJob(jobId);
      setDeletedJobIds((prev) => ({ ...prev, [jobId]: true }));
      toast.success(t("jobMonitoring.toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || t("jobMonitoring.toast.deleteFailed"));
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-xl text-body-sm">
          {loadError}
        </div>
      )}

      <section className="bg-white rounded-card border border-[#E5E7EB] p-6">
        <div>
          <h3 className="text-section font-semibold text-[#111827]">{t("jobMonitoring.title")}</h3>
          <p className="text-body-sm text-[#6B7280] mt-1">
            {t("jobMonitoring.subtitle")}
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          {/* `min-w` is what makes the `overflow-x-auto` wrapper above do
              anything: a bare `w-full` table can never exceed its container, so
              these 8 columns compressed to ~40px each on a phone instead of
              scrolling. Matches the other 8-column admin tables. */}
          <table className="w-full min-w-[940px] text-left text-body-sm">
            <thead>
              <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.job")}</th>
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.category")}</th>
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.status")}</th>
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.applicants")}</th>
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.postedBy")}</th>
                <th className="py-3 pr-4 font-medium">{t("jobMonitoring.table.posted")}</th>
                <th className="py-3 font-medium">{t("jobMonitoring.table.salary")}</th>
                <th className="py-3 font-medium">{t("jobMonitoring.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#9CA3AF]">
                    {t("jobMonitoring.loading")}
                  </td>
                </tr>
              )}

              {!isLoading && sortedJobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#9CA3AF]">
                    {t("jobMonitoring.empty")}
                  </td>
                </tr>
              )}

              {!isLoading &&
                paginatedJobs.map((job, index) => {
                  const postedDate = job.createdAt
                    ? formatDate(job.createdAt)
                    : formatDateFromObjectId(job._id);
                  return (
                    <motion.tr
                      key={job._id}
                      className="border-b border-[#F3F4F6] transition-colors hover:bg-slate-50"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: seconds(motionTokens.duration.enter) }}
                    >
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
                      <td className="py-3 pr-4 text-[#111827]">{formatSalary(job.salary)}</td>
                      <td className="py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedJobId(job._id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-caption font-medium bg-brand/[0.06] text-brand hover:opacity-80"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("jobMonitoring.viewAction")}
                          </button>
                          {canManageJobs ? <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: job._id, title: job.title })}
                            disabled={deletingJobId === job._id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-caption font-medium bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2] disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingJobId === job._id ? t("jobMonitoring.deletingAction") : t("jobMonitoring.deleteAction")}
                          </button> : null}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && sortedJobs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#E5E7EB] text-body-sm text-[#6B7280] mt-4">
            <span>
              {t("jobMonitoring.pagination.showing", { start: pageStart + 1, end: pageEnd, total: sortedJobs.length })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-control border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
              >
                {t("jobMonitoring.pagination.previous")}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-[8px] text-body-sm ${
                      page === safePage
                        ? "bg-brand text-white"
                        : "border border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-control border border-[#E5E7EB] text-[#111827] disabled:text-[#9CA3AF] disabled:bg-[#F9FAFB]"
              >
                {t("jobMonitoring.pagination.next")}
              </button>
            </div>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(selectedJob)}
        title={selectedJob?.title || t("jobMonitoring.viewAction")}
        description={selectedJob ? `${getPosterName(selectedJob)} · ${selectedJob.location || "—"}` : ""}
        onClose={() => setSelectedJobId(null)}
      >
        {selectedJob ? (
          <div className="space-y-4 text-sm text-slate-700">
            <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobMonitoring.table.category")}</dt><dd className="mt-1 text-slate-900">{getCategoryName(selectedJob)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobMonitoring.table.status")}</dt><dd className="mt-1 text-slate-900">{selectedJob.status || "—"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobMonitoring.table.salary")}</dt><dd className="mt-1 text-slate-900">{formatSalary(selectedJob.salary)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobMonitoring.table.applicants")}</dt><dd className="mt-1 text-slate-900">{selectedJob.applicantsCount ?? selectedJob.applicants?.length ?? 0}</dd></div>
            </dl>
            <div><h4 className="font-semibold text-slate-950">{t("jobMonitoring.details.description")}</h4><p className="mt-1 whitespace-pre-wrap">{selectedJob.description || t("jobMonitoring.details.noDescription")}</p></div>
            {selectedJob.requirements?.length ? <div><h4 className="font-semibold text-slate-950">{t("jobMonitoring.details.requirements")}</h4><ul className="mt-1 list-disc space-y-1 pl-5">{selectedJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            {selectedJob.skills?.length ? <div><h4 className="font-semibold text-slate-950">{t("jobMonitoring.details.skills")}</h4><div className="mt-2 flex flex-wrap gap-2">{selectedJob.skills.map((item) => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item}</span>)}</div></div> : null}
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("jobMonitoring.deleteDialog.title")}
        description={t("jobMonitoring.deleteDialog.description", { title: deleteTarget?.title || t("jobMonitoring.deleteDialog.fallbackTitle") })}
        confirmLabel={t("jobMonitoring.deleteDialog.title")}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteJob(deleteTarget.id)}
      />
    </div>
  );
}

export function AdminJobMonitoring() {
  return (
    <AdminGate permission="jobs.view">
      <AdminJobMonitoringContent />
    </AdminGate>
  );
}
