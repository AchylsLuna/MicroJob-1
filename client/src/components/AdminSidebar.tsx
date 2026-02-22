import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/MicroIcon.png";
import bagIcon1 from "../assets/dashboard/bagIcon1.png";
import bagtransIcon from "../assets/dashboard/bagtransIcon.png";
import clockIcon from "../assets/dashboard/clockIcon.png";
import helpIcon from "../assets/dashboard/helpIcon.png";
import logoutIcon from "../assets/dashboard/logoutIcon.png";
import mailIcon from "../assets/dashboard/mailIcon.png";
import messageIcon from "../assets/dashboard/messageIcon.png";
import messageIcon1 from "../assets/dashboard/messageIcon1.png";
import searchIcon from "../assets/dashboard/searchIcon.png";
import settingsIcon from "../assets/dashboard/settingsIcon.png";
import starIcon from "../assets/dashboard/starIcon.png";
import walletIcon from "../assets/dashboard/walletIcon.png";
import { useAuth } from "../hooks/useAuth";

interface AdminSidebarProps {
  userName?: string;
  userEmail?: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  userName = "Admin User",
  userEmail = "admin@example.com",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const authUser = useAuth();

  useEffect(() => {
    const handler = () => {
      try {
        const storedRaw = localStorage.getItem("profile_settings");
        const stored = storedRaw ? JSON.parse(storedRaw) : {};
        setProfilePhotoPreview(stored.personal?.profilePhotoPreview || "");
      } catch {
        setProfilePhotoPreview("");
      }
    };
    handler();
    window.addEventListener("profile_settings_updated", handler);
    return () => window.removeEventListener("profile_settings_updated", handler);
  }, []);

  const adminMenuItems = [
    { icon: "dashboard", label: "Dashboard", path: "/admin" },
    { icon: "analytics", label: "Analytics", path: "/admin/analytics" },
    { icon: "reports", label: "Reports", path: "/admin/reports" },
    { icon: "e-wallet", label: "E-Wallet", path: "/admin/e-wallet" },
    { icon: "jobs", label: "Jobs", path: "/admin/jobs" },
    { icon: "security", label: "Security", path: "/admin/security" },
    { icon: "users", label: "User Management", path: "/admin/users" },
  ];

  const bottomMenuItems: any[] = [];

  const iconMap: Record<string, string> = {
    dashboard: starIcon,
    analytics: starIcon,
    reports: bagtransIcon,
    "e-wallet": walletIcon,
    jobs: bagIcon1,
    security: clockIcon,
    users: messageIcon,
    settings: settingsIcon,
    support: helpIcon,
    logout: logoutIcon,
  };

  const renderIcon = (iconKey: string) => (
    <img
      src={iconMap[iconKey] || starIcon}
      alt=""
      aria-hidden="true"
      className="h-5 w-5 grayscale"
    />
  );

  return (
    <div
      className={`bg-white text-gray-800 shadow-lg fixed h-screen overflow-y-auto flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
      style={{ padding: isCollapsed ? "12px" : "24px" }}
    >
      <div className="flex items-center justify-between mb-8">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img src={logo} alt="MicroJobs Logo" className="h-8 w-8" />
          {!isCollapsed && <span className="text-xl font-bold text-black">MicroJobs</span>}
        </div>
        <button
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            try {
              localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
            } catch {}
            window.dispatchEvent(new CustomEvent("sidebar_toggled", { detail: { collapsed: next } }));
          }}
          className="text-gray-600 hover:text-gray-900 transition text-lg"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="space-y-1 flex-1 flex flex-col">
        <div className="space-y-1 pb-4 border-b border-gray-200">
          {adminMenuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold transition relative ${
                location.pathname === item.path ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-100"
              } ${isCollapsed ? "px-2" : ""}`}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="space-y-1 py-4 border-b border-gray-200">
          <button
            onClick={() => {
              localStorage.removeItem("auth_user");
              localStorage.removeItem("auth_token");
              window.dispatchEvent(new Event("auth_user_updated"));
              navigate("/admin/signin", { replace: true });
            }}
            className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold text-red-600 hover:bg-red-50 transition relative"
            title={isCollapsed ? "Logout" : ""}
          >
            {renderIcon("logout")}
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </nav>

      <div className="border-t border-gray-200 pt-6">
        <button className="w-full flex items-center justify-between lg:justify-start gap-3 hover:opacity-80 transition">
          <div className="flex items-center gap-3">
            {profilePhotoPreview ? (
              <img
                src={profilePhotoPreview}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-lg flex-shrink-0">👨</div>
            )}
            {!isCollapsed && (
              <div className="text-left">
                <p className="text-gray-600 text-xs">Signed in as</p>
                <p className="font-bold text-gray-900 text-sm">{authUser?.firstName ? `${authUser.firstName} ${authUser.lastName || ''}` : userName}</p>
                <p className="text-xs text-gray-500">{authUser?.email || userEmail}</p>
              </div>
            )}
          </div>
          {!isCollapsed && <span className="text-gray-400">›</span>}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
