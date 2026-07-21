import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { NavBar } from "./NavBar";
import { webUi } from "../styles/webUi";

export function DashboardLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className={webUi.layout.shell}>
      <div className="hidden shrink-0 lg:block">
        <Sidebar />
      </div>
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative h-full w-[min(20rem,88vw)]">
            <Sidebar mobile onClose={() => setIsMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className={webUi.layout.content}>
        <NavBar
          isNavigationOpen={isMobileSidebarOpen}
          onOpenNavigation={() => setIsMobileSidebarOpen(true)}
        />
        <main className={`${webUi.layout.main} dashboard-scope`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
