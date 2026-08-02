import { useMemo } from "react";
import { Briefcase, DollarSign, TrendingUp, Users } from "lucide-react";
import type { AdminJob, AdminUser } from "../../hooks/useAdminData";
import type { PaymentTransaction } from "../../services/api";

const CHART_MONTHS = 6;

type TopCategory = {
  name: string;
  count: number;
};

type AnalyticsOverviewProps = {
  isLoading: boolean;
  jobs: AdminJob[];
  users: AdminUser[];
  transactions: PaymentTransaction[];
  totalUsers: number;
  topCategories: TopCategory[];
  formatCurrency: (value: number) => string;
};

export function AnalyticsOverview({
  isLoading,
  jobs,
  users,
  transactions,
  totalUsers,
  topCategories,
  formatCurrency,
}: AnalyticsOverviewProps) {
  const monthBuckets = useMemo(() => {
    const now = new Date();
    return Array.from({ length: CHART_MONTHS }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return {
        key,
        label: date.toLocaleDateString("en-US", { month: "short" }),
        month: date.getMonth(),
        year: date.getFullYear(),
      };
    });
  }, []);

  const getDateFromId = (id?: string) => {
    if (!id || id.length < 8) return null;
    const timestamp = parseInt(id.slice(0, 8), 16) * 1000;
    return new Date(timestamp);
  };

  const jobDates = jobs.map((job) => {
    if (job.createdAt) return new Date(job.createdAt);
    return getDateFromId(job._id);
  });

  const userDates = users.map((user) => getDateFromId(user._id));

  const monthlyJobs = monthBuckets.map((bucket) => {
    return jobs.filter((_, jobIndex) => {
      const date = jobDates[jobIndex];
      return date && date.getMonth() === bucket.month && date.getFullYear() === bucket.year;
    }).length;
  });

  const monthlyUsers = monthBuckets.map((bucket) => {
    return users.filter((_, userIndex) => {
      const date = userDates[userIndex];
      return date && date.getMonth() === bucket.month && date.getFullYear() === bucket.year;
    }).length;
  });

  const monthlyPayoutVolume = monthBuckets.map((bucket) => {
    return transactions.reduce((sum, transaction) => {
      if (transaction.type !== "PAYOUT" || transaction.status !== "COMPLETED") return sum;
      const date = transaction.createdAt ? new Date(transaction.createdAt) : null;
      if (!date) return sum;
      if (date.getMonth() !== bucket.month || date.getFullYear() !== bucket.year) return sum;
      return sum + Number(transaction.amount || 0);
    }, 0);
  });

  const totalPayoutVolume = monthlyPayoutVolume.reduce((sum, value) => sum + value, 0);
  const activeJobs = jobs.filter((job) => job.status === "Available" || job.status === "In Progress").length;

  const applicantIds = new Set<string>();
  jobs.forEach((job) => {
    job.applicants?.forEach((id) => applicantIds.add(id));
  });

  const conversionRate = users.length ? (applicantIds.size / users.length) * 100 : 0;

  const percentChange = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  const latestIndex = monthBuckets.length - 1;
  const payoutVolumeChange = percentChange(monthlyPayoutVolume[latestIndex] || 0, monthlyPayoutVolume[latestIndex - 1] || 0);
  const jobChange = percentChange(monthlyJobs[latestIndex] || 0, monthlyJobs[latestIndex - 1] || 0);
  const userChange = percentChange(monthlyUsers[latestIndex] || 0, monthlyUsers[latestIndex - 1] || 0);
  const conversionChange = percentChange(
    monthlyUsers[latestIndex] ? (monthlyJobs[latestIndex] / monthlyUsers[latestIndex]) * 100 : 0,
    monthlyUsers[latestIndex - 1]
      ? (monthlyJobs[latestIndex - 1] / monthlyUsers[latestIndex - 1]) * 100
      : 0,
  );

  const cardItems = [
    {
      label: "Completed Payout Volume",
      value: isLoading ? "—" : formatCurrency(totalPayoutVolume),
      change: payoutVolumeChange,
      icon: <DollarSign className="w-6 h-6 text-[#1C4D8D]" />,
    },
    {
      label: "Active Jobs",
      value: isLoading ? "—" : activeJobs,
      change: jobChange,
      icon: <Briefcase className="w-6 h-6 text-[#1C4D8D]" />,
    },
    {
      label: "Total Users",
      value: isLoading ? "—" : totalUsers,
      change: userChange,
      icon: <Users className="w-6 h-6 text-[#1C4D8D]" />,
    },
    {
      label: "Conversion Rate",
      value: isLoading ? "—" : `${conversionRate.toFixed(1)}%`,
      change: conversionChange,
      icon: <TrendingUp className="w-6 h-6 text-[#1C4D8D]" />,
    },
  ];

  const maxMonthly = Math.max(...monthlyJobs, ...monthlyUsers, 1);
  const maxPayoutVolume = Math.max(...monthlyPayoutVolume, 1);
  const monthlyUserGrowth = monthlyUsers.reduce<number[]>((acc, value) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + value);
    return acc;
  }, []);
  const maxUserGrowth = Math.max(...monthlyUserGrowth, 1);

  const chartPoints = (values: number[], maxValue: number) => {
    const width = 360;
    const height = 180;
    const padding = 10;
    const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
    return values.map((value, index) => {
      const x = padding + step * index;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return { x, y };
    });
  };

  const payoutVolumePoints = chartPoints(monthlyPayoutVolume, maxPayoutVolume);
  const userGrowthPoints = chartPoints(monthlyUserGrowth, maxUserGrowth);

  const linePath = (points: { x: number; y: number }[]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  const chartTicks = (maxValue: number) => {
    const ticks = 4;
    return Array.from({ length: ticks }, (_, index) =>
      Math.round(maxValue * (1 - index / (ticks - 1)))
    );
  };

  const payoutVolumeTicks = chartTicks(maxPayoutVolume);
  const userGrowthTicks = chartTicks(maxUserGrowth);

  const categoryTotal = jobs.length || 1;
  const categorySegments = useMemo(() => {
    const colors = ["#1C4D8D", "#10B981", "#EF4444", "#94A3B8", "#E2E8F0"];
    const visible = topCategories.slice(0, 4);
    const used = visible.reduce((sum, item) => sum + item.count, 0);
    const segments = visible.map((item, index) => ({
      label: item.name,
      value: item.count,
      color: colors[index],
    }));
    const remaining = categoryTotal - used;
    if (remaining > 0) {
      segments.push({ label: "Others", value: remaining, color: colors[4] });
    }
    return segments;
  }, [topCategories, categoryTotal]);

  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cardItems.map((card) => (
          <div key={card.label} className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-[#6B7280]">{card.label}</p>
                <p className="text-[28px] font-semibold text-[#111827] mt-2">{card.value}</p>
                <p
                  className={`text-[12px] mt-2 ${
                    card.change < 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                  }`}
                >
                  {card.change >= 0 ? "+" : ""}
                  {card.change.toFixed(1)}% from last month
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#1C4D8D]/[0.06] flex items-center justify-center">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <h3 className="text-[18px] font-semibold text-[#111827]">Monthly Activity</h3>
          <div className="mt-6 flex items-end gap-4 h-[220px]">
            {monthBuckets.map((bucket, index) => {
              const jobHeight = (monthlyJobs[index] / maxMonthly) * 100;
              const userHeight = (monthlyUsers[index] / maxMonthly) * 100;
              return (
                <div key={bucket.key} className="flex flex-col items-center gap-2 flex-1">
                  <div className="flex items-end gap-2 h-[160px]">
                    <div
                      className="w-6 rounded-[8px] bg-[#1C4D8D]/80"
                      style={{ height: `${Math.max(jobHeight, 6)}%` }}
                    />
                    <div
                      className="w-6 rounded-[8px] bg-[#10B981]"
                      style={{ height: `${Math.max(userHeight, 6)}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-[#6B7280]">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <h3 className="text-[18px] font-semibold text-[#111827]">Completed Payout Trend</h3>
          <div className="mt-6 flex gap-4">
            <div className="flex flex-col justify-between text-[12px] text-[#94A3B8] h-[200px]">
              {payoutVolumeTicks.map((tick) => (
                <span key={tick}>{formatCurrency(tick)}</span>
              ))}
            </div>
            <svg viewBox="0 0 360 180" className="w-full h-[200px]">
              <path d={linePath(payoutVolumePoints)} stroke="#1C4D8D" strokeWidth="2" fill="none" />
              {payoutVolumePoints.map((point, index) => (
                <circle key={`rev-${index}`} cx={point.x} cy={point.y} r={4} fill="#1C4D8D" />
              ))}
            </svg>
          </div>
          <div className="flex justify-between text-[12px] text-[#6B7280] mt-2">
            {monthBuckets.map((bucket) => (
              <span key={bucket.key}>{bucket.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <h3 className="text-[18px] font-semibold text-[#111827]">Jobs by Category</h3>
          <div className="mt-6 flex flex-col items-center gap-6">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <g transform="translate(100 100) rotate(-90)">
                {categorySegments.map((segment) => {
                  const value = segment.value / categoryTotal;
                  const dash = donutCircumference * value;
                  const strokeDasharray = `${dash} ${donutCircumference - dash}`;
                  const strokeDashoffset = -donutOffset;
                  donutOffset += dash;
                  return (
                    <circle
                      key={segment.label}
                      r={donutRadius}
                      cx={0}
                      cy={0}
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth={24}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                    />
                  );
                })}
              </g>
            </svg>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {categorySegments.map((segment) => (
                <div key={segment.label} className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span>
                    {segment.label} ({Math.round((segment.value / categoryTotal) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <h3 className="text-[18px] font-semibold text-[#111827]">User Growth</h3>
          <div className="mt-6 flex gap-4">
            <div className="flex flex-col justify-between text-[12px] text-[#94A3B8] h-[200px]">
              {userGrowthTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <svg viewBox="0 0 360 180" className="w-full h-[200px]">
              <path d={linePath(userGrowthPoints)} stroke="#EF4444" strokeWidth="2" fill="none" />
              {userGrowthPoints.map((point, index) => (
                <circle key={`user-${index}`} cx={point.x} cy={point.y} r={4} fill="#EF4444" />
              ))}
            </svg>
          </div>
          <div className="flex justify-between text-[12px] text-[#6B7280] mt-2">
            {monthBuckets.map((bucket) => (
              <span key={bucket.key}>{bucket.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
