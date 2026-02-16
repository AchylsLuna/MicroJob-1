import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, FileText, LayoutDashboard, Shield, Users, Wallet } from "lucide-react";
import svgPaths from "../imports/svg-at917c2et3";
import { useAuth } from "../contexts/AuthContext";

function Logo1() {
  return (
    <div className="relative shrink-0 w-8 h-8">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g clipPath="url(#clip0_1_887)">
          <path clipRule="evenodd" d={svgPaths.pb82c00} fill="#1C4D8D" fillRule="evenodd" />
          <path clipRule="evenodd" d={svgPaths.p9a9cd00} fill="#1C4D8D" fillRule="evenodd" />
        </g>
        <defs>
          <clipPath id="clip0_1_887">
            <rect fill="white" height="32" width="32" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

interface LogoProps {
  isCollapsed: boolean;
}

function Logo({ isCollapsed }: LogoProps) {
  return (
    <div className="content-stretch flex gap-[8px] items-center overflow-clip relative shrink-0">
      <Logo1 />
      {!isCollapsed && (
        <p className="font-['Poppins:SemiBold',sans-serif] leading-[1.4] not-italic relative shrink-0 text-[#081021] text-[20px] whitespace-nowrap">
          Micro Jobs
        </p>
      )}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  badge?: boolean;
  isCollapsed: boolean;
  isActiveOverride?: boolean;
}

function NavItem({ icon, label, to, badge, isCollapsed, isActiveOverride }: NavItemProps) {
  const location = useLocation();
  const computedActive = to === "/dashboard"
    ? location.pathname === "/dashboard"
    : location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  const isActive = typeof isActiveOverride === "boolean" ? isActiveOverride : computedActive;

  return (
    <Link
      to={to}
      className={`h-[44px] relative rounded-[99px] shrink-0 w-full block ${isActive ? "bg-[#E8F2F8]" : ""} group`}
      title={isCollapsed ? label : undefined}
    >
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] w-full h-full">
        <div className={`content-stretch flex items-center ${isCollapsed ? "px-[12px] justify-center" : "px-[16px]"} py-[12px] relative w-full h-full`}>
          <div className="content-stretch flex flex-[1_0_0] gap-[12px] items-center min-h-px min-w-px relative">
            <div className="content-stretch flex items-start relative shrink-0">
              {icon}
            </div>
            {!isCollapsed && (
              <>
                <div className={`flex flex-[1_0_0] flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] min-h-px min-w-px not-italic relative self-stretch text-[14px] ${isActive ? "text-[#1C4D8D]" : "text-[#64748b]"}`}>
                  <p className="leading-[20px] whitespace-pre-wrap">{label}</p>
                </div>
                {badge && (
                  <div className="bg-[#1C4D8D] rounded-[99px] w-[6px] h-[6px]">
                    <div aria-hidden="true" className="absolute border border-solid border-white inset-[-1px] pointer-events-none rounded-[100px]" />
                  </div>
                )}
              </>
            )}
            {isCollapsed && badge && (
              <div className="absolute bg-[#1C4D8D] rounded-[99px] w-[6px] h-[6px] top-[8px] right-[8px]">
                <div aria-hidden="true" className="absolute border border-solid border-white inset-[-1px] pointer-events-none rounded-[100px]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

interface ExpandableNavItemProps {
  icon: React.ReactNode;
  label: string;
  basePath: string;
  badge?: boolean;
  isCollapsed: boolean;
  children?: { label: string; to: string; isActive?: boolean }[];
}

function ExpandableNavItem({ icon, label, basePath, badge, isCollapsed, children = [] }: ExpandableNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(basePath);
  const [isExpanded, setIsExpanded] = useState(isActive);

  return (
    <div className="w-full">
      <button
        onClick={() => !isCollapsed && setIsExpanded(!isExpanded)}
        className={`h-[44px] relative rounded-[99px] shrink-0 w-full block p-0 text-left border-0 ${isActive ? "bg-[#E8F2F8]" : ""} group`}
        title={isCollapsed ? label : undefined}
      >
        <div className="flex flex-row items-center overflow-clip rounded-[inherit] w-full h-full">
          <div className={`content-stretch flex items-center ${isCollapsed ? "px-[12px] justify-center" : "px-[16px]"} py-[12px] relative w-full h-full`}>
            <div className="content-stretch flex flex-[1_0_0] gap-[12px] items-center min-h-px min-w-px relative">
              <div className="content-stretch flex items-start relative shrink-0">
                {icon}
              </div>
              {!isCollapsed && (
                <>
                  <div className={`flex flex-[1_0_0] flex-col font-['Poppins:Medium',sans-serif] justify-center leading-[0] min-h-px min-w-px not-italic relative self-stretch text-[14px] ${isActive ? "text-[#1C4D8D]" : "text-[#64748b]"}`}>
                    <p className="leading-[20px] whitespace-pre-wrap">{label}</p>
                  </div>
                  {badge && (
                    <div className="bg-[#1C4D8D] rounded-[99px] w-[6px] h-[6px]">
                      <div aria-hidden="true" className="absolute border border-solid border-white inset-[-1px] pointer-events-none rounded-[100px]" />
                    </div>
                  )}
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-[10px] border transition-all duration-200 ${
                      isExpanded
                        ? "bg-[#E8F2F8] text-[#1C4D8D] border-[#CFE3F2] shadow-[0_4px_12px_rgba(28,77,141,0.18)]"
                        : "text-[#64748b] border-[#E2E8F0] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <span className={`text-[16px] leading-[16px] transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                      {">"}
                    </span>
                  </div>
                </>
              )}
              {isCollapsed && badge && (
                <div className="absolute bg-[#1C4D8D] rounded-[99px] w-[6px] h-[6px] top-[8px] right-[8px]">
                  <div aria-hidden="true" className="absolute border border-solid border-white inset-[-1px] pointer-events-none rounded-[100px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
      
      {!isCollapsed && isExpanded && children.length > 0 && (
        <div className="mt-1 ml-[44px] space-y-1">
          {children.map((child) => {
            const isChildActive =
              child.isActive ??
              (child.to.includes("?")
                ? `${location.pathname}${location.search}` === child.to
                : location.pathname === child.to);
            return (
              <Link
                key={child.to}
                to={child.to}
                className={`block px-4 py-2 text-[13px] font-['Poppins:Medium',sans-serif] rounded-lg transition-colors ${
                  isChildActive 
                    ? "text-[#1C4D8D] bg-[#E8F2F8]" 
                    : "text-[#64748b] hover:bg-gray-50"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardIcon({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p2fc4f200} stroke={isActive ? "#498BC9" : "#64748B"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function BriefcaseIcon({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" viewBox="0 0 20 20">
        <path d="M10 9V6.5M6.5 9V6.5M13.5 9V6.5M5.5 17.5H14.5C15.6046 17.5 16.5 16.6046 16.5 15.5V7C16.5 5.89543 15.6046 5 14.5 5H5.5C4.39543 5 3.5 5.89543 3.5 7V15.5C3.5 16.6046 4.39543 17.5 5.5 17.5Z" stroke={isActive ? "#498BC9" : "#64748B"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 5V4C7 3.44772 7.44772 3 8 3H12C12.5523 3 13 3.44772 13 4V5" stroke={isActive ? "#498BC9" : "#64748B"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function InboxIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p2d9a2480} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function TruckIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p1e38c0c0} stroke="#64748B" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function WalletIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.pa9e5380} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function BellIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p2185fa00} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function SettingsIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g>
          <path d={svgPaths.p7eada00} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={svgPaths.p2d5fa000} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

function SupportIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p26323f00} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function CalendarIcon() {
  return (
    <div className="relative shrink-0 w-5 h-5">
      <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path d={svgPaths.p2bff9300} stroke="#64748B" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function AnalyticsIcon({ isActive }: { isActive: boolean }) {
  return <BarChart3 className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function AdminDashboardIcon({ isActive }: { isActive: boolean }) {
  return <LayoutDashboard className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function WalletMonitoringIcon({ isActive }: { isActive: boolean }) {
  return <Wallet className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function JobPostingIcon({ isActive }: { isActive: boolean }) {
  return <ClipboardList className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function SecurityIcon({ isActive }: { isActive: boolean }) {
  return <Shield className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function UserManagementIcon({ isActive }: { isActive: boolean }) {
  return <Users className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

function ReportsIcon({ isActive }: { isActive: boolean }) {
  return <FileText className={`w-5 h-5 ${isActive ? "text-[#498BC9]" : "text-[#64748B]"}`} />;
}

export function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const displayName =
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.email ||
    "Account";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const settingsTabParam = new URLSearchParams(location.search).get("tab");
  const settingsAccountTabs = ["account", "personal", "experience", "resume", "cv"];
  const isSettingsAccountActive =
    location.pathname.startsWith("/dashboard/settings") &&
    (!settingsTabParam || settingsAccountTabs.includes(settingsTabParam));
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";
  const isEmployerAccount = user?.accountType === "employer";
  const adminBasePath = "/dashboard/admin-dashboard";
  const isAdminOverview = location.pathname === adminBasePath;
  const isAdminAnalytics = location.pathname.startsWith(`${adminBasePath}/analytics`);
  const isAdminWallet = location.pathname.startsWith(`${adminBasePath}/e-wallet`);
  const isAdminJobs = location.pathname.startsWith(`${adminBasePath}/jobs`);
  const isAdminReports = location.pathname.startsWith(`${adminBasePath}/reports`);
  const isAdminSecurity = location.pathname.startsWith(`${adminBasePath}/security`);
  const isAdminUserManagement = location.pathname.startsWith(`${adminBasePath}/user-management`);

  return (
    <div 
      className={`bg-white content-stretch flex flex-col gap-[24px] h-screen sticky top-0 isolate items-center shadow-[0px_0px_44px_0px_rgba(0,0,0,0.05)] border-r border-[#E5E7EB] transition-all duration-300 ${
        isCollapsed ? "w-[80px]" : "w-[280px]"
      }`}
    >
      {/* Top */}
      <div className="relative shrink-0 w-full z-[4]">
        <div className="flex flex-row items-center w-full h-full">
          <div className={`content-stretch flex gap-[12px] items-center ${isCollapsed ? "p-[16px] justify-center" : "p-[24px]"} relative w-full`}>
            <Logo isCollapsed={isCollapsed} />
          </div>
        </div>
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 rounded-full p-1.5 bg-white border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.12)] z-10 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.18)] active:translate-y-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="block w-5 h-5 rounded-full bg-[#E8F2F8] text-center text-[16px] leading-[20px] text-[#1C4D8D] shadow-inner">
            {isCollapsed ? ">" : "<"}
          </span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="content-stretch flex flex-[1_0_0] flex-col gap-[24px] items-center min-h-px min-w-px relative w-full z-[3] overflow-y-auto">
        <div className="relative shrink-0 w-full">
          <div className={`content-stretch flex flex-col gap-[4px] items-start ${isCollapsed ? "px-[12px]" : "px-[24px]"} relative w-full`}>
            {isAdminUser ? (
              <>
                <NavItem
                  icon={<AdminDashboardIcon isActive={isAdminOverview} />}
                  label="Dashboard"
                  to={adminBasePath}
                  isCollapsed={isCollapsed}
                  isActiveOverride={isAdminOverview}
                />
                <NavItem
                  icon={<AnalyticsIcon isActive={isAdminAnalytics} />}
                  label="Analytics"
                  to={`${adminBasePath}/analytics`}
                  isCollapsed={isCollapsed}
                  isActiveOverride={isAdminAnalytics}
                />
                <NavItem
                  icon={<ReportsIcon isActive={isAdminReports} />}
                  label="Reports"
                  to={`${adminBasePath}/reports`}
                  isCollapsed={isCollapsed}
                  isActiveOverride={isAdminReports}
                />
                <NavItem
                  icon={<BellIcon />}
                  label="Notifications"
                  to="/dashboard/notifications"
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  icon={<SupportIcon />}
                  label="Support Inbox"
                  to="/dashboard/messages"
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  icon={<WalletMonitoringIcon isActive={isAdminWallet} />}
                  label="E-Wallet Monitoring"
                  to={`${adminBasePath}/e-wallet`}
                  isCollapsed={isCollapsed}
                  isActiveOverride={isAdminWallet}
                />
                <NavItem
                  icon={<JobPostingIcon isActive={isAdminJobs} />}
                  label="Job Posting Monitoring"
                  to={`${adminBasePath}/jobs`}
                  isCollapsed={isCollapsed}
                  isActiveOverride={isAdminJobs}
                />
                {isSuperAdmin && (
                  <NavItem
                    icon={<SecurityIcon isActive={isAdminSecurity} />}
                    label="Security"
                    to={`${adminBasePath}/security`}
                    isCollapsed={isCollapsed}
                    isActiveOverride={isAdminSecurity}
                  />
                )}
                {isSuperAdmin && (
                  <NavItem
                    icon={<UserManagementIcon isActive={isAdminUserManagement} />}
                    label="User Management"
                    to={`${adminBasePath}/user-management`}
                    isCollapsed={isCollapsed}
                    isActiveOverride={isAdminUserManagement}
                  />
                )}
              </>
            ) : (
              <>
                <NavItem 
                  icon={<DashboardIcon isActive={location.pathname === "/dashboard"} />} 
                  label="Dashboard" 
                  to="/dashboard" 
                  isCollapsed={isCollapsed}
                />
                {isEmployerAccount && (
                  <ExpandableNavItem
                    icon={<BriefcaseIcon isActive={location.pathname.startsWith("/dashboard/employer")} />}
                    label="Employer"
                    basePath="/dashboard/employer"
                    isCollapsed={isCollapsed}
                    children={[
                      { label: "Dashboard", to: "/dashboard/employer" },
                      { label: "Applications", to: "/dashboard/employer/applications" },
                    ]}
                  />
                )}
                <NavItem 
                  icon={<InboxIcon />} 
                  label="Find Jobs" 
                  to="/dashboard/find-jobs" 
                  isCollapsed={isCollapsed}
                />
                <NavItem 
                  icon={<TruckIcon />} 
                  label="Applied Jobs" 
                  to="/dashboard/applied-jobs" 
                  isCollapsed={isCollapsed}
                />
                <NavItem 
                  icon={<CalendarIcon />} 
                  label="Messages" 
                  to="/dashboard/messages" 
                  badge={true}
                  isCollapsed={isCollapsed}
                />
                <NavItem 
                  icon={<TruckIcon />} 
                  label="Saved Jobs" 
                  to="/dashboard/saved-jobs" 
                  isCollapsed={isCollapsed}
                />
                <NavItem 
                  icon={<WalletIcon />} 
                  label="E-Wallet" 
                  to="/dashboard/e-wallet" 
                  isCollapsed={isCollapsed}
                />
              </>
            )}
            
          </div>
        </div>

        {/* Divider */}
        {!isAdminUser && (
        <div className="h-0 relative shrink-0 w-full">
          <div className="absolute inset-[-1px_0_0_0]">
            <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 280 1">
              <line stroke="#E2E8F0" x2="280" y1="0.5" y2="0.5" />
            </svg>
          </div>
        </div>
        )}

        {/* Secondary Navigation */}
        {!isAdminUser && (
        <div className="relative shrink-0 w-full">
          <div className={`content-stretch flex flex-col gap-[4px] items-start ${isCollapsed ? "px-[12px]" : "px-[24px]"} relative w-full`}>
            <NavItem 
              icon={<BellIcon />} 
              label="Notifications" 
              to="/dashboard/notifications" 
              badge={true}
              isCollapsed={isCollapsed}
            />
            <ExpandableNavItem
              icon={<SettingsIcon />}
              label="Settings"
              basePath="/dashboard/settings"
              isCollapsed={isCollapsed}
              children={[
                {
                  label: "Account",
                  to: "/dashboard/settings?tab=account",
                  isActive: isSettingsAccountActive,
                },
                {
                  label: "Privacy & Security",
                  to: "/dashboard/settings?tab=privacy",
                  isActive:
                    location.pathname.startsWith("/dashboard/settings") && settingsTabParam === "privacy",
                },
                {
                  label: "Payment Methods",
                  to: "/dashboard/settings?tab=payments",
                  isActive:
                    location.pathname.startsWith("/dashboard/settings") && settingsTabParam === "payments",
                },
              ]}
            />
            <NavItem 
              icon={<SupportIcon />} 
              label="Support" 
              to="/dashboard/support" 
              isCollapsed={isCollapsed}
            />
          </div>
        </div>
        )}
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <Link to="/dashboard/profile" className="relative shrink-0 w-full z-[1] hover:bg-gray-50 transition-colors group cursor-pointer">
          <div aria-hidden="true" className="absolute border-[#e2e8f0] border-solid border-t inset-[-1px_0_0_0] pointer-events-none" />
          <div className="flex flex-row items-center w-full h-full">
            <div className="content-stretch flex gap-[12px] items-center p-[24px] relative w-full">
              <div className="content-stretch flex flex-[1_0_0] gap-[12px] items-center min-h-px min-w-px relative">
                <div className="bg-[#ffb31f] overflow-clip relative rounded-[99px] shrink-0 w-10 h-10 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full flex items-center justify-center text-[15px] font-semibold text-[#1F2937]">
                    {avatarInitial}
                  </div>
                </div>
                <div className="content-stretch flex flex-[1_0_0] flex-col font-['Poppins:Medium',sans-serif] gap-[2px] items-start leading-[20px] min-h-px min-w-px not-italic relative whitespace-pre-wrap">
                  <p className="relative shrink-0 text-[#64748b] text-[12px] w-full">Welcome back 👋</p>
                  <p className="relative shrink-0 text-[#081021] text-[14px] w-full group-hover:text-[#1C4D8D] transition-colors">{displayName}</p>
                </div>
              </div>
              <div className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                <span className="text-[18px] leading-[18px] text-[#081021]">{">"}</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Footer - Collapsed State */}
      {isCollapsed && (
        <Link to="/dashboard/profile" className="relative shrink-0 w-full z-[1] pb-4 hover:bg-gray-50 transition-colors cursor-pointer">
          <div className="flex flex-col items-center">
            <div className="bg-[#ffb31f] overflow-clip relative rounded-[99px] shrink-0 w-10 h-10 hover:scale-105 transition-transform">
              <div className="w-full h-full flex items-center justify-center text-[15px] font-semibold text-[#1F2937]">
                {avatarInitial}
              </div>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
