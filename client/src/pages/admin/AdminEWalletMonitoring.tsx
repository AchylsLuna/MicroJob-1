import { BarChart3, Clock, DollarSign, TrendingUp, Wallet } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../microjobs/hooks/useAdminData";

function AdminEWalletMonitoringContent() {
  const {
    isLoading,
    loadError,
    walletStats,
    recentPayouts,
    formatCurrency,
    formatSalary,
    formatDateFromObjectId,
    getJobStatusColor,
  } = useAdminData();

  const cards = [
    {
      label: "Completed Payouts",
      value: isLoading ? "—" : walletStats.completedCount,
      icon: <Wallet className="w-6 h-6 text-[#0F766E]" />,
      accent: "from-[#CCFBF1] to-[#99F6E4]",
    },
    {
      label: "Pending Payouts",
      value: isLoading ? "—" : walletStats.pendingCount,
      icon: <Clock className="w-6 h-6 text-[#1D4ED8]" />,
      accent: "from-[#DBEAFE] to-[#BFDBFE]",
    },
    {
      label: "Completed Total",
      value: isLoading ? "—" : formatCurrency(walletStats.completedTotal),
      icon: <DollarSign className="w-6 h-6 text-[#047857]" />,
      accent: "from-[#D1FAE5] to-[#A7F3D0]",
    },
    {
      label: "Pending Total",
      value: isLoading ? "—" : formatCurrency(walletStats.pendingTotal),
      icon: <TrendingUp className="w-6 h-6 text-[#B45309]" />,
      accent: "from-[#FEF3C7] to-[#FDE68A]",
    },
    {
      label: "Avg. Completed",
      value: isLoading ? "—" : formatCurrency(walletStats.averageCompleted),
      icon: <BarChart3 className="w-6 h-6 text-[#7C3AED]" />,
      accent: "from-[#E9D5FF] to-[#DDD6FE]",
    },
  ];

  const getPosterName = (job: typeof recentPayouts[number]) => {
    const poster = job.jobPoster;
    if (!poster || typeof poster === "string") return "—";
    return `${poster.firstName || ""} ${poster.lastName || ""}`.trim() || poster.email || "—";
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-[12px] bg-gradient-to-br ${card.accent} flex items-center justify-center`}
              >
                {card.icon}
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">{card.label}</p>
            <p className="text-[26px] font-bold text-[#111827] truncate">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div>
          <h3 className="text-[18px] font-semibold text-[#111827]">Recent Completed Payouts</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">Latest jobs marked as completed.</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="py-3 pr-4 font-medium">Job</th>
                <th className="py-3 pr-4 font-medium">Poster</th>
                <th className="py-3 pr-4 font-medium">Amount</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                    Loading payouts...
                  </td>
                </tr>
              )}

              {!isLoading && recentPayouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                    No completed payouts yet.
                  </td>
                </tr>
              )}

              {!isLoading &&
                recentPayouts.map((job) => {
                  const dateLabel = job.createdAt
                    ? new Date(job.createdAt).toLocaleDateString()
                    : formatDateFromObjectId(job._id);
                  return (
                    <tr key={job._id} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4 text-[#111827] font-medium">{job.title}</td>
                      <td className="py-3 pr-4 text-[#6B7280]">{getPosterName(job)}</td>
                      <td className="py-3 pr-4 text-[#111827]">{formatSalary(job.salary)}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                            getJobStatusColor(job.status)
                          }`}
                        >
                          {job.status || "Completed"}
                        </span>
                      </td>
                      <td className="py-3 text-[#6B7280]">{dateLabel}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AdminEWalletMonitoring() {
  return (
    <AdminGate allowedRoles={["superadmin", "admin"]}>
      <AdminEWalletMonitoringContent />
    </AdminGate>
  );
}
