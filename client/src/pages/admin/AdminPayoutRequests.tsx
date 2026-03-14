import { useEffect, useMemo, useState } from "react";
import { Landmark, Search } from "lucide-react";
import { toast } from "../../lib/toast";
import {
  getAdminPayoutRequests,
  updateAdminPayoutRequest,
  type PayoutRequest,
} from "../../services/api";
import { AdminGate } from "./admin/AdminGate";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const statusClasses: Record<PayoutRequest["status"], string> = {
  requested: "bg-[#DBEAFE] text-[#1D4ED8]",
  approved: "bg-[#FEF3C7] text-[#B45309]",
  rejected: "bg-[#FEE2E2] text-[#B91C1C]",
  paid: "bg-[#DCFCE7] text-[#15803D]",
  cancelled: "bg-[#F3F4F6] text-[#6B7280]",
};

function AdminPayoutRequestsContent() {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutRequest["status"]>("all");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await getAdminPayoutRequests({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const nextRequests = Array.isArray((response as any)?.payoutRequests)
        ? ((response as any).payoutRequests as PayoutRequest[])
        : [];
      setRequests(nextRequests);
    } catch (error: any) {
      setLoadError(error?.message || "Failed to load payout requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [search, statusFilter]);

  const counts = useMemo(
    () => ({
      requested: requests.filter((item) => item.status === "requested").length,
      approved: requests.filter((item) => item.status === "approved").length,
      paid: requests.filter((item) => item.status === "paid").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    }),
    [requests],
  );

  const handleAction = async (requestId: string, status: "approved" | "rejected" | "paid") => {
    setPendingAction(`${requestId}:${status}`);
    try {
      const response = await updateAdminPayoutRequest(requestId, {
        status,
        reviewNotes: notesById[requestId]?.trim() || undefined,
      });
      const updated = (response as any)?.payoutRequest as PayoutRequest | undefined;
      if (updated) {
        setRequests((current) => current.map((item) => (item._id === requestId ? updated : item)));
      } else {
        await loadRequests();
      }
      toast.success(`Payout request ${status}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update payout request.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
          <p className="text-[13px] text-[#6B7280]">Requested</p>
          <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : counts.requested}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
          <p className="text-[13px] text-[#6B7280]">Approved</p>
          <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : counts.approved}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
          <p className="text-[13px] text-[#6B7280]">Paid</p>
          <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : counts.paid}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5">
          <p className="text-[13px] text-[#6B7280]">Rejected</p>
          <p className="text-[28px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : counts.rejected}</p>
        </div>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-[#111827]">Payout Requests</h1>
            <p className="text-[13px] text-[#6B7280] mt-1">Review worker payout requests, add notes, and mark final payment completion.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by user or institution"
                className="w-full h-10 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-10 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
            >
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loadError ? (
          <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
            {loadError}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="py-3 pr-4 font-medium">User</th>
                <th className="py-3 pr-4 font-medium">Destination</th>
                <th className="py-3 pr-4 font-medium">Amount</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Review Notes</th>
                <th className="py-3 pr-4 font-medium">Transaction</th>
                <th className="py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                    Loading payout requests...
                  </td>
                </tr>
              ) : null}

              {!isLoading && requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                    No payout requests found.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? requests.map((request) => {
                    const user = request.user && typeof request.user === "object" ? request.user : null;
                    const tx = request.transaction && typeof request.transaction === "object" ? request.transaction : null;
                    const isFinal = ["rejected", "paid", "cancelled"].includes(request.status);
                    return (
                      <tr key={request._id} className="border-b border-[#F3F4F6] align-top">
                        <td className="py-3 pr-4 text-[#111827]">
                          <div className="font-medium">
                            {`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "—"}
                          </div>
                          <div className="text-[12px] text-[#6B7280] mt-1">{user?.email || "—"}</div>
                          <div className="text-[12px] text-[#9CA3AF] mt-1">
                            Worker balance: {currency.format(Number(user?.workerBalance || 0))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          <div className="font-medium text-[#111827]">{request.destinationSnapshot.institutionName}</div>
                          <div className="mt-1">{request.destinationSnapshot.accountName}</div>
                          <div className="text-[12px] text-[#9CA3AF] mt-1">
                            {request.destinationSnapshot.accountNumberMasked || request.destinationSnapshot.accountNumber || "-"}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[#111827] font-medium">{currency.format(Number(request.amount || 0))}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${statusClasses[request.status]}`}>
                            {request.status}
                          </span>
                          <div className="text-[12px] text-[#9CA3AF] mt-2">
                            Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : "-"}
                          </div>
                        </td>
                        <td className="py-3 pr-4 min-w-[240px]">
                          <textarea
                            rows={3}
                            value={notesById[request._id] ?? request.reviewNotes ?? ""}
                            onChange={(event) =>
                              setNotesById((current) => ({
                                ...current,
                                [request._id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                            placeholder="Optional review note"
                            disabled={isFinal}
                          />
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          <div>{tx?._id || "-"}</div>
                          <div className="text-[12px] text-[#9CA3AF] mt-1">{tx?.status || "-"}</div>
                          <div className="text-[12px] text-[#9CA3AF] mt-1">{tx?.providerReference || tx?.reference || "-"}</div>
                        </td>
                        <td className="py-3 min-w-[240px]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAction(request._id, "approved")}
                              disabled={isFinal || pendingAction === `${request._id}:approved`}
                              className="px-3 py-2 rounded-[10px] bg-[#DBEAFE] text-[#1D4ED8] font-semibold disabled:opacity-50"
                            >
                              {pendingAction === `${request._id}:approved` ? "Updating..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(request._id, "rejected")}
                              disabled={isFinal || pendingAction === `${request._id}:rejected`}
                              className="px-3 py-2 rounded-[10px] bg-[#FEE2E2] text-[#B91C1C] font-semibold disabled:opacity-50"
                            >
                              {pendingAction === `${request._id}:rejected` ? "Updating..." : "Reject"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(request._id, "paid")}
                              disabled={isFinal || pendingAction === `${request._id}:paid` || request.status !== "approved"}
                              className="px-3 py-2 rounded-[10px] bg-[#DCFCE7] text-[#15803D] font-semibold disabled:opacity-50"
                            >
                              {pendingAction === `${request._id}:paid` ? "Updating..." : "Mark Paid"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminPayoutRequests() {
  return (
    <AdminGate allowedRoles={["admin"]}>
      <AdminPayoutRequestsContent />
    </AdminGate>
  );
}
