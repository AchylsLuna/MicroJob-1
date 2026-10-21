import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileUp, MessageSquareText, Scale } from "lucide-react";
import { Badge, Button, Card, Input, Select, StatusState, Tabs, Textarea } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { toAbsoluteAssetUrl } from "../../lib/assetUrl";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import { toast } from "../../lib/toast";
import {
  addFinancialDisputeMessage,
  getFinancialDisputes,
  getUserApplications,
  openPaymentDispute,
  submitFinancialDisputeAppeal,
  submitFinancialDisputeEmployerResponse,
  uploadFinancialDisputeEvidence,
  type FinancialDispute,
} from "../../services/api";

const statusTone = (status: string) =>
  status === "RESOLVED" || status === "PAID" || status === "SETTLED"
    ? "bg-emerald-100 text-emerald-800"
    : status.includes("AWAITING") || status.includes("PENDING") || status.includes("OUTSTANDING")
      ? "bg-amber-100 text-amber-900"
      : "bg-brand-100 text-brand-800";

const label = (value?: string | null) => String(value || "Not set").replace(/_/g, " ");
const personName = (person: any) => [person?.firstName, person?.lastName].filter(Boolean).join(" ") || person?.companyName || person?.email || "Unknown";
type DetailTab = "Overview" | "Evidence" | "Conversation" | "Settlement";

export function FinancialDisputes() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEmployer = user?.accountType === "employer";
  const [disputes, setDisputes] = useState<FinancialDispute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [claim, setClaim] = useState("");
  const [disputedAmount, setDisputedAmount] = useState("");
  const [response, setResponse] = useState("");
  const [message, setMessage] = useState("");
  const [evidenceType, setEvidenceType] = useState("OTHER");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");

  useEffect(() => {
    const id = searchParams.get('disputeId');
    if (!id || !disputes.some((item) => item.id === id)) return;
    setSelectedId(id); setActiveTab('Overview');
    const next = new URLSearchParams(searchParams); next.delete('disputeId');
    setSearchParams(next, { replace: true });
  }, [disputes, searchParams, setSearchParams]);

  const load = async () => {
    const payload = await getFinancialDisputes();
    setDisputes(payload.disputes || []);
    setSelectedId((current) => current && payload.disputes.some((item) => item.id === current) ? current : payload.disputes[0]?.id || null);
  };

  useEffect(() => {
    Promise.all([
      load(),
      isEmployer ? Promise.resolve([]) : getUserApplications().then((items) => {
        const eligible = items.filter((item) => item.status === "Hired" && item.workStatus === "Submitted" && !["Paid", "Disputed", "Refunded"].includes(item.paymentStatus));
        setApplications(eligible);
        if (eligible[0]) {
          setApplicationId(String(eligible[0]._id));
          setDisputedAmount(String(eligible[0].agreedAmount || eligible[0].job?.salary || ""));
        }
      }),
    ]).catch((error: any) => toast.error(error?.message || "Failed to load financial disputes."))
      .finally(() => setLoading(false));
  }, [isEmployer]);

  const selected = useMemo(() => disputes.find((item) => item.id === selectedId) || null, [disputes, selectedId]);
  const canAppeal = selected?.investigationStatus === "RESOLVED" && !selected.appealSubmittedAt;
  const hasSettlement = Boolean(selected?.financeSettlement || selected?.settlementHistory?.length || canAppeal);
  useEffect(() => { setActiveTab("Overview"); }, [selectedId]);

  const replaceSelected = (updated: FinancialDispute) => {
    setDisputes((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const submitDispute = async () => {
    const amount = Number(disputedAmount);
    if (!applicationId || !claim.trim() || !Number.isFinite(amount) || amount <= 0) return toast.error("Select a job, describe the problem, and enter the unpaid amount.");
    setBusy(true);
    try {
      const result = await openPaymentDispute(applicationId, claim.trim(), amount);
      toast.success(result.message);
      setClaim("");
      await load();
    } catch (error: any) { toast.error(error?.message || "Failed to submit the dispute."); }
    finally { setBusy(false); }
  };

  const submitResponse = async () => {
    if (!selected || !response.trim()) return;
    setBusy(true);
    try {
      const result = await submitFinancialDisputeEmployerResponse(selected.id, response.trim());
      replaceSelected(result.dispute); setResponse(""); toast.success(result.message);
    } catch (error: any) { toast.error(error?.message || "Failed to submit the response."); }
    finally { setBusy(false); }
  };

  const sendMessage = async () => {
    if (!selected || !message.trim()) return;
    setBusy(true);
    try {
      const result = await addFinancialDisputeMessage(selected.id, message.trim());
      replaceSelected(result.dispute); setMessage(""); toast.success(result.message);
    } catch (error: any) { toast.error(error?.message || "Failed to send the response."); }
    finally { setBusy(false); }
  };

  const uploadEvidence = async () => {
    if (!selected || (!evidenceFile && !evidenceDescription.trim())) return toast.error("Choose a file or describe the evidence reference.");
    setBusy(true);
    try {
      const result = await uploadFinancialDisputeEvidence(selected.id, { file: evidenceFile, evidenceType, description: evidenceDescription.trim() });
      replaceSelected(result.dispute); setEvidenceFile(null); setEvidenceDescription(""); toast.success(result.message);
    } catch (error: any) { toast.error(error?.message || "Failed to upload evidence."); }
    finally { setBusy(false); }
  };

  const submitAppeal = async () => {
    if (!selected || !appealReason.trim()) return;
    setBusy(true);
    try {
      const result = await submitFinancialDisputeAppeal(selected.id, appealReason.trim());
      replaceSelected(result.dispute); setAppealReason(""); toast.success(result.message);
    } catch (error: any) { toast.error(error?.message || "Failed to submit appeal."); }
    finally { setBusy(false); }
  };

  if (loading) return <StatusState title="Loading financial disputes…" tone="loading" />;

  return (
    <div className="ui-page space-y-6">
      <header>
        <h1 className="ui-page-title">Financial Disputes</h1>
        <p className="ui-page-subtitle">Neutral Support investigation and independent Finance settlement for incorrect or missing job payments.</p>
      </header>

      {!isEmployer ? (
        <Card>
          <h2 className="text-lg font-bold text-slate-950">Submit a financial dispute</h2>
          <p className="mt-1 text-sm text-slate-600">Submitting creates a linked Support ticket. It does not automatically release or refund money.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Select label="Affected job" value={applicationId} onChange={(event) => {
              setApplicationId(event.target.value);
              const item = applications.find((candidate) => String(candidate._id) === event.target.value);
              setDisputedAmount(String(item?.agreedAmount || item?.job?.salary || ""));
            }}>
              <option value="">Select submitted work</option>
              {applications.map((item) => <option key={item._id} value={item._id}>{item.job?.title || "Job"} — {formatCurrency(item.agreedAmount || item.job?.salary || 0)}</option>)}
            </Select>
            <Input label="Amount believed unpaid" type="number" min="0.01" step="0.01" value={disputedAmount} onChange={(event) => setDisputedAmount(event.target.value)} />
          </div>
          <div className="mt-4"><Textarea label="What happened?" maxLength={4000} value={claim} onChange={(event) => setClaim(event.target.value)} /></div>
          <Button className="mt-4" disabled={busy || applications.length === 0} onClick={submitDispute}>Create dispute and Support ticket</Button>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <h2 className="font-bold text-slate-950">Cases</h2>
          <div className="mt-4 space-y-3">
            {disputes.length === 0 ? <p className="text-sm text-slate-500">No financial disputes yet.</p> : disputes.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === item.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}>
                <p className="text-sm font-bold text-slate-950">{item.ticketId}</p>
                <p className="mt-1 truncate text-sm text-slate-600">{item.job?.title || item.subject}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Badge className={statusTone(item.investigationStatus)}>{item.displayStatus || label(item.investigationStatus)}</Badge><Badge className={statusTone(item.paymentStatus)}>{label(item.paymentStatus)}</Badge></div>
              </button>
            ))}
          </div>
        </Card>

        {selected ? (
          <Tabs<DetailTab> label="Case details" value={activeTab} onChange={setActiveTab} tabs={[
            { id: "Overview", label: "Overview", content: (<>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold text-brand-700">{selected.ticketId}</p><h2 className="text-xl font-bold text-slate-950">{selected.job?.title || selected.subject}</h2></div>
                  <div className="flex flex-wrap gap-2"><Badge className={statusTone(selected.investigationStatus)}>Investigation: {selected.displayStatus || label(selected.investigationStatus)}</Badge><Badge className={statusTone(selected.paymentStatus)}>Payment: {label(selected.paymentStatus)}</Badge></div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {[
                    ["Agreed", selected.agreedJobAmount], ["Already paid", selected.alreadyPaidAmount], ["Disputed", selected.disputedAmount], ["Actually held", selected.fundsHeldAmount], ["Outstanding", selected.outstandingAmount],
                  ].map(([name, value]) => <div key={String(name)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{name}</p><p className="mt-1 font-bold text-slate-950">{formatCurrency(Number(value))}</p></div>)}
                </div>
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Funds classification: {label(selected.fundStatus)}</p><p className="mt-1">Only “funds held” are controlled by MicroJobs. Outstanding payment is recorded as an external employer obligation, not presented as escrow.</p></div>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">Worker</dt><dd>{personName(selected.worker)}</dd></div><div><dt className="font-semibold text-slate-500">Employer</dt><dd>{personName(selected.employer)}</dd></div></dl>
                <div className="mt-5"><h3 className="font-bold text-slate-900">Worker claim</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.workerClaim}</p></div>
                {selected.employerResponse ? <div className="mt-5"><h3 className="font-bold text-slate-900">Employer response</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.employerResponse}</p></div> : null}
              </Card>

              {isEmployer && !selected.employerResponse && selected.investigationStatus !== "RESOLVED" ? <Card><h3 className="font-bold text-slate-950">Respond to the investigation</h3><div className="mt-4"><Textarea label="Employer explanation" value={response} onChange={(event) => setResponse(event.target.value)} /></div><Button className="mt-4" disabled={busy} onClick={submitResponse}>Submit response</Button></Card> : null}
            </>) },
            { id: "Evidence", label: "Evidence", content: (<>
              <Card>
                <div className="flex items-center gap-2"><FileUp className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Evidence</h3></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Select label="Evidence type" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>{["OTHER","PAYMENT_RECEIPT","SCREENSHOT","WORK_PHOTO","DOCUMENT","ATTENDANCE_RECORD","JOB_LOG","CHAT_REFERENCE"].map((type) => <option key={type} value={type}>{label(type)}</option>)}</Select><Input label="File (optional for chat reference)" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /></div>
                <div className="mt-4"><Textarea label="Evidence description" value={evidenceDescription} onChange={(event) => setEvidenceDescription(event.target.value)} /></div><Button className="mt-4" disabled={busy || selected.investigationStatus === "RESOLVED"} onClick={uploadEvidence}>Add evidence</Button>
                <div className="mt-5 space-y-3">{(selected.evidence || []).map((item: any) => <div key={item._id} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-900">{label(item.evidenceType)} · {item.uploaderRole}</p><p className="mt-1 text-slate-600">{item.description || item.fileName || "Evidence"}</p>{item.fileUrl ? <a className="mt-2 inline-block font-semibold text-brand-700 underline" href={toAbsoluteAssetUrl(item.fileUrl) || "#"} target="_blank" rel="noreferrer">Open evidence file</a> : null}</div>)}</div>
              </Card>
            </>) },
            { id: "Conversation", label: "Conversation", content: (<>
              <Card>
                <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Ticket conversation</h3></div>
                <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{(selected.messages || []).map((item: any) => <div key={item._id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">{item.authorRole} · {formatDateTime(item.createdAt)}</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{item.body}</p></div>)}</div>
                <div className="mt-4"><Textarea label="Response" value={message} onChange={(event) => setMessage(event.target.value)} /></div><Button className="mt-4" disabled={busy} onClick={sendMessage}>Send response</Button>
              </Card>
            </>) },
            ...(hasSettlement ? [{ id: "Settlement" as const, label: "Settlement", content: (<>
              {selected.financeSettlement ? <Card><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-brand-700"/><h3 className="font-bold text-slate-950">Finance settlement</h3></div><p className="mt-3 text-lg font-bold text-slate-950">{label(selected.financeSettlement.settlementType)}</p><p className="mt-1 text-sm text-slate-700">{selected.financeSettlement.decisionReason}</p><div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"><div>Worker: <strong>{formatCurrency(selected.financeSettlement.workerSettlementAmount)}</strong></div><div>Employer: <strong>{formatCurrency(selected.financeSettlement.employerRefundAmount)}</strong></div><div>Outstanding: <strong>{formatCurrency(selected.financeSettlement.outstandingAmount)}</strong></div></div></Card> : null}

              {(selected.settlementHistory || []).length > 0 ? <Card><h3 className="font-bold text-slate-950">Previous Finance decisions</h3><div className="mt-4 space-y-3">{(selected.settlementHistory || []).map((settlement: any) => <div key={settlement.settlementId} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-950">{label(settlement.settlementType)} · {settlement.settlementId}</p><p className="mt-1 text-slate-700">{settlement.decisionReason}</p><p className="mt-2 text-xs text-slate-500">Worker {formatCurrency(settlement.workerSettlementAmount)} · Employer {formatCurrency(settlement.employerRefundAmount)} · Outstanding {formatCurrency(settlement.outstandingAmount)}</p></div>)}</div></Card> : null}

              {canAppeal ? <Card><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700"/><h3 className="font-bold text-slate-950">Appeal decision</h3></div><div className="mt-4"><Textarea label="Why should this decision be reviewed?" value={appealReason} onChange={(event) => setAppealReason(event.target.value)} /></div><Button className="mt-4 !bg-amber-700" disabled={busy} onClick={submitAppeal}>Submit appeal</Button></Card> : null}
            </>) }] : []),
          ]} />
        ) : <StatusState title="Select a case" description="Choose a financial dispute to view its investigation and payment status." />}
      </div>
    </div>
  );
}

export default FinancialDisputes;
