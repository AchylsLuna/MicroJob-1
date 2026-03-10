import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { jobsAPI } from "../services/jobs";
import { ROUTES, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";
import { MicroJobsLogo } from "./MicroJobsLogo";

interface SidebarProps {
  userName?: string;
  userRole?: "user" | "employer" | "admin" | "doctor";
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
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [, setAuthUpdateTrigger] = useState(0); // Force re-render on auth updates
  const { user: authUser } = useAuth();

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
      console.log("Sidebar - Auth update detected, forcing re-render");
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
      { icon: "job-posts", label: "My Job Posts", path: ROUTES.employer.jobPosts },
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
          { icon: "support", label: "Support", path: ROUTES.support },
        ];

  const iconMap: Record<string, React.ReactNode> = {
    dashboard: <Star className="h-5 w-5" />,
    "find-jobs": <Search className="h-5 w-5" />,
    "applied-jobs": <Mail className="h-5 w-5" />,
    "post-job": <Plus className="h-5 w-5" />,
    "job-posts": <Briefcase className="h-5 w-5" />,
    applications: <ClipboardList className="h-5 w-5" />,
    analytics: <BarChart3 className="h-5 w-5" />,
    reports: <FileText className="h-5 w-5" />,
    "jobs-monitoring": <Briefcase className="h-5 w-5" />,
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

  const loadNotifCount = async () => {
    try {
      if (effectiveRole === "admin") {
        setNotifCount(0);
        return;
      }

      if (effectiveRole === "employer") {
        const res = await jobsAPI.getEmployerApplications();
        const apps = res.data || [];
        const unread = apps.filter((a: any) => !a.employerReadAt).length;
        setNotifCount(unread);
      } else {
        const res = await jobsAPI.getUserApplications();
        const apps = res.data || [];
        const allowed = new Set(["Shortlisted", "Terms", "Hired"]);
        const unread = apps.filter((a: any) => allowed.has(a.status) && !a.applicantReadAt).length;
        setNotifCount(unread);
      }
    } catch {
      // ignore notification count errors
    }
  };

  useEffect(() => {
    loadNotifCount();
    const handler = () => loadNotifCount();
    window.addEventListener("auth_user_updated", handler);
    return () => window.removeEventListener("auth_user_updated", handler);
  }, [effectiveRole]);

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
    `w-full flex items-center rounded-lg transition pl-14 pr-4 py-2.5 text-sm ${
      active ? "text-blue-600 bg-blue-50 font-semibold" : "text-gray-600 hover:bg-gray-100 font-medium"
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
      className={`${webUi.sidebar.root} transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
      style={{ padding: isCollapsed ? "12px" : "24px" }}
    >
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer min-w-0"
          onClick={() => navigate(ROUTES.home)}
        >
          <MicroJobsLogo className={isCollapsed ? "[&>span]:hidden" : ""} />
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-600 hover:text-gray-900 transition text-lg"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="space-y-1 flex-1 flex flex-col">
        <div className={`space-y-1 pb-4 border-b ${webUi.sidebar.sectionDivider}`}>
          {!isCollapsed && (
            <div className="mb-3">
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-50 text-sky-700 font-semibold border border-sky-100">
                <span>{roleLabel}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate(dashboardPath)}
            className={getNavButtonClass(isPathActive(dashboardPath))}
            title={isCollapsed ? "Dashboard" : ""}
          >
            {renderIcon("dashboard")}
            {!isCollapsed && <span>Dashboard</span>}
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

                {!isCollapsed && (
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

              {!isCollapsed && isEmployerGroupOpen && (
                <div className="mt-1 space-y-1">
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
              {!isCollapsed && <span>{item.label}</span>}
              {item.notification &&
                (item.path === ROUTES.notifications ? (
                  <span
                    className={`ml-auto inline-flex items-center justify-center text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5 ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  >
                    {notifCount > 0 ? notifCount : ""}
                  </span>
                ) : (
                  <span
                    className={`w-2 h-2 bg-blue-600 rounded-full ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  ></span>
                ))}
            </button>
          ))}
        </div>

        <div className={`space-y-1 py-4 border-b ${webUi.sidebar.sectionDivider}`}>
          {bottomMenuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={getNavButtonClass(isPathActive(item.path))}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {!isCollapsed && <span>{item.label}</span>}
              {item.notification &&
                (item.path === ROUTES.notifications ? (
                  <span
                    className={`ml-auto inline-flex items-center justify-center text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5 ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  >
                    {notifCount > 0 ? notifCount : ""}
                  </span>
                ) : (
                  <span
                    className={`w-2 h-2 bg-blue-600 rounded-full ${
                      isCollapsed ? "absolute right-2 top-2" : ""
                    }`}
                  ></span>
                ))}
            </button>
          ))}
        </div>
      </nav>

      <div className={`border-t ${webUi.sidebar.sectionDivider} pt-6`}>
        <button className="w-full flex items-center justify-between lg:justify-start gap-3 hover:opacity-80 transition">
          <div className="flex items-center gap-3">
            {profilePhotoPreview ? (
              <img
                src={profilePhotoPreview}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                👨
              </div>
            )}
            {!isCollapsed && (
              <div className="text-left">
                <p className="text-gray-600 text-xs">Welcome back 👋</p>
                <p className="font-bold text-gray-900 text-sm">{displayUserName}</p>
              </div>
            )}
          </div>
          {!isCollapsed && <span className="text-gray-400">›</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
