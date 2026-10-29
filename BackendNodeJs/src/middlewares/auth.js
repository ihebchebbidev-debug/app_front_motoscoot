const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { JWT_SECRET } = require('../config/jwt');
const logger = require('../utils/logger');

// LRU cache of users.is_active checks. Keyed by user id, TTL 60s.
// Avoids hammering the DB on every authenticated request while still giving
// a ban-hammer admin near-immediate effect (worst case: 60s lag).
//
// JS Map preserves insertion order, so we get true LRU semantics by deleting
// + re-inserting the entry on every cache HIT (it moves to the tail). Eviction
// then drops the head, which is the genuinely least-recently-used entry —
// not just the oldest insertion as the previous implementation did.
const ACTIVE_CACHE = new Map(); // id -> { active: bool, exp: ms }
const ACTIVE_TTL_MS = 60_000;
const ACTIVE_CACHE_MAX = 5000;

async function isUserActive(userId) {
  const now = Date.now();
  const cached = ACTIVE_CACHE.get(userId);
  if (cached && cached.exp > now) {
    // Promote to MRU position so frequently-checked users never get evicted.
    ACTIVE_CACHE.delete(userId);
    ACTIVE_CACHE.set(userId, cached);
    return cached.active;
  }
  // Stale entry — drop it before refetching so we don't leave a ghost in place
  // if the DB call below throws.
  if (cached) ACTIVE_CACHE.delete(userId);
  try {
    const { rows } = await query('SELECT is_active FROM users WHERE id = $1', [userId]);
    const active = rows.length === 0 ? false : rows[0].is_active !== false;
    ACTIVE_CACHE.set(userId, { active, exp: now + ACTIVE_TTL_MS });
    // True LRU eviction: head of the Map = least recently used.
    while (ACTIVE_CACHE.size > ACTIVE_CACHE_MAX) {
      const lruKey = ACTIVE_CACHE.keys().next().value;
      ACTIVE_CACHE.delete(lruKey);
    }
    return active;
  } catch (err) {
    // Fail-CLOSED for users we have a recent "banned" verdict on, fail-OPEN
    // for everyone else. The previous unconditional fail-open meant a banned
    // user regained access for the duration of any DB outage. Keeping the
    // last-known verdict for cached entries gives the same uptime for normal
    // users without re-enabling banned accounts.
    const stale = ACTIVE_CACHE.get(userId);
    if (stale && stale.active === false) return false;
    logger.warn(`isUserActive: DB check failed for user ${userId}, falling back to allow:`, err && err.message);
    return true;
  }
}

/** Require valid JWT + non-banned account */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // Token blacklist check (best-effort, fail-open if table missing)
    try {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const { rows } = await query('SELECT 1 FROM token_blacklist WHERE token_hash = $1', [hash]);
      if (rows.length) return res.status(401).json({ error: 'Token revoked' });
    } catch { /* ignore if table not yet migrated */ }

    // Banned/deactivated user check — invalidates the JWT immediately
    // (within the 60s cache window) when an admin flips is_active=false.
    if (req.user?.id) {
      const active = await isUserActive(req.user.id);
      if (!active) return res.status(403).json({ error: 'Account disabled' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Optionally attach user if token present, but don't block */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.split(' ')[1], JWT_SECRET); } catch { /* ignore */ }
  }
  next();
}

/** Require admin role (must come after authenticate) */
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2',
      [req.user.id, 'admin']
    );
    if (rows.length === 0) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { authenticate, optionalAuth, requireAdmin, generateToken };
