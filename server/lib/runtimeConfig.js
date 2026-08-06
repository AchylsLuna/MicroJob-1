const LOCAL_WEB_ORIGIN = 'http://localhost:5173';

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function getWebOrigin() {
  return String(
    process.env.WEB_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    process.env.ORIGIN ||
    (isProductionRuntime() ? '' : LOCAL_WEB_ORIGIN)
  ).replace(/\/$/, '');
}

export function validateProductionRuntime() {
  if (!isProductionRuntime()) return;

  const required = [
    ['MONGO_URI or MONGODB_URI', process.env.MONGO_URI || process.env.MONGODB_URI],
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['WEB_ORIGIN or CLIENT_ORIGIN', process.env.WEB_ORIGIN || process.env.CLIENT_ORIGIN],
    ['FRONTEND_URL', process.env.FRONTEND_URL],
  ];
  const missing = required.filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);

  for (const [name, value] of [
    ['WEB_ORIGIN', process.env.WEB_ORIGIN || process.env.CLIENT_ORIGIN],
    ['FRONTEND_URL', process.env.FRONTEND_URL],
  ]) {
    let url;
    try {
      url = new URL(String(value));
    } catch {
      throw new Error(`${name} must be an absolute HTTPS URL.`);
    }
    if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`);
  }
}
