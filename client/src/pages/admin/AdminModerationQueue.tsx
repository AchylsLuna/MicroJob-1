import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertOctagon, Briefcase, ShieldOff, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { Button, ConfirmDialog, Dialog, StatusState, Textarea } from "../../components/ui";
import { toast } from "../../lib/toast";
import { formatDateTime } from "../../lib/formatters";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { dismissAdminModerationReport, enforceAdminModerationReport, getAdminModerationReports } from "../../services/api";
import type { ModerationReport } from "../../lib/adminFixtures";

type EnforcementAction = "suspended" | "banned";

const statusStyle: Record<ModerationReport["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  resolved: "bg-emerald-100 text-emerald-900",
  dismissed: "bg-slate-200 text-slate-700",
};

/** Reports are loaded from and mutated through the persisted admin API. */
function AdminModerationQueueContent() {
  const { t } = useTranslation("admin");
  const { can } = useAdminPermissions();
  const prefersReducedMotion = useReducedMotion();

  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [enforceTarget, setEnforceTarget] = useState<{ report: ModerationReport; action: EnforcementAction } | null>(null);
  const [enforceReason, setEnforceReason] = useState("");
  const [enforceError, setEnforceError] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<ModerationReport | null>(null);

  useEffect(() => {
    let active = true;
    getAdminModerationReports()
      .then((items) => { if (active) setReports(items); })
      .catch((error) => toast.error(error instanceof Error ? error.message : t("moderationQueue.states.emptyDescription")));
    return () => { active = false; };
  }, [t]);

  const pendingCount = useMemo(() => reports.filter((report) => report.status === "pending").length, [reports]);

  const openEnforce = (report: ModerationReport, action: EnforcementAction) => {
    setEnforceTarget({ report, action });
    setEnforceReason("");
    setEnforceError(null);
  };

  const submitEnforce = async () => {
    if (!enforceTarget) return;
    const reason = enforceReason.trim();
    if (!reason) {
      setEnforceError(t("moderationQueue.enforceDialog.reasonRequired"));
      return;
    }
    const { report, action } = enforceTarget;
    try {
      await enforceAdminModerationReport(report.id, { action, reason });
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status: "resolved", resolution: `${t(`moderationQueue.actions.${action}`)}: ${reason}` } : item));
      toast.success(
        action === "banned"
          ? t("moderationQueue.toast.banned", { name: report.targetName })
          : t("moderationQueue.toast.suspended", { name: report.targetName }),
      );
      setEnforceTarget(null);
      setEnforceReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("moderationQueue.states.emptyDescription"));
    }
  };

  const submitDismiss = async () => {
    if (!dismissTarget) return;
    try {
      await dismissAdminModerationReport(dismissTarget.id, "Dismissed by admin review");
      setReports((current) => current.map((item) => item.id === dismissTarget.id ? { ...item, status: "dismissed" } : item));
      toast.success(t("moderationQueue.toast.dismissed", { name: dismissTarget.targetName }));
      setDismissTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("moderationQueue.states.emptyDescription"));
    }
  };

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
            <AlertOctagon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">{t("moderationQueue.cards.pending")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{pendingCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <ShieldOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">{t("moderationQueue.cards.total")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{reports.length}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-950">{t("moderationQueue.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("moderationQueue.subtitle")}</p>
        </div>

        <div className="mt-6">
          {reports.length === 0 ? (
            <StatusState
              title={t("moderationQueue.states.emptyTitle")}
              description={t("moderationQueue.states.emptyDescription")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <caption className="sr-only">{t("moderationQueue.table.caption")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="px-3 py-3">{t("moderationQueue.table.reported")}</th>
                    <th scope="col" className="px-3 py-3">{t("moderationQueue.table.reason")}</th>
                    <th scope="col" className="px-3 py-3">{t("moderationQueue.table.reportedBy")}</th>
                    <th scope="col" className="px-3 py-3">{t("moderationQueue.table.date")}</th>
                    <th scope="col" className="px-3 py-3">{t("moderationQueue.table.status")}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t("moderationQueue.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, index) => (
                    <motion.tr
                      key={report.id}
                      className="border-b border-slate-100 align-top"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          {report.targetType === "user" ? (
                            <UserIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          ) : (
                            <Briefcase className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          )}
                          <span className="font-semibold text-slate-950">{report.targetName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {report.reason}
                        {report.resolution ? <p className="mt-1 text-xs text-slate-500">{report.resolution}</p> : null}
                      </td>
                      <td className="px-3 py-4 text-slate-600">{report.reportedBy}</td>
                      <td className="px-3 py-4 text-slate-600">{formatDateTime(report.reportedAt)}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[report.status]}`}>
                          {t(`moderationQueue.statuses.${report.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {report.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            {can("users.suspend") ? (
                              <Button onClick={() => openEnforce(report, "suspended")} className="!bg-white !text-amber-800 ring-1 ring-amber-300 hover:!bg-amber-50">
                                {t("moderationQueue.actions.suspended")}
                              </Button>
                            ) : null}
                            {can("users.ban") ? (
                              <Button onClick={() => openEnforce(report, "banned")} className="!bg-red-700 hover:!bg-red-800">
                                {t("moderationQueue.actions.banned")}
                              </Button>
                            ) : null}
                            {can("moderation.enforce") ? (
                              <Button onClick={() => setDismissTarget(report)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
                                {t("moderationQueue.actions.dismiss")}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(enforceTarget)}
        title={enforceTarget?.action === "banned" ? t("moderationQueue.enforceDialog.titleBan") : t("moderationQueue.enforceDialog.titleSuspend")}
        description={enforceTarget ? t("moderationQueue.enforceDialog.description", { name: enforceTarget.report.targetName }) : ""}
        onClose={() => setEnforceTarget(null)}
      >
        <Textarea
          label={t("moderationQueue.enforceDialog.reasonLabel")}
          value={enforceReason}
          maxLength={2000}
          error={enforceError || undefined}
          onChange={(event) => { setEnforceReason(event.target.value); setEnforceError(null); }}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setEnforceTarget(null)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
            {t("moderationQueue.enforceDialog.cancel")}
          </Button>
          <Button onClick={submitEnforce} className={enforceTarget?.action === "banned" ? "!bg-red-700 hover:!bg-red-800" : undefined}>
            {enforceTarget?.action === "banned" ? t("moderationQueue.actions.banned") : t("moderationQueue.actions.suspended")}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(dismissTarget)}
        title={t("moderationQueue.dismissDialog.title")}
        description={dismissTarget ? t("moderationQueue.dismissDialog.description", { name: dismissTarget.targetName }) : ""}
        confirmLabel={t("moderationQueue.actions.dismiss")}
        onConfirm={submitDismiss}
        onClose={() => setDismissTarget(null)}
      />
    </div>
  );
}

export function AdminModerationQueue() {
  return (
    <AdminGate permission="moderation.review">
      <AdminModerationQueueContent />
    </AdminGate>
  );
}
