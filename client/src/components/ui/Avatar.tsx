import { useState } from "react";
import { User } from "lucide-react";
import { getAvatarVisual, getInitials } from "../../lib/avatarVisuals";
import { toAbsoluteAssetUrl } from "../../lib/assetUrl";

type Props = {
  name?: string | null;
  /**
   * Prefer passing the user id: the placeholder colour is derived from it, so
   * using the id keeps a person's colour stable when they rename themselves.
   * Falls back to the name when no id is available.
   */
  userId?: string | null;
  /** Stored upload path or absolute URL. Resolved and error-guarded here. */
  avatarUrl?: string | null;
  /**
   * Overrides the monogram derived from `name`. For callers that already
   * compute initials under their own rules (ProfileHeader takes them as a
   * prop, so employer records can monogram a company name rather than a
   * person's) and must keep that behaviour.
   */
  initials?: string | null;
  /**
   * Rendered box in px, applied as an inline style the way CategoryTile sizes
   * its tile. Pass `null` when the box must be sized by `className` instead --
   * an inline width would win over responsive utilities, so a caller with a
   * breakpoint-dependent avatar needs this. Such callers should also supply a
   * font-size class, since the monogram can no longer be scaled from `size`.
   */
  size?: number | null;
  shape?: "circle" | "card";
  className?: string;
};

/**
 * One person-shaped image slot: the uploaded photo when there is one, a
 * deterministic flat-colour monogram when there is not.
 *
 * Replaces the hand-rolled `charAt(0)` circles that were scattered across the
 * review list and the public profile. Those had two problems this fixes: every
 * person got the same `bg-brand-100`, so a list of reviewers read as one
 * repeated shape, and an `avatarUrl` that failed to load left a broken-image
 * box rather than degrading to the monogram.
 *
 * That second case is not hypothetical. A stored `/uploads/<file>` path is
 * served by UploadRoute, which resolves it out of Azure Blob or the Mongo
 * StoredUpload collection -- and that lookup has several ordinary ways to come
 * back empty: StoredUpload carries a TTL index on `metadata.purgeAt`, the Azure
 * container is a no-op when unconfigured, and the route authorises by matching
 * the filename against User fields, so a stale URL 404s rather than 200s.
 * `onError` is what makes this component unable to render blank.
 *
 * Decorative by design: every current call site renders the person's name as
 * adjacent text, so announcing it again here would just make screen readers
 * repeat themselves. Mirrors CategoryTile's `aria-hidden` treatment.
 */
export function Avatar({ name, userId, avatarUrl, initials: initialsOverride, size = 44, shape = "circle", className }: Props) {
  // Keyed by URL rather than a boolean so the guard self-heals: when this
  // component is reused for a different person (a re-sorted review list
  // reusing DOM nodes), a previous failure must not suppress the new photo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const resolved = toAbsoluteAssetUrl(avatarUrl);
  const radius = shape === "circle" ? "rounded-full" : "rounded-card";
  const sized = typeof size === "number";

  if (resolved && resolved !== failedUrl) {
    return (
      <img
        src={resolved}
        alt=""
        aria-hidden="true"
        onError={() => setFailedUrl(resolved)}
        className={`shrink-0 object-cover ${radius} ${className || ""}`}
        style={sized ? { width: size, height: size } : undefined}
      />
    );
  }

  const visual = getAvatarVisual(userId || name);
  const initials = (initialsOverride || "").trim() || getInitials(name);

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-bold leading-none ${radius} ${className || ""}`}
      style={{
        ...(sized ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : null),
        backgroundColor: visual.fill,
        color: visual.onFill,
      }}
    >
      {/* A nameless record ("Verified user" stripped, a deleted account) gets a
          glyph instead of an empty coloured circle, which would read as a bug. */}
      {initials || <User size={sized ? Math.round(size * 0.5) : 18} strokeWidth={2} />}
    </div>
  );
}
