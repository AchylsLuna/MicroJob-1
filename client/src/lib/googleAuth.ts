/**
 * Whether Google sign-in is configured for this build.
 *
 * `GoogleSignInButton` renders nothing when no client id is present, so the
 * auth screens gate the "or continue with Google" divider on the same value —
 * otherwise a stray rule is left hanging above empty space.
 *
 * Set VITE_GOOGLE_CLIENT_ID (see client/.env.example) to the public OAuth 2.0
 * web client id from the Google Cloud Console. The server also needs
 * GOOGLE_CLIENT_ID, or POST /auth/google answers 503 by design.
 */
export const googleSignInConfigured = Boolean(
  String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim(),
);
