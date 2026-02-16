import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Toaster } from "../lib/toast";
import { NavBar } from "./NavBar";

export function DashboardLayout() {
  return (
    <div className="bg-[#f8f8f8] flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <NavBar />
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
