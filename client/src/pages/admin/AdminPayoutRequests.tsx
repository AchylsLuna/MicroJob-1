import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, WalletCards, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { Button, Dialog, StatusState, Textarea } from "../../components/ui";
import { toast } from "../../lib/toast";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import {
  getAdminPayoutRequests,
  updateAdminPayoutRequest,
  type PayoutRequest,
} from "../../services/api";

type ReviewStatus = "approved" | "rejected" | "paid";

const statusStyle: Record<PayoutRequest["status"], string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-blue-100 text-blue-900",
  rejected: "bg-red-100 text-red-900",
  paid: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-slate-200 text-slate-700",
};

const accountName = (request: PayoutRequest, t: TFunction<"admin">) => {
  const user = request.user && typeof request.user === "object" ? request.user : null;
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || t("payoutRequests.platformUser");
};

function AdminPayoutRequestsContent() {
  const { t } = useTranslation("admin");
  // The page itself is already gated on this permission (AdminGate below),
  // so this is defense-in-depth: it keeps the actions correctly hidden if a
  // future change ever splits "view payouts" from "review payouts" into
  // separate permissions.
  const { can } = useAdminPermissions();
  const canReviewPayouts = can("finance.payouts.review");
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutRequest["status"]>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ request: PayoutRequest; status: ReviewStatus } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await getAdminPayoutRequests({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setRequests(Array.isArray(response?.payoutRequests) ? response.payoutRequests : []);
    } catch (error: any) {
      setLoadError(error?.message || t("payoutRequests.toast.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => ({
    requested: requests.filter((request) => request.status === "requested").length,
    approved: requests.filter((request) => request.status === "approved").length,
    paid: requests.filter((request) => request.status === "paid").length,
  }), [requests]);

  const openReview = (request: PayoutRequest, status: ReviewStatus) => {
    setReviewTarget({ request, status });
    setReviewNotes("");
    setReviewError(null);
  };

  const closeReview = () => {
    if (isReviewing) return;
    setReviewTarget(null);
    setReviewNotes("");
    setReviewError(null);
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    const notes = reviewNotes.trim();
    if (reviewTarget.status === "rejected" && !notes) {
      setReviewError(t("payoutRequests.toast.rejectReasonRequired"));
      return;
    }
    setIsReviewing(true);
    setReviewError(null);
    try {
      const response = await updateAdminPayoutRequest(reviewTarget.request._id, {
        status: reviewTarget.status,
        reviewNotes: notes || undefined,
      });
      const updated = response?.payoutRequest;
      if (updated) {
        setRequests((current) => current.map((item) => item._id === updated._id ? updated : item));
      } else {
        await loadRequests();
      }
      toast.success(
        reviewTarget.status === "paid"
          ? t("payoutRequests.toast.markedPaid")
          : reviewTarget.status === "approved"
            ? t("payoutRequests.toast.approved")
            : t("payoutRequests.toast.rejectedRefunded"),
      );
      setReviewTarget(null);
      setReviewNotes("");
    } catch (error: any) {
      setReviewError(error?.message || t("payoutRequests.toast.updateFailed"));
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t("payoutRequests.cards.awaitingReview"), value: counts.requested, icon: Clock3, tone: "bg-amber-50 text-amber-800" },
          { label: t("payoutRequests.cards.approvedForPayment"), value: counts.approved, icon: CheckCircle2, tone: "bg-blue-50 text-blue-800" },
          { label: t("payoutRequests.cards.paidInView"), value: counts.paid, icon: WalletCards, tone: "bg-emerald-50 text-emerald-800" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{isLoading ? "—" : value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{t("payoutRequests.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("payoutRequests.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              {t("payoutRequests.filters.statusLabel")}
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1 block min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-blue-600">
                <option value="all">{t("payoutRequests.filters.statusOptions.all")}</option>
                <option value="requested">{t("payoutRequests.filters.statusOptions.requested")}</option>
                <option value="approved">{t("payoutRequests.filters.statusOptions.approved")}</option>
                <option value="paid">{t("payoutRequests.filters.statusOptions.paid")}</option>
                <option value="rejected">{t("payoutRequests.filters.statusOptions.rejected")}</option>
                <option value="cancelled">{t("payoutRequests.filters.statusOptions.cancelled")}</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              {t("payoutRequests.filters.searchLabel")}
              <span className="relative mt-1 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("payoutRequests.filters.searchPlaceholder")} className="min-h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 font-normal outline-none focus:ring-2 focus:ring-blue-600 sm:w-64" />
              </span>
            </label>
            <Button onClick={() => void loadRequests()} disabled={isLoading} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" /> {t("payoutRequests.filters.refresh")}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? <StatusState tone="loading" title={t("payoutRequests.states.loading")} /> : null}
          {!isLoading && loadError ? <StatusState tone="error" title={t("payoutRequests.states.errorTitle")} description={loadError} action={<Button onClick={() => void loadRequests()}>{t("payoutRequests.states.retry")}</Button>} /> : null}
          {!isLoading && !loadError && requests.length === 0 ? <StatusState title={t("payoutRequests.states.emptyTitle")} description={t("payoutRequests.states.emptyDescription")} /> : null}
          {!isLoading && !loadError && requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <caption className="sr-only">{t("payoutRequests.table.caption")}</caption>
                <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="px-3 py-3">{t("payoutRequests.table.requester")}</th><th scope="col" className="px-3 py-3">{t("payoutRequests.table.destination")}</th><th scope="col" className="px-3 py-3">{t("payoutRequests.table.amount")}</th><th scope="col" className="px-3 py-3">{t("payoutRequests.table.submitted")}</th><th scope="col" className="px-3 py-3">{t("payoutRequests.table.status")}</th><th scope="col" className="px-3 py-3 text-right">{t("payoutRequests.table.actions")}</th></tr></thead>
                <tbody>
                  {requests.map((request) => {
                    const destination = request.destinationSnapshot;
                    return (
                      <tr key={request._id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4"><p className="font-semibold text-slate-950">{accountName(request, t)}</p><p className="mt-1 text-xs text-slate-500">{typeof request.user === "object" ? request.user?.email : ""}</p></td>
                        <td className="px-3 py-4"><p className="font-medium text-slate-800">{destination.institutionName}</p><p className="mt-1 text-xs text-slate-500">{destination.methodType.replace(/_/g, " ")} · {destination.accountNumberMasked || t("payoutRequests.table.maskedAccount")}</p></td>
                        <td className="px-3 py-4 font-bold text-slate-950">{formatCurrency(request.amount)}</td>
                        <td className="px-3 py-4 text-slate-600">{request.createdAt ? formatDateTime(request.createdAt) : "—"}</td>
                        <td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[request.status]}`}>{request.status}</span>{request.reviewNotes ? <p className="mt-2 max-w-52 text-xs text-slate-500">{request.reviewNotes}</p> : null}</td>
                        <td className="px-3 py-4"><div className="flex justify-end gap-2">
                          {canReviewPayouts && request.status === "requested" ? <Button onClick={() => openReview(request, "approved")}>{t("payoutRequests.actions.approve")}</Button> : null}
                          {canReviewPayouts && request.status === "approved" ? <Button onClick={() => openReview(request, "paid")} className="!bg-emerald-700 hover:!bg-emerald-800">{t("payoutRequests.actions.markPaid")}</Button> : null}
                          {canReviewPayouts && (request.status === "requested" || request.status === "approved") ? <Button onClick={() => openReview(request, "rejected")} className="!bg-white !text-red-700 ring-1 ring-red-300 hover:!bg-red-50"><XCircle className="h-4 w-4" aria-hidden="true" />{t("payoutRequests.actions.reject")}</Button> : null}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog
        open={Boolean(reviewTarget)}
        title={reviewTarget?.status === "paid" ? t("payoutRequests.reviewDialog.titlePaid") : reviewTarget?.status === "approved" ? t("payoutRequests.reviewDialog.titleApproved") : t("payoutRequests.reviewDialog.titleRejected")}
        description={reviewTarget?.status === "paid" ? t("payoutRequests.reviewDialog.descriptionPaid") : reviewTarget?.status === "rejected" ? t("payoutRequests.reviewDialog.descriptionRejected") : t("payoutRequests.reviewDialog.descriptionApproved")}
        onClose={closeReview}
        closeDisabled={isReviewing}
      >
        <Textarea
          label={reviewTarget?.status === "rejected" ? t("payoutRequests.reviewDialog.notesLabelRejected") : t("payoutRequests.reviewDialog.notesLabelOptional")}
          value={reviewNotes}
          maxLength={2000}
          error={reviewError || undefined}
          hint={reviewTarget?.status === "rejected" ? t("payoutRequests.reviewDialog.notesHintRejected") : t("payoutRequests.reviewDialog.notesHintOptional")}
          onChange={(event) => { setReviewNotes(event.target.value); setReviewError(null); }}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={closeReview} disabled={isReviewing} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">{t("payoutRequests.reviewDialog.cancel")}</Button>
          <Button onClick={() => void submitReview()} disabled={isReviewing} className={reviewTarget?.status === "rejected" ? "!bg-red-700 hover:!bg-red-800" : reviewTarget?.status === "paid" ? "!bg-emerald-700 hover:!bg-emerald-800" : undefined}>
            {isReviewing ? t("payoutRequests.reviewDialog.saving") : reviewTarget?.status === "paid" ? t("payoutRequests.reviewDialog.confirmPaid") : reviewTarget?.status === "approved" ? t("payoutRequests.reviewDialog.titleApproved") : t("payoutRequests.reviewDialog.rejectAndRefund")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AdminPayoutRequests() {
  return <AdminGate permission="finance.payouts.review"><AdminPayoutRequestsContent /></AdminGate>;
}
