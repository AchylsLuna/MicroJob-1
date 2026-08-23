import {
  ArrowRight,
  BriefcaseBusiness,
  CircleAlert,
  ClipboardList,
  FileText,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData, type AdminJob } from "../../hooks/useAdminData";
import { ROUTES } from "../../utils/routes";
import { formatDate } from "../../lib/formatters";

const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

const getPosterName = (job: AdminJob, t: TFunction<"admin">) => {
  if (!job.jobPoster || typeof job.jobPoster === "string") return t("dashboard.recentJobs.unassignedEmployer");
  return (
    `${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim() ||
    job.jobPoster.email ||
    t("dashboard.recentJobs.unassignedEmployer")
  );
};

function AdminDashboardContent() {
  const { t } = useTranslation("admin");
  const {
    isLoading,
    loadError,
    stats,
    jobs,
    walletStats,
    recentPayouts,
    formatCurrency,
    formatDateFromObjectId,
    getJobStatusColor,
    reload,
  } = useAdminData();

  const totalApplications = jobs.reduce((total, job) => total + (job.applicants?.length || 0), 0);
  const recentJobs = [...jobs]
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime || right._id.localeCompare(left._id);
    })
    .slice(0, 5);

  const metrics = [
    {
      label: t("dashboard.metrics.totalJobs.label"),
      value: stats.totalJobs,
      detail: t("dashboard.metrics.totalJobs.detail", { count: stats.availableJobs }),
      icon: BriefcaseBusiness,
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      label: t("dashboard.metrics.applications.label"),
      value: totalApplications,
      detail: t("dashboard.metrics.applications.detail"),
      icon: ClipboardList,
      iconClass: "bg-violet-50 text-violet-700",
    },
    {
      label: t("dashboard.metrics.totalUsers.label"),
      value: stats.totalUsers,
      detail: t("dashboard.metrics.totalUsers.detail", { count: stats.activeUsers }),
      icon: Users,
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("dashboard.metrics.completedValue.label"),
      value: formatCurrency(walletStats.completedTotal),
      detail: t("dashboard.metrics.completedValue.detail", { count: walletStats.completedCount }),
      icon: Wallet,
      iconClass: "bg-amber-50 text-amber-700",
    },
  ];

  const quickActions = [
    { label: t("dashboard.quickActions.manageUsers.label"), description: t("dashboard.quickActions.manageUsers.description"), to: ROUTES.admin.userManagement, icon: Users },
    { label: t("dashboard.quickActions.monitorJobs.label"), description: t("dashboard.quickActions.monitorJobs.description"), to: ROUTES.admin.jobs, icon: BriefcaseBusiness },
    { label: t("dashboard.quickActions.openReports.label"), description: t("dashboard.quickActions.openReports.description"), to: ROUTES.admin.reports, icon: FileText },
    { label: t("dashboard.quickActions.reviewPayouts.label"), description: t("dashboard.quickActions.reviewPayouts.description"), to: ROUTES.admin.payouts, icon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-[1341px] space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-[#1C4D8D]/20 bg-[#1C4D8D] p-5 text-white shadow-lg shadow-[#1C4D8D]/10 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.badge")}
          </div>
          <h2 className="text-xl font-bold sm:text-2xl">{t("dashboard.header.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/85">
            {t("dashboard.header.description")}
          </p>
        </div>
        <Link
          to={ROUTES.admin.reports}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {t("dashboard.header.reportsLink")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {loadError && (
        <section role="alert" className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-red-950">{t("dashboard.error.title")}</h2>
              <p className="mt-1 text-sm text-red-700">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {t("dashboard.error.retry")}
          </button>
        </section>
      )}

      {(stats.pendingUsers > 0 || stats.pendingPayouts > 0 || stats.openSupportTickets > 0) && !loadError && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-amber-950">{t("dashboard.pendingBanner.title")}</h2>
              <p className="mt-1 text-sm text-amber-800">
                {t("dashboard.pendingSummary", {
                  pendingUsers: stats.pendingUsers,
                  pendingPayouts: stats.pendingPayouts,
                  openSupportTickets: stats.openSupportTickets,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-amber-900">
            {stats.pendingUsers > 0 && <Link to={ROUTES.admin.userManagement} className="underline-offset-4 hover:underline">{t("dashboard.pendingBanner.reviewAccounts")}</Link>}
            {stats.pendingPayouts > 0 && <Link to={ROUTES.admin.payouts} className="underline-offset-4 hover:underline">{t("dashboard.pendingBanner.reviewPayouts")}</Link>}
            {stats.openSupportTickets > 0 && <Link to={ROUTES.admin.support} className="underline-offset-4 hover:underline">{t("dashboard.pendingBanner.reviewSupport")}</Link>}
          </div>
        </section>
      )}

      <section aria-labelledby="platform-summary-title" className="space-y-3">
        <div>
          <h2 id="platform-summary-title" className="text-lg font-bold text-slate-950">{t("dashboard.summary.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("dashboard.summary.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className={`${panelClass} p-5`}>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.iconClass}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">{metric.label}</p>
                <p className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950" aria-live="polite">
                  {isLoading ? "—" : metric.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{isLoading ? t("dashboard.metrics.loading") : metric.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="quick-actions-title" className="space-y-3">
        <div>
          <h2 id="quick-actions-title" className="text-lg font-bold text-slate-950">{t("dashboard.quickActions.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("dashboard.quickActions.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className={`${panelClass} group flex min-h-28 items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-950">{action.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="recent-jobs-title" className={`${panelClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="recent-jobs-title" className="font-bold text-slate-950">{t("dashboard.recentJobs.title")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("dashboard.recentJobs.subtitle")}</p>
            </div>
            <Link to={ROUTES.admin.jobs} className="text-sm font-semibold text-blue-700 hover:text-blue-900">{t("dashboard.recentJobs.viewAll")}</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading && <p role="status" className="p-6 text-center text-sm text-slate-500">{t("dashboard.recentJobs.loading")}</p>}
            {!isLoading && recentJobs.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{t("dashboard.recentJobs.empty")}</p>}
            {!isLoading && recentJobs.map((job) => (
              <article key={job._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-950">{job.title}</h3>
                  <p className="mt-1 truncate text-sm text-slate-500">{getPosterName(job, t)} · {job.location || t("dashboard.recentJobs.locationNotProvided")}</p>
                </div>
                <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getJobStatusColor(job.status)}`}>
                  {job.status || t("dashboard.recentJobs.statusUnknown")}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="recent-payouts-title" className={`${panelClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="recent-payouts-title" className="font-bold text-slate-950">{t("dashboard.recentPayouts.title")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("dashboard.recentPayouts.subtitle")}</p>
            </div>
            <Link to={ROUTES.admin.eWallet} className="text-sm font-semibold text-blue-700 hover:text-blue-900">{t("dashboard.recentPayouts.viewWallet")}</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading && <p role="status" className="p-6 text-center text-sm text-slate-500">{t("dashboard.recentPayouts.loading")}</p>}
            {!isLoading && recentPayouts.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{t("dashboard.recentPayouts.empty")}</p>}
            {!isLoading && recentPayouts.slice(0, 5).map((payout) => {
              const account = payout.user;
              const userName = typeof account === "string"
                ? t("dashboard.recentPayouts.platformUser")
                : `${account?.firstName || ""} ${account?.lastName || ""}`.trim() || account?.email || t("dashboard.recentPayouts.platformUser");
              return (
                <article key={payout._id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-950">{userName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{payout.paidAt ? formatDate(payout.paidAt) : formatDateFromObjectId(payout._id)}</p>
                  </div>
                  <p className="shrink-0 font-bold text-emerald-700">{formatCurrency(Number(payout.amount || 0))}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <AdminGate allowedRoles={["admin"]}>
      <AdminDashboardContent />
    </AdminGate>
  );
}
