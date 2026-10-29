const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { generateToken } = require('../middlewares/auth');
const crypto = require('crypto');
const { isValidTunisiaPhone, formatTunisiaPhone, TUNISIA_PHONE_ERROR } = require('../utils/phone');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/mailer');
const logger = require('../utils/logger');

/**
 * Build the absolute URL the user clicks in the reset email.
 *
 * Resolution order:
 *   1. The Origin / Referer header on the incoming request — keeps the link
 *      pointing at whatever frontend the user actually used (Lovable preview,
 *      staging domain, custom domain, mobile webview).
 *   2. process.env.FRONTEND_URL — explicit override for cron-style callers
 *      that don't have a request context.
 *   3. Hard-coded production fallback — last resort so emails always work.
 */
function buildResetLink(token, req) {
  // Allow-list of host patterns the API will trust as a frontend origin. We
  // only follow the request Origin when it matches one of these — otherwise
  // an attacker could send a forgot-password request with a malicious Origin
  // header and trick the email into linking to phishing.moto-scoot.tn.
  //
  // IMPORTANT: do NOT match arbitrary `*.lovable.app` subdomains. Anyone can
  // publish a Lovable project at `<their-id>.lovable.app` and forge an Origin
  // header that would otherwise pass the regex, sending our users' reset
  // links to their phishing site. We hard-code only the OUR project's
  // preview hosts (id-preview, project--<id>) plus production domains.
  //
  // Production canonical domain is `moto-scoot.tn` (with hyphen). The legacy
  // `moto-scoot.tn` (no hyphen) is kept in the allow-list because some early
  // links / DNS aliases may still resolve there during the transition.
  const TRUSTED_HOSTS = [
    /^(www\.)?moto-scoot\.tn$/i,
    /^(www\.)?motoscoot\.tn$/i,
    /^motoscoot\.ihebchebbi\.pro$/i,
    /^id-preview--[a-f0-9-]+\.lovable\.app$/i,
    /^project--[a-f0-9-]+(-dev)?\.lovable\.app$/i,
    /^localhost(:\d+)?$/i,
    /^127\.0\.0\.1(:\d+)?$/i,
  ];
  const TRUSTED_HOST_RE = (host) => TRUSTED_HOSTS.some((re) => re.test(host));

  let base = null;
  try {
    const fromReq = req && (req.get?.('origin') || req.get?.('referer'));
    if (fromReq) {
      const u = new URL(fromReq);
      if (TRUSTED_HOST_RE(u.host)) base = `${u.protocol}//${u.host}`;
    }
  } catch { /* malformed header — fall through */ }

  if (!base) base = process.env.FRONTEND_URL || 'https://www.moto-scoot.tn';
  base = base.replace(/\/+$/, '');
  return `${base}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
}

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    // Accept both the legacy and the new FE payload shapes:
    //   - legacy:  { full_name, seller_type }
    //   - new FE:  { first_name, last_name, account_type }  (composed by authApi.toBackendRegisterPayload, but we
    //              still accept the raw shape here so older clients don't break)
    const b = req.body || {};
    const email = b.email;
    const password = b.password;
    const rawPhone = b.phone;
    const city = b.city;
    const governorate = b.governorate;

    const composedFullName = [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
    const full_name = (b.full_name && String(b.full_name).trim()) || composedFullName || null;

    // Map account_type → seller_type when only the new shape is sent.
    const accountType = b.account_type ? String(b.account_type).toLowerCase() : null;
    const seller_type = b.seller_type
      || (accountType === 'pro' || accountType === 'professional' ? 'Pro' : (accountType ? 'Particulier' : 'Particulier'));

    // Pro-only fields. Trimmed; empty strings normalized to null so the column
    // stores NULL instead of '' for accounts that didn't fill them in.
    //
    // shop_name:    free-text, length-capped (DB bloat / abuse guard).
    // shop_address: free-text, length-capped, no URL/JS scheme allowed
    //               (defensive — even though no consumer eval()s it, sloppy
    //               UI rendering of `<a href={shop_address}>` would otherwise
    //               make `javascript:alert(1)` a stored-XSS vector).
    // shop_logo:    must be an http(s) URL or a `/uploads/...` path. Anything
    //               else (data:, javascript:, file:) is rejected outright so
    //               the URL can never reach an <img src> with an unsafe scheme.
    const trimOrNull = (v, max = 255) => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!s) return null;
      if (s.length > max) return { _err: `Champ trop long (max ${max} caractères).` };
      return s;
    };
    const shop_name    = trimOrNull(b.shop_name, 200);
    const shop_address = trimOrNull(b.shop_address, 500);
    let   shop_logo    = trimOrNull(b.shop_logo, 1024);

    for (const f of [shop_name, shop_address, shop_logo]) {
      if (f && typeof f === 'object' && f._err) return res.status(400).json({ error: f._err });
    }
    // Block dangerous URL schemes in shop_address (it's free-text but some FE
    // surfaces render it inside a link). Allow plain text and http(s) only.
    if (shop_address && /^\s*(javascript|data|vbscript|file):/i.test(shop_address)) {
      return res.status(400).json({ error: "L'adresse de la boutique contient un format non autorisé." });
    }
    // shop_logo MUST be a URL we'd be willing to put in <img src>.
    if (shop_logo) {
      if (!(/^https?:\/\//i.test(shop_logo) || shop_logo.startsWith('/uploads/'))) {
        return res.status(400).json({ error: "Le logo de la boutique doit être une URL http(s) ou un fichier déposé." });
      }
    }

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password and full_name (or first_name + last_name) are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Phone is required at signup so buyers can contact the seller.
    if (!rawPhone || !isValidTunisiaPhone(rawPhone)) {
      return res.status(400).json({ error: TUNISIA_PHONE_ERROR });
    }
    // Phone is guaranteed non-empty by the validator above; no need for `|| null`.
    const phone = formatTunisiaPhone(rawPhone);

    // Pro accounts must have a shop name + address so listings carry a real
    // identity. The frontend already enforces this; double-check server-side
    // so direct API calls can't bypass it.
    if (seller_type === 'Pro') {
      if (!shop_name)    return res.status(400).json({ error: 'Le nom de la boutique est requis pour un compte Professionnel.' });
      if (!shop_address) return res.status(400).json({ error: "L'adresse de la boutique est requise pour un compte Professionnel." });
    }

    // Check existing
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Try the full insert first (with shop_* columns from migration 011).
      // If the DB hasn't been migrated yet, Postgres raises 42703 ("column
      // does not exist"), which ALSO marks the entire transaction as aborted —
      // any further query then fails with 25P02 ("current transaction is
      // aborted, commands ignored until end of transaction block").
      //
      // The fix is a SAVEPOINT around the optimistic insert: on 42703 we
      // ROLLBACK TO SAVEPOINT, which clears the aborted state without
      // killing the surrounding transaction, and we can safely retry with
      // the legacy column set.
      let rows;
      await client.query('SAVEPOINT users_insert');
      try {
        ({ rows } = await client.query(
          `INSERT INTO users
             (email, password_hash, full_name, phone, city, governorate, seller_type,
              shop_name, shop_address, shop_logo, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
           RETURNING id, email, full_name, phone, city, governorate,
                     avatar_url, seller_type, shop_name, shop_address, shop_logo,
                     is_active, created_at`,
          [email.toLowerCase(), password_hash, full_name, phone, city || null,
           governorate || null, seller_type || 'Particulier',
           shop_name, shop_address, shop_logo]
        ));
        await client.query('RELEASE SAVEPOINT users_insert');
      } catch (innerErr) {
        if (innerErr && innerErr.code === '42703') {
          // Roll back ONLY the failed insert, keep the outer transaction alive.
          await client.query('ROLLBACK TO SAVEPOINT users_insert');
          await client.query('RELEASE SAVEPOINT users_insert');
          ({ rows } = await client.query(
            `INSERT INTO users (email, password_hash, full_name, phone, city, governorate, seller_type, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
             RETURNING id, email, full_name, phone, city, governorate,
                       avatar_url, seller_type, is_active, created_at`,
            [email.toLowerCase(), password_hash, full_name, phone, city || null,
             governorate || null, seller_type || 'Particulier']
          ));
        } else { throw innerErr; }
      }

      // Assign default role
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [rows[0].id, 'user']
      );

      await client.query('COMMIT');

      // Mark this signup moment as the user's first "session" so audience /
      // last-seen analytics don't classify brand new accounts as inactive
      // until they explicitly log in. Best-effort — failure must not block
      // the registration response.
      query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [rows[0].id])
        .catch(() => { /* non-fatal */ });

      const token = generateToken(rows[0]);

      // Fire-and-forget welcome email. SMTP failures must NEVER block signup,
      // so we swallow the error and just log it for ops to monitor.
      sendWelcomeEmail({ to: rows[0].email, name: rows[0].full_name })
        .then(() => logger.info(`[auth] welcome email sent (user ${rows[0].id})`))
        .catch((mailErr) => logger.error(`[auth] FAILED to send welcome email (user ${rows[0].id}):`, mailErr && mailErr.message));

      // Mirror the /auth/login response shape: include `roles` so the frontend
      // can drive role-gated UI off a single field regardless of which auth
      // entry point produced the user object. New signups always get ['user'].
      res.status(201).json({ user: { ...rows[0], roles: ['user'] }, token });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, avatar_url, seller_type, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Get roles
    const roles = await query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]);

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ user: { ...safeUser, roles: roles.rows.map(r => r.role) }, token });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 *
 * Always returns success to prevent email enumeration.
 *
 * EMAIL DELIVERY: not yet wired. Until a real mailer (SendGrid / SES /
 * Mailgun) is configured, set `RESET_TOKEN_DEV_LOG=1` in the environment to
 * have the generated reset token surfaced in the response body — useful for
 * local development & manual QA.
 */
// In-memory throttle for forgot-password (per email). Keyed by lowercased
// email; entries are evicted opportunistically. Survives only the process
// lifetime, which is fine — it is a defence-in-depth layer on top of the
// global rate limiter.
const _forgotPwTimers = new Map();
const FORGOT_PW_COOLDOWN_MS = 60 * 1000; // 1 minute between requests per email

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const key = String(email).toLowerCase().trim();
    const now = Date.now();
    const last = _forgotPwTimers.get(key) || 0;
    if (now - last < FORGOT_PW_COOLDOWN_MS) {
      // Always reply 200 with the generic message so the throttle doesn't leak
      // whether the email exists.
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }
    _forgotPwTimers.set(key, now);
    // Lazy GC — keep the map small.
    if (_forgotPwTimers.size > 5000) {
      for (const [k, t] of _forgotPwTimers) {
        if (now - t > FORGOT_PW_COOLDOWN_MS * 5) _forgotPwTimers.delete(k);
      }
    }

    const { rows } = await query(
      'SELECT id, email, full_name FROM users WHERE LOWER(email) = $1',
      [key]
    );
    if (rows.length === 0) {
      // Generic response — never leak whether the email exists.
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
      [rows[0].id, token, expires]
    );

    // Fire the email. We deliberately do NOT await-rethrow on SMTP failure
    // because surfacing the error would leak the fact that the address exists
    // (success path returns the same generic message). Instead, log loudly so
    // ops can spot delivery problems in the backend logs.
    const link = buildResetLink(token, req);
    try {
      await sendPasswordResetEmail({
        to: rows[0].email,
        name: rows[0].full_name,
        link,
      });
      logger.info(`[auth] password reset email sent (user ${rows[0].id}, req ${req.id || '-'})`);
    } catch (mailErr) {
      logger.error(`[auth] FAILED to send password reset email (user ${rows[0].id}):`, mailErr && mailErr.message);
    }

    // Optional dev backdoor: when explicitly enabled in non-production, also
    // return the raw token so manual QA can bypass the inbox.
    const devLog = process.env.RESET_TOKEN_DEV_LOG === '1' && process.env.NODE_ENV === 'development';
    res.json({
      message: 'If the email exists, a reset link has been sent',
      ...(devLog ? { dev_token: token, dev_link: link } : {}),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { rows } = await query(
      `SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const password_hash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, rows[0].user_id]);
    await query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].user_id]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh-token
 */
async function refreshToken(req, res, next) {
  try {
    // req.user is set by authenticate middleware
    const { rows } = await query('SELECT id, email, full_name, avatar_url FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const token = generateToken(rows[0]);
    res.json({ token, user: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    // Include the new whatsapp / address / lat-lng columns so the dashboard
    // Settings tab can hydrate the form on first load. Falls back gracefully
    // on older DBs that don't have these columns yet (42703).
    let rows;
    try {
      ({ rows } = await query(
        `SELECT id, email, full_name, phone, whatsapp, avatar_url, seller_type,
                city, governorate, bio, address, latitude, longitude,
                shop_name, shop_address, shop_logo,
                is_verified, created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT id, email, full_name, phone, avatar_url, seller_type, city, governorate, bio, is_verified, created_at
           FROM users WHERE id = $1`,
          [req.user.id]
        ));
      } else { throw innerErr; }
    }
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const roles = await query('SELECT role FROM user_roles WHERE user_id = $1', [req.user.id]);
    res.json({ ...rows[0], roles: roles.rows.map(r => r.role) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, forgotPassword, resetPassword, refreshToken, getMe };
