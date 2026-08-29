import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { StatusState } from "../../components/ui";
import { formatDateTime } from "../../lib/formatters";
import { AUDIT_LOG_FIXTURES, type AuditLogEntry } from "../../lib/adminFixtures";

const categoryStyle: Record<AuditLogEntry["category"], string> = {
  system: "bg-blue-100 text-blue-900",
  error: "bg-red-100 text-red-900",
};

/** Read-only — nothing on this page writes. Fixture-backed, see `lib/adminFixtures.ts`. */
function AdminAuditLogsContent() {
  const { t } = useTranslation("admin");
  const prefersReducedMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditLogEntry["category"]>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return AUDIT_LOG_FIXTURES.filter((entry) => {
      const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
      const matchesSearch =
        !query ||
        entry.actor.toLowerCase().includes(query) ||
        entry.action.toLowerCase().includes(query) ||
        entry.target.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    }).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [search, categoryFilter]);

  const counts = useMemo(
    () => ({
      total: AUDIT_LOG_FIXTURES.length,
      errors: AUDIT_LOG_FIXTURES.filter((entry) => entry.category === "error").length,
    }),
    [],
  );

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">{t("auditLogs.cards.total")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{counts.total}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-800">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">{t("auditLogs.cards.errors")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{counts.errors}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{t("auditLogs.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("auditLogs.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              {t("auditLogs.filters.categoryLabel")}
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
                className="mt-1 block min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">{t("auditLogs.filters.allCategories")}</option>
                <option value="system">{t("auditLogs.filters.system")}</option>
                <option value="error">{t("auditLogs.filters.error")}</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              {t("auditLogs.filters.searchLabel")}
              <span className="relative mt-1 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("auditLogs.filters.searchPlaceholder")}
                  className="min-h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 font-normal outline-none focus:ring-2 focus:ring-blue-600 sm:w-64"
                />
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <StatusState
              title={t("auditLogs.states.emptyTitle")}
              description={t("auditLogs.states.emptyDescription")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">{t("auditLogs.table.caption")}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="px-3 py-3">{t("auditLogs.table.timestamp")}</th>
                    <th scope="col" className="px-3 py-3">{t("auditLogs.table.actor")}</th>
                    <th scope="col" className="px-3 py-3">{t("auditLogs.table.action")}</th>
                    <th scope="col" className="px-3 py-3">{t("auditLogs.table.target")}</th>
                    <th scope="col" className="px-3 py-3">{t("auditLogs.table.category")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, index) => (
                    <motion.tr
                      key={entry.id}
                      className="border-b border-slate-100 align-top"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                    >
                      <td className="px-3 py-4 text-slate-600">{formatDateTime(entry.at)}</td>
                      <td className="px-3 py-4 font-semibold text-slate-950">{entry.actor}</td>
                      <td className="px-3 py-4">
                        <p className="font-mono text-xs text-slate-800">{entry.action}</p>
                        {entry.reason ? <p className="mt-1 text-xs text-slate-500">{entry.reason}</p> : null}
                      </td>
                      <td className="px-3 py-4 text-slate-600">{entry.target}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${categoryStyle[entry.category]}`}>
                          {t(`auditLogs.filters.${entry.category}`)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function AdminAuditLogs() {
  return (
    <AdminGate permission="audit.view">
      <AdminAuditLogsContent />
    </AdminGate>
  );
}
