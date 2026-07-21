import { useState, useRef, useEffect, type ReactNode } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { toast } from "../lib/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { jobsAPI } from "../services/jobs";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { mapNotificationRecord, type FeedNotification } from "../utils/notificationFeed";
import { ROUTES, matchesAnyPath, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";

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
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const path = location.pathname;

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

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);
    try {
      const data = await getNotifications({ limit: 10 }).catch(() => [] as any[]);
      const nextNotifications = (Array.isArray(data) ? data : [])
        .map((item: any) => mapNotificationRecord(item, notificationAudience, "relative"))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotifications(nextNotifications);
    } catch {
      // avoid noisy toast when user is not authenticated
    } finally {
      setNotificationsLoading(false);
    }
  };

  type PageMeta =
    | { title: string; subtitle?: string; icon?: ReactNode; search?: undefined }
    | { title: string; subtitle?: string; icon?: ReactNode; search: { placeholder: string; mode: "query" } };

  const pageMeta: PageMeta = (() => {
    if (isPath(ROUTES.worker.dashboard, ROUTES.legacyDashboard.root)) {
      return { title: "Dashboard" };
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
        title: "Employer Dashboard",
        subtitle: "Monitor your hiring pipeline and recent activity.",
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
    loadNotifications();
  }, [user, isEmployerView]);

  // Reload notifications when location changes (e.g., user marks notifications as read on a different page)
  useEffect(() => {
    loadNotifications();
  }, [location.pathname]);

  // Listen for custom notification refresh events from notification pages
  useEffect(() => {
    const handleNotificationRefresh = () => {
      loadNotifications();
    };
    window.addEventListener('notification-refresh', handleNotificationRefresh);
    return () => {
      window.removeEventListener('notification-refresh', handleNotificationRefresh);
    };
  }, []);

  useEffect(() => {
    if (!showNotifications && !showUserMenu) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showNotifications, showUserMenu]);

  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notification: FeedNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(notification.id);
      window.dispatchEvent(new Event("notification-refresh"));
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark notification.");
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
      window.dispatchEvent(new Event("notification-refresh"));
      toast.success("All notifications marked as read");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark all as read.");
    }
  };

  const handleSignOut = () => {
    logout();
    setShowUserMenu(false);
    setShowNotifications(false);
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

  return (
    <div className={webUi.navbar.root}>
      <div className={webUi.navbar.container}>
        <div className="flex min-w-0 items-center gap-2">
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
          {pageMeta.title && (
            <div className="flex items-center gap-3">
              {pageMeta.icon && (
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E8F2F8]">
                  {pageMeta.icon}
                </span>
              )}
              <div className="min-w-0">
                <h1 className={webUi.navbar.title}>{pageMeta.title}</h1>
                {pageMeta.subtitle && <p className={webUi.navbar.subtitle}>{pageMeta.subtitle}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="hidden min-w-0 items-center justify-center sm:flex">
          {pageMeta.search && (
            <div className="relative h-10 w-full max-w-[460px] min-w-0">
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
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3">
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className={webUi.navbar.iconButton}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={showNotifications}
              aria-haspopup="menu"
            >
              <Bell className="w-5 h-5 text-[#6B7280]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div role="menu" aria-label="Notifications" className={`fixed left-4 right-4 top-16 max-h-[calc(100dvh-5rem)] overflow-hidden z-50 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px] ${webUi.navbar.popover}`}>
                <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
                  <h3 className="font-semibold text-[16px] text-[#111827]">
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[12px] text-[#4F46E5] hover:text-[#4338CA] font-medium"
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
                        className={`block w-full p-4 text-left border-b border-[#E5E7EB] last:border-b-0 hover:bg-gray-50 transition-colors ${
                          !notification.read ? "bg-[#EEF2FF]" : ""
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
                                <div className="w-2 h-2 rounded-full bg-[#4F46E5]"></div>
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
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="hover:opacity-80 transition-opacity"
              aria-label="Open account menu"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div className="w-10 h-10 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                <span className="text-[#3B82F6] font-semibold text-[16px]">
                  {user?.firstName?.[0] ?? "U"}
                  {user?.lastName?.[0] ?? "S"}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <div role="menu" aria-label="Account" className={`fixed left-4 right-4 top-16 overflow-hidden z-50 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[300px] ${webUi.navbar.popover}`}>
                <div className="p-4 border-b border-[#E5E7EB]">
                  <p className="text-[18px] font-semibold text-[#111827]">
                    {user ? `${user.firstName} ${user.lastName}` : "User"}
                  </p>
                  <p className="text-[14px] text-[#6B7280]">
                    {user?.role === "admin"
                      ? "Admin Account"
                      : user?.accountType === "employer"
                      ? "Employer Account"
                      : "Worker Account"}
                  </p>
                </div>

                {canSwitchAccount && (
                  <div className="p-4 border-b border-[#E5E7EB]">
                    <button
                      onClick={() => handleSwitchTo(user?.accountType === "worker" ? "employer" : "worker")}
                      className="w-full rounded-[12px] text-[15px] font-semibold py-3 bg-[#1EC19A] text-white hover:bg-[#18a882] transition-colors"
                    >
                      Switch to {user?.accountType === "worker" ? "Employer" : "Worker"}
                    </button>
                  </div>
                )}

                <div className="p-4">
                  <button onClick={handleSignOut} className="w-full text-left text-[#EF4444] font-semibold">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
