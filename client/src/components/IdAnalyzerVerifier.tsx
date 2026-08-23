import { useState } from "react";
import { Check, CheckCircle2, FileScan, RotateCcw, Upload, XCircle } from "lucide-react";
import { toast } from "../lib/toast";
import { getCsrfToken } from "../services/api";

type Props = {
  profileId?: string;
  onComplete?: (verified: boolean) => void;
};

type ExtractedFields = {
  firstName: string;
  lastName: string;
  documentNumber: string;
  dateOfBirth: string;
  address: string;
};

const GOVERNMENT_IDS = [
  "PhilSys National ID",
  "Philippine Passport",
  "Driver's License",
  "UMID",
  "SSS Card",
  "PRC ID",
  "PhilHealth ID",
  "TIN Card",
  "Postal ID",
];
const EMPTY_FIELDS: ExtractedFields = { firstName: "", lastName: "", documentNumber: "", dateOfBirth: "", address: "" };

export default function IdAnalyzerVerifier({ profileId, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<ExtractedFields>(EMPTY_FIELDS);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scanDocument = async () => {
    if (!file) return toast.error("Choose a photo or PDF of your ID first.");
    if (!selectedId) return toast.error("Choose a valid government ID type first.");
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", selectedId);
      formData.append("finalize", "false");
      if (profileId) formData.append("profileId", profileId);
      const csrfToken = getCsrfToken();
      const response = await fetch("/api/verify-id/verify", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "ID scan failed.");
      const source = body?.extracted || {};
      setFields({
        firstName: typeof source.firstName === "string" ? source.firstName : "",
        lastName: typeof source.lastName === "string" ? source.lastName : "",
        documentNumber: typeof source.documentNumber === "string" ? source.documentNumber : "",
        dateOfBirth: typeof source.dateOfBirth === "string" ? source.dateOfBirth : "",
        address: typeof source.address === "string" ? source.address : "",
      });
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ID scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const verifyProfile = async () => {
    setSubmitting(true);
    try {
      const csrfToken = getCsrfToken();
      const response = await fetch("/api/verify-id/confirm", {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Unable to submit verification.");

      const matches = body?.verified === true;
      setVerified(matches);
      setStep(4);
      onComplete?.(matches);
      if (matches) toast.success("Identity verified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit verification.");
    } finally {
      setSubmitting(false);
    }
  };

  const rescanDocument = async () => {
    try {
      const csrfToken = getCsrfToken();
      await fetch("/api/verify-id/discard", {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
    } catch (_error) {
      // Local reset still proceeds even if discard request fails.
    }
    setFile(null);
    setFields(EMPTY_FIELDS);
    setVerified(null);
    setStep(2);
  };

  const reset = () => {
    setStep(1);
    setSelectedId("");
    setFile(null);
    setFields(EMPTY_FIELDS);
    setVerified(null);
  };

  const steps = ["Select ID", "Scan document", "Review details", "Verify profile"];
  return (
    <section className="mt-3 overflow-hidden rounded-[14px] border border-[#D9E2EC] bg-white" aria-label="Philippine document ID verification">
      <div className="border-b border-[#E8EEF5] bg-[#F8FAFC] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C4D8D]">ID Analyzer</p><h3 className="mt-1 text-[16px] font-semibold text-[#102A43]">Verify your Philippine government ID</h3></div>
          <FileScan className="h-6 w-6 text-[#1C4D8D]" aria-hidden="true" />
        </div>
        <ol className="mt-5 grid grid-cols-4 gap-2">
          {steps.map((label, index) => { const number = index + 1; return <li key={label} className={`text-[11px] font-semibold ${number <= step ? "text-[#1C4D8D]" : "text-[#829AB1]"}`}><span className={`mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full ${number < step ? "bg-[#1C4D8D] text-white" : number === step ? "bg-[#D9EAF7] text-[#1C4D8D]" : "bg-[#E8EEF5]"}`}>{number < step ? <Check className="h-3 w-3" /> : number}</span>{label}</li>; })}
        </ol>
      </div>
      <div className="p-5">
        {step === 1 && <div><p className="text-[13px] text-[#486581]">Choose the ID you will use for verification.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{GOVERNMENT_IDS.map((id) => <button key={id} type="button" onClick={() => { setSelectedId(id); setStep(2); }} className="flex items-center justify-between rounded-[9px] border border-[#CBD5E1] px-4 py-3 text-left text-[13px] font-semibold text-[#243B53] hover:border-[#1C4D8D] hover:bg-[#F5F9FD]">{id}<span className="text-[#1C4D8D]">→</span></button>)}</div></div>}
        {step === 2 && <div><p className="text-[13px] text-[#486581]">Upload a clear image or PDF of your {selectedId}.</p><label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-[#9FB3C8] bg-[#F8FAFC] px-5 py-8 text-center hover:bg-[#F1F5F9]"><Upload className="h-7 w-7 text-[#1C4D8D]" /><span className="mt-2 text-[13px] font-semibold text-[#243B53]">{file?.name || "Choose document"}</span><span className="mt-1 text-[11px] text-[#829AB1]">JPG, PNG, or PDF up to 5 MB</span><input type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><div className="mt-4 flex gap-2"><button type="button" onClick={() => setStep(1)} className="rounded-[8px] border border-[#CBD5E1] px-4 py-2 text-[12px] font-semibold text-[#486581]">Back</button><button type="button" onClick={scanDocument} disabled={!file || scanning} className="rounded-[8px] bg-[#1C4D8D] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">{scanning ? "Scanning..." : "Scan document"}</button></div></div>}
        {step === 3 && <div><p className="text-[13px] text-[#486581]">Review the extracted content before submitting. These fields are read-only.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{([ ["firstName", "First name"], ["lastName", "Last name"], ["documentNumber", "Document number"], ["dateOfBirth", "Date of birth"], ["address", "Address"] ] as const).map(([name, label]) => <label key={name} className="text-[11px] font-semibold text-[#486581]">{label}<input value={fields[name]} readOnly className="mt-1 w-full cursor-not-allowed rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[13px] font-normal text-[#102A43] outline-none" /></label>)}</div><div className="mt-5 flex gap-2"><button type="button" onClick={rescanDocument} disabled={submitting} className="rounded-[8px] border border-[#CBD5E1] px-4 py-2 text-[12px] font-semibold text-[#486581] disabled:opacity-50">Back</button><button type="button" onClick={verifyProfile} disabled={submitting} className="rounded-[8px] bg-[#1C4D8D] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">{submitting ? "Submitting..." : "Submit details"}</button></div></div>}
        {step === 4 && <div className="text-center">{verified ? <><CheckCircle2 className="mx-auto h-12 w-12 text-[#16825D]" /><h4 className="mt-3 text-[17px] font-semibold text-[#102A43]">Identity verified</h4><p className="mt-1 text-[13px] text-[#486581]">The details on your ID match your profile.</p></> : <><XCircle className="mx-auto h-12 w-12 text-[#C05640]" /><h4 className="mt-3 text-[17px] font-semibold text-[#102A43]">We could not verify your identity</h4><p className="mt-1 text-[13px] text-[#486581]">The extracted name does not match your profile.</p><button type="button" onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-[8px] bg-[#1C4D8D] px-4 py-2 text-[12px] font-semibold text-white"><RotateCcw className="h-3.5 w-3.5" />Try again</button></>}</div>}
      </div>
    </section>
  );
}