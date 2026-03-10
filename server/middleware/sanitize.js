// Simple NoSQL injection sanitizer middleware
// Removes any keys starting with '$' or containing '.' from req.body, req.query, and req.params
function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(scrub);
  }
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      // skip dangerous key
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') {
      clean[key] = scrub(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function applyCleanInPlace(target, clean) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return;
  }

  for (const key of Object.keys(target)) {
    if (!(key in clean)) {
      delete target[key];
    }
  }

  for (const [key, value] of Object.entries(clean)) {
    target[key] = value;
  }
}

export default function sanitize(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      applyCleanInPlace(req.body, scrub(req.body));
    }
    if (req.query && typeof req.query === 'object') {
      applyCleanInPlace(req.query, scrub(req.query));
    }
    if (req.params && typeof req.params === 'object') {
      applyCleanInPlace(req.params, scrub(req.params));
    }
  } catch (err) {
    console.warn('Sanitization failed', err);
  }
  next();
};
