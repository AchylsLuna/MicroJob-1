export function createRateLimiter({ windowMs, max, prefix = "default", keyFn } = {}) {
  if (!windowMs || !max) {
    throw new Error("createRateLimiter requires windowMs and max options.");
  }

  const buckets = new Map();
  let requestCounter = 0;
  const cleanupThreshold = 100;

  const cleanupExpiredBuckets = (now) => {
    requestCounter += 1;
    if (requestCounter < cleanupThreshold) {
      return;
    }

    requestCounter = 0;
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const baseKey = keyFn ? keyFn(req) : req.ip;
    const key = `${prefix}:${baseKey || "unknown"}`;

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    }

    existing.count += 1;
    buckets.set(key, existing);

    return next();
  };
}
