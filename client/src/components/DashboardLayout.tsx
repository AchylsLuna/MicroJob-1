import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { NavBar } from "./NavBar";
import { webUi } from "../styles/webUi";

export function DashboardLayout() {
  return (
    <div className={webUi.layout.shell}>
      <Sidebar />
      <div className={webUi.layout.content}>
        <NavBar />
        <main className={`${webUi.layout.main} dashboard-scope`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
