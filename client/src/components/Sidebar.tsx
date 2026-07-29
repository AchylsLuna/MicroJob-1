import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Briefcase,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getNotifications } from "../services/api";
import { ROUTES, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";
import { MicroJobsLogo } from "./MicroJobsLogo";

interface SidebarProps {
  userName?: string;
  userRole?: "user" | "employer" | "admin" | "doctor";
  mobile?: boolean;
  onClose?: () => void;
}

type RoleType = "user" | "employer" | "admin";

type MenuItem = {
  icon: string;
  label: string;
  path: string;
  notification?: boolean;
};

type EmployerMenuGroup = {
  icon: string;
  label: string;
  path: string;
  children: MenuItem[];
};

const Sidebar: React.FC<SidebarProps> = ({
  userName = "User",
  userRole = "user",
  mobile = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCollapsed = false;
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [, setAuthUpdateTrigger] = useState(0); // Force re-render on auth updates
  const { user: authUser } = useAuth();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mobile) closeButtonRef.current?.focus();
  }, [mobile]);

  const loadProfilePhoto = () => {
    try {
      const storedRaw = localStorage.getItem("profile_settings");
      const stored = storedRaw ? JSON.parse(storedRaw) : {};
      const preview = stored.personal?.profilePhotoPreview || "";
      setProfilePhotoPreview(preview);
    } catch {
      setProfilePhotoPreview("");
    }
  };

  useEffect(() => {
    loadProfilePhoto();
    const handleProfileUpdate = () => loadProfilePhoto();
    window.addEventListener("profile_settings_updated", handleProfileUpdate);
    return () => window.removeEventListener("profile_settings_updated", handleProfileUpdate);
  }, []);

  // Listen for auth updates to force sidebar re-render on role switch
  useEffect(() => {
    const handleAuthUpdate = () => {
      setAuthUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener("auth_user_updated", handleAuthUpdate);
    return () => window.removeEventListener("auth_user_updated", handleAuthUpdate);
  }, []);

  const userRoleFromAuth = String(authUser?.role || userRole || "user").toLowerCase();
  const effectiveRole: RoleType =
    userRoleFromAuth === "admin"
      ? "admin"
      : authUser?.accountType === "employer" ||
        userRoleFromAuth === "employer" ||
        userRoleFromAuth === "doctor"
      ? "employer"
      : "user";

  const workerMenuItems: MenuItem[] = [
    { icon: "find-jobs", label: "Find Jobs", path: ROUTES.worker.findJobs },
    { icon: "applied-jobs", label: "Applied Jobs", path: ROUTES.worker.appliedJobs },
  ];

  const employerMenuGroup: EmployerMenuGroup = {
    icon: "post-job",
    label: "Post a Job",
    path: ROUTES.employer.postJob,
    children: [
        { icon: "jobs-management", label: "Jobs Management", path: ROUTES.employer.jobs },
      { icon: "applications", label: "Applications", path: ROUTES.employer.applications },
    ],
  };

  const commonMenuItems: MenuItem[] =
    effectiveRole === "employer"
      ? [
          { icon: "messages", label: "Messages", path: ROUTES.employer.messages, notification: true },
          { icon: "e-wallet", label: "E-Wallet", path: ROUTES.employer.eWallet },
        ]
      : [
          { icon: "messages", label: "Messages", path: ROUTES.worker.messages, notification: true },
          { icon: "e-wallet", label: "E-Wallet", path: ROUTES.worker.eWallet },
        ];

  const adminMenuItems: MenuItem[] = [
    { icon: "analytics", label: "Analytics", path: ROUTES.admin.analytics },
    { icon: "reports", label: "Reports", path: ROUTES.admin.reports },
    { icon: "support", label: "Support", path: ROUTES.admin.support },
    { icon: "e-wallet", label: "E-Wallet", path: ROUTES.admin.eWallet },
    { icon: "jobs-monitoring", label: "Job Monitoring", path: ROUTES.admin.jobs },
    { icon: "security", label: "Security", path: ROUTES.admin.security },
    { icon: "user-management", label: "User Management", path: ROUTES.admin.userManagement },
    { icon: "messages", label: "Messages", path: ROUTES.admin.messages, notification: true },
  ];

  let menuItems: MenuItem[] = [];
  if (effectiveRole === "user") {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  } else if (effectiveRole === "employer") {
    menuItems = [...commonMenuItems];
  } else if (effectiveRole === "admin") {
    menuItems = adminMenuItems;
  } else {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  }

  const bottomMenuItems: MenuItem[] =
    effectiveRole === "admin"
      ? [{ icon: "settings", label: "Settings", path: ROUTES.settings }]
      : effectiveRole === "employer"
      ? [
          { icon: "notifications", label: "Notifications", path: ROUTES.employer.notifications, notification: true },
          { icon: "settings", label: "Settings", path: ROUTES.employer.settings },
          { icon: "support", label: "Support", path: ROUTES.employer.support },
        ]
      : [
          { icon: "notifications", label: "Notifications", path: ROUTES.notifications, notification: true },
          { icon: "settings", label: "Settings", path: ROUTES.settings },
          { icon: "support", label: "Support", path: ROUTES.worker.support },
        ];
  const pinnedSettingsItem = bottomMenuItems.find((item) => item.icon === "settings");
  const workspaceMenuItems = bottomMenuItems.filter((item) => item.icon !== "settings");

  const iconMap: Record<string, React.ReactNode> = {
    dashboard: <Star className="h-5 w-5" />,
    "find-jobs": <Search className="h-5 w-5" />,
    "applied-jobs": <Mail className="h-5 w-5" />,
    "post-job": <Plus className="h-5 w-5" />,
    applications: <ClipboardList className="h-5 w-5" />,
    analytics: <BarChart3 className="h-5 w-5" />,
    reports: <FileText className="h-5 w-5" />,
    payouts: <Wallet className="h-5 w-5" />,
    "jobs-monitoring": <Briefcase className="h-5 w-5" />,
    "jobs-management": <Briefcase className="h-5 w-5" />,
    security: <ShieldCheck className="h-5 w-5" />,
    "user-management": <Users className="h-5 w-5" />,
    messages: <MessageSquare className="h-5 w-5" />,
    "e-wallet": <Wallet className="h-5 w-5" />,
    notifications: <Bell className="h-5 w-5" />,
    settings: <SettingsIcon className="h-5 w-5" />,
    support: <CircleHelp className="h-5 w-5" />,
  };

  const [notifCount, setNotifCount] = useState<number>(0);
  const [isEmployerGroupOpen, setIsEmployerGroupOpen] = useState<boolean>(true);

  const loadNotifCount = useCallback(async () => {
    try {
      if (effectiveRole === "admin") {
        setNotifCount(0);
        return;
      }

      const notifications = await getNotifications({ unread: true, limit: 200 }).catch(() => [] as any[]);
      setNotifCount(Array.isArray(notifications) ? notifications.length : 0);
    } catch {
      // ignore notification count errors
    }
  }, [effectiveRole]);

  useEffect(() => {
    loadNotifCount();
    const handler = () => loadNotifCount();
    window.addEventListener("auth_user_updated", handler);
    window.addEventListener("notification-refresh", handler);
    return () => {
      window.removeEventListener("auth_user_updated", handler);
      window.removeEventListener("notification-refresh", handler);
    };
  }, [effectiveRole, loadNotifCount]);

  const renderIcon = (iconKey: string) => (
    <span aria-hidden="true" className="text-current">
      {iconMap[iconKey] || <Star className="h-5 w-5" />}
    </span>
  );

  const isPathActive = (path: string) => {
    if (path === ROUTES.notifications || path === ROUTES.employer.notifications) {
      return (
        matchesPath(location.pathname, ROUTES.notifications) ||
        matchesPath(location.pathname, ROUTES.worker.notifications) ||
        matchesPath(location.pathname, ROUTES.employer.notifications) ||
        matchesPath(location.pathname, ROUTES.doctor.notifications) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.employer.notifications) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.doctor.notifications)
      );
    }
    if (path === ROUTES.support || path === ROUTES.employer.support) {
      return (
        matchesPath(location.pathname, ROUTES.support) ||
        matchesPath(location.pathname, ROUTES.worker.support) ||
        matchesPath(location.pathname, ROUTES.employer.support) ||
        matchesPath(location.pathname, ROUTES.doctor.support) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.employer.support) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.doctor.support)
      );
    }
    if (path === ROUTES.settings || path === ROUTES.employer.settings) {
      return (
        matchesPath(location.pathname, ROUTES.settings) ||
        matchesPath(location.pathname, ROUTES.employer.settings) ||
        matchesPath(location.pathname, ROUTES.doctor.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.employer.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.doctor.settings)
      );
    }
    return startsWithPath(location.pathname, path);
  };

  const dashboardPath =
    effectiveRole === "admin"
      ? ROUTES.admin.dashboard
      : effectiveRole === "employer"
      ? ROUTES.employer.dashboard
      : ROUTES.worker.dashboard;

  const roleLabel =
    effectiveRole === "employer"
      ? "Employer"
      : effectiveRole === "admin"
      ? "Admin"
      : "Worker";

  const getNavButtonClass = (active: boolean) =>
    `${webUi.sidebar.navButton} ${isCollapsed ? "px-2" : "px-4"} ${
      active ? webUi.sidebar.navButtonActive : webUi.sidebar.navButtonIdle
    }`;

  const getChildNavButtonClass = (active: boolean) =>
    `flex min-h-11 w-full items-center rounded-xl py-2.5 pl-12 pr-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${
      active ? "bg-blue-50 font-semibold text-[#1C4D8D]" : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const isEmployerParentActive =
    effectiveRole === "employer" && matchesPath(location.pathname, employerMenuGroup.path);

  const displayUserName = (() => {
    if (authUser) {
      const fullName = `${authUser.firstName || ""} ${authUser.lastName || ""}`.trim();
      if (fullName) return fullName;
      if (authUser.email) return authUser.email.split("@")[0];
    }
    return userName;
  })();

  return (
    <aside
      id={mobile ? "mobile-dashboard-navigation" : undefined}
      aria-label="Primary navigation"
      className={`${webUi.sidebar.root} w-full p-4 sm:p-5`}
    >
      <div className="dashboard-sidebar-header mb-6 flex shrink-0 items-center justify-between">
        <button
          type="button"
          className="flex min-h-11 min-w-0 items-center gap-2 cursor-pointer"
          onClick={() => navigate(ROUTES.home)}
        >
          <MicroJobsLogo />
        </button>
        {mobile ? (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="dashboard-sidebar-nav min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1" aria-label={`${roleLabel} menu`}>
        <div className="space-y-1.5 pb-3">
          <button
            onClick={() => navigate(dashboardPath)}
            className={getNavButtonClass(isPathActive(dashboardPath))}
            title={isCollapsed ? "Dashboard" : ""}
          >
            {renderIcon("dashboard")}
            {(mobile || !isCollapsed) && <span>Dashboard</span>}
          </button>

          {effectiveRole === "employer" && (
            <div>
              <div className="relative">
                <button
                  onClick={() => navigate(employerMenuGroup.path)}
                  className={`${getNavButtonClass(isEmployerParentActive)} ${!isCollapsed ? "pr-10" : ""}`}
                  title={isCollapsed ? employerMenuGroup.label : ""}
                >
                  {renderIcon(employerMenuGroup.icon)}
                  {!isCollapsed && <span>{employerMenuGroup.label}</span>}
                </button>

                {(mobile || !isCollapsed) && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsEmployerGroupOpen((prev) => !prev);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={isEmployerGroupOpen ? "Collapse Post a Job menu" : "Expand Post a Job menu"}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isEmployerGroupOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>
                )}
              </div>

              {(mobile || !isCollapsed) && isEmployerGroupOpen && (
                <div className="mt-2 space-y-2">
                  {employerMenuGroup.children.map((child) => (
                    <button
                      key={child.path}
                      onClick={() => navigate(child.path)}
                      className={getChildNavButtonClass(isPathActive(child.path))}
                    >
                      <span>{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={getNavButtonClass(isPathActive(item.path))}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {(mobile || !isCollapsed) && <span>{item.label}</span>}
              {item.notification && item.icon === "notifications" && notifCount > 0 && (
                  <span
                    className={`ml-auto inline-flex items-center justify-center text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5 ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  >
                    {notifCount}
                  </span>
                )}
            </button>
          ))}
        </div>

        {workspaceMenuItems.length > 0 && (
          <div className={`space-y-1.5 border-t py-4 ${webUi.sidebar.sectionDivider}`}>
            <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            {workspaceMenuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={getNavButtonClass(isPathActive(item.path))}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {(mobile || !isCollapsed) && <span>{item.label}</span>}
              {item.notification && item.icon === "notifications" && notifCount > 0 && (
                  <span
                    className={`ml-auto inline-flex items-center justify-center text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5 ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  >
                    {notifCount}
                  </span>
                )}
            </button>
            ))}
          </div>
        )}
      </nav>

      <div className="dashboard-sidebar-footer mt-3 shrink-0 space-y-2 border-t border-slate-200 pt-3">
        {pinnedSettingsItem && (
          <button
            type="button"
            onClick={() => navigate(pinnedSettingsItem.path)}
            className={getNavButtonClass(isPathActive(pinnedSettingsItem.path))}
          >
            {renderIcon(pinnedSettingsItem.icon)}
            <span>{pinnedSettingsItem.label}</span>
          </button>
        )}
        <button className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]">
          <div className="flex items-center gap-3">
            {profilePhotoPreview ? (
              <img
                src={profilePhotoPreview}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
                {displayUserName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {(mobile || !isCollapsed) && (
              <div className="text-left">
                <p className="text-xs text-slate-500">Welcome back</p>
                <p className="max-w-[150px] truncate text-sm font-bold text-slate-900">{displayUserName}</p>
              </div>
            )}
          </div>
          {(mobile || !isCollapsed) && <span className="text-slate-400">›</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
