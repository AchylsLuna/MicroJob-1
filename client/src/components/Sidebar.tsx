import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useAdminPermissions } from "../hooks/useAdminPermissions";
import { useNotifications } from "../contexts/NotificationContext";
import type { AdminPermission } from "../lib/adminPermissions";
import { ROUTES, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { workerMoreNavigation, workerPrimaryNavigation } from "./workerNavigation";

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
  /** Admin links only — the RBAC permission required to see this link. */
  permission?: AdminPermission;
};

/** A labeled cluster of admin links, grouped by domain rather than shown as one flat list. */
type MenuGroup = {
  label: string;
  items: MenuItem[];
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
  const [, setAuthUpdateTrigger] = useState(0); // Force re-render on auth updates
  const { user: authUser } = useAuth();
  const { can } = useAdminPermissions();
  const { unreadCount: notifCount } = useNotifications();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mobile) closeButtonRef.current?.focus();
  }, [mobile]);

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
    ...workerPrimaryNavigation
      .filter((item) => item.path !== ROUTES.worker.messages)
      .map((item) => ({
        ...item,
        icon: item.path === ROUTES.worker.findJobs ? "find-jobs" : "applied-jobs",
      })),
    ...workerMoreNavigation
      .filter((item) => item.path === ROUTES.worker.savedJobs)
      .map((item) => ({ ...item, icon: "saved-jobs" })),
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

  // Each link carries the permission that opens its page, so the sidebar and
  // the page gates cannot drift apart. Items without a `permission` (Messages)
  // stay visible to every staff role — as does the Dashboard button rendered
  // separately below, and Settings in `bottomMenuItems`, so no role can end up
  // looking at an empty sidebar.
  //
  // Grouped by domain — the same domains the permission matrix in
  // lib/adminPermissions.ts is itself organized around (marketplace,
  // finance, platform/system, analytics, support) — rather than one flat,
  // unweighted list. A role missing every permission in a group simply
  // never sees that group's header, so the sidebar stays proportional to
  // what that role can actually do instead of always showing all fourteen
  // links at equal visual weight.
  const adminMenuGroupsRaw: MenuGroup[] = [
    {
      label: "Marketplace",
      items: [
        { icon: "user-management", label: "User Management", path: ROUTES.admin.userManagement, permission: "users.view" },
        { icon: "jobs-monitoring", label: "Job Monitoring", path: ROUTES.admin.jobs, permission: "jobs.view" },
        { icon: "verification", label: "ID Verification", path: ROUTES.admin.verificationReview, permission: "verification.review" },
        { icon: "moderation", label: "Moderation Queue", path: ROUTES.admin.moderationQueue, permission: "moderation.review" },
      ],
    },
    {
      label: "Finance",
      items: [
        { icon: "e-wallet", label: "E-Wallet", path: ROUTES.admin.eWallet, permission: "finance.transactions.view" },
        { icon: "payouts", label: "Payout Requests", path: ROUTES.admin.payouts, permission: "finance.payouts.review" },
        { icon: "disputes", label: "Financial Disputes", path: ROUTES.admin.disputes, permission: "finance.disputes.handle" },
      ],
    },
    {
      label: "Platform",
      items: [
        { icon: "staff-management", label: "Staff Management", path: ROUTES.admin.staffManagement, permission: "staff.view" },
        { icon: "audit-logs", label: "Audit Logs", path: ROUTES.admin.auditLogs, permission: "audit.view" },
        { icon: "security", label: "Security", path: ROUTES.admin.security, permission: "audit.view" },
      ],
    },
    {
      label: "Insights",
      items: [
        { icon: "analytics", label: "Analytics", path: ROUTES.admin.analytics, permission: "analytics.view" },
        { icon: "reports", label: "Reports", path: ROUTES.admin.reports, permission: "analytics.view" },
      ],
    },
    {
      label: "Support",
      items: [
        { icon: "support", label: "Support", path: ROUTES.admin.support, permission: "support.tickets.handle" },
      ],
    },
  ];

  // Ungated, like Dashboard — every staff role gets the same admin inbox
  // workers/employers get (WorkerMessages), so it belongs at top level next
  // to Dashboard, not nested inside a domain group it isn't actually part of.
  const adminMessagesItem: MenuItem = {
    icon: "messages",
    label: "Messages",
    path: ROUTES.admin.messages,
    notification: true,
  };
  const adminMenuGroups = adminMenuGroupsRaw
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) }))
    .filter((group) => group.items.length > 0);

  let menuItems: MenuItem[] = [];
  if (effectiveRole === "user") {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  } else if (effectiveRole === "employer") {
    menuItems = [...commonMenuItems];
  } else if (effectiveRole !== "admin") {
    menuItems = [...workerMenuItems, ...commonMenuItems];
  }
  // Admin renders `adminMenuGroups` directly below instead of a flat `menuItems` list.

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
          { icon: "settings", label: "Settings", path: ROUTES.worker.settings },
          { icon: "support", label: "Support", path: ROUTES.worker.support },
        ];
  const pinnedSettingsItem = bottomMenuItems.find((item) => item.icon === "settings");
  const workspaceMenuItems = bottomMenuItems.filter((item) => item.icon !== "settings");

  const [isEmployerGroupOpen, setIsEmployerGroupOpen] = useState<boolean>(true);

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
    if (path === ROUTES.worker.settings || path === ROUTES.settings || path === ROUTES.employer.settings) {
      return (
        matchesPath(location.pathname, ROUTES.settings) ||
        matchesPath(location.pathname, ROUTES.worker.settings) ||
        matchesPath(location.pathname, ROUTES.employer.settings) ||
        matchesPath(location.pathname, ROUTES.doctor.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.employer.settings) ||
        matchesPath(location.pathname, ROUTES.legacyDashboard.doctor.settings)
      );
    }
    return startsWithPath(location.pathname, path);
  };

  // Workers have no dashboard; the button that uses this is gated to
  // non-worker roles, and the profile card sends workers to their profile.
  const dashboardPath =
    effectiveRole === "admin" ? ROUTES.admin.dashboard : ROUTES.employer.dashboard;

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

  const renderMenuButton = (item: MenuItem) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      className={getNavButtonClass(isPathActive(item.path))}
      title={isCollapsed ? item.label : ""}
    >
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
  );

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
      className={`${webUi.sidebar.root} w-full p-4 sm:p-5 [@media(max-height:700px)]:p-2`}
    >
      <div className="dashboard-sidebar-header mb-6 flex shrink-0 items-center justify-between [@media(max-height:700px)]:mb-0">
        <MicroJobsLogo onClick={() => navigate(ROUTES.home)} className="min-h-11 min-w-0 cursor-pointer" />
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

      <nav className="dashboard-sidebar-nav min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 [@media(max-height:700px)]:space-y-0" aria-label={`${roleLabel} menu`}>
        <div className="space-y-1.5 pb-3 [@media(max-height:700px)]:space-y-0 [@media(max-height:700px)]:pb-0">
          {effectiveRole !== "user" && (
            <button
              onClick={() => navigate(dashboardPath)}
              className={getNavButtonClass(isPathActive(dashboardPath))}
              title={isCollapsed ? "Dashboard" : ""}
            >
              {(mobile || !isCollapsed) && <span>Dashboard</span>}
            </button>
          )}

          {effectiveRole === "admin" && renderMenuButton(adminMessagesItem)}

          {effectiveRole === "employer" && (
            <div>
              <div className="relative">
                <button
                  onClick={() => navigate(employerMenuGroup.path)}
                  className={`${getNavButtonClass(isEmployerParentActive)} ${!isCollapsed ? "pr-10" : ""}`}
                  title={isCollapsed ? employerMenuGroup.label : ""}
                >
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

          {effectiveRole === "admin"
            ? adminMenuGroups.map((group, index) => (
                <div
                  key={group.label}
                  className={
                    index === 0
                      ? "space-y-1.5"
                      : `space-y-1.5 border-t py-4 ${webUi.sidebar.sectionDivider}`
                  }
                >
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {group.label}
                  </p>
                  {group.items.map((item) => renderMenuButton(item))}
                </div>
              ))
            : menuItems.map((item) => renderMenuButton(item))}
        </div>

        {workspaceMenuItems.length > 0 && (
          <div className={`space-y-1.5 border-t py-4 ${webUi.sidebar.sectionDivider}`}>
            <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            {workspaceMenuItems.map((item) => renderMenuButton(item))}
          </div>
        )}
      </nav>

      <div className="dashboard-sidebar-footer mt-3 shrink-0 space-y-2 border-t border-slate-200 pt-3 [@media(max-height:700px)]:mt-0 [@media(max-height:700px)]:space-y-0 [@media(max-height:700px)]:pt-0">
        {pinnedSettingsItem && (
          <button
            type="button"
            onClick={() => navigate(pinnedSettingsItem.path)}
            className={getNavButtonClass(isPathActive(pinnedSettingsItem.path))}
          >
            <span>{pinnedSettingsItem.label}</span>
          </button>
        )}
        <button onClick={() => navigate(effectiveRole === "user" ? ROUTES.worker.profile : dashboardPath)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] [@media(max-height:700px)]:min-h-11 [@media(max-height:700px)]:p-1">
          <div className="flex items-center gap-3">
            {authUser?.avatarUrl ? (
              <img
                src={authUser.avatarUrl}
                alt="Profile"
                className="h-10 w-10 flex-shrink-0 rounded-full object-cover [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8">
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
