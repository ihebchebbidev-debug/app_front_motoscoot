/**
 * Request-Id middleware.
 *
 * - Honors any incoming `X-Request-Id` header (so reverse proxies / clients
 *   can correlate logs end-to-end). Falls back to a fresh UUID v4 otherwise.
 * - Attaches the id to `req.id`.
 * - Always echoes the id back via `X-Request-Id` so callers can capture it
 *   even when they didn't send one.
 * - Attaches a child logger `req.log` whose output is automatically prefixed
 *   with the request id, the HTTP method, and the URL.
 *
 * Downstream code should prefer `req.log.*` over the bare `logger` so every
 * line is correlated with a request. The bare `logger` is still fine for
 * boot-time / background-job messages.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

// Validate inbound IDs lightly — accept anything UUID/ULID/short id-ish,
// but cap length and strip control chars to avoid log injection.
function sanitizeIncoming(id) {
  if (typeof id !== 'string') return null;
  const cleaned = id.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (cleaned.length === 0 || cleaned.length > 128) return null;
  return cleaned;
}

function newId() {
  // crypto.randomUUID is available in Node 14.17+, 16+ and is what we ship on.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function requestId(req, res, next) {
  const incoming = sanitizeIncoming(req.headers['x-request-id']);
  const id = incoming || newId();

  req.id = id;
  res.setHeader('X-Request-Id', id);

  // Per-request bound logger
  const tag = `[req=${id}] ${req.method} ${req.originalUrl}`;
  req.log = {
    info: (...args) => logger.info(tag, ...args),
    warn: (...args) => logger.warn(tag, ...args),
    error: (...args) => logger.error(tag, ...args),
    debug: (...args) => logger.debug(tag, ...args),
  };

  next();
}

module.exports = { requestId };
