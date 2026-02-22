import { Shield, ShieldCheck, UserCog, UserMinus } from "lucide-react";
import { AdminGate } from "./AdminGate/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";

function AdminSecurityContent() {
  const { isLoading, loadError, stats, users, recentActivity } = useAdminData();

  const adminCount = users.filter((user) => user.role === "admin" || user.role === "superadmin").length;
  const recentUsers = recentActivity.filter((activity) => activity.type === "user");

  return (
    <div className="max-w-[1341px] mx-auto space-y-4">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="w-12 h-12 rounded-[12px] bg-[#E8F2FF] flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
          </div>
          <p className="text-[13px] text-[#6B7280]">Active Users</p>
          <p className="text-[26px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : stats.activeUsers}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="w-12 h-12 rounded-[12px] bg-[#FEE2E2] flex items-center justify-center mb-4">
            <UserMinus className="w-6 h-6 text-[#DC2626]" />
          </div>
          <p className="text-[13px] text-[#6B7280]">Disabled Accounts</p>
          <p className="text-[26px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : stats.disabledUsers}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="w-12 h-12 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-[#D97706]" />
          </div>
          <p className="text-[13px] text-[#6B7280]">Pending Approvals</p>
          <p className="text-[26px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : stats.pendingUsers}</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="w-12 h-12 rounded-[12px] bg-[#EDE9FE] flex items-center justify-center mb-4">
            <UserCog className="w-6 h-6 text-[#7C3AED]" />
          </div>
          <p className="text-[13px] text-[#6B7280]">Admin Accounts</p>
          <p className="text-[26px] font-semibold text-[#111827] mt-2">{isLoading ? "—" : adminCount}</p>
        </div>
      </section>

      <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827]">Recent User Activity</h3>
            <p className="text-[13px] text-[#6B7280] mt-1">New user registrations in the last few days.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="text-[13px] text-[#9CA3AF]">Loading activity...</div>
          )}
          {!isLoading && recentUsers.length === 0 && (
            <div className="text-[13px] text-[#9CA3AF]">No recent user activity.</div>
          )}
          {!isLoading &&
            recentUsers.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between gap-4 p-3 rounded-[12px] border border-[#F3F4F6]"
              >
                <div>
                  <p className="text-[14px] font-medium text-[#111827]">{activity.subtitle}</p>
                  <p className="text-[12px] text-[#6B7280]">{activity.title}</p>
                </div>
                <span className="text-[12px] text-[#9CA3AF]">{activity.date.toLocaleDateString()}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

export function AdminSecurity() {
  return (
    <AdminGate>
      <AdminSecurityContent />
    </AdminGate>
  );
}