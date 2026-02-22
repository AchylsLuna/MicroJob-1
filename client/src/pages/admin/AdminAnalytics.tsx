import { AdminGate } from "./AdminGate/AdminGate";
import { AnalyticsOverview } from "./AnalyticsOverview";
import { useAdminData } from "../../hooks/useAdminData";

function AdminAnalyticsContent() {
  const { isLoading, loadError, jobs, users, stats, topCategories, formatCurrency } = useAdminData();

  return (
    <div className="max-w-full ml-6 md:ml-12 space-y-6 text-[16px] mt-8 md:mt-12">
      <header className="mb-8 text-left">
        <h1 className="text-4xl md:text-5xl font-semibold text-[#111827]">Analytics</h1>
        <p className="text-base text-[#6B7280] mt-2">Overview of analytics across your platform</p>
      </header>
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <AnalyticsOverview
        isLoading={isLoading}
        jobs={jobs}
        users={users}
        totalUsers={stats.totalUsers}
        topCategories={topCategories}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

export function AdminAnalytics() {
  return (
    <AdminGate allowedRoles={["superadmin", "admin"]}>
      <AdminAnalyticsContent />
    </AdminGate>
  );
}