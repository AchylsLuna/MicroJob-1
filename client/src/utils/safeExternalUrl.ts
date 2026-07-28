export type ExternalUrlPurpose = "asset" | "payment" | "external";

export type SafeExternalUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "missing" | "malformed" | "protocol" | "untrusted-host" | "untrusted-path" };

const PAYMENT_HOST_SUFFIXES = ["paymongo.com", "xendit.co"];

const isLocalDevelopmentHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const matchesHost = (hostname: string, candidate: string) =>
  hostname === candidate || hostname.endsWith(`.${candidate}`);

export function getSafeExternalUrl(
  value: unknown,
  options: { purpose?: ExternalUrlPurpose; trustedOrigins?: string[] } = {},
): SafeExternalUrlResult {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { ok: false, reason: "missing" };
  if (raw.startsWith("//")) return { ok: false, reason: "protocol" };

  const purpose = options.purpose || "external";
  const baseOrigin = typeof window === "undefined" ? "https://microjobs.invalid" : window.location.origin;
  let parsed: URL;
  try {
    parsed = new URL(raw, baseOrigin);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const isLocalHttp = parsed.protocol === "http:" && isLocalDevelopmentHost(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) return { ok: false, reason: "protocol" };

  if (purpose === "payment") {
    const trustedPaymentHost = PAYMENT_HOST_SUFFIXES.some((host) => matchesHost(parsed.hostname, host));
    if (!trustedPaymentHost && !isLocalDevelopmentHost(parsed.hostname)) {
      return { ok: false, reason: "untrusted-host" };
    }
  }

  if (purpose === "asset") {
    const trustedOrigins = new Set([baseOrigin, ...(options.trustedOrigins || [])]);
    if (!trustedOrigins.has(parsed.origin)) return { ok: false, reason: "untrusted-host" };
    if (!parsed.pathname.startsWith("/uploads/")) return { ok: false, reason: "untrusted-path" };
  }

  return { ok: true, url: parsed.toString() };
}

export function safeExternalUrl(value: unknown, options?: Parameters<typeof getSafeExternalUrl>[1]) {
  const result = getSafeExternalUrl(value, options);
  return result.ok ? result.url : null;
}
