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

module.exports = function sanitize(req, res, next) {
  try {
    if (req.body) req.body = scrub(req.body);
    if (req.query) req.query = scrub(req.query);
    if (req.params) req.params = scrub(req.params);
  } catch (err) {
    console.warn('Sanitization failed', err);
  }
  next();
};
