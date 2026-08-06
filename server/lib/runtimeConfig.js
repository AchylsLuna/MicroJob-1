const LOCAL_WEB_ORIGIN = 'http://localhost:5173';

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

export function getWebOrigin() {
  return trimTrailingSlashes(
    process.env.WEB_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    process.env.ORIGIN ||
    getVercelOrigins()[0] ||
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
