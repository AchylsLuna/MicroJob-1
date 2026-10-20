import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, ConfirmDialog, StatusState } from "../../components/ui";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";
import {
  getGovernmentIdVerifications,
  revokeGovernmentIdVerification,
  type GovernmentIdVerificationRecord,
} from "../../services/api";

export function GovernmentIdVerificationTable() {
  const { t, i18n } = useTranslation("admin");
  const [records, setRecords] = useState<GovernmentIdVerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<GovernmentIdVerificationRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getGovernmentIdVerifications()
      .then((rows) => { if (active) setRecords(rows); })
      .catch((error: Error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const revoke = async () => {
    if (!revokeTarget || pending) return;
    setPending(true);
    setRevokeError(null);
    try {
      await revokeGovernmentIdVerification(revokeTarget._id);
      setRecords((rows) => rows.map((row) => row._id === revokeTarget._id ? { ...row, verified: false } : row));
      setRevokeTarget(null);
      toast.success(t("verificationReview.governmentId.revokedToast"));
    } catch (error) {
      setRevokeError(error instanceof Error ? error.message : t("verificationReview.toast.failed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-card border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-bold text-slate-950">{t("verificationReview.identityLabel")}</h1>
      <div className="mt-6">
        {loading ? <StatusState tone="loading" title={t("verificationReview.states.loading")} /> : null}
        {!loading && loadError ? <StatusState tone="error" title={t("verificationReview.states.errorTitle")} description={loadError} action={<Button onClick={() => setReloadKey((key) => key + 1)}>{t("verificationReview.states.retry")}</Button>} /> : null}
        {!loading && !loadError && records.length === 0 ? <StatusState title={t("verificationReview.governmentId.emptyTitle")} description={t("verificationReview.governmentId.emptyDescription")} /> : null}
        {!loading && !loadError && records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <caption className="sr-only">{t("verificationReview.governmentId.caption")}</caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {(["userName", "govIdName", "documentType", "date"] as const).map((column) => (
                    <th key={column} scope="col" className="px-3 py-3">{t(`verificationReview.governmentId.${column}`)}</th>
                  ))}
                  <th scope="col" className="px-3 py-3 text-right">{t("verificationReview.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-4 font-semibold text-slate-950">{record.userName}</td>
                    <td className="px-3 py-4">{record.govIdName}</td>
                    <td className="px-3 py-4">{record.documentType}</td>
                    <td className="whitespace-nowrap px-3 py-4"><time dateTime={record.date}>{new Date(record.date).toLocaleDateString(i18n.language, { year: "numeric", month: "short", day: "numeric" })}</time></td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`${ROUTES.publicProfile(record.user._id)}?viewAs=${record.user.role === "hire" ? "employer" : "worker"}`} className="whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">{t("verificationReview.governmentId.viewProfile")}</Link>
                        <Button disabled={!record.verified || pending} onClick={() => { setRevokeError(null); setRevokeTarget(record); }} className="!bg-white !text-red-700 ring-1 ring-red-300 hover:!bg-red-50">
                          {t(record.verified ? "verificationReview.governmentId.revoke" : "verificationReview.governmentId.revoked")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t("verificationReview.governmentId.revoke")}
        description={t("verificationReview.governmentId.revokeDescription", { name: revokeTarget?.userName || "" })}
        confirmLabel={t("verificationReview.governmentId.revoke")}
        destructive
        pending={pending}
        error={revokeError}
        onConfirm={revoke}
        onClose={() => { if (!pending) setRevokeTarget(null); }}
      />
    </section>
  );
}
