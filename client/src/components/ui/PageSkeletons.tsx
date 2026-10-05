import { useLocation } from "react-router-dom";
import { webUi } from "../../styles/webUi";
import { Skeleton } from "./Skeleton";

/**
 * Page-level loading states, shaped like the page they stand in for.
 *
 * A skeleton only earns its keep if it matches the real layout — otherwise it
 * is a spinner with extra steps, and the content still visibly jumps into
 * place when it arrives. The route fallback in `App.tsx` is a single
 * `<Suspense>` wrapping *every* route (`App.tsx:315`), outside the dashboard
 * shell, so one generic placeholder stood in for a dashboard, an auth card and
 * the landing page alike — each a different shape, none of them that one.
 *
 * `RouteSkeleton` picks by path instead. The frames below deliberately reuse
 * `webUi.layout` and the same widths as the real chrome (`w-[304px]` sidebar,
 * `h-16` topbar — `DashboardLayout.tsx:99-101`), so the skeleton and the thing
 * it precedes occupy the same box. Change the shell and these follow.
 *
 * Every block is `Skeleton`, which is `aria-hidden` and drops its pulse under
 * reduced motion; each exported frame carries one `role="status"` so assistive
 * tech hears a single "loading" rather than a wall of empty boxes.
 */

/** Sidebar + topbar frame, matching `DashboardLayout`'s geometry. */
export function DashboardShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className={webUi.layout.shell}>
      <div className="hidden h-full w-[304px] shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-4 lg:flex">
        <Skeleton className="h-10 w-40" />
        <div className="mt-6 flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-11 w-full" />
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>

      <div className={webUi.layout.content}>
        <div className="flex h-16 min-h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-6 w-40 sm:w-56" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        </div>
        <div className={webUi.layout.main}>
          <div className={webUi.layout.maxContainer}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Page title + subtitle, the opening of nearly every dashboard screen. */
function PageHeadingSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
    </>
  );
}

/** Stat tiles over a list — the dashboard overview shape. */
function OverviewSkeleton() {
  return (
    <>
      <PageHeadingSkeleton />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <Skeleton key={tile} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-card lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    </>
  );
}

/** Toolbar over rows — the admin management screens. */
function TableSkeleton() {
  return (
    <>
      <PageHeadingSkeleton />
      <div className="mt-6 rounded-card border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-11 w-full max-w-sm" />
          <Skeleton className="h-11 w-36" />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
            <div key={row} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-6 w-20 rounded-full md:block" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Filter rail beside a results grid — the job search screens. */
function SearchSkeleton() {
  return (
    <>
      <PageHeadingSkeleton />
      <Skeleton className="mt-6 h-14 w-full rounded-xl" />
      <div className="mt-4 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((chip) => (
          <Skeleton key={chip} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <Skeleton key={card} className="h-56 w-full rounded-card" />
        ))}
      </div>
    </>
  );
}

/** Conversation list beside a thread — Messages. */
function TwoPaneSkeleton() {
  return (
    <div className="flex h-[70dvh] gap-4">
      <div className="flex w-full flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 md:w-[340px]">
        <Skeleton className="h-11 w-full" />
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-1 flex-col rounded-card border border-slate-200 bg-white p-4 md:flex">
        <Skeleton className="h-12 w-56" />
        <div className="mt-6 flex flex-1 flex-col gap-4">
          <Skeleton className="h-16 w-2/3 rounded-card" />
          <Skeleton className="h-16 w-1/2 self-end rounded-card" />
          <Skeleton className="h-16 w-3/5 rounded-card" />
        </div>
        <Skeleton className="mt-4 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Stacked labelled fields — Settings and the profile editors. */
function FormSkeleton() {
  return (
    <>
      <PageHeadingSkeleton />
      <div className="mt-6 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((tab) => (
          <Skeleton key={tab} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-6 rounded-card border border-slate-200 bg-white p-6">
        {[0, 1, 2, 3].map((field) => (
          <div key={field} className={field === 0 ? "" : "mt-5"}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-[52px] w-full rounded-control" />
          </div>
        ))}
        <Skeleton className="mt-6 h-[52px] w-40 rounded-control" />
      </div>
    </>
  );
}

/** The centred card the auth screens render inside. */
function AuthSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F7F8FA] px-4 py-10">
      <div className="w-full max-w-[460px] rounded-card border border-slate-200 bg-white p-8">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="mx-auto mt-5 h-7 w-48" />
        <Skeleton className="mx-auto mt-3 h-4 w-64 max-w-full" />
        <Skeleton className="mt-8 h-[52px] w-full rounded-control" />
        <Skeleton className="mx-auto mt-6 h-4 w-32" />
        {[0, 1].map((field) => (
          <div key={field} className="mt-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-[52px] w-full rounded-control" />
          </div>
        ))}
        <Skeleton className="mt-6 h-[52px] w-full rounded-control" />
      </div>
    </div>
  );
}

/** Marketing page: hero, then stacked sections. */
function PublicPageSkeleton() {
  return (
    <div className="min-h-dvh bg-white">
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-6">
        <Skeleton className="h-8 w-36" />
        <div className="hidden items-center gap-6 md:flex">
          {[0, 1, 2].map((link) => (
            <Skeleton key={link} className="h-4 w-20" />
          ))}
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <Skeleton className="h-12 w-3/4 max-w-2xl" />
        <Skeleton className="mt-4 h-12 w-2/3 max-w-xl" />
        <Skeleton className="mt-6 h-5 w-full max-w-lg" />
        <Skeleton className="mt-8 h-14 w-full max-w-xl rounded-xl" />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="h-64 w-full rounded-[24px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The route-level fallback.
 *
 * Matches on pathname because that is all that is knowable before the chunk
 * loads — the route's own component, and therefore its layout, is precisely
 * the thing still downloading. Ordered most specific first.
 */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  const path = pathname.toLowerCase();

  const isDashboard = /^\/(worker|employer|admin)(\/|$)/.test(path);

  if (!isDashboard) {
    if (/sign-?in|sign-?up|forgot-password|reset-password|verify/.test(path)) return <AuthSkeleton />;
    return <PublicPageSkeleton />;
  }

  let content = <OverviewSkeleton />;
  if (/messages/.test(path)) content = <TwoPaneSkeleton />;
  else if (/settings|profile/.test(path)) content = <FormSkeleton />;
  else if (/find-jobs|jobs|applications|applicants/.test(path)) content = <SearchSkeleton />;
  else if (path.startsWith("/admin/") && !/dashboard/.test(path)) content = <TableSkeleton />;

  return <DashboardShellSkeleton>{content}</DashboardShellSkeleton>;
}
