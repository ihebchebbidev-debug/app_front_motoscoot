/**
 * View counter for actualités (articles) and conseils (tips).
 *
 * Privacy-friendly audience counting, no cookie and no consent banner needed:
 *  - a visitor is recognised by a one-way hash of (secret, Tunis day, content,
 *    IP, browser). The salt changes every day, so the same person gives a
 *    different hash tomorrow, and the hash cannot be turned back into an IP.
 *    Nothing else is stored (no IP, no user id).
 *  - one visitor = at most one view per content per day;
 *  - bots, crawlers, link previews and headless browsers are ignored;
 *  - drafts are never counted (admin previews don't inflate the number).
 *
 * The browser sends the view only after the page has been visible for a few
 * seconds (hooks/useContentView.ts), so a quick bounce or a prefetch is not
 * a view.
 */
const crypto = require('crypto');
const { query } = require('../config/database');
const { JWT_SECRET } = require('../config/jwt');

const BOT_UA_RE = /(bot|spider|crawler|crawling|preview|facebookexternalhit|whatsapp|telegram|slurp|baiduspider|yandex|duckduckbot|bingbot|googlebot|lighthouse|pagespeed|headless|prerender|curl|wget|python-requests|axios|node-fetch)/i;

/** Calendar day in Tunisia (UTC+1, no DST) — "2026-11-15". */
function tunisDay(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isBot(userAgent) {
  const ua = String(userAgent || '').trim();
  return ua === '' || BOT_UA_RE.test(ua);
}

/**
 * Daily, one-way visitor key (64 hex chars, fits the `fingerprint` column).
 * A signed-in visitor is keyed by account so phone + computer count once.
 */
function visitorKey({ contentId, ip, userAgent, userId, now = new Date(), secret }) {
  const salt = `${secret || process.env.VIEW_HASH_SECRET || JWT_SECRET}|${tunisDay(now)}`;
  const who = userId ? `u:${userId}` : `a:${ip || ''}|${userAgent || ''}`;
  return crypto.createHmac('sha256', salt).update(`${contentId}|${who}`).digest('hex');
}

/**
 * Express handler factory. kind: 'articles' (article_views.article_id) or
 * 'tips' (tip_views.tip_id). Table names come from this fixed map only.
 */
const KINDS = {
  articles: { table: 'articles', views: 'article_views', fk: 'article_id' },
  tips: { table: 'tips', views: 'tip_views', fk: 'tip_id' },
};

function makeTrackView(kind) {
  const k = KINDS[kind];
  if (!k) throw new Error(`Unknown content kind: ${kind}`);

  return async function trackView(req, res, next) {
    try {
      const ua = req.headers['user-agent'];
      if (isBot(ua)) return res.json({ success: true, counted: false, reason: 'bot' });

      // The page may address the content by slug or by UUID.
      const found = await query(
        `SELECT id FROM ${k.table}
          WHERE (slug = $1 OR id::text = $1) AND is_published = TRUE
          LIMIT 1`,
        [String(req.params.slug || '')]
      );
      if (found.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const contentId = found.rows[0].id;

      const key = visitorKey({
        contentId,
        ip: req.ip,
        userAgent: ua,
        userId: req.user?.id || null,
      });

      // One statement: insert the view only if this visitor has none today
      // for this content, and bump the counter only when a row went in.
      // ($2 is cast so PostgreSQL infers one type for both of its uses.)
      const { rows } = await query(
        `WITH ins AS (
           INSERT INTO ${k.views} (${k.fk}, fingerprint)
           SELECT $1, $2::text
            WHERE NOT EXISTS (
              SELECT 1 FROM ${k.views} WHERE ${k.fk} = $1 AND fingerprint = $2::text
            )
           RETURNING 1
         )
         UPDATE ${k.table} SET views_count = COALESCE(views_count, 0) + 1
          WHERE id = $1 AND EXISTS (SELECT 1 FROM ins)
          RETURNING views_count`,
        [contentId, key]
      );
      res.json({ success: true, counted: rows.length > 0 });
    } catch (e) { next(e); }
  };
}

module.exports = { makeTrackView, visitorKey, tunisDay, isBot, BOT_UA_RE };
