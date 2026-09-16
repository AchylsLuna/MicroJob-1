import { useState, type ReactNode } from "react";
import { Mail, MapPin } from "lucide-react";

/**
 * The header shared by the worker and employer Profile pages.
 *
 * Both pages previously carried their own near-identical copy of this markup,
 * including a fragile `-mt-16` / `sm:mt-[70px]` offset pair that pulled the name
 * block back down out of the cover band. That is gone: the avatar overlaps the
 * band on its own and the text column simply follows it, so the name can never
 * land dark-on-dark at a narrow width again.
 */
export function ProfileHeader({
  name,
  title,
  location,
  email,
  avatarUrl,
  initials,
  bio,
  moreLabel,
  lessLabel,
  actions,
}: {
  name: string;
  /** Optional role/position line under the name. Employers don't use it. */
  title?: string;
  location: string;
  email?: string;
  /** Accepts null since safeExternalUrl() -- the usual source -- returns string | null. */
  avatarUrl?: string | null;
  initials: string;
  /** Optional "about" text, clamped to three lines behind a show-more toggle. */
  bio?: string;
  moreLabel: string;
  lessLabel: string;
  actions?: ReactNode;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const trimmedBio = bio?.trim();
  // ~180 chars is roughly where three lines fill at this column width; below
  // that the toggle would be a control that visibly does nothing.
  const bioNeedsToggle = Boolean(trimmedBio && trimmedBio.length > 180);

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
      {/* Flat brand band — no gradient, per the standing design rule. */}
      <div className="h-[92px] bg-[#1C4D8D]" />

      <div className="px-6 pb-6 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:gap-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="-mt-12 h-28 w-28 shrink-0 rounded-full border-4 border-white object-cover shadow-md"
              />
            ) : (
              <div className="-mt-12 flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#1C4D8D] shadow-md">
                <span className="text-[36px] font-bold text-white">{initials}</span>
              </div>
            )}

            <div className="min-w-0 pt-1 sm:pt-4">
              <h1 className="truncate text-[26px] font-bold text-[#0F172A]">{name}</h1>
              {title ? <p className="mt-0.5 truncate text-[15px] text-slate-500">{title}</p> : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{location}</span>
                </span>
                {email ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{email}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:pt-4">{actions}</div> : null}
        </div>

        {trimmedBio ? (
          <div className="mt-5 max-w-3xl">
            <p className={`text-[14px] leading-6 text-slate-600 ${bioExpanded ? "" : "line-clamp-3"}`}>
              {trimmedBio}
            </p>
            {bioNeedsToggle ? (
              <button
                type="button"
                onClick={() => setBioExpanded((open) => !open)}
                aria-expanded={bioExpanded}
                className="mt-1 min-h-11 text-[13px] font-semibold text-[#1C4D8D] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
              >
                {bioExpanded ? lessLabel : moreLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
