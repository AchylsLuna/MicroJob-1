import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Toaster } from "../lib/toast";
import { NavBar } from "./NavBar";
import { webUi } from "../styles/webUi";

export function DashboardLayout() {
  return (
    <div className={webUi.layout.shell}>
      <Sidebar />
      <div className={webUi.layout.content}>
        <NavBar />
        <main className={webUi.layout.main}>
          <div className={webUi.layout.maxContainer}>
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
