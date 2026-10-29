/**
 * Similar listings digest job — runs once per day.
 *
 * For each user with at least one favorite in the last 60 days:
 *   1. Compute their "interest set" = distinct (brand, category) tuples from favorites.
 *   2. Find listings created in the last 24h matching that set, that the user
 *      hasn't already favorited and that aren't theirs.
 *   3. Send a single digest email with up to 6 items.
 *   4. Record in `similar_listings_digests` so we don't send twice the same day.
 *
 * Respects `email_preferences.similar_listings = FALSE` opt-out.
 */
const { query } = require('../config/database');
const { sendSimilarListingsEmail } = require('../services/mailer');
const logger = require('../utils/logger');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.moto-scoot.tn';
const MAX_PER_DIGEST = 6;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;    // 5 min after boot

async function runOnce() {
  const startedAt = Date.now();
  let processed = 0, emailed = 0, skipped = 0;
  try {
    // Eligible users: have at least one favorite in last 60 days, didn't get
    // a digest today, and haven't opted out.
    const { rows: users } = await query(`
      SELECT DISTINCT u.id, u.email, u.name
        FROM users u
        JOIN favorites f ON f.user_id = u.id
        LEFT JOIN email_preferences ep ON ep.user_id = u.id
        LEFT JOIN similar_listings_digests d
               ON d.user_id = u.id AND d.sent_on = CURRENT_DATE
       WHERE u.email IS NOT NULL
         AND u.email <> ''
         AND f.created_at > NOW() - INTERVAL '60 days'
         AND COALESCE(ep.similar_listings, TRUE) = TRUE
         AND d.user_id IS NULL
       LIMIT 500
    `).catch(() => ({ rows: [] }));

    for (const u of users) {
      processed += 1;
      try {
        // Match new listings (last 24h) by brand of favorited items.
        const { rows: matches } = await query(`
          SELECT l.id, l.title, l.price, l.location, l.brand, l.category,
                 (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY position LIMIT 1) AS image
            FROM listings l
           WHERE l.status = 'active'
             AND l.created_at > NOW() - INTERVAL '24 hours'
             AND l.user_id <> $1
             AND l.brand IN (
               SELECT DISTINCT lf.brand FROM favorites f
                 JOIN listings lf ON lf.id = f.listing_id
                WHERE f.user_id = $1 AND lf.brand IS NOT NULL
             )
             AND NOT EXISTS (
               SELECT 1 FROM favorites ff WHERE ff.user_id = $1 AND ff.listing_id = l.id
             )
           ORDER BY l.created_at DESC
           LIMIT $2
        `, [u.id, MAX_PER_DIGEST]).catch(() => ({ rows: [] }));

        if (matches.length === 0) { skipped += 1; continue; }

        const listings = matches.map((m) => ({
          title: `${m.brand || ''} ${m.title || ''}`.trim(),
          url: `${FRONTEND_URL}/annonces/${m.id}`,
          image: m.image,
          price: m.price,
          location: m.location,
        }));

        await sendSimilarListingsEmail({
          to: u.email,
          recipientName: u.name,
          listings,
          unsubscribeUrl: `${FRONTEND_URL}/parametres/notifications?optout=similar`,
        });
        emailed += 1;

        // Record send so the user only gets one digest per day even if the
        // job runs twice (e.g. after a deploy restarts the timer).
        await query(
          `INSERT INTO similar_listings_digests (user_id, sent_on, count)
                VALUES ($1, CURRENT_DATE, $2)
           ON CONFLICT (user_id, sent_on) DO UPDATE SET count = EXCLUDED.count`,
          [u.id, listings.length]
        ).catch(() => {});
      } catch (e) {
        logger.warn(`[similar-digest] user ${u.id} failed:`, e.message);
      }
    }
    const ms = Date.now() - startedAt;
    logger.info(`[similar-digest] processed=${processed} emailed=${emailed} skipped=${skipped} (${ms}ms)`);
  } catch (e) {
    logger.warn('[similar-digest] run failed:', e.message);
  }
}

function startSimilarListingsDigestJob() {
  setTimeout(runOnce, FIRST_RUN_DELAY_MS);
  setInterval(runOnce, RUN_INTERVAL_MS);
}

module.exports = { startSimilarListingsDigestJob, runOnce };
