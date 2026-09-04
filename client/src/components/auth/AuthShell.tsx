import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MicroJobsLogo } from "../MicroJobsLogo";

/**
 * The frame every public auth screen sits in: light background, one centred
 * column, logo, a single `<h1>`, then the form.
 *
 * It owns both the `<main>` element and the page's only `<h1>` — the e2e suite
 * asserts exactly one visible instance of each on /sign-in, /sign-up and
 * /forgot-password, so screens using this must not render their own.
 */
type AuthShellProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Where the back link goes. Omit to hide it. */
  backTo?: string;
  backLabel?: string;
  /** "wide" fits the two role cards side by side; everything else is "narrow". */
  width?: "narrow" | "wide";
  /** Rendered above the heading — the sign-in success banner uses this. */
  banner?: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  backTo,
  backLabel,
  width = "narrow",
  banner,
}: AuthShellProps) {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-white px-5 py-8 sm:py-12">
      <div className={`mx-auto flex w-full flex-col ${width === "wide" ? "max-w-[680px]" : "max-w-[440px]"}`}>
        {backTo ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="-ml-2 mb-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-[10px] px-2 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </button>
        ) : null}

        <div className="flex justify-center">
          <MicroJobsLogo />
        </div>

        {banner ? <div className="mt-6">{banner}</div> : null}

        <h1 className="mt-7 text-center text-[30px] font-bold leading-tight tracking-tight text-slate-950 sm:text-[34px]">
          {title}
        </h1>

        {subtitle ? (
          <p className="mx-auto mt-2 max-w-[400px] text-center text-[15px] leading-6 text-slate-600">
            {subtitle}
          </p>
        ) : null}

        <div className="mt-8">{children}</div>

        {footer ? <div className="mt-8 text-center text-[14px] text-slate-600">{footer}</div> : null}
      </div>
    </main>
  );
}

/**
 * Shared control styling. Kept as exported strings rather than a wrapper
 * component because the three screens need different input internals — one is
 * uncontrolled via a ref, one is numeric-only, one carries a toggle button.
 */
export const authFieldClass =
  "min-h-[52px] w-full rounded-[10px] border border-slate-300 bg-white px-4 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]/25 disabled:bg-slate-50 disabled:text-slate-500";

export const authFieldErrorClass =
  "border-red-400 focus:border-red-500 focus:ring-red-500/25";

export const authLabelClass = "mb-2 block text-[14px] font-semibold text-slate-900";

export const authPrimaryButtonClass =
  "brand-primary-interactive min-h-[52px] w-full rounded-[10px] px-5 text-[15px] font-semibold";
