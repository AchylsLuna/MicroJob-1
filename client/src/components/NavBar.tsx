import { useState, useRef, useEffect, useMemo, type ReactNode, type Ref } from "react";
import { ArrowRight, Bell, MapPin, Menu, Search } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { LAYER_Z } from "./ui/layers";
import { toast } from "../lib/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { jobsAPI } from "../services/jobs";
import { mapNotificationRecord, type FeedNotification } from "../utils/notificationFeed";
import { useNotifications } from "../contexts/NotificationContext";
import { ROUTES, matchesAnyPath, matchesPath, startsWithPath } from "../utils/routes";
import { webUi } from "../styles/webUi";
import { MicroJobsLogo } from "./MicroJobsLogo";
// Neither worker navigation list is imported here any more. The header's
// duplicate worker nav went first, and the "More" dropdown that outlived it
// followed for the same reason -- every destination it offered is a row in the
// sidebar. The sidebar owns both lists and imports them directly.

interface NavBarProps {
  isNavigationOpen?: boolean;
  onOpenNavigation?: () => void;
  showDesktopNavigationTrigger?: boolean;
  navigationButtonRef?: Ref<HTMLButtonElement>;
  /** Hide the navbar (slid up out of view) — set by the scrollable dashboard shell. */
  isHidden?: boolean;
}

export function NavBar({ isNavigationOpen = false, onOpenNavigation, showDesktopNavigationTrigger = false, navigationButtonRef, isHidden = false }: NavBarProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  // Never slide the bar away while the notifications menu is open — the popover
  // isn't re-anchored to the header's transform, so hiding mid-interaction
  // would visually detach it from its trigger.
  const isNavBarHidden = isHidden && !showNotifications;
  const notificationState = useNotifications();
  const refreshNotifications = notificationState.refresh;
  const [appliedJobsCount, setAppliedJobsCount] = useState<number>(0);
  
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isEmployerView =
    user?.accountType === "employer" ||
    normalizedRole === "employer" ||
    normalizedRole === "doctor" ||
    normalizedRole === "hire";
  const notificationAudience: "admin" | "employer" | "worker" =
    normalizedRole === "admin" || normalizedRole === "superadmin"
      ? "admin"
      : isEmployerView
      ? "employer"
      : "worker";

  const headerRef = useRef<HTMLElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  const notifications = useMemo(() => notificationState.notifications
    .map((item: any) => mapNotificationRecord(item, notificationAudience, "relative"))
    .slice(0, 10), [notificationAudience, notificationState.notifications]);
  const notificationsLoading = notificationState.loading;
  const unreadCount = notificationState.unreadCount;
  const path = location.pathname;
  const isWorkerView = notificationAudience === "worker";
  const isPath = (...targets: string[]) => matchesAnyPath(path, targets);
  const isExactPath = (...targets: string[]) => targets.some((target) => matchesPath(path, target));
  const isAppliedJobsPage = isPath(
    ROUTES.worker.appliedJobs,
    ROUTES.legacyDashboard.appliedJobs,
    ROUTES.legacyShortcuts.appliedJobs,
  );

  useEffect(() => {
    if (!isAppliedJobsPage) return;
    let isMounted = true;
    const loadAppliedCount = async () => {
      try {
        const response = await jobsAPI.getUserApplications();
        const nextCount = Array.isArray(response?.data) ? response.data.length : 0;
        if (isMounted) setAppliedJobsCount(nextCount);
      } catch {
        if (isMounted) setAppliedJobsCount(0);
      }
    };
    loadAppliedCount();
    return () => {
      isMounted = false;
    };
  }, [isAppliedJobsPage, path]);

  type PageMeta = {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    search?: { placeholder: string; mode: "query" };
    action?: { label: string; to: string };
    subtitleAction?: string;
    homeContext?: boolean;
  };

  const localArea = [user?.city, user?.province]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  const pageMeta: PageMeta = (() => {
    // Find Jobs is the worker's home now that the worker dashboard is gone, so
    // it carries the home chrome (local-area subtitle) as well as its own search.
    // The legacy /dashboard root must stay an *exact* match: isPath is a prefix
    // test, so listing it there would shadow every /dashboard/* route below.
    if (
      isExactPath(ROUTES.legacyDashboard.root) ||
      isPath(
        ROUTES.worker.findJobs,
        ROUTES.legacyDashboard.findJobs,
        ROUTES.legacyShortcuts.findJobs,
      )
    ) {
      return {
        title: t("navbar.pages.findJobs.title"),
        subtitle: localArea || t("navbar.setLocalArea"),
        subtitleAction: `${ROUTES.worker.settings}?tab=personal`,
        homeContext: true,
        search: { placeholder: t("navbar.pages.findJobs.searchPlaceholder"), mode: "query" as const },
      };
    }

    if (isPath(ROUTES.worker.appliedJobs, ROUTES.legacyDashboard.appliedJobs, ROUTES.legacyShortcuts.appliedJobs)) {
      return {
        title: t("navbar.pages.appliedJobs.title"),
        subtitle: t("navbar.appliedJobsCount", { count: appliedJobsCount }),
      };
    }

    if (
      isPath(
        ROUTES.worker.messages,
        ROUTES.legacyDashboard.messages,
        ROUTES.legacyShortcuts.messages,
        ROUTES.employer.messages,
        ROUTES.admin.messages,
        ROUTES.doctor.messages,
        ROUTES.legacyDashboard.employer.messages,
        ROUTES.legacyDashboard.admin.messages,
        ROUTES.legacyDashboard.doctor.messages,
      )
    ) {
      return { title: t("navbar.pages.messages.title") };
    }

    if (
      isPath(
        ROUTES.worker.support,
        ROUTES.legacyDashboard.support,
        ROUTES.support,
        ROUTES.employer.support,
        ROUTES.doctor.support,
        ROUTES.legacyDashboard.employer.support,
        ROUTES.legacyDashboard.doctor.support,
      )
    ) {
      return { title: t("navbar.pages.support.title"), search: { placeholder: t("navbar.pages.support.searchPlaceholder"), mode: "query" as const } };
    }

    if (isPath(ROUTES.worker.savedJobs, ROUTES.legacyDashboard.savedJobs, ROUTES.legacyShortcuts.savedJobs)) {
      return {
        title: t("navbar.pages.savedJobs.title"),
        search: { placeholder: t("navbar.pages.savedJobs.searchPlaceholder"), mode: "query" as const },
      };
    }

    if (
      isPath(
        ROUTES.worker.eWallet,
        ROUTES.legacyDashboard.eWallet,
        ROUTES.legacyShortcuts.eWallet,
        ROUTES.employer.eWallet,
        ROUTES.admin.payouts,
        ROUTES.admin.support,
        ROUTES.doctor.eWallet,
        ROUTES.legacyDashboard.admin.payouts,
        ROUTES.legacyDashboard.admin.support,
        ROUTES.legacyDashboard.employer.eWallet,
        ROUTES.legacyDashboard.doctor.eWallet,
      )
    ) {
      if (isPath(ROUTES.admin.payouts, ROUTES.legacyDashboard.admin.payouts)) {
        return { title: t("navbar.pages.payoutRequests.title") };
      }
      if (isPath(ROUTES.admin.support, ROUTES.legacyDashboard.admin.support)) {
        return { title: t("navbar.pages.supportTickets.title") };
      }
      return { title: t("navbar.pages.eWallet.title") };
    }

    if (
      isPath(
        ROUTES.worker.notifications,
        ROUTES.legacyDashboard.notifications,
        ROUTES.notifications,
        ROUTES.employer.notifications,
        ROUTES.doctor.notifications,
        ROUTES.legacyDashboard.employer.notifications,
        ROUTES.legacyDashboard.doctor.notifications,
      )
    ) {
      return {
        title: t("navbar.pages.notifications.title"),
        subtitle: t("navbar.pages.notifications.subtitle"),
      };
    }

    if (
      isPath(
        ROUTES.settings,
        ROUTES.worker.settings,
        ROUTES.legacyDashboard.settings,
        ROUTES.employer.settings,
        ROUTES.doctor.settings,
        ROUTES.legacyDashboard.employer.settings,
        ROUTES.legacyDashboard.doctor.settings,
      )
    ) {
      return { title: t("navbar.pages.settings.title") };
    }

    if (isPath(ROUTES.worker.profile, ROUTES.legacyDashboard.profile, ROUTES.legacyShortcuts.profile)) {
      return { title: t("navbar.pages.profile.title") };
    }

    if (
      isExactPath(
        ROUTES.doctor.dashboard,
        ROUTES.doctor.root,
        ROUTES.legacyDashboard.doctor.root,
        ROUTES.employer.dashboard,
        ROUTES.employer.root,
        ROUTES.legacyDashboard.employer.root,
      )
    ) {
      return {
        title: t("navbar.pages.employerHome.title"),
        subtitle: localArea || t("navbar.setLocalArea"),
        subtitleAction: `${ROUTES.employer.settings}?tab=personal`,
        homeContext: true,
        action: { label: t("navbar.pages.employerHome.action"), to: ROUTES.employer.postJob },
      };
    }

    if (
      isPath(
        ROUTES.doctor.applications,
        ROUTES.legacyDashboard.doctor.applications,
        ROUTES.employer.applications,
        ROUTES.legacyDashboard.employer.applications,
      )
    ) {
      return {
        title: t("navbar.pages.applications.title"),
        subtitle: t("navbar.pages.applications.subtitle"),
        action: { label: t("navbar.pages.applications.action"), to: ROUTES.employer.jobs },
      };
    }

    if (
      isPath(
        ROUTES.doctor.postJob,
        ROUTES.legacyDashboard.doctor.postJob,
        ROUTES.employer.postJob,
        ROUTES.legacyDashboard.employer.postJob,
      )
    ) {
      return {
        title: t("navbar.pages.postJob.title"),
        subtitle: t("navbar.pages.postJob.subtitle"),
        action: { label: t("navbar.pages.postJob.action"), to: ROUTES.employer.jobs },
      };
    }

    if (
      isPath(
        ROUTES.doctor.jobs,
        ROUTES.legacyDashboard.doctor.jobs,
        ROUTES.employer.jobs,
        ROUTES.legacyDashboard.employer.jobs,
      )
    ) {
      return {
        title: t("navbar.pages.jobsManagement.title"),
        search: { placeholder: t("navbar.pages.jobsManagement.searchPlaceholder"), mode: "query" as const },
      };
    }

    if (isPath(ROUTES.admin.analytics, ROUTES.legacyDashboard.admin.analytics)) {
      return {
        title: t("navbar.pages.adminAnalytics.title"),
        subtitle: t("navbar.pages.adminAnalytics.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.eWallet, ROUTES.legacyDashboard.admin.eWallet)) {
      return {
        title: t("navbar.pages.adminEWallet.title"),
        subtitle: t("navbar.pages.adminEWallet.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.jobs, ROUTES.legacyDashboard.admin.jobs)) {
      return {
        title: t("navbar.pages.adminJobs.title"),
        subtitle: t("navbar.pages.adminJobs.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.userManagement, ROUTES.legacyDashboard.admin.userManagement)) {
      return {
        title: t("navbar.pages.adminUsers.title"),
        subtitle: t("navbar.pages.adminUsers.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.reports, ROUTES.legacyDashboard.admin.reports)) {
      return {
        title: t("navbar.pages.adminReports.title"),
        subtitle: t("navbar.pages.adminReports.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.security, ROUTES.legacyDashboard.admin.security)) {
      return {
        title: t("navbar.pages.adminSecurity.title"),
        subtitle: t("navbar.pages.adminSecurity.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.dashboard, ROUTES.legacyDashboard.admin.root)) {
      return {
        title: t("navbar.pages.adminDashboard.title"),
        subtitle: t("navbar.pages.adminDashboard.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.staffManagement, ROUTES.legacyDashboard.admin.staffManagement)) {
      return {
        title: t("navbar.pages.adminStaffManagement.title"),
        subtitle: t("navbar.pages.adminStaffManagement.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.auditLogs, ROUTES.legacyDashboard.admin.auditLogs)) {
      return {
        title: t("navbar.pages.adminAuditLogs.title"),
        subtitle: t("navbar.pages.adminAuditLogs.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.moderationQueue, ROUTES.legacyDashboard.admin.moderationQueue)) {
      return {
        title: t("navbar.pages.adminModerationQueue.title"),
        subtitle: t("navbar.pages.adminModerationQueue.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.verificationReview, ROUTES.legacyDashboard.admin.verificationReview)) {
      return {
        title: t("navbar.pages.adminVerificationReview.title"),
        subtitle: t("navbar.pages.adminVerificationReview.subtitle"),
      };
    }

    if (isPath(ROUTES.admin.disputes, ROUTES.legacyDashboard.admin.disputes)) {
      return {
        title: t("navbar.pages.adminDisputes.title"),
        subtitle: t("navbar.pages.adminDisputes.subtitle"),
      };
    }

    if (
      startsWithPath(path, ROUTES.worker.jobDetailsPattern.replace("/:jobId", "")) ||
      startsWithPath(path, ROUTES.legacyDashboard.jobDetailsPattern.replace("/:jobId", ""))
    ) {
      return { title: t("navbar.pages.jobDetails.title") };
    }

    if (
      startsWithPath(path, ROUTES.doctor.root) ||
      startsWithPath(path, ROUTES.legacyDashboard.doctor.root) ||
      startsWithPath(path, ROUTES.employer.root) ||
      startsWithPath(path, ROUTES.legacyDashboard.employer.root)
    ) {
      return { title: t("navbar.pages.employerFallback.title") };
    }

    if (startsWithPath(path, ROUTES.admin.root) || startsWithPath(path, ROUTES.legacyDashboard.admin.root)) {
      return { title: t("navbar.pages.adminFallback.title") };
    }

    return { title: "" };
  })();

  const searchValue = pageMeta.search?.mode === "query" ? searchParams.get("q") ?? "" : "";

  const handleSearchChange = (value: string) => {
    if (pageMeta.search?.mode === "query") {
      setSearchParams(value ? { q: value } : {});
    }
  };

  // Published as a CSS variable so the notifications popover can size and place
  // itself against the header's real height instead of a magic number --
  // it is 4rem normally but 5rem on "home context" pages, and a hardcoded
  // offset got that wrong on exactly the two most-visited screens. Mirrors the
  // same ResizeObserver -> CSS variable pattern ResponsiveBottomNavigation uses.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const apply = () => {
      document.documentElement.style.setProperty("--navbar-height", `${header.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--navbar-height");
    };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        window.requestAnimationFrame(() => notificationButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showNotifications]);

  useEffect(() => {
    if (showNotifications) {
      void refreshNotifications();
    }
  }, [refreshNotifications, showNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notification: FeedNotification) => {
    try {
      await notificationState.setRead(notification.id, true);
    } catch (error: any) {
      toast.error(error?.message || t("navbar.toast.markNotificationFailed"));
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationState.markAllRead();
      toast.success(t("navbar.toast.markAllReadSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("navbar.toast.markAllReadFailed"));
    }
  };

  return (
    <header
      ref={headerRef}
      className={`${webUi.navbar.root} transform-gpu transition-transform ${
        prefersReducedMotion ? "duration-[0ms]" : "duration-300 ease-out"
      } ${isNavBarHidden ? "-translate-y-full navbar-slide-hidden" : "translate-y-0"}`}
    >

      <div className={`${webUi.navbar.container} ${pageMeta.homeContext ? "!h-20 !min-h-20" : ""}`}>
        <div className={`flex min-w-0 items-center gap-2 ${isWorkerView ? "lg:gap-7" : ""}`}>
          <button
            ref={navigationButtonRef}
            type="button"
            onClick={onOpenNavigation}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${showDesktopNavigationTrigger ? "" : "lg:hidden"}`}
            aria-label={t("navbar.openNavigationMenu")}
            // The desktop panel remains mounted when closed. The mobile
            // drawer's id exists only while that drawer is open.
            aria-controls={showDesktopNavigationTrigger ? "desktop-dashboard-navigation" : isNavigationOpen ? "mobile-dashboard-navigation" : undefined}
            aria-expanded={isNavigationOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* The worker's desktop navigation is the sidebar, and only the
              sidebar. A second `<nav>` used to live here at `xl`, listing the
              same destinations -- so above 1280px a worker had two navigation
              landmarks with identical links, and a screen reader announced the
              same menu twice. The sidebar renders from `lg` upward with no
              upper bound (DashboardLayout.tsx) and already carries every one of
              those destinations, so this was pure duplication.

              Removing it also lets the wordmark and page title below drop their
              `xl:` guards, which existed only to hand off to this nav. */}
          {pageMeta.title && (
            <div className="flex min-w-0 items-center gap-3">
              <MicroJobsLogo markOnly className="shrink-0" />
              {pageMeta.icon && (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F2F8]">
                  {pageMeta.icon}
                </span>
              )}
              {/* Always shown now. This used to be `xl:hidden` for workers so
                  the header nav could take over; with that nav gone, hiding it
                  would leave the worker header empty above 1280px. */}
              <div className="min-w-0 leading-tight">
                <h1 className={webUi.navbar.title}>{pageMeta.title}</h1>
                {pageMeta.subtitle && pageMeta.subtitleAction ? (
                  /* No pill background on this one: the chip read as a status
                     badge next to the page title rather than the quiet link to
                     location settings that it is. The hover underline carries
                     the affordance the fill used to.
                     The 44px tap target is the `::after` overlay, not the box
                     itself. With the fill gone, `min-h-11` was 44px of visible
                     emptiness between the title and this line -- and it pushed
                     the whole header past its own `h-16`. The overlay keeps the
                     target without taking the space. */
                  <button
                    type="button"
                    onClick={() => navigate(pageMeta.subtitleAction!)}
                    className="relative mt-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-xs font-bold leading-tight text-[#0F2954] transition after:absolute after:inset-x-0 after:-inset-y-4 after:content-[''] hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={t("navbar.locationSettingsAria", { subtitle: pageMeta.subtitle })}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    <span className="truncate">{pageMeta.subtitle}</span>
                    <span className="shrink-0 text-brand" aria-hidden>›</span>
                  </button>
                ) : pageMeta.subtitle ? <p className={webUi.navbar.subtitle}>{pageMeta.subtitle}</p> : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {pageMeta.search && !isWorkerView && (
            <div className="relative hidden h-10 w-[min(26vw,22rem)] min-w-0 md:block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={pageMeta.search.placeholder}
                aria-label={pageMeta.search.placeholder}
                className={webUi.navbar.searchInput}
              />
            </div>
          )}
          {pageMeta.action && (
            <button
              type="button"
              data-testid="header-context-action"
              onClick={() => navigate(pageMeta.action!.to)}
              className="hidden min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:inline-flex"
            >
              {pageMeta.action.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <div className="relative" ref={notificationsRef}>
            <button
              ref={notificationButtonRef}
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
              }}
              className={`${webUi.navbar.iconButton} border-slate-200 bg-white shadow-sm`}
              title={t("navbar.notifications")}
              aria-label={unreadCount > 0 ? t("navbar.notificationsAriaLabelUnread", { count: unreadCount }) : t("navbar.notificationsAriaLabel")}
              aria-expanded={showNotifications}
              aria-haspopup="menu"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              /* `top-full` is the bottom edge of this popover's containing
                 block, which is the header on mobile (the header carries a
                 transform, so it contains its own fixed descendants) and the
                 bell button's wrapper at sm+. Both are exactly where the menu
                 should start, so the same class is correct in both modes --
                 unlike the `top-[4.5rem]` it replaces, which assumed a 4rem
                 header and so overlapped it on the 5rem "home" pages. */
              <div role="menu" aria-label={t("navbar.notifications")} className={`fixed left-4 right-4 top-full mt-2 ${LAYER_Z.furniture} flex max-h-[calc(100dvh-var(--navbar-height,4rem)-var(--mobile-bottom-nav-height,0px)-var(--cookie-banner-height,0px)-1.5rem)] flex-col overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:w-[380px] ${webUi.navbar.popover}`}>
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4">
                  <h3 className="font-semibold text-section text-[#111827]">
                    {t("navbar.notifications")} {unreadCount > 0 && `(${unreadCount})`}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="min-h-9 rounded-lg px-2 text-xs font-bold text-brand hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {t("navbar.markAllAsRead")}
                    </button>
                  )}
                </div>

                {/* Flexes into whatever the popover's own cap leaves rather
                    than carrying its own 400px cap -- with a fixed height here
                    and `overflow-hidden` on the parent, anything past the cap
                    was clipped outright instead of scrolling. */}
                <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[400px]">
                  {notificationsLoading ? (
                    <div className="p-6 text-center text-body text-[#6B7280]">
                      {t("navbar.loadingNotifications")}
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        className={`block min-h-11 w-full border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                          !notification.read ? "bg-brand/[0.06]" : ""
                        }`}
                        onClick={async () => {
                          await markAsRead(notification);
                          navigate(notification.link || ROUTES.notifications);
                          setShowNotifications(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-body text-[#111827]">
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-brand"></div>
                              )}
                            </div>
                            <p className="text-body-sm text-[#6B7280] mb-1">{notification.message}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{notification.time}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Bell className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                      <p className="text-body text-[#6B7280]">{t("navbar.noNotifications")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
