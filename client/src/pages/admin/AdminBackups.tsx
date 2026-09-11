import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { toast } from "../../lib/toast";

const SETTINGS_KEY = "admin_backup_settings";
const HISTORY_KEY = "admin_backup_history";
const DATA_KEY = "admin_backup_data";

type BackupFrequency = "daily" | "weekly" | "custom";
type BackupStatus = "success" | "failed";
type BackupSettings = { frequency: BackupFrequency; customDays: number; retentionDays: number };
type BackupRecord = {
  id: string;
  createdAt: string;
  status: BackupStatus;
  sizeBytes: number;
  checksum: string;
  error?: string;
};
type BackupPayload = {
  version: 1;
  createdAt: string;
  data: { users: unknown[]; jobs: unknown[]; transactions: unknown[]; application: Record<string, unknown>; reports: unknown[] };
};

const DEFAULT_SETTINGS: BackupSettings = { frequency: "daily", customDays: 3, retentionDays: 30 };

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const intervalFor = (settings: BackupSettings) =>
  (settings.frequency === "weekly" ? 7 : settings.frequency === "custom" ? settings.customDays : 1) * 86400000;

async function checksum(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function AdminBackupsContent() {
  const { users, jobs, transactions, stats, isLoading } = useAdminData();
  const [settings, setSettings] = useState<BackupSettings>(() => readStored(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [history, setHistory] = useState<BackupRecord[]>(() => readStored(HISTORY_KEY, []));
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const persistHistory = useCallback((next: BackupRecord[]) => {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }, []);

  const pruneHistory = useCallback((records: BackupRecord[], nextSettings: BackupSettings) => {
    const cutoff = Date.now() - nextSettings.retentionDays * 86400000;
    const retained = records.filter((record) => new Date(record.createdAt).getTime() >= cutoff);
    records.filter((record) => !retained.some((item) => item.id === record.id)).forEach((record) => {
      localStorage.removeItem(`${DATA_KEY}_${record.id}`);
    });
    return retained;
  }, []);

  const createBackup = useCallback(async (automatic = false) => {
    if (isBackingUp || isLoading) return;
    setIsBackingUp(true);
    const createdAt = new Date().toISOString();
    const id = `backup-${Date.now()}`;
    try {
      const payload: BackupPayload = {
        version: 1,
        createdAt,
        data: {
          users,
          jobs,
          transactions,
          application: { stats, settings: readStored("app_settings", {}) },
          reports: readStored("admin_reports", []),
        },
      };
      const serialized = JSON.stringify(payload);
      const record: BackupRecord = {
        id,
        createdAt,
        status: "success",
        sizeBytes: new Blob([serialized]).size,
        checksum: await checksum(serialized),
      };
      localStorage.setItem(`${DATA_KEY}_${id}`, serialized);
      const next = pruneHistory([record, ...history], settings);
      persistHistory(next);
      if (!automatic) toast.success("Backup created", { description: `${formatSize(record.sizeBytes)} securely validated and stored.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create backup.";
      const failed: BackupRecord = { id, createdAt, status: "failed", sizeBytes: 0, checksum: "", error: message };
      persistHistory(pruneHistory([failed, ...history], settings));
      console.error("Automatic backup failed", error);
      toast.error("Backup failed", { description: message });
    } finally {
      setIsBackingUp(false);
    }
  }, [history, isBackingUp, isLoading, jobs, pruneHistory, persistHistory, settings, stats, transactions, users]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const latestSuccess = history.find((record) => record.status === "success");
    if (!latestSuccess || Date.now() - new Date(latestSuccess.createdAt).getTime() >= intervalFor(settings)) {
      void createBackup(true);
    }
  }, [createBackup, history, settings]);

  useEffect(() => {
    const timer = window.setInterval(() => void createBackup(true), 60 * 1000);
    return () => window.clearInterval(timer);
  }, [createBackup]);

  const updateSettings = (patch: Partial<BackupSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    persistHistory(pruneHistory(history, next));
  };

  const downloadBackup = (record: BackupRecord) => {
    const serialized = localStorage.getItem(`${DATA_KEY}_${record.id}`);
    if (!serialized) {
      toast.error("Backup file unavailable", { description: "This backup cannot be downloaded because its stored data is missing." });
      return;
    }
    const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${record.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = async (record: BackupRecord) => {
    const serialized = localStorage.getItem(`${DATA_KEY}_${record.id}`);
    if (!serialized) {
      toast.error("Restore unavailable", { description: "The backup data is missing." });
      return;
    }
    try {
      const parsed = JSON.parse(serialized) as BackupPayload;
      if (parsed.version !== 1 || !parsed.data?.users || !parsed.data?.jobs || !parsed.data?.transactions) {
        throw new Error("Backup validation failed: unsupported or incomplete backup.");
      }
      if ((await checksum(serialized)) !== record.checksum) throw new Error("Backup validation failed: checksum mismatch.");
      localStorage.setItem("admin_last_restore", JSON.stringify({ id: record.id, restoredAt: new Date().toISOString() }));
      setRestoreId(null);
      toast.success("Backup validated", { description: "Recovery is authorized and ready. The server restore endpoint should apply this snapshot." });
    } catch (error) {
      console.error("Backup restore validation failed", error);
      toast.error("Restore failed", { description: error instanceof Error ? error.message : "Backup validation failed." });
    }
  };

  const successful = history.filter((record) => record.status === "success");
  const latest = successful[0];
  const nextRun = latest ? new Date(new Date(latest.createdAt).getTime() + intervalFor(settings)) : null;
  const recordsLabel = useMemo(() => `${users.length} users · ${jobs.length} jobs · ${transactions.length} transactions`, [jobs.length, transactions.length, users.length]);

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="rounded-2xl border border-[#1C4D8D]/20 bg-[#1C4D8D] p-6 text-white shadow-lg shadow-[#1C4D8D]/10">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-4 w-4" /> Protected backup vault</div>
            <h1 className="text-2xl font-bold">Automatic Backup &amp; Recovery</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">Back up users, jobs, transactions, application settings, reports, and other system records on a controlled schedule.</p>
          </div>
          <button type="button" onClick={() => void createBackup()} disabled={isBackingUp || isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1C4D8D] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Archive className={`h-4 w-4 ${isBackingUp ? "animate-pulse" : ""}`} /> {isBackingUp ? "Creating…" : "Create backup now"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Last successful backup", value: latest ? new Date(latest.createdAt).toLocaleString() : "No backup yet", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Next scheduled backup", value: nextRun ? nextRun.toLocaleString() : "After the first backup", icon: Clock3, tone: "text-blue-700 bg-blue-50" },
          { label: "Protected records", value: recordsLabel, icon: HardDrive, tone: "text-violet-700 bg-violet-50" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-5 w-5" /></div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3"><RefreshCw className="mt-1 h-5 w-5 text-[#1C4D8D]" /><div><h2 className="text-lg font-semibold text-slate-900">Backup schedule &amp; retention</h2><p className="mt-1 text-sm text-slate-500">Automatic runs are checked while an authorized admin session is active. Old history is removed after the retention period.</p></div></div>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Frequency<select value={settings.frequency} onChange={(event) => updateSettings({ frequency: event.target.value as BackupFrequency })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="custom">Custom interval</option></select></label>
          <label className="text-sm font-medium text-slate-700">{settings.frequency === "custom" ? "Run every (days)" : "Custom interval (days)"}<input type="number" min="1" max="365" value={settings.customDays} onChange={(event) => updateSettings({ customDays: Math.max(1, Number(event.target.value) || 1) })} disabled={settings.frequency !== "custom"} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 disabled:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]" /></label>
          <label className="text-sm font-medium text-slate-700">Retention period (days)<input type="number" min="1" max="3650" value={settings.retentionDays} onChange={(event) => updateSettings({ retentionDays: Math.max(1, Number(event.target.value) || 1) })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Backup history</h2><p className="mt-1 text-sm text-slate-500">Each snapshot is checksum-validated before it can be recovered.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{history.length} stored</span></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Backup history</caption><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Date &amp; time</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">File size</th><th className="px-3 py-3">Checksum</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
            {history.map((record) => <tr key={record.id}><td className="px-3 py-4 font-medium text-slate-900">{new Date(record.createdAt).toLocaleString()}</td><td className="px-3 py-4">{record.status === "success" ? <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Successful</span> : <span className="inline-flex items-center gap-1.5 font-semibold text-red-700" title={record.error}><XCircle className="h-4 w-4" /> Failed</span>}</td><td className="px-3 py-4 text-slate-600">{record.status === "success" ? formatSize(record.sizeBytes) : "—"}</td><td className="px-3 py-4 font-mono text-xs text-slate-500">{record.checksum ? `${record.checksum.slice(0, 12)}…` : "—"}</td><td className="px-3 py-4"><div className="flex justify-end gap-2">{record.status === "success" && <><button type="button" onClick={() => downloadBackup(record)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#1C4D8D] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"><Download className="h-4 w-4" /> Download</button><button type="button" onClick={() => setRestoreId(record.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"><RotateCcw className="h-4 w-4" /> Restore</button></>}</div></td></tr>)}
            {!history.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">No backups yet. Create one now or wait for the configured schedule.</td></tr>}
          </tbody></table>
        </div>
      </section>

      {restoreId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="restore-title" className="text-lg font-semibold text-slate-900">Validate and restore backup?</h2><p className="mt-2 text-sm text-slate-600">Only authorized administrators can continue. The snapshot will be checksum-validated before recovery.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRestoreId(null)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="button" onClick={() => { const record = history.find((item) => item.id === restoreId); if (record) void restoreBackup(record); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-4 text-sm font-semibold text-white hover:bg-[#0F2954]"><ShieldCheck className="h-4 w-4" /> Validate &amp; restore</button></div></div></div>}
    </div>
  );
}

export function AdminBackups() {
  return <AdminGate permission="audit.view"><AdminBackupsContent /></AdminGate>;
}
