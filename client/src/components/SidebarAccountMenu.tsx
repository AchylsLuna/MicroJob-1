import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, LogOut, Star, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../utils/routes";
import { Avatar } from "./ui/Avatar";
import { LAYER_Z } from "./ui/layers";
import { webUi } from "../styles/webUi";

const itemClass = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-body-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand";

type SidebarAccountMenuProps = {
  displayName: string;
  isActive: boolean;
  compact?: boolean;
  onNavigate?: () => void;
};

export function SidebarAccountMenu({ displayName, isActive, compact = false, onNavigate }: SidebarAccountMenuProps) {
  const { t } = useTranslation("common");
  const { user, logout, switchAccountType } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLastRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(0);

  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  const isEmployer = user?.accountType === "employer" || ["employer", "doctor", "hire"].includes(role);
  const isWorker = !isAdmin && !isEmployer;
  const accountLabel = t(isAdmin ? "navbar.roleAdmin" : isEmployer ? "navbar.roleEmployer" : "navbar.roleWorker");
  const canSwitch = !isAdmin && Boolean(user && (role === "both" || user.accountPreference === "both"
    || (user.accountOptions?.includes("worker") && user.accountOptions.includes("employer"))));

  const measure = useCallback(() => {
    const button = buttonRef.current;
    const sidebar = rootRef.current?.closest("aside");
    if (!button || !sidebar) return;
    const header = sidebar.querySelector<HTMLElement>(".dashboard-sidebar-header");
    const visibleTop = Math.max(sidebar.getBoundingClientRect().top, header?.getBoundingClientRect().bottom ?? 0,
      window.visualViewport?.offsetTop ?? 0);
    setMaxHeight(Math.max(0, button.getBoundingClientRect().top - visibleTop - 16));
  }, []);

  const openMenu = (focusLast = false) => {
    // Measure before mounting so the first frame already has usable height.
    measure();
    focusLastRef.current = focusLast;
    setIsOpen(true);
  };

  useEffect(() => {
    setIsOpen(false);
  }, [isActive, location.key, user?.id, user?.accountType]);

  useLayoutEffect(() => {
    if (!isOpen || !isActive) return;
    const button = buttonRef.current;
    const sidebar = rootRef.current?.closest("aside");
    if (!button || !sidebar) return;
    const header = sidebar.querySelector<HTMLElement>(".dashboard-sidebar-header");
    // The popup stays in the drawer's focus scope and clipped sidebar. Its
    // height must fit above the real trigger, including after drawer scrolling.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sidebar);
    observer.observe(button);
    if (header) observer.observe(header);
    sidebar.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      sidebar.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [isOpen, isActive, measure]);

  useLayoutEffect(() => {
    if (!isOpen || !isActive) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    const item = items?.[focusLastRef.current ? items.length - 1 : 0];
    item?.focus({ preventScroll: true });
    if (menuRef.current) menuRef.current.scrollTop = focusLastRef.current ? menuRef.current.scrollHeight : 0;
  }, [isOpen, isActive]);

  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (menuRef.current?.contains(document.activeElement)) buttonRef.current?.focus({ preventScroll: true });
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [isOpen]);

  const goTo = (path: string) => {
    setIsOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isOpen && event.key === "Escape") {
      // Consume Escape before the mobile drawer's document listener sees it.
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(event.key === "ArrowUp");
      }
      return;
    }
    if (event.key === "Tab") {
      setIsOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    const item = items[next];
    item.focus({ preventScroll: true });
    const menu = menuRef.current!;
    const itemRect = item.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    if (itemRect.top < menuRect.top) menu.scrollTop -= menuRect.top - itemRect.top;
    else if (itemRect.bottom > menuRect.bottom) menu.scrollTop += itemRect.bottom - menuRect.bottom;
  };

  const identity = <>
    <Avatar name={displayName} userId={user?.id} avatarUrl={user?.avatarUrl} size={40} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-body-sm font-bold text-slate-950">{displayName}</span>
      <span className="block truncate text-caption text-slate-600">{accountLabel}</span>
    </span>
  </>;

  return (
    <div ref={rootRef} className="relative w-full min-w-0" onKeyDownCapture={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}>
      <button ref={buttonRef} type="button" aria-label={t("navbar.openAccountMenu")}
        aria-haspopup="menu" aria-expanded={isOpen && isActive} aria-controls={isOpen && isActive ? menuId : undefined}
        onClick={() => { if (isOpen) setIsOpen(false); else openMenu(); }}
        className={`flex min-h-16 w-full min-w-0 items-center gap-3 rounded-card border border-slate-200 bg-slate-50 p-3 text-left text-slate-900 transition hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [@media(max-height:700px)]:min-h-11 [@media(max-height:700px)]:p-1 ${compact ? "justify-center" : ""}`}>
        <Avatar name={displayName} userId={user?.id} avatarUrl={user?.avatarUrl} size={null}
          className="h-10 w-10 text-sm [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8" />
        {!compact && <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-slate-900">{displayName}</span>
            <span className="block truncate text-xs text-slate-600">{accountLabel}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </>}
      </button>
      {isOpen && isActive && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={t("navbar.accountMenuAria")}
          style={{ maxHeight }}
          className={`absolute inset-x-0 bottom-full mb-2 ${LAYER_Z.furniture} overflow-y-auto overscroll-contain p-2 ${webUi.navbar.popover}`}>
          {isAdmin ? <div className="flex items-center gap-3 p-2">{identity}</div> : (
            <button type="button" role="menuitem" tabIndex={0}
              onClick={() => goTo(isWorker ? ROUTES.worker.profile : ROUTES.employer.profile)}
              className={`${itemClass} !px-2`}>
              {identity}<ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          )}
          {canSwitch && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <button type="button" role="menuitem" tabIndex={-1}
                onClick={() => {
                  const next = isEmployer ? "worker" : "employer";
                  switchAccountType(next);
                  goTo(next === "employer" ? ROUTES.employer.dashboard : ROUTES.worker.findJobs);
                }}
                className="min-h-11 w-full rounded-xl bg-brand px-3 py-2 text-body-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
                {t("navbar.switchTo", { role: t(isEmployer ? "navbar.roleWorker" : "navbar.roleEmployer") })}
              </button>
            </div>
          )}
          {!isAdmin && (isWorker || user?.id) && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              {isWorker && <button type="button" role="menuitem" tabIndex={-1} onClick={() => goTo(ROUTES.worker.profile)} className={itemClass}>
                <UserRound className="h-[18px] w-[18px] shrink-0 text-slate-400" aria-hidden="true" />
                {t("navbar.viewProfile")}
              </button>}
              {user?.id && <button type="button" role="menuitem" tabIndex={-1}
                onClick={() => goTo(`${ROUTES.publicProfile(user.id)}?viewAs=${isWorker ? "worker" : "employer"}`)} className={itemClass}>
                <Star className="h-[18px] w-[18px] shrink-0 text-slate-400" aria-hidden="true" />
                {t("navbar.ratingsAndReviews")}
              </button>}
            </div>
          )}
          <div className="mt-2 border-t border-slate-200 pt-2">
            <button type="button" role="menuitem" tabIndex={isAdmin ? 0 : -1}
              onClick={() => { logout(); goTo(ROUTES.home); }}
              className={`${itemClass} !text-red-700 hover:!bg-red-50 focus-visible:!ring-red-700`}>
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{t("navbar.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
