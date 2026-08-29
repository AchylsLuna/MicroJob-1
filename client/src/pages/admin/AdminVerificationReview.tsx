import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileCheck2, IdCard, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { Button, Dialog, StatusState, Textarea } from "../../components/ui";
import { toast } from "../../lib/toast";
import { useAdminData } from "../../hooks/useAdminData";
import { updateAdminVerification } from "../../services/api";

const toAdminAssetUrl = (value?: string) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const origin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
};

type DocumentType = "identity" | "address";

interface PendingSubmission {
  userId: string;
  name: string;
  email: string;
  documentType: DocumentType;
  documentUrl?: string;
}

/**
 * Real data, not fixtures: reuses `useAdminData()` (the same hook
 * AdminUserManagement uses) and writes through the existing
 * `updateAdminVerification` endpoint — the identical call
 * AdminUserManagement's per-user drawer already makes. This page is a
 * queue view over the same submissions, filtered to the ones awaiting a
 * decision, so a moderator doesn't have to open users one at a time.
 */
function AdminVerificationReviewContent() {
  const { t } = useTranslation("admin");
  const { isLoading, loadError, users, reload } = useAdminData();
  const prefersReducedMotion = useReducedMotion();

  const [rejectTarget, setRejectTarget] = useState<PendingSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const submissions = useMemo<PendingSubmission[]>(() => {
    const rows: PendingSubmission[] = [];
    for (const user of users) {
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
      (["identity", "address"] as const).forEach((documentType) => {
        const document = user.verification?.[`${documentType}Document`];
        if (document?.status === "in-review") {
          rows.push({ userId: user._id, name, email: user.email, documentType, documentUrl: document.documentUrl });
        }
      });
    }
    return rows;
  }, [users]);

  const key = (submission: PendingSubmission) => `${submission.userId}:${submission.documentType}`;

  const approve = async (submission: PendingSubmission) => {
    setPendingKey(key(submission));
    try {
      await updateAdminVerification(submission.userId, submission.documentType, { status: "complete" });
      toast.success(t("verificationReview.toast.approved", { name: submission.name }));
      reload();
    } catch (error: any) {
      toast.error(error?.message || t("verificationReview.toast.failed"));
    } finally {
      setPendingKey(null);
    }
  };

  const openReject = (submission: PendingSubmission) => {
    setRejectTarget(submission);
    setRejectReason("");
    setRejectError(null);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError(t("verificationReview.rejectDialog.reasonRequired"));
      return;
    }
    setPendingKey(key(rejectTarget));
    try {
      await updateAdminVerification(rejectTarget.userId, rejectTarget.documentType, { status: "rejected", rejectionReason: reason });
      toast.success(t("verificationReview.toast.rejected", { name: rejectTarget.name }));
      setRejectTarget(null);
      reload();
    } catch (error: any) {
      setRejectError(error?.message || t("verificationReview.toast.failed"));
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
            <FileCheck2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">{t("verificationReview.cards.pending")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{isLoading ? "—" : submissions.length}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-950">{t("verificationReview.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("verificationReview.subtitle")}</p>
        </div>

        <div className="mt-6">
          {isLoading ? <StatusState tone="loading" title={t("verificationReview.states.loading")} /> : null}
          {!isLoading && loadError ? (
            <StatusState tone="error" title={t("verificationReview.states.errorTitle")} description={loadError} action={<Button onClick={reload}>{t("verificationReview.states.retry")}</Button>} />
          ) : null}
          {!isLoading && !loadError && submissions.length === 0 ? (
            <StatusState title={t("verificationReview.states.emptyTitle")} description={t("verificationReview.states.emptyDescription")} />
          ) : null}
          {!isLoading && !loadError && submissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <caption className="sr-only">{t("verificationReview.table.caption")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="px-3 py-3">{t("verificationReview.table.applicant")}</th>
                    <th scope="col" className="px-3 py-3">{t("verificationReview.table.document")}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t("verificationReview.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission, index) => (
                    <motion.tr
                      key={key(submission)}
                      className="border-b border-slate-100 align-top"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                    >
                      <td className="px-3 py-4">
                        <p className="font-semibold text-slate-950">{submission.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{submission.email}</p>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2 text-slate-800">
                          {submission.documentType === "identity" ? <IdCard className="h-4 w-4 text-slate-400" aria-hidden="true" /> : <MapPinned className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                          {submission.documentType === "identity" ? t("verificationReview.identityLabel") : t("verificationReview.addressLabel")}
                        </div>
                        {submission.documentUrl ? (
                          <a href={toAdminAssetUrl(submission.documentUrl)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:underline">
                            {t("verificationReview.viewDocument")}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          <Button disabled={pendingKey === key(submission)} onClick={() => void approve(submission)}>
                            {t("verificationReview.actions.approve")}
                          </Button>
                          <Button disabled={pendingKey === key(submission)} onClick={() => openReject(submission)} className="!bg-white !text-red-700 ring-1 ring-red-300 hover:!bg-red-50">
                            {t("verificationReview.actions.reject")}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog
        open={Boolean(rejectTarget)}
        title={t("verificationReview.rejectDialog.title")}
        description={rejectTarget ? t("verificationReview.rejectDialog.description", { name: rejectTarget.name }) : ""}
        onClose={() => setRejectTarget(null)}
      >
        <Textarea
          label={t("verificationReview.rejectDialog.reasonLabel")}
          value={rejectReason}
          maxLength={2000}
          error={rejectError || undefined}
          onChange={(event) => { setRejectReason(event.target.value); setRejectError(null); }}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setRejectTarget(null)} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
            {t("verificationReview.rejectDialog.cancel")}
          </Button>
          <Button onClick={() => void submitReject()} className="!bg-red-700 hover:!bg-red-800">
            {t("verificationReview.actions.reject")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AdminVerificationReview() {
  return (
    <AdminGate permission="verification.review">
      <AdminVerificationReviewContent />
    </AdminGate>
  );
}
