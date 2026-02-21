import { AdminGate } from "./admin/AdminGate";
import { AnalyticsOverview } from "./AnalyticsOverview";
import { useAdminData } from "../../hooks/useAdminData";

function AdminAnalyticsContent() {
  const { isLoading, loadError, jobs, users, stats, topCategories, formatCurrency } = useAdminData();

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
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
