import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Briefcase, DollarSign, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AdminJob, AdminUser } from "../../hooks/useAdminData";
import type { PaymentTransaction } from "../../services/api";
import { formatDate } from "../../lib/formatters";
import { TopJobCategories } from "./TopJobCategories";

const CHART_MONTHS = 6;

/**
 * Categorical series colors. Validated as a set with the dataviz palette
 * checker (lightness band, chroma floor, CVD separation, normal-vision floor,
 * contrast) against a light surface — do not swap one out in isolation, and
 * assign in fixed order rather than cycling.
 */
const SERIES = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
};
const GRID = "#E2E8F0";
const AXIS_TEXT = "#64748B";

/** Plot geometry shared by both line charts so their axes line up. */
const PLOT = { width: 400, height: 200, top: 12, right: 12, bottom: 28, left: 52 };
const INNER_W = PLOT.width - PLOT.left - PLOT.right;
const INNER_H = PLOT.height - PLOT.top - PLOT.bottom;

/**
 * Rounded "nice" ticks that never repeat after formatting. The previous axis
 * divided the max into four equal parts and rounded each, so a max of 1 rendered
 * as [1, 1, 0, 0] — two duplicate pairs. Forcing an integer step ≥ 1 makes every
 * tick distinct for the counts and peso amounts these charts show.
 */
function niceTicks(maxValue: number, desired = 4): number[] {
  const safeMax = Math.max(maxValue, 1);
  const rawStep = safeMax / (desired - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, Math.round(niceStep * magnitude));
  const top = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];
  for (let value = top; value >= 0; value -= step) ticks.push(value);
  return ticks;
}

type AnalyticsOverviewProps = {
  isLoading: boolean;
  jobs: AdminJob[];
  users: AdminUser[];
  transactions: PaymentTransaction[];
  totalUsers: number;
  formatCurrency: (value: number) => string;
};

export function AnalyticsOverview({
  isLoading,
  jobs,
  users,
  transactions,
  totalUsers,
  formatCurrency,
}: AnalyticsOverviewProps) {
  const { t } = useTranslation("admin");
  const prefersReducedMotion = useReducedMotion();

  const monthBuckets = useMemo(() => {
    const now = new Date();
    return Array.from({ length: CHART_MONTHS }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: formatDate(date, { month: "short" }),
        month: date.getMonth(),
        year: date.getFullYear(),
      };
    });
  }, []);

  const getDateFromId = (id?: string) => {
    if (!id || id.length < 8) return null;
    return new Date(parseInt(id.slice(0, 8), 16) * 1000);
  };

  const jobDates = jobs.map((job) => (job.createdAt ? new Date(job.createdAt) : getDateFromId(job._id)));
  const userDates = users.map((user) => getDateFromId(user._id));

  const inBucket = (date: Date | null, bucket: { month: number; year: number }) =>
    Boolean(date) && date!.getMonth() === bucket.month && date!.getFullYear() === bucket.year;

  const monthlyJobs = monthBuckets.map((bucket) => jobDates.filter((date) => inBucket(date, bucket)).length);
  const monthlyUsers = monthBuckets.map((bucket) => userDates.filter((date) => inBucket(date, bucket)).length);

  const monthlyPayoutVolume = monthBuckets.map((bucket) =>
    transactions.reduce((sum, transaction) => {
      if (transaction.type !== "PAYOUT" || transaction.status !== "COMPLETED") return sum;
      const date = transaction.createdAt ? new Date(transaction.createdAt) : null;
      return inBucket(date, bucket) ? sum + Number(transaction.amount || 0) : sum;
    }, 0),
  );

  const totalPayoutVolume = monthlyPayoutVolume.reduce((sum, value) => sum + value, 0);
  const activeJobs = jobs.filter((job) => job.status === "Available" || job.status === "In Progress").length;

  const applicantIds = new Set<string>();
  jobs.forEach((job) => job.applicants?.forEach((id) => applicantIds.add(id)));
  const conversionRate = users.length ? (applicantIds.size / users.length) * 100 : 0;

  /** `null` when there is no prior month to divide by — shown as a dash rather
   * than a fabricated "+0.0%", which read as real data on a brand-new platform. */
  const percentChange = (current: number, previous: number): number | null => {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  };

  const last = monthBuckets.length - 1;
  const cardItems = [
    {
      label: t("analytics.overview.cards.payoutVolume"),
      value: isLoading ? "—" : formatCurrency(totalPayoutVolume),
      change: percentChange(monthlyPayoutVolume[last] || 0, monthlyPayoutVolume[last - 1] || 0),
      icon: <DollarSign className="h-6 w-6 text-[#1C4D8D]" />,
    },
    {
      label: t("analytics.overview.cards.activeJobs"),
      value: isLoading ? "—" : activeJobs,
      change: percentChange(monthlyJobs[last] || 0, monthlyJobs[last - 1] || 0),
      icon: <Briefcase className="h-6 w-6 text-[#1C4D8D]" />,
    },
    {
      label: t("analytics.overview.cards.totalUsers"),
      value: isLoading ? "—" : totalUsers,
      change: percentChange(monthlyUsers[last] || 0, monthlyUsers[last - 1] || 0),
      icon: <Users className="h-6 w-6 text-[#1C4D8D]" />,
    },
    {
      label: t("analytics.overview.cards.conversionRate"),
      value: isLoading ? "—" : `${conversionRate.toFixed(1)}%`,
      change: null,
      icon: <TrendingUp className="h-6 w-6 text-[#1C4D8D]" />,
    },
  ];

  const monthlyUserGrowth = monthlyUsers.reduce<number[]>((acc, value) => {
    acc.push((acc.length ? acc[acc.length - 1] : 0) + value);
    return acc;
  }, []);

  const activityTicks = niceTicks(Math.max(...monthlyJobs, ...monthlyUsers, 0));
  const payoutTicks = niceTicks(Math.max(...monthlyPayoutVolume, 0));
  const growthTicks = niceTicks(Math.max(...monthlyUserGrowth, 0));
  const activityMax = activityTicks[0];

  const hasActivity = monthlyJobs.some((v) => v > 0) || monthlyUsers.some((v) => v > 0);
  const hasPayouts = monthlyPayoutVolume.some((v) => v > 0);
  const hasGrowth = monthlyUserGrowth.some((v) => v > 0);

  const xAt = (index: number) =>
    PLOT.left + (monthBuckets.length > 1 ? (INNER_W / (monthBuckets.length - 1)) * index : INNER_W / 2);
  const yAt = (value: number, maxValue: number) => PLOT.top + INNER_H - (value / Math.max(maxValue, 1)) * INNER_H;


  const cardClass = "rounded-[16px] border border-[#E5E7EB] bg-white p-6 transition hover:shadow-md";
  const headingClass = "text-[18px] font-semibold text-[#111827]";

  const EmptyPlot = ({ label }: { label: string }) => (
    <div className="flex h-[200px] items-center justify-center rounded-[12px] border border-dashed border-slate-200 text-[13px] text-slate-500">
      {label}
    </div>
  );

  const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[12px] text-[#475569]">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );

  /** Shared axis furniture: horizontal gridlines + y tick labels + x month labels. */
  const Axes = ({ ticks, format }: { ticks: number[]; format: (value: number) => string }) => (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const y = yAt(tick, ticks[0]);
        return (
          <g key={tick}>
            <line x1={PLOT.left} x2={PLOT.width - PLOT.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PLOT.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
              {format(tick)}
            </text>
          </g>
        );
      })}
      {monthBuckets.map((bucket, index) => (
        <text
          key={bucket.key}
          x={xAt(index)}
          y={PLOT.height - 8}
          textAnchor="middle"
          fontSize={11}
          fill={AXIS_TEXT}
        >
          {bucket.label}
        </text>
      ))}
    </g>
  );

  const LineChart = ({
    values,
    ticks,
    color,
    format,
  }: {
    values: number[];
    ticks: number[];
    color: string;
    format: (value: number) => string;
  }) => {
    const points = values.map((value, index) => ({ x: xAt(index), y: yAt(value, ticks[0]) }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return (
      <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} className="h-[200px] w-full" role="img">
        <Axes ticks={ticks} format={format} />
        <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle key={monthBuckets[index].key} cx={point.x} cy={point.y} r={4} fill={color} stroke="#fff" strokeWidth={2}>
            <title>{`${monthBuckets[index].label}: ${format(values[index])}`}</title>
          </circle>
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cardItems.map((card, index) => (
          <motion.div
            key={card.label}
            className={`${cardClass} hover:-translate-y-0.5`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-[#6B7280]">{card.label}</p>
                <p className="mt-2 text-[28px] font-semibold text-[#111827]">{card.value}</p>
                {card.change === null ? (
                  <p className="mt-2 text-[12px] text-[#94A3B8]">{t("analytics.overview.noPriorMonth")}</p>
                ) : (
                  <p className={`mt-2 text-[12px] ${card.change < 0 ? "text-[#B91C1C]" : "text-[#15803D]"}`}>
                    {t("analytics.overview.changeFromLastMonth", {
                      sign: card.change >= 0 ? "+" : "",
                      value: card.change.toFixed(1),
                    })}
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C4D8D]/[0.06]">
                {card.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className={headingClass}>{t("analytics.overview.monthlyActivity")}</h3>
          {hasActivity ? (
            <>
              <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} className="mt-4 h-[200px] w-full" role="img">
                <Axes ticks={activityTicks} format={(value) => String(value)} />
                {monthBuckets.map((bucket, index) => {
                  const band = INNER_W / monthBuckets.length;
                  const centre = PLOT.left + band * index + band / 2;
                  const barWidth = Math.min(14, band / 3);
                  const series = [
                    { value: monthlyJobs[index], color: SERIES.blue, label: t("analytics.overview.legendJobs") },
                    { value: monthlyUsers[index], color: SERIES.orange, label: t("analytics.overview.legendUsers") },
                  ];
                  return (
                    <g key={bucket.key}>
                      {series.map((item, seriesIndex) => {
                        // No synthetic minimum height: a zero month must render as
                        // nothing, or the chart shows activity that never happened.
                        const height = (item.value / Math.max(activityMax, 1)) * INNER_H;
                        // 2px surface gap between the two bars in a group.
                        const x = centre - barWidth - 1 + seriesIndex * (barWidth + 2);
                        return (
                          <rect
                            key={item.label}
                            x={x}
                            y={PLOT.top + INNER_H - height}
                            width={barWidth}
                            height={height}
                            rx={height > 4 ? 4 : 0}
                            fill={item.color}
                          >
                            <title>{`${bucket.label} · ${item.label}: ${item.value}`}</title>
                          </rect>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
              <Legend
                items={[
                  { label: t("analytics.overview.legendJobs"), color: SERIES.blue },
                  { label: t("analytics.overview.legendUsers"), color: SERIES.orange },
                ]}
              />
            </>
          ) : (
            <div className="mt-4">
              <EmptyPlot label={t("analytics.overview.noData")} />
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h3 className={headingClass}>{t("analytics.overview.payoutTrend")}</h3>
          <div className="mt-4">
            {hasPayouts ? (
              <LineChart values={monthlyPayoutVolume} ticks={payoutTicks} color={SERIES.blue} format={formatCurrency} />
            ) : (
              <EmptyPlot label={t("analytics.overview.noData")} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopJobCategories jobs={jobs} />

        <div className={cardClass}>
          <h3 className={headingClass}>{t("analytics.overview.userGrowth")}</h3>
          <div className="mt-4">
            {hasGrowth ? (
              <LineChart
                values={monthlyUserGrowth}
                ticks={growthTicks}
                color={SERIES.aqua}
                format={(value) => String(value)}
              />
            ) : (
              <EmptyPlot label={t("analytics.overview.noData")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
