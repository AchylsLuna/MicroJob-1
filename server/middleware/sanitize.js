// Simple NoSQL injection sanitizer middleware.
// Removes any keys starting with '$' or containing '.' from req.body, req.query, and req.params.
const isDangerousKey = (key) => key.startsWith('$') || key.includes('.');

function scrub(value) {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(scrub);
  }

  const clean = {};
  for (const key of Object.keys(value)) {
    if (isDangerousKey(key)) continue;
    clean[key] = scrub(value[key]);
  }
  return clean;
}

function scrubInPlace(target) {
  if (!target || typeof target !== 'object') return;

  const clean = scrub(target);
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, clean);
}

export default function sanitize(req, res, next) {
  try {
    // req.query can be getter-only in newer Express versions, so sanitize in-place.
    if (req.query && typeof req.query === 'object') {
      scrubInPlace(req.query);
    }

    if (req.params && typeof req.params === 'object') {
      scrubInPlace(req.params);
    }

    // req.body is generally writable; keep assignment so arrays/primitives are handled correctly.
    if (req.body !== undefined) {
      req.body = scrub(req.body);
    }
  } catch (err) {
    console.warn('Sanitization failed', err);
  }
  next();
}
