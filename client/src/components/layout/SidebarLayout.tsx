import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import AdminSidebar from "../AdminSidebar";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const SidebarLayout: React.FC = () => {
  const authUser = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: any) => setCollapsed(Boolean(e?.detail?.collapsed));
    window.addEventListener("sidebar_toggled", handler as EventListener);
    return () => window.removeEventListener("sidebar_toggled", handler as EventListener);
  }, []);

  const marginLeft = collapsed ? "5rem" : "16rem"; // matches w-20 (5rem) and w-64 (16rem)

  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="flex h-screen bg-gray-50">
      {isAdminRoute ? (
        <AdminSidebar userName={authUser?.firstName + " " + authUser?.lastName || "Admin User"} userEmail={authUser?.email || "admin@example.com"} />
      ) : (
        <Sidebar
          userName={authUser?.firstName + " " + authUser?.lastName || "Jonas Enriquez"}
          userEmail={authUser?.email || "jonas@example.com"}
          balance="₱67.67"
          messageCount={2}
          userRole={authUser?.role || "work"}
        />
      )}

      <div className="flex-1 overflow-auto" style={{ marginLeft, transition: "margin-left 240ms ease" }}>
        <div className="page-transition h-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SidebarLayout;
