import { useState, useRef, useEffect, type ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { toast } from "../lib/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { ROUTES, matchesAnyPath, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

const formatTimeLabel = (value?: string) => {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
};

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, user, switchAccountType } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  
  const hasBothOptions =
    Array.isArray(user?.accountOptions) &&
    user.accountOptions.includes("worker") &&
    user.accountOptions.includes("employer");
  const isBothRole =
    !!user &&
    user.role !== "admin" &&
    (user.role === "both" || (user as any)?.accountPreference === "both" || hasBothOptions);
  const canSwitchAccount = isBothRole;

  // Log for debugging
  useEffect(() => {
    console.log("NavBar - User:", user);
    console.log("NavBar - hasBothOptions:", hasBothOptions);
    console.log("NavBar - isBothRole:", isBothRole);
    console.log("NavBar - canSwitchAccount:", canSwitchAccount);
  }, [user, hasBothOptions, isBothRole, canSwitchAccount]);

  // Log when menu opens
  useEffect(() => {
    if (showUserMenu) {
      console.log("NavBar - User menu opened, canSwitchAccount:", canSwitchAccount);
      console.log("NavBar - User object:", user);
    }
  }, [showUserMenu, canSwitchAccount, user]);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const path = location.pathname;

  const isPath = (...targets: string[]) => matchesAnyPath(path, targets);
  const isExactPath = (...targets: string[]) => targets.some((target) => matchesPath(path, target));

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const data = await getNotifications({ limit: 10 });
      const mapped = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: item._id || item.id,
        title: item.title || "Notification",
        message: item.message || "",
        time: formatTimeLabel(item.createdAt),
        read: Boolean(item.readAt),
        link: item.link || undefined,
      })) as Notification[];
      setNotifications(mapped);
    } catch {
      // avoid noisy toast when user is not authenticated
    } finally {
      setNotificationsLoading(false);
    }
  };

  type PageMeta =
    | { title: string; subtitle?: string; icon?: ReactNode; search?: undefined }
    | {
        title: string;
        subtitle?: string;
        icon?: ReactNode;
        search: { placeholder: string; mode: "query" };
      }
    | {
        title: string;
        subtitle?: string;
        icon?: ReactNode;
        search: { placeholder: string; mode: "redirect"; redirectTo: string };
      };

  const pageMeta: PageMeta = (() => {
    if (isPath(ROUTES.worker.dashboard, ROUTES.legacyDashboard.root)) {
      return {
        title: "Dashboard",
        search: {
          placeholder: "Search by skills, name, or expertise...",
          mode: "redirect" as const,
          redirectTo: ROUTES.worker.findJobs,
        },
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
        search: { placeholder: "Search applications...", mode: "query" as const },
      };
    }

    if (isPath(ROUTES.worker.messages, ROUTES.legacyDashboard.messages, ROUTES.legacyShortcuts.messages)) {
      return { title: "Messages" };
    }

    if (isPath(ROUTES.worker.support, ROUTES.legacyDashboard.support, ROUTES.support)) {
      return { title: "Support", search: { placeholder: "Search help...", mode: "query" as const } };
    }

    if (isPath(ROUTES.worker.savedJobs, ROUTES.legacyDashboard.savedJobs, ROUTES.legacyShortcuts.savedJobs)) {
      return {
        title: "Saved Jobs",
        search: { placeholder: "Search saved jobs...", mode: "query" as const },
      };
    }

    if (isPath(ROUTES.worker.eWallet, ROUTES.legacyDashboard.eWallet, ROUTES.legacyShortcuts.eWallet)) {
      return { title: "E-Wallet" };
    }

    if (isPath(ROUTES.worker.notifications, ROUTES.legacyDashboard.notifications, ROUTES.notifications)) {
      return { title: "Notifications" };
    }

    if (isPath(ROUTES.settings, ROUTES.legacyDashboard.settings)) {
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
        title: "Overview",
        subtitle: "Manage your job postings and candidate applications",
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
        search: { placeholder: "Search applications...", mode: "query" as const },
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
      return { title: "Post a Job" };
    }

    if (
      isPath(
        ROUTES.doctor.jobPosts,
        ROUTES.legacyDashboard.doctor.jobPosts,
        ROUTES.employer.jobPosts,
        ROUTES.legacyDashboard.employer.jobPosts,
      )
    ) {
      return {
        title: "My Job Posts",
        subtitle: "Manage the jobs you have posted.",
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

  const searchValue =
    pageMeta.search?.mode === "query" ? searchParams.get("q") ?? "" : dashboardSearch;

  const handleSearchChange = (value: string) => {
    if (pageMeta.search?.mode === "query") {
      setSearchParams(value ? { q: value } : {});
    } else {
      setDashboardSearch(value);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (pageMeta.search?.mode === "redirect") {
      const trimmed = dashboardSearch.trim();
      navigate(
        trimmed
          ? `${pageMeta.search.redirectTo}?q=${encodeURIComponent(trimmed)}`
          : pageMeta.search.redirectTo,
      );
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

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

  const markAsRead = async (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark notification.");
    }
  };

  const markAllAsRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
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
    console.log("NavBar - handleSwitchTo called with nextType:", nextType);
    console.log("NavBar - Current user.accountType:", user?.accountType);
    
    if (!user || user.accountType === nextType) {
      console.log("NavBar - Switch aborted: user missing or already on this type");
      return;
    }
    
    console.log("NavBar - Calling switchAccountType...");
    switchAccountType(nextType);
    setShowUserMenu(false);
    
    const targetRoute = nextType === "employer" ? ROUTES.employer.dashboard : ROUTES.worker.dashboard;
    console.log("NavBar - Navigating to:", targetRoute);
    navigate(targetRoute);
  };

  return (
    <div className={webUi.navbar.root}>
      <div className={webUi.navbar.container}>
        <div className="min-w-0 shrink-0">
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

        <div className="flex-1 flex items-center justify-center">
          {pageMeta.search && (
            <div className="relative w-full max-w-[460px] min-w-[220px] h-10">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={pageMeta.search.placeholder}
                className={webUi.navbar.searchInput}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 shrink-0">
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className={webUi.navbar.iconButton}
            >
              <Bell className="w-5 h-5 text-[#6B7280]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className={`absolute right-0 mt-2 w-[380px] overflow-hidden z-50 ${webUi.navbar.popover}`}>
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
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-[#E5E7EB] last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer ${
                          !notification.read ? "bg-[#EEF2FF]" : ""
                        }`}
                        onClick={async () => {
                          await markAsRead(notification.id);
                          if (notification.link) {
                            navigate(notification.link);
                          } else {
                            navigate(ROUTES.notifications);
                          }
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
                      </div>
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
              onClick={() => {
                console.log("NavBar - Profile button clicked. Current canSwitchAccount:", canSwitchAccount);
                console.log("NavBar - Current user:", user);
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                <span className="text-[#3B82F6] font-semibold text-[16px]">
                  {user?.firstName?.[0] ?? "U"}
                  {user?.lastName?.[0] ?? "S"}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <div className={`absolute right-0 mt-2 w-[300px] overflow-hidden z-50 ${webUi.navbar.popover}`}>
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
