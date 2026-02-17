import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import { useAuth } from "../../hooks/useAuth";

const SidebarLayout: React.FC = () => {
  const authUser = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        userName={authUser?.firstName + " " + authUser?.lastName || "Jonas Enriquez"}
        userEmail={authUser?.email || "jonas@example.com"}
        balance="₱67.67"
        messageCount={2}
        userRole={authUser?.role || "work"}
      />

      <div className="flex-1 overflow-auto ml-64">
        <div className="page-transition h-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SidebarLayout;
