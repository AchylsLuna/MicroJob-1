import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import {
  getAdminSupportTicket,
  getAdminSupportTickets,
  replyToAdminSupportTicket,
  updateAdminSupportTicket,
  type SupportTicket,
} from "../../services/api";
import { AdminGate } from "./admin/AdminGate";
import { formatDateTime } from "../../lib/formatters";

const formatTicketDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return formatDateTime(parsed);
};

const statusClasses: Record<SupportTicket["status"], string> = {
  open: "bg-[#1C4D8D]/10 text-[#1C4D8D]",
  in_progress: "bg-[#FEF3C7] text-[#B45309]",
  waiting_user: "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]",
  resolved: "bg-[#DCFCE7] text-[#15803D]",
  closed: "bg-[#F3F4F6] text-[#6B7280]",
};

const getTicketStatusLabel = (status: SupportTicket["status"], t: TFunction<"admin">) => {
  if (status === "in_progress") return t("supportTickets.statuses.inProgress");
  if (status === "waiting_user") return t("supportTickets.statuses.waitingUser");
  if (status === "resolved") return t("supportTickets.statuses.resolved");
  if (status === "closed") return t("supportTickets.statuses.closed");
  return t("supportTickets.statuses.open");
};

const extractTickets = (response: any): SupportTicket[] => {
  if (Array.isArray(response?.tickets)) return response.tickets as SupportTicket[];
  if (Array.isArray(response?.data)) return response.data as SupportTicket[];
  if (Array.isArray(response)) return response as SupportTicket[];
  return [];
};

const extractTicket = (response: any): SupportTicket | undefined => {
  if (response?.ticket && typeof response.ticket === "object") return response.ticket as SupportTicket;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data as SupportTicket;
  }
  return undefined;
};

function AdminSupportTicketsContent() {
  const { t } = useTranslation("admin");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicket["status"]>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("medium");
  const [status, setStatus] = useState<SupportTicket["status"]>("open");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const detailsDirtyRef = useRef(false);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket._id === selectedTicketId) || null,
    [selectedTicketId, tickets],
  );

  const loadTickets = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setIsLoading(true);
      setLoadError(null);
    }
    try {
      const response = await getAdminSupportTickets({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const nextTickets = extractTickets(response as any);
      setTickets(nextTickets);
      if (nextTickets.length > 0) {
        setSelectedTicketId((current) => current || nextTickets[0]._id);
      } else {
        setSelectedTicketId(null);
      }
    } catch (error: any) {
      if (!silent) {
        setLoadError(error?.message || t("supportTickets.toast.loadTicketsFailed"));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [search, statusFilter, t]);

  const loadTicketDetails = useCallback(async (ticketId: string, options?: { silent?: boolean; resetForm?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      const response = await getAdminSupportTicket(ticketId);
      const ticket = extractTicket(response as any);
      if (!ticket) return;
      setTickets((current) => current.map((item) => (item._id === ticketId ? ticket : item)));
      if (options?.resetForm || !detailsDirtyRef.current) {
        setStatus(ticket.status);
        setPriority(ticket.priority || "medium");
      }
      if (options?.resetForm) {
        setReviewNotes("");
        detailsDirtyRef.current = false;
      }
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || t("supportTickets.toast.loadDetailsFailed"));
      }
    }
  }, [t]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets, search, statusFilter]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetails(selectedTicketId, { resetForm: true });
    }
  }, [selectedTicketId, loadTicketDetails]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadTickets({ silent: true });
    }, 10000);
    return () => window.clearInterval(id);
  }, [loadTickets, search, statusFilter]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const id = window.setInterval(() => {
      loadTicketDetails(selectedTicketId, { silent: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [selectedTicketId, loadTicketDetails]);

  const handleUpdateTicket = async () => {
    if (!selectedTicketId) return;
    setIsUpdating(true);
    try {
      const response = await updateAdminSupportTicket(selectedTicketId, {
        status,
        priority,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      const ticket = extractTicket(response as any);
      if (ticket) {
        setTickets((current) => current.map((item) => (item._id === ticket._id ? ticket : item)));
      } else {
        await loadTicketDetails(selectedTicketId);
      }
      setReviewNotes("");
      detailsDirtyRef.current = false;
      toast.success(t("supportTickets.toast.ticketUpdated"));
    } catch (error: any) {
      toast.error(error?.message || t("supportTickets.toast.updateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicketId || !replyDraft.trim()) return;
    setIsReplying(true);
    try {
      const response = await replyToAdminSupportTicket(selectedTicketId, { message: replyDraft.trim() });
      const ticket = extractTicket(response as any);
      if (ticket) {
        setTickets((current) => current.map((item) => (item._id === ticket._id ? ticket : item)));
      } else {
        await loadTicketDetails(selectedTicketId);
      }
      setReplyDraft("");
      toast.success(t("supportTickets.toast.replySent"));
    } catch (error: any) {
      toast.error(error?.message || t("supportTickets.toast.replyFailed"));
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="bg-white rounded-[16px] border border-slate-200 p-6 space-y-4">
          <div>
            <h1 className="text-[22px] font-semibold text-[#111827]">{t("supportTickets.header.title")}</h1>
            <p className="text-[13px] text-[#6B7280] mt-1">{t("supportTickets.header.subtitle")}</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("supportTickets.filters.searchPlaceholder")}
              className="w-full h-10 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-10 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
          >
            <option value="all">{t("supportTickets.filters.statusAll")}</option>
            <option value="open">{t("supportTickets.statuses.open")}</option>
            <option value="in_progress">{t("supportTickets.statuses.inProgress")}</option>
            <option value="waiting_user">{t("supportTickets.statuses.waitingUser")}</option>
            <option value="resolved">{t("supportTickets.statuses.resolved")}</option>
            <option value="closed">{t("supportTickets.statuses.closed")}</option>
          </select>

          {loadError ? (
            <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
              {loadError}
            </div>
          ) : null}

          <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
            {isLoading ? <div className="py-6 text-center text-[#9CA3AF]">{t("supportTickets.list.loading")}</div> : null}
            {!isLoading && tickets.length === 0 ? <div className="py-6 text-center text-[#9CA3AF]">{t("supportTickets.list.empty")}</div> : null}
            {!isLoading
              ? tickets.map((ticket) => {
                  const requester = ticket.requester && typeof ticket.requester === "object" ? ticket.requester : null;
                  return (
                    <button
                      key={ticket._id}
                      onClick={() => setSelectedTicketId(ticket._id)}
                      className={`w-full rounded-[14px] border p-4 text-left transition-colors ${
                        selectedTicketId === ticket._id ? "border-[#1C4D8D] bg-[#1C4D8D]/[0.06]" : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#111827] line-clamp-1">{ticket.subject}</p>
                          <p className="text-[12px] text-[#6B7280] mt-1 line-clamp-1">
                            {`${requester?.firstName || ""} ${requester?.lastName || ""}`.trim() || requester?.email || "—"}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusClasses[ticket.status]}`}>
                          {getTicketStatusLabel(ticket.status, t)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#9CA3AF]">{t("supportTickets.list.updatedAt", { date: formatTicketDate(ticket.updatedAt) })}</p>
                    </button>
                  );
                })
              : null}
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          {!selectedTicket ? (
            <div className="py-20 text-center text-[#9CA3AF]">{t("supportTickets.detail.emptyState")}</div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[14px] bg-[#F8FAFC] border border-[#E5E7EB] p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <h2 className="text-[22px] font-semibold text-[#111827]">{selectedTicket.subject}</h2>
                    <p className="text-[13px] text-[#6B7280] mt-2">
                      {t("supportTickets.detail.openedBy", {
                        date: formatTicketDate(selectedTicket.createdAt),
                        name: `${selectedTicket.requester?.firstName || ""} ${selectedTicket.requester?.lastName || ""}`.trim() || selectedTicket.requester?.email || "—",
                      })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold ${statusClasses[selectedTicket.status]}`}>
                    {getTicketStatusLabel(selectedTicket.status, t)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ticket-status" className="block text-[13px] text-[#374151] mb-2">{t("supportTickets.detail.statusLabel")}</label>
                  <select
                    id="ticket-status"
                    value={status}
                    onChange={(event) => { detailsDirtyRef.current = true; setStatus(event.target.value as SupportTicket["status"]); }}
                    className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                  >
                    <option value="open">{t("supportTickets.statuses.open")}</option>
                    <option value="in_progress">{t("supportTickets.statuses.inProgress")}</option>
                    <option value="waiting_user">{t("supportTickets.statuses.waitingUser")}</option>
                    <option value="resolved">{t("supportTickets.statuses.resolved")}</option>
                    <option value="closed">{t("supportTickets.statuses.closed")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ticket-priority" className="block text-[13px] text-[#374151] mb-2">{t("supportTickets.detail.priorityLabel")}</label>
                  <select
                    id="ticket-priority"
                    value={priority}
                    onChange={(event) => { detailsDirtyRef.current = true; setPriority(event.target.value as SupportTicket["priority"]); }}
                    className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                  >
                    <option value="low">{t("supportTickets.priorities.low")}</option>
                    <option value="medium">{t("supportTickets.priorities.medium")}</option>
                    <option value="high">{t("supportTickets.priorities.high")}</option>
                    <option value="urgent">{t("supportTickets.priorities.urgent")}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleUpdateTicket}
                    disabled={isUpdating}
                    className="w-full h-11 rounded-[12px] bg-[#1C4D8D] text-white text-[14px] font-semibold disabled:opacity-60"
                  >
                    {isUpdating ? t("supportTickets.detail.savingButton") : t("supportTickets.detail.saveButton")}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="ticket-review-note" className="block text-[13px] text-[#374151] mb-2">{t("supportTickets.detail.internalNoteLabel")}</label>
                <textarea
                  id="ticket-review-note"
                  rows={3}
                  value={reviewNotes}
                  onChange={(event) => { detailsDirtyRef.current = true; setReviewNotes(event.target.value); }}
                  placeholder={t("supportTickets.detail.internalNotePlaceholder")}
                  className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                />
              </div>

              {(selectedTicket.internalNotes || []).length > 0 ? (
                <section className="rounded-[14px] border border-amber-200 bg-amber-50 p-4" aria-labelledby="internal-notes-title">
                  <h3 id="internal-notes-title" className="text-sm font-semibold text-amber-950">{t("supportTickets.detail.internalNotesTitle")}</h3>
                  <div className="mt-3 space-y-3">
                    {(selectedTicket.internalNotes || []).map((note) => (
                      <article key={note._id} className="rounded-xl border border-amber-200 bg-white p-3">
                        <p className="text-sm text-slate-800">{note.body}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatTicketDate(note.createdAt)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {(selectedTicket.messages || []).map((message) => {
                  const isAdmin = message.actorRole === "admin";
                  return (
                    <div
                      key={message._id}
                      className={`rounded-[14px] p-4 border ${
                        isAdmin ? "bg-[#1C4D8D]/[0.06] border-[#1C4D8D]/20" : "bg-[#F9FAFB] border-[#E5E7EB]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <ShieldCheck className="w-4 h-4 text-[#1C4D8D]" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-[#6B7280]" />
                          )}
                          <p className="text-[13px] font-semibold text-[#111827]">{isAdmin ? t("supportTickets.detail.roleAdmin") : t("supportTickets.detail.roleUser")}</p>
                        </div>
                        <p className="text-[12px] text-[#6B7280]">{formatTicketDate(message.createdAt)}</p>
                      </div>
                      <p className="text-[14px] leading-relaxed text-[#374151]">{message.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder={t("supportTickets.detail.replyPlaceholder")}
                  className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                />
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={isReplying || !replyDraft.trim()}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-[12px] bg-[#1C4D8D] text-white text-[14px] font-semibold disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {isReplying ? t("supportTickets.detail.sendingReply") : t("supportTickets.detail.sendReply")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminSupportTickets() {
  return (
    <AdminGate permission="support.tickets.handle">
      <AdminSupportTicketsContent />
    </AdminGate>
  );
}
