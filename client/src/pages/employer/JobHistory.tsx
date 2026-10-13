import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { getEmployerJobHistory, type EmployerJobHistoryItem } from "../../services/api";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { Dialog } from "../../components/ui";
import { ApplicationsManagement } from "./ApplicationsManagement";

export function JobHistory() {
  const { t } = useTranslation("employer");
  const [jobs, setJobs] = useState<EmployerJobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = jobs.find((job) => job._id === selectedId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await getEmployerJobHistory());
    } catch (requestError: any) {
      setError(requestError?.message || t("jobHistory.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const statusLabel = (status: string) => t(`jobHistory.statuses.${status}`, { defaultValue: status });

  return (
    <div className="ui-page">
      <div className="ui-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ui-page-title">{t("jobHistory.title")}</h1>
            <p className="ui-page-subtitle">{t("jobHistory.subtitle")}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-brand/20 px-4 text-body-sm font-semibold text-brand disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("jobHistory.refresh")}
          </button>
        </div>
        <p className="mt-4 text-caption text-slate-500">{t("jobHistory.moneyNote")}</p>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
        {loading ? <p role="status" className="py-10 text-center text-slate-500">{t("jobHistory.loading")}</p> : null}
        {!loading && !error && !jobs.length ? <p className="py-10 text-center text-slate-500">{t("jobHistory.empty")}</p> : null}
        {!loading && !error && jobs.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-body-sm">
              <thead><tr className="border-b border-slate-200 text-slate-500">
                {["jobTitle", "status", "amountHeld", "amountPaid", "details"].map((key) => <th key={key} scope="col" className="px-3 py-3 font-medium">{t(`jobHistory.${key}`)}</th>)}
              </tr></thead>
              <tbody>{jobs.map((job) => (
                <tr key={job._id} className="border-b border-slate-100">
                  <th scope="row" className="px-3 py-4 font-semibold text-slate-900">{job.title}</th>
                  <td className="px-3 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-caption font-semibold ${job.status === "In Progress" ? "bg-amber-50 text-amber-800" : job.status === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{statusLabel(job.status)}</span></td>
                  <td className="px-3 py-4 tabular-nums">{formatCurrency(job.amountHeld)}</td>
                  <td className="px-3 py-4 tabular-nums">{formatCurrency(job.amountPaid)}</td>
                  <td className="px-3 py-4"><button type="button" onClick={() => setSelectedId(job._id)} aria-label={t("jobHistory.viewDetailsFor", { title: job.title })} className="min-h-11 rounded-control border border-brand/20 px-3 font-semibold text-brand hover:bg-brand/[0.06]">{t("jobHistory.viewDetails")}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </div>
      {selected ? (
        <Dialog open size="xl" title={selected.title} description={statusLabel(selected.status)} onClose={() => { setSelectedId(null); void load(); }}>
          <div className="mb-5 space-y-3 text-body-sm text-slate-700">
            <p className="whitespace-pre-wrap">{selected.description}</p>
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              <div><dt className="text-slate-500">{t("jobHistory.location")}</dt><dd>{selected.location || "—"}</dd></div>
              <div><dt className="text-slate-500">{t("jobHistory.jobType")}</dt><dd>{selected.jobType || "—"}</dd></div>
              <div><dt className="text-slate-500">{t("jobHistory.deadline")}</dt><dd>{selected.deadline ? formatDate(selected.deadline) : "—"}</dd></div>
              <div><dt className="text-slate-500">{t("jobHistory.minimumPay")}</dt><dd>{formatCurrency(selected.salary || 0)}</dd></div>
              <div><dt className="text-slate-500">{t("jobHistory.amountHeld")}</dt><dd>{formatCurrency(selected.amountHeld)}</dd></div>
              <div><dt className="text-slate-500">{t("jobHistory.amountPaid")}</dt><dd>{formatCurrency(selected.amountPaid)}</dd></div>
            </dl>
            {(["skills", "requirements", "responsibilities"] as const).map((key) => selected[key]?.length ? <div key={key}><h3 className="font-semibold">{t(`jobHistory.${key}`)}</h3><ul className="mt-2 list-disc pl-5">{selected[key]?.map((value, index) => <li key={`${index}:${value}`}>{value}</li>)}</ul></div> : null)}
          </div>
          <ApplicationsManagement key={selected._id} historyJobId={selected._id} onHistoryChange={() => void load()} />
        </Dialog>
      ) : null}
    </div>
  );
}
