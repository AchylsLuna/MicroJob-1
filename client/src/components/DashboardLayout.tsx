import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { NavBar } from "./NavBar";
import { webUi } from "../styles/webUi";
import { useAuth } from "../contexts/AuthContext";
import { ResponsiveBottomNavigation } from "./ResponsiveBottomNavigation";
import { MessageDock } from "./messaging/MessageDock";
import { useHideOnScroll } from "../hooks/useHideOnScroll";

export function DashboardLayout() {
  const { t } = useTranslation("common");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const navigationTriggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAuth();
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isEmployerView =
    user?.accountType === "employer" ||
    normalizedRole === "employer" ||
    normalizedRole === "doctor" ||
    normalizedRole === "hire";
  const isAdminView = normalizedRole === "admin" || normalizedRole === "superadmin";
  const isWorkerView = !isEmployerView && !isAdminView;

  const isNavBarHidden = useHideOnScroll(contentRef, { disabled: isMobileSidebarOpen });

  useEffect(() => {
    setIsMobileSidebarOpen(false);
    // A fresh route should always start scrolled to the top, and the top navbar
    // should be visible there — otherwise a hidden navbar from the previous
    // page's scroll position would carry over into the new one.
    contentRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = mobileNavigationRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((element) => element.getClientRects().length > 0);
    const focusFrame = window.requestAnimationFrame(() => {
      const closeButton = panel?.querySelector<HTMLElement>('[data-mobile-nav-close="true"]');
      (closeButton || focusableElements()[0])?.focus();
    });
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
      {!isWorkerView && (
        <div className="hidden h-full w-[280px] shrink-0 lg:block">
          <Sidebar />
        </div>
      )}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={t("dashboardLayout.navigationMenuAria")}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label={t("dashboardLayout.closeNavigationMenu")}
            data-mobile-nav-close="true"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div ref={mobileNavigationRef} className="relative h-full w-[min(20rem,88vw)]">
            <Sidebar mobile onClose={() => setIsMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div ref={contentRef} className={webUi.layout.content}>
        <NavBar
          isNavigationOpen={isMobileSidebarOpen}
          isHidden={isNavBarHidden}
          onOpenNavigation={() => {
            navigationTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setIsMobileSidebarOpen(true);
          }}
        />
        <main className={`${webUi.layout.main} dashboard-scope`}>
          <Outlet />
        </main>
        {!isAdminView ? <ResponsiveBottomNavigation /> : null}
        <MessageDock />
      </div>
    </div>
  );
}
