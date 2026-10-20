import { CompletionEvidence } from '../../components/CompletionEvidence';
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileSearch, FileUp, MessageSquareText, Scale, ShieldCheck } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { Badge, Button, Card, ConfirmDialog, Input, Select, StatusState, Tabs, Textarea } from "../../components/ui";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import { toAbsoluteAssetUrl } from "../../lib/assetUrl";
import { toast } from "../../lib/toast";
import {
  addFinancialDisputeMessage,
  approveFinancialDisputeSettlement,
  assignFinancialDisputeSupport,
  completeFinancialDisputeInvestigation,
  getAdminFinancialDisputes,
  proposeFinancialDisputeSettlement,
  requestFinancialDisputeEvidence,
  type FinancialDispute,
} from "../../services/api";

type DetailTab = "Overview" | "Evidence" | "Conversation" | "Investigation" | "Settlement" | "Audit trail";
type SettlementType = "FULL_REFUND" | "COMPLETE_PAYMENT" | "PARTIAL_PAYMENT";
const label = (value?: string | null) => String(value || "Not set").replace(/_/g, " ");
const personName = (person: any) => [person?.firstName, person?.lastName].filter(Boolean).join(" ") || person?.companyName || person?.email || "Unknown";
const tone = (status: string) => status === "RESOLVED" || status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : status.includes("PENDING") || status.includes("AWAITING") ? "bg-amber-100 text-amber-900" : "bg-brand-100 text-brand-800";

function AdminFinancialDisputesContent() {
  const { user } = useAuth();
  const { can } = useAdminPermissions();
  const canInvestigate = can("finance.disputes.investigate");
  const canReview = can("finance.disputes.review");
  const canApprove = can("finance.disputes.approve");
  const [items, setItems] = useState<FinancialDispute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ACTIVE");
  const [requestTarget, setRequestTarget] = useState<"worker" | "employer">("worker");
  const [requestMessage, setRequestMessage] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [visibleToParties, setVisibleToParties] = useState(true);
  const [report, setReport] = useState({ jobDescription: "", workCompletionFindings: "", paymentFindings: "", timelineSummary: "", supportNotes: "", recommendedFacts: "" });
  const [settlementType, setSettlementType] = useState<SettlementType>("COMPLETE_PAYMENT");
  const [workerAmount, setWorkerAmount] = useState("");
  const [employerRefund, setEmployerRefund] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [confirmProposal, setConfirmProposal] = useState(false);
  const [confirmApproval, setConfirmApproval] = useState(false);

  const load = async () => {
    const disputes = await getAdminFinancialDisputes();
    setItems(disputes);
    setSelectedId((current) => current && disputes.some((item) => item.id === current) ? current : disputes[0]?.id || null);
  };
  useEffect(() => { load().catch((error: any) => toast.error(error?.message || "Failed to load financial disputes.")).finally(() => setLoading(false)); }, []);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const hasInvestigation = canInvestigate && selected?.investigationReport?.status !== "COMPLETED" && Boolean(selected && selected.investigationStatus !== "RESOLVED");
  const hasSettlement = Boolean((canReview && selected?.investigationStatus === "FOR_FINANCE_REVIEW") || selected?.financeSettlement || selected?.settlementHistory?.length);
  const hasAuditTrail = Boolean(selected?.auditLogs?.length);
  useEffect(() => { setActiveTab("Overview"); }, [selectedId]);
  const filtered = useMemo(() => items.filter((item) => filter === "ALL" || (filter === "ACTIVE" ? item.investigationStatus !== "RESOLVED" : item.investigationStatus === filter)), [items, filter]);
  const replace = (updated: FinancialDispute) => setItems((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
  const run = async (action: () => Promise<{ message: string; dispute: FinancialDispute }>) => {
    setBusy(true);
    try { const result = await action(); replace(result.dispute); toast.success(result.message); return result; }
    catch (error: any) { toast.error(error?.message || "The action failed."); return null; }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!selected) return;
    setWorkerAmount(String(selected.financeSettlement?.workerSettlementAmount ?? Math.max(0, selected.agreedJobAmount - selected.alreadyPaidAmount)));
    setEmployerRefund(String(selected.financeSettlement?.employerRefundAmount ?? 0));
    setDecisionReason(selected.financeSettlement?.decisionReason || "");
    setReport({
      jobDescription: selected.investigationReport?.jobDescription || selected.job?.description || "",
      workCompletionFindings: selected.investigationReport?.workCompletionFindings || "",
      paymentFindings: selected.investigationReport?.paymentFindings || "",
      timelineSummary: selected.investigationReport?.timelineSummary || "",
      supportNotes: selected.investigationReport?.supportNotes || "",
      recommendedFacts: selected.investigationReport?.recommendedFacts || "",
    });
  }, [selected, selectedId]);

  const propose = async () => {
    if (!selected) return;
    const result = await run(() => proposeFinancialDisputeSettlement(selected.id, {
      settlementType,
      ...(settlementType === "PARTIAL_PAYMENT" ? { workerAmount: Number(workerAmount), employerRefund: Number(employerRefund) } : {}),
      decisionReason: decisionReason.trim(),
    }));
    if (result) setConfirmProposal(false);
  };

  if (loading) return <StatusState title="Loading financial disputes…" tone="loading" />;
  return (
    <div className="ui-page space-y-6">
      <header><h1 className="ui-page-title">Financial Disputes</h1><p className="ui-page-subtitle">Support establishes facts. Finance selects one of three settlements. A second Finance user approves before any ledger movement.</p></header>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <h2 className="font-bold text-slate-950">Cases</h2>
          <div className="mt-4"><Select label="Queue" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ACTIVE">Active cases</option><option value="FOR_FINANCE_REVIEW">For Finance review</option><option value="PENDING_FINANCE_APPROVAL">Pending approval</option><option value="RESOLVED">Resolved</option><option value="ALL">All cases</option></Select></div>
          <div className="mt-4 space-y-3">{filtered.length === 0 ? <p className="text-sm text-slate-500">No disputes in this queue.</p> : filtered.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === item.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}><p className="text-sm font-bold text-slate-950">{item.ticketId}</p><p className="mt-1 truncate text-sm text-slate-600">{item.job?.title || item.subject}</p><div className="mt-2 flex flex-wrap gap-2"><Badge className={tone(item.investigationStatus)}>{label(item.investigationStatus)}</Badge><Badge className={tone(item.paymentStatus)}>{label(item.paymentStatus)}</Badge></div></button>)}</div>
        </Card>

        {selected ? <Tabs<DetailTab> label="Case details" value={activeTab} onChange={setActiveTab} tabs={[
          { id: "Overview", label: "Overview", content: (<>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-brand-700">{selected.ticketId}</p><h2 className="text-xl font-bold text-slate-950">{selected.job?.title || selected.subject}</h2><p className="mt-1 text-sm text-slate-500">Opened {selected.raisedAt ? formatDateTime(selected.raisedAt) : "Unknown"}</p></div><div className="flex flex-wrap gap-2"><Badge className={tone(selected.investigationStatus)}>Investigation: {label(selected.investigationStatus)}</Badge><Badge className={tone(selected.paymentStatus)}>Payment: {label(selected.paymentStatus)}</Badge></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">{[["Agreed",selected.agreedJobAmount],["Already paid",selected.alreadyPaidAmount],["Disputed",selected.disputedAmount],["Held by platform",selected.fundsHeldAmount],["Outstanding externally",selected.outstandingAmount]].map(([name,value]) => <div key={String(name)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{name}</p><p className="mt-1 font-bold">{formatCurrency(Number(value))}</p></div>)}</div>
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Funds classification: {label(selected.fundStatus)}</p><p className="mt-1">Only “funds held” are controlled by MicroJobs. Outstanding payment is recorded as an external employer obligation, not presented as escrow.</p></div>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><p className="font-semibold text-slate-500">Worker</p><p>{personName(selected.worker)}</p></div><div><p className="font-semibold text-slate-500">Employer</p><p>{personName(selected.employer)}</p></div></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><div><h3 className="font-bold">Worker statement</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.workerClaim}</p></div><div><h3 className="font-bold">Employer statement</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.employerResponse || "Awaiting employer response."}</p></div></div>
            </Card>
          </>) },
          { id: "Evidence", label: "Evidence", content: (<>
            <CompletionEvidence items={selected.application?.completionEvidence} />
            {canInvestigate && selected.investigationStatus !== "RESOLVED" && selected.investigationStatus !== "FOR_FINANCE_REVIEW" && selected.investigationStatus !== "PENDING_FINANCE_APPROVAL" ? <Card><div className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-brand-700"/><h3 className="font-bold">Support investigation</h3></div><p className="mt-1 text-sm text-slate-600">Support may collect and document facts, but cannot select or process the settlement.</p>
              {!selected.assignedSupportUserId ? <Button className="mt-4" disabled={busy} onClick={() => void run(() => assignFinancialDisputeSupport(selected.id))}>Assign to me and investigate</Button> : <p className="mt-4 text-sm font-semibold text-slate-700">Assigned to {personName(selected.assignedSupportUserId)}</p>}
              <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr] lg:grid-cols-1 xl:grid-cols-[180px_1fr]"><Select label="Request from" value={requestTarget} onChange={(event) => setRequestTarget(event.target.value as "worker" | "employer")}><option value="worker">Worker</option><option value="employer">Employer</option></Select><Textarea label="Evidence request" value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} /></div><Button className="mt-3 !bg-white !text-brand-700 ring-1 ring-brand-300" disabled={busy || !requestMessage.trim()} onClick={() => void run(() => requestFinancialDisputeEvidence(selected.id, requestTarget, requestMessage.trim())).then((result) => result && setRequestMessage(""))}>Request evidence</Button>
            </Card> : null}

            <Card>
              <div className="flex items-center gap-2"><FileUp className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Evidence</h3></div>
              <div className="mt-5"><div className="space-y-3">{(selected.evidence || []).length === 0 ? <p className="text-sm text-slate-500">No evidence submitted.</p> : (selected.evidence || []).map((evidence: any) => <div key={evidence._id} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold">{label(evidence.evidenceType)} · {evidence.uploaderRole}</p><p className="mt-1 text-slate-600">{evidence.description || evidence.fileName}</p>{evidence.fileUrl ? <a href={toAbsoluteAssetUrl(evidence.fileUrl) || "#"} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-brand-700 underline">Open evidence</a> : null}</div>)}</div></div>
            </Card>
          </>) },
          { id: "Conversation", label: "Conversation", content: (<>
            <Card>
              <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Ticket conversation</h3></div>
              <div className="mt-4"><div className="max-h-80 space-y-3 overflow-y-auto">{(selected.messages || []).map((item: any) => <div key={item._id} className={`rounded-xl p-3 text-sm ${item.visibleToParties === false ? "bg-violet-50" : "bg-slate-50"}`}><p className="font-semibold">{item.authorRole}{item.visibleToParties === false ? " · Internal" : ""}</p><p className="mt-1 whitespace-pre-wrap">{item.body}</p></div>)}</div></div>
              <div className="mt-5"><Textarea label="Add investigation note or participant message" value={staffMessage} onChange={(event) => setStaffMessage(event.target.value)} /></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={visibleToParties} onChange={(event) => setVisibleToParties(event.target.checked)} /> Visible to worker and employer</label><Button className="mt-3" disabled={busy || !staffMessage.trim()} onClick={() => void run(() => addFinancialDisputeMessage(selected.id, staffMessage.trim(), visibleToParties)).then((result) => result && setStaffMessage(""))}>Add message</Button>
            </Card>
          </>) },
          ...(hasInvestigation ? [{ id: "Investigation" as const, label: "Investigation", content: (<>
            {canInvestigate && selected.investigationReport?.status !== "COMPLETED" && selected.investigationStatus !== "RESOLVED" ? <Card><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Structured Investigation Report</h3></div><p className="mt-1 text-sm text-slate-600">The report forwards facts to Finance; it does not recommend a settlement outcome.</p><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{Object.entries(report).map(([key,value]) => <Textarea key={key} label={label(key.replace(/([a-z])([A-Z])/g,"$1_$2"))} value={value} onChange={(event) => setReport((current) => ({ ...current, [key]: event.target.value }))} />)}</div><Button className="mt-4" disabled={busy} onClick={() => void run(() => completeFinancialDisputeInvestigation(selected.id, report))}>Complete report and forward to Finance</Button></Card> : null}
          </>) }] : []),
          ...(hasSettlement ? [{ id: "Settlement" as const, label: "Settlement", content: (<>
            {canReview && selected.investigationStatus === "FOR_FINANCE_REVIEW" ? <Card><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-brand-700"/><h3 className="font-bold">Finance settlement decision</h3></div><div className="mt-4"><Select label="Settlement outcome" value={settlementType} onChange={(event) => setSettlementType(event.target.value as SettlementType)}><option value="FULL_REFUND">FULL REFUND</option><option value="COMPLETE_PAYMENT">COMPLETE PAYMENT</option><option value="PARTIAL_PAYMENT">PARTIAL PAYMENT</option></Select></div>
              {settlementType === "PARTIAL_PAYMENT" ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Worker amount" type="number" min="0" step="0.01" value={workerAmount} onChange={(event) => setWorkerAmount(event.target.value)} /><Input label="Employer refund" type="number" min="0" step="0.01" value={employerRefund} onChange={(event) => setEmployerRefund(event.target.value)} /></div> : null}
              {settlementType === "COMPLETE_PAYMENT" ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p>Total job payment: <strong>{formatCurrency(selected.agreedJobAmount)}</strong></p><p>Already paid: <strong>{formatCurrency(selected.alreadyPaidAmount)}</strong></p><p>Remaining payable from held funds: <strong>{formatCurrency(Math.min(selected.fundsHeldAmount, Math.max(0, selected.agreedJobAmount - selected.alreadyPaidAmount)))}</strong></p></div> : null}
              {settlementType === "FULL_REFUND" ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><p>Employer refund: <strong>{formatCurrency(selected.fundsHeldAmount)}</strong></p><p>New worker payment: <strong>{formatCurrency(0)}</strong></p><p>Previously paid amounts are not reversed.</p></div> : null}
              <div className="mt-4"><Textarea label="Mandatory decision reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></div><Button className="mt-4" disabled={busy || !decisionReason.trim()} onClick={() => setConfirmProposal(true)}>Submit settlement for approval</Button>
            </Card> : null}

            {selected.financeSettlement ? <Card><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-700"/><h3 className="font-bold">Settlement record</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4"><div><p className="text-xs text-slate-500">Decision</p><strong>{label(selected.financeSettlement.settlementType)}</strong></div><div><p className="text-xs text-slate-500">Worker</p><strong>{formatCurrency(selected.financeSettlement.workerSettlementAmount)}</strong></div><div><p className="text-xs text-slate-500">Employer</p><strong>{formatCurrency(selected.financeSettlement.employerRefundAmount)}</strong></div><div><p className="text-xs text-slate-500">Outstanding</p><strong>{formatCurrency(selected.financeSettlement.outstandingAmount)}</strong></div></div><p className="mt-4 text-sm text-slate-700">{selected.financeSettlement.decisionReason}</p>
              {canApprove && selected.investigationStatus === "PENDING_FINANCE_APPROVAL" ? <Button className="mt-4 !bg-emerald-700" disabled={busy || String(selected.financeSettlement.financeUserId?._id || selected.financeSettlement.financeUserId) === user?.id} onClick={() => setConfirmApproval(true)}>Approve and process settlement</Button> : null}
              {String(selected.financeSettlement.financeUserId?._id || selected.financeSettlement.financeUserId) === user?.id && selected.investigationStatus === "PENDING_FINANCE_APPROVAL" ? <p className="mt-3 text-sm font-semibold text-amber-800">A different authorized Finance user must approve this decision.</p> : null}
            </Card> : null}

            {(selected.settlementHistory || []).length > 0 ? <Card><h3 className="font-bold">Previous settlement decisions</h3><div className="mt-4 space-y-3">{(selected.settlementHistory || []).map((settlement: any) => <div key={settlement.settlementId} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold">{label(settlement.settlementType)} · {settlement.settlementId}</p><p className="mt-1 text-slate-600">{settlement.decisionReason}</p><p className="mt-2 text-xs text-slate-500">Worker {formatCurrency(settlement.workerSettlementAmount)} · Employer {formatCurrency(settlement.employerRefundAmount)} · Outstanding {formatCurrency(settlement.outstandingAmount)}</p></div>)}</div></Card> : null}
          </>) }] : []),
          ...(hasAuditTrail ? [{ id: "Audit trail" as const, label: "Audit trail", content: (<>
            <Card><h3 className="font-bold">Immutable case audit trail</h3><ol className="mt-4 space-y-3">{(selected.auditLogs || []).map((entry: any) => <li key={entry._id} className="border-l-2 border-brand-200 pl-3 text-sm"><p className="font-semibold text-slate-900">{label(entry.action)}</p><p className="text-slate-500">{formatDateTime(entry.timestamp)}{entry.previousStatus || entry.newStatus ? ` · ${label(entry.previousStatus)} → ${label(entry.newStatus)}` : ""}</p></li>)}</ol></Card>
          </>) }] : []),
        ]} /> : <StatusState title="Select a dispute" description="Choose a case from the queue." />}
      </div>

      <ConfirmDialog open={confirmProposal} title="Submit Finance settlement?" description="This records the Finance decision and requires approval by a different authorized finance user before funds move." confirmLabel="Submit for approval" pending={busy} onClose={() => setConfirmProposal(false)} onConfirm={propose} />
      <ConfirmDialog open={confirmApproval} title="Approve and process settlement?" description="The approved amounts will be credited from actual held funds. Completed ledger records prevent duplicate processing." confirmLabel="Approve and process" pending={busy} onClose={() => setConfirmApproval(false)} onConfirm={() => selected && void run(() => approveFinancialDisputeSettlement(selected.id)).then((result) => result && setConfirmApproval(false))} />
    </div>
  );
}

export function AdminFinancialDisputes() {
  return <AdminGate permission="finance.disputes.view"><AdminFinancialDisputesContent /></AdminGate>;
}
