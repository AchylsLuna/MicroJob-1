const DEV_FALLBACK_JWT_SECRET = 'microjobs-dev-only-jwt-secret-change-me';
let hasWarnedAboutFallback = false;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required.');
  }

  // Keep local development usable without forcing secret setup.
  process.env.JWT_SECRET = DEV_FALLBACK_JWT_SECRET;
  if (!hasWarnedAboutFallback) {
    hasWarnedAboutFallback = true;
    console.warn(
      'JWT_SECRET is not set; using a development fallback secret. Set JWT_SECRET in env for safer local auth.'
    );
  }
  return DEV_FALLBACK_JWT_SECRET;
}
