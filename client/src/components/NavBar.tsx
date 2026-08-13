import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { ArrowRight, Bell, ChevronDown, Ellipsis, MapPin, Menu, Search } from "lucide-react";
import { toast } from "../lib/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { jobsAPI } from "../services/jobs";
import { mapNotificationRecord, type FeedNotification } from "../utils/notificationFeed";
import { useNotifications } from "../contexts/NotificationContext";
import { ROUTES, matchesAnyPath, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { workerMoreNavigation, workerPrimaryNavigation } from "./workerNavigation";

interface NavBarProps {
  isNavigationOpen?: boolean;
  onOpenNavigation?: () => void;
}

export function NavBar({ isNavigationOpen = false, onOpenNavigation }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, user, switchAccountType } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const notificationState = useNotifications();
  const refreshNotifications = notificationState.refresh;
  const [appliedJobsCount, setAppliedJobsCount] = useState<number>(0);
  
  const rawAccountOptions = user?.accountOptions;
  const accountOptions: Array<"worker" | "employer"> = Array.isArray(rawAccountOptions)
    ? (rawAccountOptions as Array<"worker" | "employer">)
    : [];
  const hasBothOptions =
    accountOptions.includes("worker") && accountOptions.includes("employer");
  const isBothRole =
    !!user &&
    user.role !== "admin" &&
    (user.role === "both" || (user as any)?.accountPreference === "both" || hasBothOptions);
  const canSwitchAccount = isBothRole;
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isEmployerView =
    user?.accountType === "employer" ||
    normalizedRole === "employer" ||
    normalizedRole === "doctor" ||
    normalizedRole === "hire";
  const notificationAudience: "admin" | "employer" | "worker" =
    normalizedRole === "admin" || normalizedRole === "superadmin"
      ? "admin"
      : isEmployerView
      ? "employer"
      : "worker";

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const notifications = useMemo(() => notificationState.notifications
    .map((item: any) => mapNotificationRecord(item, notificationAudience, "relative"))
    .slice(0, 10), [notificationAudience, notificationState.notifications]);
  const notificationsLoading = notificationState.loading;
  const unreadCount = notificationState.unreadCount;
  const path = location.pathname;
  const isWorkerView = notificationAudience === "worker";

  const isPath = (...targets: string[]) => matchesAnyPath(path, targets);
  const isExactPath = (...targets: string[]) => targets.some((target) => matchesPath(path, target));
  const isAppliedJobsPage = isPath(
    ROUTES.worker.appliedJobs,
    ROUTES.legacyDashboard.appliedJobs,
    ROUTES.legacyShortcuts.appliedJobs,
  );

  useEffect(() => {
    if (!isAppliedJobsPage) return;
    let isMounted = true;
    const loadAppliedCount = async () => {
      try {
        const response = await jobsAPI.getUserApplications();
        const nextCount = Array.isArray(response?.data) ? response.data.length : 0;
        if (isMounted) setAppliedJobsCount(nextCount);
      } catch {
        if (isMounted) setAppliedJobsCount(0);
      }
    };
    loadAppliedCount();
    return () => {
      isMounted = false;
    };
  }, [isAppliedJobsPage, path]);

  type PageMeta = {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    search?: { placeholder: string; mode: "query" };
    action?: { label: string; to: string };
    subtitleAction?: string;
    homeContext?: boolean;
  };

  const localArea = [user?.city, user?.province]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  const pageMeta: PageMeta = (() => {
    if (isExactPath(ROUTES.worker.dashboard, ROUTES.legacyDashboard.root)) {
      return {
        title: "Home",
        subtitle: localArea || "Set your local area",
        subtitleAction: `${ROUTES.worker.settings}?tab=personal`,
        homeContext: true,
      };
    }

    if (
      isPath(
        ROUTES.worker.findJobs,
        ROUTES.legacyDashboard.findJobs,
        ROUTES.legacyShortcuts.findJobs,
      )
    ) {
      return { title: "Find Jobs", search: { placeholder: "Search jobs...", mode: "query" as const } };
    }

    if (isPath(ROUTES.worker.appliedJobs, ROUTES.legacyDashboard.appliedJobs, ROUTES.legacyShortcuts.appliedJobs)) {
      return {
        title: "Applied Jobs",
        subtitle: `You have ${appliedJobsCount} job application${appliedJobsCount === 1 ? "" : "s"}.`,
      };
    }

    if (
      isPath(
        ROUTES.worker.messages,
        ROUTES.legacyDashboard.messages,
        ROUTES.legacyShortcuts.messages,
        ROUTES.employer.messages,
        ROUTES.admin.messages,
        ROUTES.doctor.messages,
        ROUTES.legacyDashboard.employer.messages,
        ROUTES.legacyDashboard.admin.messages,
        ROUTES.legacyDashboard.doctor.messages,
      )
    ) {
      return { title: "Messages" };
    }

    if (
      isPath(
        ROUTES.worker.support,
        ROUTES.legacyDashboard.support,
        ROUTES.support,
        ROUTES.employer.support,
        ROUTES.doctor.support,
        ROUTES.legacyDashboard.employer.support,
        ROUTES.legacyDashboard.doctor.support,
      )
    ) {
      return { title: "Support", search: { placeholder: "Search help...", mode: "query" as const } };
    }

    if (isPath(ROUTES.worker.savedJobs, ROUTES.legacyDashboard.savedJobs, ROUTES.legacyShortcuts.savedJobs)) {
      return {
        title: "Saved Jobs",
        search: { placeholder: "Search saved jobs...", mode: "query" as const },
      };
    }

    if (
      isPath(
        ROUTES.worker.eWallet,
        ROUTES.legacyDashboard.eWallet,
        ROUTES.legacyShortcuts.eWallet,
        ROUTES.employer.eWallet,
        ROUTES.admin.payouts,
        ROUTES.admin.support,
        ROUTES.doctor.eWallet,
        ROUTES.legacyDashboard.admin.payouts,
        ROUTES.legacyDashboard.admin.support,
        ROUTES.legacyDashboard.employer.eWallet,
        ROUTES.legacyDashboard.doctor.eWallet,
      )
    ) {
      if (isPath(ROUTES.admin.payouts, ROUTES.legacyDashboard.admin.payouts)) {
        return { title: "Payout Requests" };
      }
      if (isPath(ROUTES.admin.support, ROUTES.legacyDashboard.admin.support)) {
        return { title: "Support Tickets" };
      }
      return { title: "E-Wallet" };
    }

    if (
      isPath(
        ROUTES.worker.notifications,
        ROUTES.legacyDashboard.notifications,
        ROUTES.notifications,
        ROUTES.employer.notifications,
        ROUTES.doctor.notifications,
        ROUTES.legacyDashboard.employer.notifications,
        ROUTES.legacyDashboard.doctor.notifications,
      )
    ) {
      return {
        title: "Notifications",
        subtitle: "Application updates, messages, and payments",
      };
    }

    if (
      isPath(
        ROUTES.settings,
        ROUTES.worker.settings,
        ROUTES.legacyDashboard.settings,
        ROUTES.employer.settings,
        ROUTES.doctor.settings,
        ROUTES.legacyDashboard.employer.settings,
        ROUTES.legacyDashboard.doctor.settings,
      )
    ) {
      return { title: "Settings" };
    }

    if (isPath(ROUTES.worker.profile, ROUTES.legacyDashboard.profile, ROUTES.legacyShortcuts.profile)) {
      return { title: "Profile" };
    }

    if (
      isExactPath(
        ROUTES.doctor.dashboard,
        ROUTES.doctor.root,
        ROUTES.legacyDashboard.doctor.root,
        ROUTES.employer.dashboard,
        ROUTES.employer.root,
        ROUTES.legacyDashboard.employer.root,
      )
    ) {
      return {
        title: "Home",
        subtitle: localArea || "Set your local area",
        subtitleAction: `${ROUTES.employer.settings}?tab=personal`,
        homeContext: true,
        action: { label: "Post a job", to: ROUTES.employer.postJob },
      };
    }

    if (
      isPath(
        ROUTES.doctor.applications,
        ROUTES.legacyDashboard.doctor.applications,
        ROUTES.employer.applications,
        ROUTES.legacyDashboard.employer.applications,
      )
    ) {
      return {
        title: "Applications",
        subtitle: "Review applicants and update hiring status.",
        action: { label: "Manage jobs", to: ROUTES.employer.jobs },
      };
    }

    if (
      isPath(
        ROUTES.doctor.postJob,
        ROUTES.legacyDashboard.doctor.postJob,
        ROUTES.employer.postJob,
        ROUTES.legacyDashboard.employer.postJob,
      )
    ) {
      return {
        title: "My Job Postings",
        subtitle: "Create and manage your open positions",
        action: { label: "Manage jobs", to: ROUTES.employer.jobs },
      };
    }

    if (
      isPath(
        ROUTES.doctor.jobs,
        ROUTES.legacyDashboard.doctor.jobs,
        ROUTES.employer.jobs,
        ROUTES.legacyDashboard.employer.jobs,
      )
    ) {
      return {
        title: "Jobs Management",
        search: { placeholder: "Search jobs...", mode: "query" as const },
      };
    }

    if (isPath(ROUTES.admin.analytics, ROUTES.legacyDashboard.admin.analytics)) {
      return {
        title: "Admin Analytics",
        subtitle: "Understand category performance and recent platform activity",
      };
    }

    if (isPath(ROUTES.admin.eWallet, ROUTES.legacyDashboard.admin.eWallet)) {
      return {
        title: "E-Wallet Monitoring",
        subtitle: "Track payout volume, pending balances, and recent completions",
      };
    }

    if (isPath(ROUTES.admin.jobs, ROUTES.legacyDashboard.admin.jobs)) {
      return {
        title: "Job Posting Monitoring",
        subtitle: "Monitor job listings, statuses, and applicant activity",
      };
    }

    if (isPath(ROUTES.admin.userManagement, ROUTES.legacyDashboard.admin.userManagement)) {
      return {
        title: "Users",
        subtitle: "Manage platform users and their profiles",
      };
    }

    if (isPath(ROUTES.admin.reports, ROUTES.legacyDashboard.admin.reports)) {
      return {
        title: "Reports",
        subtitle: "Generate and download platform reports",
      };
    }

    if (isPath(ROUTES.admin.security, ROUTES.legacyDashboard.admin.security)) {
      return {
        title: "Security & Access",
        subtitle: "Manage user access, roles, and security status",
      };
    }

    if (isPath(ROUTES.admin.dashboard, ROUTES.legacyDashboard.admin.root)) {
      return {
        title: "Admin Dashboard",
        subtitle: "Overview of your job posting platform",
      };
    }

    if (
      startsWithPath(path, ROUTES.worker.jobDetailsPattern.replace("/:jobId", "")) ||
      startsWithPath(path, ROUTES.legacyDashboard.jobDetailsPattern.replace("/:jobId", ""))
    ) {
      return { title: "Job Details" };
    }

    if (
      startsWithPath(path, ROUTES.doctor.root) ||
      startsWithPath(path, ROUTES.legacyDashboard.doctor.root) ||
      startsWithPath(path, ROUTES.employer.root) ||
      startsWithPath(path, ROUTES.legacyDashboard.employer.root)
    ) {
      return { title: "Employer" };
    }

    if (startsWithPath(path, ROUTES.admin.root) || startsWithPath(path, ROUTES.legacyDashboard.admin.root)) {
      return { title: "Admin" };
    }

    return { title: "" };
  })();

  const searchValue = pageMeta.search?.mode === "query" ? searchParams.get("q") ?? "" : "";

  const handleSearchChange = (value: string) => {
    if (pageMeta.search?.mode === "query") {
      setSearchParams(value ? { q: value } : {});
    }
  };

  useEffect(() => {
    if (!showNotifications && !showUserMenu && !showMoreMenu) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const returnTarget = showNotifications
          ? notificationButtonRef.current
          : showMoreMenu
          ? moreButtonRef.current
          : accountButtonRef.current;
        setShowNotifications(false);
        setShowUserMenu(false);
        setShowMoreMenu(false);
        window.requestAnimationFrame(() => returnTarget?.focus());
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMoreMenu, showNotifications, showUserMenu]);

  useEffect(() => {
    if (showNotifications) {
      void refreshNotifications();
    }
  }, [refreshNotifications, showNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  const markAsRead = async (notification: FeedNotification) => {
    try {
      await notificationState.setRead(notification.id, true);
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark notification.");
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationState.markAllRead();
      toast.success("All notifications marked as read");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark all as read.");
    }
  };

  const handleSignOut = () => {
    logout();
    setShowUserMenu(false);
    setShowNotifications(false);
    setShowMoreMenu(false);
    navigate(ROUTES.home);
  };

  const handleSwitchTo = (nextType: "worker" | "employer") => {
    if (!user || user.accountType === nextType) {
      return;
    }

    switchAccountType(nextType);
    setShowUserMenu(false);

    const targetRoute = nextType === "employer" ? ROUTES.employer.dashboard : ROUTES.worker.dashboard;
    navigate(targetRoute);
  };

  const displayName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User" : "User";
  const accountLabel = user?.role === "admin" ? "Admin" : user?.accountType === "employer" ? "Employer" : "Worker";
  const headerMoreNavigation = isWorkerView
    ? workerMoreNavigation
    : notificationAudience === "employer"
    ? [
        { label: "Jobs management", path: ROUTES.employer.jobs },
        { label: "Applications", path: ROUTES.employer.applications },
        { label: "E-Wallet", path: ROUTES.employer.eWallet },
        { label: "Support", path: ROUTES.employer.support },
        { label: "Settings", path: ROUTES.employer.settings },
      ]
    : [];

  const isWorkerNavigationActive = (target: string) => {
    if (target === ROUTES.worker.findJobs) {
      return (
        startsWithPath(path, ROUTES.worker.findJobs) ||
        startsWithPath(path, ROUTES.worker.jobDetailsPattern.replace("/:jobId", ""))
      );
    }
    if (target === ROUTES.worker.settings) {
      return matchesPath(path, ROUTES.worker.settings) || matchesPath(path, ROUTES.settings) || matchesPath(path, ROUTES.legacyDashboard.settings);
    }
    return startsWithPath(path, target);
  };

  const isHeaderMoreActive = headerMoreNavigation.some((item) => isWorkerNavigationActive(item.path));

  return (
    <header className={webUi.navbar.root}>
      <div className={`${webUi.navbar.container} ${pageMeta.homeContext ? "!h-20 !min-h-20" : ""}`}>
        <div className={`flex min-w-0 items-center gap-2 ${isWorkerView ? "lg:gap-7" : ""}`}>
          <button
            type="button"
            onClick={onOpenNavigation}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
            aria-label="Open navigation menu"
            aria-controls="mobile-dashboard-navigation"
            aria-expanded={isNavigationOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          {isWorkerView && (
            <button
              type="button"
              onClick={() => navigate(ROUTES.worker.dashboard)}
              className="hidden min-h-11 shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 lg:flex"
              aria-label="MicroJobs worker dashboard"
            >
              <MicroJobsLogo />
            </button>
          )}
          {isWorkerView && (
            <nav className="hidden min-w-0 items-stretch gap-1 lg:flex" aria-label="Worker primary navigation">
              {workerPrimaryNavigation.map((item) => {
                const active = isWorkerNavigationActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`relative min-h-16 whitespace-nowrap px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1C4D8D] ${active ? "text-[#1C4D8D]" : "text-slate-600 hover:text-slate-950"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#1C4D8D]" aria-hidden="true" />}
                  </button>
                );
              })}
            </nav>
          )}
          {pageMeta.title && (
            <div className="flex min-w-0 items-center gap-3">
              <MicroJobsLogo markOnly className="shrink-0 lg:hidden" />
              {pageMeta.icon && (
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E8F2F8]">
                  {pageMeta.icon}
                </span>
              )}
              <div className={`min-w-0 leading-tight ${isWorkerView ? "lg:hidden" : ""}`}>
                <h1 className={webUi.navbar.title}>{pageMeta.title}</h1>
                {pageMeta.subtitle && pageMeta.subtitleAction ? (
                  <button
                    type="button"
                    onClick={() => navigate(pageMeta.subtitleAction!)}
                    className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-[#EAF1FB] px-3 text-left text-xs font-bold text-[#0F2954] transition hover:bg-[#DCE6F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                    aria-label={`${pageMeta.subtitle}. Open Philippine location settings`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1C4D8D]" aria-hidden />
                    <span className="truncate">{pageMeta.subtitle}</span>
                    <span className="shrink-0 text-[#1C4D8D]" aria-hidden>›</span>
                  </button>
                ) : pageMeta.subtitle ? <p className={webUi.navbar.subtitle}>{pageMeta.subtitle}</p> : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {headerMoreNavigation.length > 0 && (
            <div className="relative hidden sm:block" ref={moreMenuRef}>
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => {
                  setShowMoreMenu((current) => !current);
                  setShowNotifications(false);
                  setShowUserMenu(false);
                }}
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] xl:px-3 ${isHeaderMoreActive ? "border-[#B8CBE5] bg-[#EAF2FC] text-[#1C4D8D]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                aria-label="Open more navigation"
                aria-expanded={showMoreMenu}
                aria-haspopup="menu"
              >
                <Ellipsis className="h-5 w-5" aria-hidden="true" />
                <span className="hidden xl:inline">More</span>
                <ChevronDown className={`hidden h-4 w-4 transition-transform xl:block ${showMoreMenu ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {showMoreMenu && (
                <div role="menu" aria-label="More navigation" className={`absolute right-0 mt-2 w-64 overflow-hidden ${webUi.navbar.popover}`}>
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">Quick links</p>
                    <p className="mt-0.5 text-xs text-slate-500">Open another part of your workspace.</p>
                  </div>
                  <div className="p-2">
                    {headerMoreNavigation.map((item) => {
                      const active = isWorkerNavigationActive(item.path);
                      return (
                        <button
                          key={item.path}
                          type="button"
                          role="menuitem"
                          onClick={() => navigate(item.path)}
                          className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1C4D8D] ${active ? "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {pageMeta.search && !isWorkerView && (
            <div className="relative hidden h-10 w-[min(26vw,22rem)] min-w-0 md:block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={pageMeta.search.placeholder}
                aria-label={pageMeta.search.placeholder}
                className={webUi.navbar.searchInput}
              />
            </div>
          )}
          {pageMeta.action && (
            <button
              type="button"
              data-testid="header-context-action"
              onClick={() => navigate(pageMeta.action!.to)}
              className="hidden min-h-10 items-center gap-2 rounded-xl bg-[#1C4D8D] px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 sm:inline-flex"
            >
              {pageMeta.action.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <div className="relative" ref={notificationsRef}>
            <button
              ref={notificationButtonRef}
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
                setShowMoreMenu(false);
              }}
              className={`${webUi.navbar.iconButton} border-slate-200 bg-white shadow-sm`}
              title="Notifications"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={showNotifications}
              aria-haspopup="menu"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div role="menu" aria-label="Notifications" className={`fixed left-4 right-4 top-[4.5rem] z-50 max-h-[calc(100dvh-5rem)] overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px] ${webUi.navbar.popover}`}>
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h3 className="font-semibold text-[16px] text-[#111827]">
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="min-h-9 rounded-lg px-2 text-xs font-bold text-[#1C4D8D] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="p-6 text-center text-[14px] text-[#6B7280]">
                      Loading notifications...
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        className={`block min-h-11 w-full border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1C4D8D] ${
                          !notification.read ? "bg-[#1C4D8D]/[0.06]" : ""
                        }`}
                        onClick={async () => {
                          await markAsRead(notification);
                          navigate(notification.link || ROUTES.notifications);
                          setShowNotifications(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-[14px] text-[#111827]">
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-[#1C4D8D]"></div>
                              )}
                            </div>
                            <p className="text-[13px] text-[#6B7280] mb-1">{notification.message}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{notification.time}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Bell className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                      <p className="text-[14px] text-[#6B7280]">No notifications</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              ref={accountButtonRef}
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
                setShowMoreMenu(false);
              }}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 text-left transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] sm:pr-2"
              aria-label="Open account menu"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <span className="text-sm font-bold text-[#1C4D8D]">
                  {user?.firstName?.[0] ?? "U"}
                  {user?.lastName?.[0] ?? "S"}
                </span>
              </div>
              <span className="hidden max-w-32 min-w-0 lg:block">
                <span className="block truncate text-sm font-bold text-slate-900">{displayName}</span>
                <span className="block text-xs text-slate-500">{accountLabel}</span>
              </span>
              <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition-transform lg:block ${showUserMenu ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {showUserMenu && (
              <div role="menu" aria-label="Account" className={`fixed left-4 right-4 top-[4.5rem] z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[300px] ${webUi.navbar.popover}`}>
                <div className="border-b border-slate-200 p-4">
                  <p className="text-lg font-bold text-slate-950">{displayName}</p>
                  <p className="text-sm text-slate-500">{accountLabel} account</p>
                </div>

                {canSwitchAccount && (
                  <div className="p-4 border-b border-[#E5E7EB]">
                    <button
                      onClick={() => handleSwitchTo(user?.accountType === "worker" ? "employer" : "worker")}
                      className="min-h-11 w-full rounded-xl bg-[#1C4D8D] px-4 py-3 text-sm font-bold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                    >
                      Switch to {user?.accountType === "worker" ? "Employer" : "Worker"}
                    </button>
                  </div>
                )}

                {isWorkerView && (
                  <div className="border-b border-slate-200 p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        navigate(ROUTES.worker.profile);
                        setShowUserMenu(false);
                      }}
                      className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1C4D8D]"
                    >
                      View profile
                    </button>
                  </div>
                )}

                {user?.id ? (
                  <div className="border-b border-slate-200 p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        navigate(`${ROUTES.publicProfile(user.id)}?viewAs=${isWorkerView ? "worker" : "employer"}`);
                        setShowUserMenu(false);
                      }}
                      className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1C4D8D]"
                    >
                      Ratings &amp; reviews
                    </button>
                  </div>
                ) : null}

                <div className="p-4">
                  <button onClick={handleSignOut} className="min-h-11 w-full rounded-xl px-3 text-left font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
