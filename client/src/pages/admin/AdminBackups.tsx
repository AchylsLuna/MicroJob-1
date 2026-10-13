import { useEffect } from "react";
import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { purgeLegacyBackupStorage } from "../../utils/authSession";

/**
 * Backup & recovery — deliberately inert until the server side exists.
 *
 * This page used to implement "backups" entirely in the browser, and every part
 * of it was unsafe or untrue:
 *
 *  - It read the full output of /api/admin/users, /jobs and /transactions and
 *    wrote the lot to `localStorage` as one JSON blob: every user's email,
 *    phone and address plus every transaction, unencrypted, on the admin's
 *    disk, readable by any XSS on this origin. `clearAuthStorage()` did not
 *    remove those keys, so the dump outlived logout.
 *  - It did that again on a 60-second `setInterval`, re-serialising and
 *    SHA-256-hashing the whole dataset on the main thread, pruning by age
 *    rather than count -- so it grew until `QuotaExceededError`.
 *  - The scheduling effect depended on `history` *and* wrote `history`, while
 *    `createBackup` depended on `history` too. Once a run failed persistently
 *    (quota exhausted, or `crypto.subtle` absent on a non-secure origin -- i.e.
 *    opening this page over plain http:// on a LAN preview) that formed a tight
 *    infinite loop that hung the tab.
 *  - "Restore" validated a checksum, wrote an `admin_last_restore` marker and
 *    reported "Recovery is authorized and ready" -- having restored nothing.
 *    There is no /api/admin/backups endpoint and never was, so an operator
 *    trusting this console had no backups at all. That was the most dangerous
 *    part: not the missing feature, but the false assurance.
 *
 * It is left as an explicit "not configured" notice rather than removed, so the
 * gap is visible to whoever opens it and the route stays available for the real
 * server-side implementation to land behind.
 */

function AdminBackupsContent() {
  // Runs on mount so simply visiting the page removes an existing dump.
  useEffect(() => {
    purgeLegacyBackupStorage();
  }, []);

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="rounded-card border border-brand/20 bg-brand p-6 text-white shadow-lg shadow-brand/10">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
          <ShieldCheck className="h-4 w-4" /> Backup &amp; recovery
        </div>
        <h1 className="text-2xl font-bold">Backups are not configured</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          This platform has no application-managed backup or restore capability yet. Nothing on this
          screen creates, stores, or recovers a backup.
        </p>
      </section>

      <section className="rounded-card border border-amber-300 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="space-y-2 text-sm text-amber-900">
            <p className="font-semibold">Do not rely on this screen for disaster recovery.</p>
            <p>
              An earlier version of this page reported successful backups and a ready-to-use restore,
              but it only wrote a copy of admin data into this browser&apos;s local storage — it never
              reached the server, and its restore button applied nothing. Any history it showed you was
              not a backup. Those local copies have now been deleted from this browser.
            </p>
            <p>
              Until a server-side implementation lands, database backups are the responsibility of
              whoever hosts the database (for example managed snapshots on your MongoDB provider).
              Confirm that those are enabled and test a restore.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Database className="mt-1 h-5 w-5 text-brand" />
          <div>
            <h2 className="text-section font-semibold text-slate-900">What a real implementation needs</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
              <li>Server-side snapshot and restore endpoints, permission-gated on <code className="rounded bg-slate-100 px-1">backups.manage</code>.</li>
              <li>Snapshots written to durable object storage, encrypted at rest — never to a browser.</li>
              <li>A scheduler that runs on the server, not only while an admin tab happens to be open.</li>
              <li>A restore path that is actually exercised, so recovery is proven rather than assumed.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminBackups() {
  return (
    <AdminGate permission="backups.manage">
      <AdminBackupsContent />
    </AdminGate>
  );
}
