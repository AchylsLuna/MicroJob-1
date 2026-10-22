import { buildAllowedOrigins } from './corsOrigins.js';

const LOCAL_WEB_ORIGIN = 'http://localhost:8082';

const trimTrailingSlashes = (value) => String(value || '').trim().replace(/\/+$/, '');

const normalizeVercelOrigin = (value) => {
  const normalized = trimTrailingSlashes(value).replace(/^https?:\/\//i, '');
  return normalized ? `https://${normalized}` : '';
};

export function getVercelOrigins() {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map(normalizeVercelOrigin)
    .filter((origin, index, origins) => origin && origins.indexOf(origin) === index);
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

/**
 * The origins this deployment already trusts, rebuilt from env here rather than
 * imported from config/env.js -- that module imports `getVercelOrigins` from
 * this one, so importing it back would be a cycle. `corsOrigins.js` has no
 * imports of its own, so this stays acyclic.
 */
const configuredOrigins = () => buildAllowedOrigins({
  clientOrigin: process.env.WEB_ORIGIN
    || process.env.CLIENT_ORIGIN
    || process.env.FRONTEND_URL
    || process.env.ORIGIN
    || '',
  extraOrigins: [
    process.env.ADDITIONAL_CORS_ORIGINS || '',
    ...getVercelOrigins(),
  ].filter(Boolean).join(','),
  defaults: isProductionRuntime() ? [] : undefined,
});

/**
 * An origin taken from the request, but only if we already trust it.
 *
 * `Origin` and `Referer` are attacker-controlled. This value feeds
 * UserController.getFrontendResetUrl, which builds
 * `<origin>/reset-password?email=…&code=…&token=…` and emails it -- so without
 * the allowlist check, `POST /api/auth/password-reset/request` with
 * `Origin: https://evil.tld` and a victim's address sent that victim a genuine
 * MicroJobs email whose reset link handed the live code to the attacker's host.
 * AdminController.requestAdminUserPasswordReset made it worse by re-invoking the
 * same flow for any chosen user, gated only on `users.resetPassword`.
 *
 * This fallback only ever runs when no WEB_ORIGIN-style env var and no Vercel
 * URL is configured, so in a correctly configured deployment it is unreachable.
 */
const originFromRequest = (req) => {
  if (!req) return '';
  const originHeader = req.headers?.origin;
  const candidate = originHeader
    ? trimTrailingSlashes(originHeader)
    : (() => {
        const referer = req.headers?.referer || req.headers?.referrer;
        if (!referer) return '';
        try {
          return trimTrailingSlashes(new URL(referer).origin);
        } catch {
          return '';
        }
      })();

  if (!candidate) return '';
  return configuredOrigins().has(candidate) ? candidate : '';
};

// `req` is an optional fallback source, used only when no WEB_ORIGIN-style env
// var or Vercel URL is configured (e.g. a preview/staging deploy that isn't
// caught by isProductionRuntime()). Env vars always win when set, so this
// never overrides an explicit configuration.
export function getWebOrigin(req) {
  return trimTrailingSlashes(
    process.env.WEB_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    process.env.ORIGIN ||
    getVercelOrigins()[0] ||
    originFromRequest(req) ||
    (isProductionRuntime() ? '' : LOCAL_WEB_ORIGIN)
  );
}

export function validateProductionRuntime() {
  if (!isProductionRuntime()) return;

  const webOrigin = getWebOrigin();
  const required = [
    ['MONGO_URI or MONGODB_URI', process.env.MONGO_URI || process.env.MONGODB_URI],
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['WEB_ORIGIN or CLIENT_ORIGIN or FRONTEND_URL or VERCEL_URL', webOrigin],
  ];
  const missing = required.filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);

  for (const [name, value] of [['WEB_ORIGIN', webOrigin]]) {
    let url;
    try {
      url = new URL(String(value));
    } catch {
      throw new Error(`${name} must be an absolute HTTPS URL.`);
    }
    if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`);
  }
}
