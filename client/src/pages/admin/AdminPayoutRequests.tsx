import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, WalletCards, XCircle } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { Button, Dialog, StatusState, Textarea } from "../../components/ui";
import { toast } from "../../lib/toast";
import {
  getAdminPayoutRequests,
  updateAdminPayoutRequest,
  type PayoutRequest,
} from "../../services/api";

type ReviewStatus = "approved" | "rejected" | "paid";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const statusStyle: Record<PayoutRequest["status"], string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-blue-100 text-blue-900",
  rejected: "bg-red-100 text-red-900",
  paid: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-slate-200 text-slate-700",
};

const accountName = (request: PayoutRequest) => {
  const user = request.user && typeof request.user === "object" ? request.user : null;
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "Platform user";
};

function AdminPayoutRequestsContent() {
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
      setLoadError(error?.message || "Failed to load payout requests.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

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
      setReviewError("Explain why this payout is being rejected.");
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
          ? "Payout marked as paid."
          : reviewTarget.status === "approved"
            ? "Payout approved."
            : "Payout rejected and refunded.",
      );
      setReviewTarget(null);
      setReviewNotes("");
    } catch (error: any) {
      setReviewError(error?.message || "Failed to update payout request.");
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Awaiting review", value: counts.requested, icon: Clock3, tone: "bg-amber-50 text-amber-800" },
          { label: "Approved for payment", value: counts.approved, icon: CheckCircle2, tone: "bg-blue-50 text-blue-800" },
          { label: "Paid in this view", value: counts.paid, icon: WalletCards, tone: "bg-emerald-50 text-emerald-800" },
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
            <h1 className="text-xl font-bold text-slate-950">Payout requests</h1>
            <p className="mt-1 text-sm text-slate-600">Approve requests, record completed transfers, or reject and return funds.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1 block min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-blue-600">
                <option value="all">All statuses</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Search
              <span className="relative mt-1 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, institution" className="min-h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 font-normal outline-none focus:ring-2 focus:ring-blue-600 sm:w-64" />
              </span>
            </label>
            <Button onClick={() => void loadRequests()} disabled={isLoading} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? <StatusState tone="loading" title="Loading payout requests…" /> : null}
          {!isLoading && loadError ? <StatusState tone="error" title="Payout requests could not be loaded" description={loadError} action={<Button onClick={() => void loadRequests()}>Try again</Button>} /> : null}
          {!isLoading && !loadError && requests.length === 0 ? <StatusState title="No payout requests found" description="Try changing the status or search filters." /> : null}
          {!isLoading && !loadError && requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <caption className="sr-only">Payout requests and available review actions</caption>
                <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="px-3 py-3">Requester</th><th scope="col" className="px-3 py-3">Destination</th><th scope="col" className="px-3 py-3">Amount</th><th scope="col" className="px-3 py-3">Submitted</th><th scope="col" className="px-3 py-3">Status</th><th scope="col" className="px-3 py-3 text-right">Actions</th></tr></thead>
                <tbody>
                  {requests.map((request) => {
                    const destination = request.destinationSnapshot;
                    return (
                      <tr key={request._id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4"><p className="font-semibold text-slate-950">{accountName(request)}</p><p className="mt-1 text-xs text-slate-500">{typeof request.user === "object" ? request.user?.email : ""}</p></td>
                        <td className="px-3 py-4"><p className="font-medium text-slate-800">{destination.institutionName}</p><p className="mt-1 text-xs text-slate-500">{destination.methodType.replace(/_/g, " ")} · {destination.accountNumberMasked || "Masked account"}</p></td>
                        <td className="px-3 py-4 font-bold text-slate-950">{currency.format(Number(request.amount || 0))}</td>
                        <td className="px-3 py-4 text-slate-600">{request.createdAt ? new Date(request.createdAt).toLocaleString() : "—"}</td>
                        <td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[request.status]}`}>{request.status}</span>{request.reviewNotes ? <p className="mt-2 max-w-52 text-xs text-slate-500">{request.reviewNotes}</p> : null}</td>
                        <td className="px-3 py-4"><div className="flex justify-end gap-2">
                          {request.status === "requested" ? <Button onClick={() => openReview(request, "approved")}>Approve</Button> : null}
                          {request.status === "approved" ? <Button onClick={() => openReview(request, "paid")} className="!bg-emerald-700 hover:!bg-emerald-800">Mark paid</Button> : null}
                          {request.status === "requested" || request.status === "approved" ? <Button onClick={() => openReview(request, "rejected")} className="!bg-white !text-red-700 ring-1 ring-red-300 hover:!bg-red-50"><XCircle className="h-4 w-4" aria-hidden="true" />Reject</Button> : null}
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
        title={reviewTarget?.status === "paid" ? "Confirm completed payout" : reviewTarget?.status === "approved" ? "Approve payout" : "Reject payout"}
        description={reviewTarget?.status === "paid" ? "Only mark this request paid after confirming the external transfer was completed." : reviewTarget?.status === "rejected" ? "The reserved amount will be returned to the worker balance." : "Approval moves this request into the payment-ready queue."}
        onClose={closeReview}
        closeDisabled={isReviewing}
      >
        <Textarea
          label={reviewTarget?.status === "rejected" ? "Rejection reason" : "Review note (optional)"}
          value={reviewNotes}
          maxLength={2000}
          error={reviewError || undefined}
          hint={reviewTarget?.status === "rejected" ? "This reason is shown to the worker." : "This optional note is shown to the worker."}
          onChange={(event) => { setReviewNotes(event.target.value); setReviewError(null); }}
        />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={closeReview} disabled={isReviewing} className="!bg-white !text-slate-700 ring-1 ring-slate-300 hover:!bg-slate-50">Cancel</Button>
          <Button onClick={() => void submitReview()} disabled={isReviewing} className={reviewTarget?.status === "rejected" ? "!bg-red-700 hover:!bg-red-800" : reviewTarget?.status === "paid" ? "!bg-emerald-700 hover:!bg-emerald-800" : undefined}>
            {isReviewing ? "Saving…" : reviewTarget?.status === "paid" ? "Confirm paid" : reviewTarget?.status === "approved" ? "Approve payout" : "Reject and refund"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function AdminPayoutRequests() {
  return <AdminGate allowedRoles={["admin"]}><AdminPayoutRequestsContent /></AdminGate>;
}
