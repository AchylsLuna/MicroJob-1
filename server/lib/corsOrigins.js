const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8082',
  'http://127.0.0.1:8082',
];

export function splitOrigins(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildAllowedOrigins({
  clientOrigin = '',
  extraOrigins = '',
  defaults = DEFAULT_ALLOWED_ORIGINS,
} = {}) {
  return new Set([
    ...splitOrigins(clientOrigin),
    ...splitOrigins(extraOrigins),
    ...defaults,
  ]);
}

export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  return allowedOrigins.has(origin);
}
