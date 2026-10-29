/**
 * Centralized JWT secret loader.
 *
 * Single source of truth for the signing secret used by the auth middleware,
 * the socket gateway, the auth/clerk controllers, the public garage detail
 * (optional-auth) endpoint, and the dev test harness. Previously each of
 * these files duplicated `process.env.JWT_SECRET || 'change-me-in-production'`,
 * which meant a missing env var in production would silently fall back to the
 * insecure default in 5 different places (only `middlewares/auth.js` warned).
 *
 * Now: in production we HARD-FAIL at boot if JWT_SECRET is missing or still
 * the placeholder. In dev/test we log a loud warning but keep going so local
 * setup stays painless.
 */
const PLACEHOLDER = 'change-me-in-production';
const raw = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production') {
  if (!raw || raw === PLACEHOLDER || raw.length < 32) {
    // Fail fast — refuse to boot a prod server with a guessable JWT secret.
    // eslint-disable-next-line no-console
    console.error('[FATAL] JWT_SECRET is missing, default, or shorter than 32 chars in production. Refusing to start.');
    process.exit(1);
  }
} else if (!raw || raw === PLACEHOLDER) {
  // eslint-disable-next-line no-console
  console.warn('[WARN] JWT_SECRET is using the insecure default. Set a strong secret before deploying.');
}

const JWT_SECRET = raw || PLACEHOLDER;

module.exports = { JWT_SECRET };
