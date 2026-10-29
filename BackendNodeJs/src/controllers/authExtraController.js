const { query } = require('../config/database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../middlewares/auth');
const { sendWelcomeEmail, sendVerificationEmail } = require('../services/mailer');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../config/jwt');

function buildVerifyLink(token) {
  const base = (process.env.FRONTEND_URL || 'https://www.moto-scoot.tn').replace(/\/+$/, '');
  return `${base}/verifier-email?token=${encodeURIComponent(token)}`;
}

/** POST /api/auth/check-email { email } -> { available } */
async function checkEmail(req, res, next) {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      // LOWER() on the column ensures we match regardless of how the row was
      // originally cased — registration normalizes to lowercase but legacy
      // rows may have mixed case. Comparing raw email returned false negatives.
      const { rows } = await query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
      return res.json({ available: rows.length === 0 });
    } catch (dbErr) {
      // 42P01 = undefined_table — be permissive on misconfigured deployments so
      // the signup screen never breaks. Final uniqueness is enforced at INSERT.
      if (dbErr && dbErr.code === '42P01') return res.json({ available: true });
      throw dbErr;
    }
  } catch (e) { next(e); }
}

/** POST /api/auth/verify-email { token } */
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    const { rows } = await query(
      'SELECT user_id FROM email_verifications WHERE token = $1 AND expires_at > NOW() AND verified_at IS NULL',
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    await query('UPDATE email_verifications SET verified_at = NOW() WHERE token = $1', [token]);
    await query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [rows[0].user_id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

/** POST /api/auth/resend-verification (auth required) */
async function resendVerification(req, res, next) {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO email_verifications (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [req.user.id, token]
    );

    // Look up the user's email + name to send the verification link.
    const { rows } = await query('SELECT email, full_name FROM users WHERE id = $1', [req.user.id]);
    const link = buildVerifyLink(token);
    if (rows.length > 0) {
      sendVerificationEmail({ to: rows[0].email, name: rows[0].full_name, link })
        .then(() => logger.info(`[auth] verification email sent (user ${req.user.id})`))
        .catch((err) => logger.error(`[auth] FAILED to send verification email (user ${req.user.id}):`, err && err.message));
    }

    res.json({ success: true, token: process.env.NODE_ENV !== 'production' ? token : undefined });
  } catch (e) { next(e); }
}

/** POST /api/auth/clerk { clerk_id, email, full_name, avatar_url, provider, session_token? } */
async function clerkSync(req, res, next) {
  try {
    const { clerk_id, email, full_name, avatar_url, provider = 'google', session_token } = req.body;
    if (!clerk_id || !email) return res.status(400).json({ error: 'clerk_id and email required' });
    const cleanEmail = email.toLowerCase().trim();

    // ---- Verify Clerk session token ----
    // Two verification modes are supported:
    //   1. CLERK_JWT_PUBLIC_KEY — static PEM public key (recommended, offline,
    //      no network round-trip to Clerk's JWKS endpoint).
    //   2. CLERK_JWKS_URL — fetch signing keys from Clerk's JWKS (legacy).
    // Either one being set triggers mandatory verification of the session JWT.
    const staticPublicKey = (process.env.CLERK_JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
    const jwksUrl = process.env.CLERK_JWKS_URL;
    if (staticPublicKey || jwksUrl) {
      const tokenFromHeader = (req.headers.authorization || '').startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null;
      const clerkToken = session_token || tokenFromHeader;
      if (!clerkToken) {
        return res.status(401).json({ error: 'Clerk session token required' });
      }
      try {
        // Pin issuer and (optionally) audience so a token from ANOTHER Clerk
        // tenant cannot be accepted here.
        const verifyOpts = { algorithms: ['RS256'] };
        if (process.env.CLERK_ISSUER) verifyOpts.issuer = process.env.CLERK_ISSUER;
        if (process.env.CLERK_AUDIENCE) verifyOpts.audience = process.env.CLERK_AUDIENCE;

        let verified;
        if (staticPublicKey) {
          // Offline verification with the configured PEM.
          verified = jwt.verify(clerkToken, staticPublicKey, verifyOpts);
        } else {
          const jwksClient = require('jwks-rsa');
          const client = jwksClient({ jwksUri: jwksUrl, cache: true, cacheMaxAge: 10 * 60 * 1000 });
          const getKey = (header, cb) => {
            client.getSigningKey(header.kid, (err, key) => {
              if (err) return cb(err);
              cb(null, key.getPublicKey());
            });
          };
          verified = await new Promise((resolve, reject) => {
            jwt.verify(clerkToken, getKey, verifyOpts, (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded);
            });
          });
        }
        if (verified.sub && verified.sub !== clerk_id) {
          return res.status(403).json({ error: 'Clerk session does not match clerk_id' });
        }
      } catch (verifyErr) {
        logger.warn(`[auth] Clerk token verification failed: ${verifyErr && verifyErr.message}`);
        return res.status(401).json({ error: 'Invalid Clerk session token' });
      }
    }

    // Defense-in-depth: never SELECT * from users — explicitly enumerate the
    // safe columns so we cannot accidentally leak password_hash, reset tokens,
    // or other sensitive fields into a future res.json(user) call.
    const SAFE_COLS = 'id, email, clerk_id, full_name, avatar_url, provider, is_active';
    let { rows } = await query(`SELECT ${SAFE_COLS} FROM users WHERE clerk_id = $1`, [clerk_id]);
    if (rows.length === 0) {
      rows = (await query(`SELECT ${SAFE_COLS} FROM users WHERE email = $1`, [cleanEmail])).rows;
      if (rows.length > 0) {
        // Refuse to merge if the matching local row already has a DIFFERENT
        // clerk_id — that's the account-takeover vector. Even without JWKS
        // verification, this stops overwriting an existing Clerk binding.
        if (rows[0].clerk_id && rows[0].clerk_id !== clerk_id) {
          return res.status(409).json({ error: 'Email already linked to another Clerk account' });
        }
        await query(
          'UPDATE users SET clerk_id = $1, provider = $2, email_verified_at = COALESCE(email_verified_at, NOW()), avatar_url = COALESCE(avatar_url, $3) WHERE id = $4',
          [clerk_id, provider, avatar_url || null, rows[0].id]
        );
      } else {
        const ins = await query(
          `INSERT INTO users (email, clerk_id, full_name, avatar_url, provider, email_verified_at)
           VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING ${SAFE_COLS}`,
          [cleanEmail, clerk_id, full_name || cleanEmail.split('@')[0], avatar_url || null, provider]
        );
        rows = ins.rows;
        await query(
          `INSERT INTO user_roles (user_id, role) VALUES ($1, 'user') ON CONFLICT DO NOTHING`,
          [rows[0].id]
        );

        // Brand-new account via Clerk → send the welcome email (fire-and-forget).
        sendWelcomeEmail({ to: rows[0].email, name: rows[0].full_name })
          .then(() => logger.info(`[auth] welcome email sent (clerk signup, user ${rows[0].id})`))
          .catch((mailErr) => logger.error(`[auth] FAILED to send welcome email (clerk signup, user ${rows[0].id}):`, mailErr && mailErr.message));
      }
    }
    const user = rows[0];
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url } });
  } catch (e) { next(e); }
}

/** POST /api/auth/logout (auth required) — blacklist current token */
async function logout(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.json({ success: true });
    const token = header.split(' ')[1];
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 3600e3);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query(
      `INSERT INTO token_blacklist (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING`,
      [hash, req.user.id, expiresAt]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { checkEmail, verifyEmail, resendVerification, clerkSync, logout };
