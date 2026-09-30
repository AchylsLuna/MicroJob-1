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
import { ErrorBoundary } from "./ErrorBoundary";

export function DashboardLayout() {
  const { t } = useTranslation("common");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(
    () => localStorage.getItem("microjobs_sidebar_collapsed") === "true",
  );
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const navigationTriggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAuth();
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isAdminView = normalizedRole === "admin" || normalizedRole === "superadmin";

  const isNavBarHidden = useHideOnScroll(contentRef, { disabled: isMobileSidebarOpen });

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("microjobs_sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setIsMobileSidebarOpen(false);
    // A fresh route should always start scrolled to the top, and the top navbar
    // should be visible there — otherwise a hidden navbar from the previous
    // page's scroll position would carry over into the new one.
    contentRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    // Lock the element that actually scrolls. `document.body` does not scroll
    // inside this shell -- it is `h-[100dvh] overflow-hidden` and scrolling
    // happens in `contentRef` (webUi.layout.content, `overflow-y-auto`), which
    // CookieConsent already had to discover the hard way when padding `body`
    // turned out to be a no-op here. Locking `body` looked like a scroll lock
    // and did nothing: the page carried on scrolling behind the open drawer.
    // Body is still locked as well, for the public-shell case where it is the
    // scroller.
    const scroller = contentRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousScrollerOverflow = scroller?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";
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
      if (scroller) scroller.style.overflow = previousScrollerOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      navigationTriggerRef.current?.focus();
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className={webUi.layout.shell}>
      <div
        className={`hidden h-full shrink-0 overflow-hidden transition-[width] duration-200 lg:block ${
          isDesktopSidebarCollapsed ? "w-[108px]" : "w-[304px]"
        }`}
      >
        <Sidebar collapsed={isDesktopSidebarCollapsed} onToggleCollapsed={toggleDesktopSidebar} />
      </div>
      {isMobileSidebarOpen && (
        /* z-100, matching `ui/index.tsx`'s Dialog: this is an `aria-modal`
           surface, and the cookie banner (z-90) was painting over it. The app
           had already decided modals outrank that banner -- the drawer and the
           message sheet were the two that had not been brought in line. Being
           the top layer is also what lets this panel use the full viewport
           height again instead of reserving space for chrome it now covers. */
        <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label={t("dashboardLayout.navigationMenuAria")}>
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
          {/* Keyed on pathname so navigating to another page clears a crash
              instead of stranding the user on the fallback. The sidebar and nav
              stay mounted, so they can still navigate their way out. */}
          <ErrorBoundary resetKey={location.pathname}>
            {/* Re-keying the page surface gives every dashboard route --
                including cards and quick links that call navigate() -- the
                same unobtrusive entrance transition. */}
            <div key={location.pathname} className="page-transition">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
        {!isAdminView ? <ResponsiveBottomNavigation /> : null}
        <MessageDock />
      </div>
    </div>
  );
}
