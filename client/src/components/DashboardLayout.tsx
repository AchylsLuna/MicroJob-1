import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { NavBar } from "./NavBar";
import { webUi } from "../styles/webUi";

export function DashboardLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const navigationTriggerRef = useRef<HTMLElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = mobileNavigationRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((element) => element.getClientRects().length > 0);
    const focusFrame = window.requestAnimationFrame(() => focusableElements()[0]?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      navigationTriggerRef.current?.focus();
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className={webUi.layout.shell}>
      <div className="hidden h-full shrink-0 lg:block">
        <Sidebar />
      </div>
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div ref={mobileNavigationRef} className="relative h-full w-[min(20rem,88vw)]">
            <Sidebar mobile onClose={() => setIsMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className={webUi.layout.content}>
        <NavBar
          isNavigationOpen={isMobileSidebarOpen}
          onOpenNavigation={() => {
            navigationTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setIsMobileSidebarOpen(true);
          }}
        />
        <main className={`${webUi.layout.main} dashboard-scope`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
