import { Shield, ShieldCheck, UserCog, UserMinus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { formatDate } from "../../lib/formatters";

function AdminSecurityContent() {
  const { t } = useTranslation("admin");
  const { isLoading, loadError, stats, users, recentActivity } = useAdminData();
  const prefersReducedMotion = useReducedMotion();

  const adminCount = users.filter((user) => user.role === "admin").length;
  const recentUsers = recentActivity.filter((activity) => activity.type === "user");

  const securityCards = [
    { icon: ShieldCheck, iconBg: "bg-[#E8F2FF]", iconColor: "text-[#1C4D8D]", label: t("security.cards.activeUsers"), value: isLoading ? "—" : stats.activeUsers },
    { icon: UserMinus, iconBg: "bg-[#FEE2E2]", iconColor: "text-[#DC2626]", label: t("security.cards.disabledAccounts"), value: isLoading ? "—" : stats.disabledUsers },
    { icon: Shield, iconBg: "bg-[#FEF3C7]", iconColor: "text-[#D97706]", label: t("security.cards.pendingApprovals"), value: isLoading ? "—" : stats.pendingUsers },
    { icon: UserCog, iconBg: "bg-[#EDE9FE]", iconColor: "text-[#7C3AED]", label: t("security.cards.adminAccounts"), value: isLoading ? "—" : adminCount },
  ];

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {securityCards.map((card, index) => (
          <motion.div
            key={card.label}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <div className={`w-12 h-12 rounded-[12px] ${card.iconBg} flex items-center justify-center mb-4`}>
              <card.icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <p className="text-[13px] text-[#6B7280]">{card.label}</p>
            <p className="text-[26px] font-semibold text-[#111827] mt-2">{card.value}</p>
          </motion.div>
        ))}
      </section>

      <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827]">{t("security.recentActivity.title")}</h3>
            <p className="text-[13px] text-[#6B7280] mt-1">{t("security.recentActivity.subtitle")}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="text-[13px] text-[#9CA3AF]">{t("security.recentActivity.loading")}</div>
          )}
          {!isLoading && recentUsers.length === 0 && (
            <div className="text-[13px] text-[#9CA3AF]">{t("security.recentActivity.empty")}</div>
          )}
          {!isLoading &&
            recentUsers.map((activity, index) => (
              <motion.div
                key={activity.id}
                className="flex items-center justify-between gap-4 p-3 rounded-[12px] border border-[#F3F4F6] transition-colors hover:bg-slate-50"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
              >
                <div>
                  <p className="text-[14px] font-medium text-[#111827]">{activity.subtitle}</p>
                  <p className="text-[12px] text-[#6B7280]">{activity.title}</p>
                </div>
                <span className="text-[12px] text-[#9CA3AF]">{formatDate(activity.date)}</span>
              </motion.div>
            ))}
        </div>
      </section>
    </div>
  );
}

export function AdminSecurity() {
  return (
    <AdminGate allowedRoles={["admin"]}>
      <AdminSecurityContent />
    </AdminGate>
  );
}
