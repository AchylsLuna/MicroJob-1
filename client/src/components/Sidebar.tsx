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

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  balance?: string;
  messageCount?: number;
  userRole?: "hire" | "work" | "both" | "admin" | "superadmin"; // Optional override
}

const Sidebar: React.FC<SidebarProps> = ({
  userName = "Jonas Enriquez",
  userEmail = "joserizal@gmail.com",
  balance = "$67.67",
  messageCount = 2,
  userRole = "work", // Default to work, NOT both
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [activeRole, setActiveRole] = useState<"work" | "hire">(() => {
    const stored = localStorage.getItem("sidebar_active_role");
    return stored === "hire" ? "hire" : "work";
  });
  const authUser = useAuth();

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
  
  // Get role from auth user (backend source of truth)
  const userRoleFromAuth = authUser?.role || "work";
  
  // Debug logging
  console.log("[Sidebar] Full authUser object:", authUser);
  console.log("[Sidebar] Role from authUser:", userRoleFromAuth);
  console.log("[Sidebar] localStorage auth_user:", localStorage.getItem("auth_user"));

  // Menu items based on user role
  const workerMenuItems = [
    { icon: "find-jobs", label: "Apply Jobs", path: "/find-jobs" },
    { icon: "applied-jobs", label: "Applied Jobs", path: "/worker/applied-jobs" },
  ];

  const employerMenuItems = [
    { icon: "➕", label: "Post a Job", path: "/employer/post-job" },
    { icon: "📋", label: "My Job Posts", path: "/employer/job-posts" },
    { icon: "applied-jobs", label: "Applications", path: "/employer/applications" },
  ];

  const commonMenuItems = [
    { icon: "messages", label: "Messages", path: "/messages", notification: true },
    { icon: "e-wallet", label: "E-Wallet", path: "/e-wallet" },
  ];

  const effectiveRole = userRoleFromAuth === "both" ? activeRole : userRoleFromAuth;


  // Build menu items array based on role
  let menuItems: any[] = [];
  
  console.log("[Sidebar] Building menu for role:", effectiveRole);
  
  if (effectiveRole === "work") {
    // Worker: Only Apply Jobs + Applied Jobs
    menuItems = [...workerMenuItems, ...commonMenuItems];
    console.log("[Sidebar] Using WORKER menu items");
  } else if (effectiveRole === "hire") {
    // Employer: Only Post Jobs + My Job Posts
    menuItems = [...employerMenuItems, ...commonMenuItems];
    console.log("[Sidebar] Using EMPLOYER menu items");
  } else if (effectiveRole === "admin" || effectiveRole === "superadmin") {
    // Admin: All items
    menuItems = [...workerMenuItems, ...employerMenuItems, ...commonMenuItems];
    console.log("[Sidebar] Using ADMIN menu items");
  } else {
    // Unknown: Default to worker
    menuItems = [...workerMenuItems, ...commonMenuItems];
    console.log("[Sidebar] Using DEFAULT (worker) menu items");
  }
  
  console.log("[Sidebar] Final menu items:", menuItems.map(i => i.label));

  const bottomMenuItems = [
    { icon: "notifications", label: "Notifications", path: "/notifications", notification: true },
    { icon: "settings", label: "Settings", path: "/settings" },
    { icon: "support", label: "Support", path: "/support" },
  ];

  const iconMap: Record<string, string> = {
    dashboard: starIcon,
    "find-jobs": searchIcon,
    "applied-jobs": mailIcon,
    "post-job": bagtransIcon,
    "job-posts": bagIcon1,
    applications: messageIcon1,
    messages: messageIcon,
    "e-wallet": walletIcon,
    notifications: clockIcon,
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
      {/* Logo Section */}
      <div className="flex items-center justify-between mb-8">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img src={logo} alt="MicroJobs Logo" className="h-8 w-8" />
          {!isCollapsed && (
            <span className="text-xl font-bold text-black">MicroJobs</span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-600 hover:text-gray-900 transition text-lg"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="space-y-1 flex-1 flex flex-col">
        {/* Main Section */}
        <div className="space-y-1 pb-4 border-b border-gray-200">
          {/* Role Selector */}
          {!isCollapsed && (
            <div className="mb-3">
              {userRoleFromAuth === "both" ? (
                <>
                  <button
                    onClick={() => setRoleSelectorOpen(!roleSelectorOpen)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-sky-50 text-sky-700 font-semibold border border-sky-100"
                  >
                    <span>{activeRole === "hire" ? "Employer" : "Worker"}</span>
                    <span className="text-sky-500">▾</span>
                  </button>
                  {roleSelectorOpen && (
                    <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <button
                        onClick={() => {
                          setRoleSelectorOpen(false);
                          setActiveRole("work");
                          localStorage.setItem("sidebar_active_role", "work");
                          navigate("/find-jobs");
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50"
                      >
                        Worker
                      </button>
                      <button
                        onClick={() => {
                          setRoleSelectorOpen(false);
                          setActiveRole("hire");
                          localStorage.setItem("sidebar_active_role", "hire");
                          navigate("/employer/applications");
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50"
                      >
                        Employer
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-50 text-sky-700 font-semibold border border-sky-100">
                  <span>{userRoleFromAuth === "hire" ? "Employer" : "Worker"}</span>
                </div>
              )}
            </div>
          )}
          {/* Dashboard Button (hide for employer) */}
          {effectiveRole !== "hire" && (
            <button
              onClick={() => navigate("/dashboard")}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold transition relative ${
                location.pathname === "/dashboard"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:bg-gray-100"
              } ${isCollapsed ? "px-2" : ""}`}
              title={isCollapsed ? "Dashboard" : ""}
            >
              {renderIcon("dashboard")}
              {!isCollapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* Menu Items based on role */}
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold transition relative ${
                location.pathname === item.path
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:bg-gray-100"
              } ${isCollapsed ? "px-2" : ""}`}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {!isCollapsed && <span>{item.label}</span>}
              {item.notification && (
                <span className={`w-2 h-2 bg-blue-600 rounded-full ${isCollapsed ? "absolute right-2 top-2" : ""}`}></span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="space-y-1 py-4 border-b border-gray-200">
          {bottomMenuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold transition relative ${
                location.pathname === item.path
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:bg-gray-100"
              } ${isCollapsed ? "px-2" : ""}`}
              title={isCollapsed ? item.label : ""}
            >
              {renderIcon(item.icon)}
              {!isCollapsed && <span>{item.label}</span>}
              {item.notification && (
                <span className={`w-2 h-2 bg-blue-600 rounded-full ${isCollapsed ? "absolute right-2 top-2" : ""}`}></span>
              )}
            </button>
          ))}

          {/* Logout Button */}
          <button
            onClick={() => {
              setShowLogoutConfirm(true);
            }}
            className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold text-red-600 hover:bg-red-50 transition relative"
            title={isCollapsed ? "Logout" : ""}
          >
            {renderIcon("logout")}
            {!isCollapsed && <span>Logout</span>}
          </button>

          {/* Logout Confirmation - Inside Sidebar */}
          {showLogoutConfirm && !isCollapsed && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-800 font-semibold mb-3">Confirm logout?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_user");
                    localStorage.removeItem("auth_token");
                    window.dispatchEvent(new Event("auth_user_updated"));
                    setShowLogoutConfirm(false);
                    navigate("/signin", { replace: true });
                  }}
                  className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-700 transition"
                >
                  Logout
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 bg-white text-red-700 text-sm font-semibold py-2 rounded-lg border border-red-300 hover:bg-red-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      </nav>

      {/* User Profile */}
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
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                👨
              </div>
            )}
            {!isCollapsed && (
              <div className="text-left">
                <p className="text-gray-600 text-xs">Welcome back 👋</p>
                <p className="font-bold text-gray-900 text-sm">{userName}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <span className="text-gray-400">›</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
