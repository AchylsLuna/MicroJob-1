import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  CircleHelp,
  ClipboardList,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Settings as SettingsIcon,
  Star,
  Wallet,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { jobsAPI } from "../services/jobs";
import { ROUTES, matchesPath, startsWithPath } from "../utils/routes";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { webUi } from "../styles/webUi";

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  balance?: string;
  messageCount?: number;
  userRole?: "hire" | "work" | "both" | "admin" | "superadmin";
}

type RoleType = "work" | "hire" | "both" | "admin" | "superadmin";

type MenuItem = {
  icon: string;
  label: string;
  path: string;
  notification?: boolean;
};

const Sidebar: React.FC<SidebarProps> = ({
  userName = "Jonas Enriquez",
  userEmail = "joserizal@gmail.com",
  balance = "$67.67",
  messageCount = 2,
  userRole = "work",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
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

  const userRoleFromAuth = (authUser?.role || userRole) as RoleType;
  const effectiveRole: RoleType =
    userRoleFromAuth === "admin" || userRoleFromAuth === "superadmin"
      ? userRoleFromAuth
      : authUser?.accountType === "employer" || userRoleFromAuth === "hire"
      ? "hire"
      : "work";

  const workerMenuItems: MenuItem[] = [
    { icon: "find-jobs", label: "Apply Jobs", path: ROUTES.worker.findJobs },
    { icon: "applied-jobs", label: "Applied Jobs", path: ROUTES.worker.appliedJobs },
  ];

  const employerMenuItems: MenuItem[] = [
    { icon: "post-job", label: "Post a Job", path: ROUTES.employer.postJob },
    { icon: "job-posts", label: "My Job Posts", path: ROUTES.employer.jobPosts },
    { icon: "applications", label: "Applications", path: ROUTES.employer.applications },
  ];

  const commonMenuItems: MenuItem[] = [
    { icon: "messages", label: "Messages", path: ROUTES.worker.messages, notification: true },
    { icon: "e-wallet", label: "E-Wallet", path: ROUTES.worker.eWallet },
  ];

  let menuItems: MenuItem[] = [];
  if (effectiveRole === "work") {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  } else if (effectiveRole === "hire") {
    menuItems = [...employerMenuItems, ...commonMenuItems];
  } else if (effectiveRole === "admin" || effectiveRole === "superadmin") {
    menuItems = [...workerMenuItems, ...employerMenuItems, ...commonMenuItems];
  } else {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  }

  const bottomMenuItems: MenuItem[] = [
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
    messages: <MessageSquare className="h-5 w-5" />,
    "e-wallet": <Wallet className="h-5 w-5" />,
    notifications: <Bell className="h-5 w-5" />,
    settings: <SettingsIcon className="h-5 w-5" />,
    support: <CircleHelp className="h-5 w-5" />,
    logout: <LogOut className="h-5 w-5" />,
  };

  const [notifCount, setNotifCount] = useState<number>(0);

  const loadNotifCount = async () => {
    try {
      if (effectiveRole === "hire") {
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
    if (path === ROUTES.notifications) {
      return matchesPath(location.pathname, ROUTES.notifications) || matchesPath(location.pathname, ROUTES.worker.notifications);
    }
    if (path === ROUTES.support) {
      return matchesPath(location.pathname, ROUTES.support) || matchesPath(location.pathname, ROUTES.worker.support);
    }
    return startsWithPath(location.pathname, path);
  };

  const dashboardPath =
    effectiveRole === "admin" || effectiveRole === "superadmin"
      ? ROUTES.admin.dashboard
      : effectiveRole === "hire"
      ? ROUTES.employer.dashboard
      : ROUTES.worker.dashboard;

  const roleLabel =
    effectiveRole === "hire"
      ? "Employer"
      : effectiveRole === "admin" || effectiveRole === "superadmin"
      ? "Admin"
      : "Worker";

  const getNavButtonClass = (active: boolean) =>
    `${webUi.sidebar.navButton} ${
      isCollapsed ? "justify-center px-2 py-3" : "justify-start px-4 py-3"
    } ${
      active ? webUi.sidebar.navButtonActive : webUi.sidebar.navButtonIdle
    }`;

  return (
    <aside
      className={`${webUi.sidebar.root} flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-[92px]" : "w-[264px]"
      }`}
      style={{ padding: isCollapsed ? "14px 12px" : "20px 16px" }}
    >
      <div className="mb-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(ROUTES.home)}
          className={`min-w-0 flex-1 rounded-xl transition hover:opacity-90 ${
            isCollapsed ? "flex items-center justify-center p-1.5" : "p-1"
          }`}
          aria-label="Go to homepage"
        >
          <MicroJobsLogo
            className={`w-full ${
              isCollapsed
                ? "justify-center [&>span]:hidden"
                : "justify-start [&>span]:text-[22px] [&>span]:md:text-[22px]"
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="space-y-1 flex-1 flex flex-col">
        <div className={`space-y-1 pb-4 border-b ${webUi.sidebar.sectionDivider}`}>
          {!isCollapsed && (
            <div className="mb-3">
              <div className="w-full flex items-center gap-3 rounded-xl border border-[#D6E7FF] bg-[#EAF4FF] px-4 py-3 font-semibold text-[#1D4ED8]">
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

          <button
            onClick={() => {
              setShowLogoutConfirm(true);
            }}
            className={`w-full flex items-center gap-3 rounded-xl py-3 font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2] ${
              isCollapsed ? "justify-center px-2" : "justify-start px-4"
            }`}
            title={isCollapsed ? "Logout" : ""}
          >
            {renderIcon("logout")}
            {!isCollapsed && <span>Logout</span>}
          </button>

          {showLogoutConfirm && !isCollapsed && (
            <div className="mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3">
              <p className="mb-3 text-sm font-semibold text-[#991B1B]">Confirm logout?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_user");
                    localStorage.removeItem("auth_token");
                    window.dispatchEvent(new Event("auth_user_updated"));
                    setShowLogoutConfirm(false);
                    navigate(ROUTES.signInLegacy, { replace: true });
                  }}
                  className="flex-1 rounded-lg bg-[#DC2626] py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C]"
                >
                  Logout
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-lg border border-[#FCA5A5] bg-white py-2 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className={`border-t pt-5 ${webUi.sidebar.sectionDivider}`}>
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
                <p className="text-[#64748B] text-xs">Welcome back</p>
                <p className="font-bold text-[#0F172A] text-sm">{userName}</p>
              </div>
            )}
          </div>
          {!isCollapsed && <span className="text-[#94A3B8]">›</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
