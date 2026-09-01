import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminJob } from "../../hooks/useAdminData";

/**
 * Category leaderboard, switchable between the four measures the API carries.
 * "Viewed" counts unique viewers, not page loads — see server/lib/jobViews.js,
 * which dedupes by user id (or a hashed IP + day for anonymous visitors) and
 * ignores a poster viewing their own listing.
 */
type MetricId = "hunting" | "hired" | "viewed" | "posted";

const TICKS = 34;

/** Same validated categorical slots the charts use — assigned in fixed order. */
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a"];
const NEUTRAL = "#94a3b8";

type Row = { label: string; value: number; color: string };

export function TopJobCategories({ jobs }: { jobs: AdminJob[] }) {
  const { t } = useTranslation("admin");
  const [metric, setMetric] = useState<MetricId>("hunting");

  const metrics = useMemo<{ id: MetricId; label: string; measure: (job: AdminJob) => number }[]>(() => [
    { id: "hunting", label: t("analytics.topCategories.metrics.hunting"), measure: (job) => job.applicantsCount ?? job.applicants?.length ?? 0 },
    { id: "hired", label: t("analytics.topCategories.metrics.hired"), measure: (job) => job.hiredCount ?? 0 },
    { id: "viewed", label: t("analytics.topCategories.metrics.viewed"), measure: (job) => job.viewCount ?? 0 },
    { id: "posted", label: t("analytics.topCategories.metrics.posted"), measure: () => 1 },
  ], [t]);

  const { rows, total } = useMemo(() => {
    const active = metrics.find((item) => item.id === metric)!;
    const totals = new Map<string, number>();
    jobs.forEach((job) => {
      const name = typeof job.category === "string" ? null : job.category?.name;
      if (!name) return;
      totals.set(name, (totals.get(name) || 0) + active.measure(job));
    });

    const sorted = [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const sum = sorted.reduce((acc, item) => acc + item.value, 0);
    const top = sorted.slice(0, 3).map((item, index) => ({ ...item, color: PALETTE[index] }));
    const restValue = sum - top.reduce((acc, item) => acc + item.value, 0);
    const result: Row[] = restValue > 0
      ? [...top, { label: t("analytics.overview.othersCategory"), value: restValue, color: NEUTRAL }]
      : top;
    return { rows: result, total: sum };
  }, [jobs, metric, metrics, t]);

  const share = (value: number) => (total ? (value / total) * 100 : 0);

  // Ticks are handed out largest-remainder style so the strip always totals
  // exactly TICKS and a small category never silently rounds away to nothing.
  const tickColors = useMemo(() => {
    if (!total) return [];
    const exact = rows.map((row) => (row.value / total) * TICKS);
    const counts = exact.map((value) => Math.floor(value));
    let remaining = TICKS - counts.reduce((acc, value) => acc + value, 0);
    const order = exact
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < order.length && remaining > 0; i += 1, remaining -= 1) counts[order[i].index] += 1;
    return rows.flatMap((row, index) => Array.from({ length: counts[index] }, () => row.color));
  }, [rows, total]);

  return (
    <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-6 transition hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[18px] font-semibold text-[#111827]">{t("analytics.topCategories.title")}</h3>
        <div className="flex gap-1 rounded-[10px] bg-slate-100 p-1" role="tablist" aria-label={t("analytics.topCategories.title")}>
          {metrics.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={metric === item.id}
              onClick={() => setMetric(item.id)}
              className={`min-h-8 rounded-[8px] px-3 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${
                metric === item.id ? "bg-white text-[#111827] shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 flex h-[180px] items-center justify-center rounded-[12px] border border-dashed border-slate-200 text-[13px] text-slate-500">
          {t("analytics.overview.noData")}
        </div>
      ) : (
        <>
          <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {rows.slice(0, 3).map((row) => (
              <li key={row.label}>
                <span className="flex items-center gap-2 text-[13px] text-[#64748B]">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: row.color }} />
                  <span className="truncate">{row.label}</span>
                </span>
                <p className="mt-1 text-[24px] font-bold tabular-nums text-[#111827]">{share(row.value).toFixed(2)}%</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex h-[64px] items-end gap-[3px]" aria-hidden="true">
            {tickColors.map((color, index) => (
              <span key={index} className="h-full flex-1 rounded-full" style={{ backgroundColor: color }} />
            ))}
          </div>

          <table className="mt-6 w-full text-left">
            <caption className="sr-only">{t("analytics.topCategories.title")}</caption>
            <thead>
              <tr className="text-[13px] text-[#94A3B8]">
                <th scope="col" className="pb-3 font-normal">{t("analytics.topCategories.columnCategory")}</th>
                <th scope="col" className="pb-3 text-right font-normal">{t("analytics.topCategories.columnPercent")}</th>
                <th scope="col" className="pb-3 text-right font-normal">{t("analytics.topCategories.columnTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: row.color }} />
                      <span className="truncate text-[14px] font-medium text-[#111827]">{row.label}</span>
                    </span>
                  </td>
                  <td className="py-3 text-right text-[14px] tabular-nums text-[#475569]">{Math.round(share(row.value))}%</td>
                  <td className="py-3 text-right text-[14px] font-semibold tabular-nums text-[#111827]">
                    {row.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
