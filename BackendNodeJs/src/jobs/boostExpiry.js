/**
 * Boost expiry sweeper.
 *
 * Listings get `is_featured = TRUE` when a row is added to `listing_boosts`,
 * but nothing was ever flipping it back to FALSE once `ends_at` passed. This
 * module owns that lifecycle:
 *
 *   - `expireBoosts()`           — runs the SQL sweep once. Returns how many
 *                                  listings were un-featured.
 *   - `startBoostExpiryJob()`    — schedules a periodic sweep (every 10 min by
 *                                  default), with a small startup delay so we
 *                                  don't hammer the DB during boot.
 *   - `lazyExpireOne(listingId)` — best-effort, fire-and-forget per-listing
 *                                  check meant for read paths so a stale
 *                                  `is_featured = TRUE` self-heals on next
 *                                  view even if the cron is down.
 *
 * Idempotent and safe to call from anywhere; failures are logged, never thrown
 * to the caller.
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Clear `is_featured` on every listing whose boosts have all expired.
 *
 * The "all expired" guard is critical: a listing may carry several boost rows
 * (renewals, stacked packs). We only un-feature when NONE of them are still
 * active (`ends_at IS NULL OR ends_at > NOW()`).
 *
 * Returns `{ swept }` — the number of listings whose `is_featured` was flipped.
 */
async function expireBoosts() {
  try {
    const { rows } = await query(
      `UPDATE listings l
          SET is_featured = FALSE
        WHERE l.is_featured = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM listing_boosts b
             WHERE b.listing_id = l.id
               AND (b.ends_at IS NULL OR b.ends_at > NOW())
          )
        RETURNING l.id`
    );
    if (rows.length) {
      logger.info(`⏱  Boost expiry: cleared is_featured on ${rows.length} listing(s)`);
    }
    return { swept: rows.length };
  } catch (err) {
    logger.warn('Boost expiry sweep failed:', err.message);
    return { swept: 0, error: err.message };
  }
}

/**
 * Lazily expire a single listing's boost. Designed to be called on hot read
 * paths (`getById`, `getPopular`, etc.) so that even with the cron disabled
 * the user never sees a "Featured" badge on a listing whose boost ended.
 *
 * Fire-and-forget: never awaited, never blocks the response.
 *
 * Rate guard: a featured listing can be viewed thousands of times per minute,
 * which would otherwise trigger thousands of identical UPDATEs. We dedupe
 * per-listing in a small in-memory Set with a short TTL — the first hit
 * fires the UPDATE, every subsequent hit within the TTL is a no-op. That's
 * fine because the UPDATE is idempotent and the cron sweep is the source
 * of truth anyway.
 */
const _lazyExpireSeen = new Map(); // listingId -> expiresAt(ms)
const LAZY_EXPIRE_TTL_MS = 60_000; // 1 update per listing per minute, max
const LAZY_EXPIRE_MAX_KEYS = 5000;

function lazyExpireOne(listingId) {
  if (!listingId) return;
  const now = Date.now();
  const seenUntil = _lazyExpireSeen.get(listingId);
  if (seenUntil && seenUntil > now) return; // already debounced

  // Opportunistic GC so the map never grows without bound under traffic.
  if (_lazyExpireSeen.size > LAZY_EXPIRE_MAX_KEYS) {
    for (const [k, exp] of _lazyExpireSeen) {
      if (exp <= now) _lazyExpireSeen.delete(k);
    }
    // If still too big after GC, drop the oldest insertion to cap memory.
    if (_lazyExpireSeen.size > LAZY_EXPIRE_MAX_KEYS) {
      const firstKey = _lazyExpireSeen.keys().next().value;
      _lazyExpireSeen.delete(firstKey);
    }
  }
  _lazyExpireSeen.set(listingId, now + LAZY_EXPIRE_TTL_MS);

  // Fire-and-forget; swallow errors silently — the cron is the source of truth.
  query(
    `UPDATE listings l
        SET is_featured = FALSE
      WHERE l.id = $1
        AND l.is_featured = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM listing_boosts b
           WHERE b.listing_id = l.id
             AND (b.ends_at IS NULL OR b.ends_at > NOW())
        )`,
    [listingId]
  ).catch(() => { /* best-effort */ });
}

/**
 * Schedule the periodic sweep. Returns a `stop()` function so tests / hot
 * reloads can clean up.
 */
function startBoostExpiryJob({ intervalMs = 10 * 60 * 1000, startupDelayMs = 30_000 } = {}) {
  const initial = setTimeout(expireBoosts, startupDelayMs);
  const handle = setInterval(expireBoosts, intervalMs);
  return () => {
    clearTimeout(initial);
    clearInterval(handle);
  };
}

module.exports = { expireBoosts, lazyExpireOne, startBoostExpiryJob };
