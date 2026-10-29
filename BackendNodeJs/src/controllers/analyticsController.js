const { query } = require('../config/database');
const { resolveGeo } = require('../utils/geoIp');
const { isBotRequest } = require('../utils/botDetection');

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function startOfDayISO(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(); }

/* ==================================================================
 * SESSION lifecycle
 * ================================================================== */

/** POST /api/analytics/sessions — create OR reuse a visitor session */
async function createSession(req, res, next) {
  try {
    // Drop bot / crawler / preview-fetcher traffic so it never pollutes
    // visitor counts, session duration averages or geo breakdowns.
    if (isBotRequest(req)) {
      return res.status(202).json({ session_id: null, skipped: 'bot' });
    }
    const {
      fingerprint, device, browser, os, referral_source,
      referral_url, landing_page, language, screen_size,
    } = req.body;
    if (!fingerprint) return res.status(400).json({ error: 'fingerprint required' });

    // Defensive enum guard: even with a fixed frontend, an old cached bundle
    // or a third-party hitting our endpoint could send a value outside the
    // Postgres ENUM and trigger a 500 on EVERY session create. Coerce unknown
    // values to 'other' (a safe enum member) instead of letting it bubble.
    const ALLOWED_SOURCES = new Set(['direct','google','facebook','instagram','linkedin','twitter','tiktok','whatsapp','email','other']);
    const safeSource = ALLOWED_SOURCES.has(String(referral_source || '').toLowerCase())
      ? String(referral_source).toLowerCase()
      : 'other';

    const geo = await resolveGeo(req);
    const userAgent = req.get('user-agent') || null;
    const userId = req.user?.id || null;

    // Dedupe: if this fingerprint has an active session in the last 30 minutes,
    // reuse it instead of creating a new one. Multiple tabs / quick re-mounts
    // would otherwise inflate session counts and skew analytics.
    let sessionId = null;
    try {
      const existing = await query(
        `SELECT id FROM visitor_sessions
          WHERE fingerprint = $1
            AND last_activity_at > NOW() - INTERVAL '30 minutes'
          ORDER BY last_activity_at DESC LIMIT 1`,
        [fingerprint]
      );
      if (existing.rows.length > 0) {
        sessionId = existing.rows[0].id;
        // Touch the existing session so its TTL refreshes.
        await query(
          'UPDATE visitor_sessions SET last_activity_at = NOW(), user_id = COALESCE(user_id, $2) WHERE id = $1',
          [sessionId, userId]
        );
      }
    } catch { /* table may be missing — fall through to insert */ }

    if (!sessionId) {
      const { rows } = await query(
        `INSERT INTO visitor_sessions
          (fingerprint, ip_address, country, country_code, city, region,
           device, browser, os, referral_source, referral_url, landing_page,
           user_agent, language, screen_size, user_id, last_activity_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
         RETURNING id`,
        [
          fingerprint, geo.ip, geo.country, geo.country_code, geo.city, geo.region,
          device || null, browser || null, os || null,
          safeSource, referral_url || null, landing_page || null,
          userAgent, language || null, screen_size || null, userId,
        ]
      );
      sessionId = rows[0].id;
    }

    // Upsert visitor profile (long-lived view of the visitor across sessions).
    await query(
      `INSERT INTO visitor_profiles
        (fingerprint, ip_address, country, country_code, city, region, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (fingerprint) DO UPDATE SET
         total_visits = visitor_profiles.total_visits + 1,
         last_seen    = NOW(),
         ip_address   = COALESCE(EXCLUDED.ip_address,   visitor_profiles.ip_address),
         country      = COALESCE(EXCLUDED.country,      visitor_profiles.country),
         country_code = COALESCE(EXCLUDED.country_code, visitor_profiles.country_code),
         city         = COALESCE(EXCLUDED.city,         visitor_profiles.city),
         region       = COALESCE(EXCLUDED.region,       visitor_profiles.region),
         user_id      = COALESCE(EXCLUDED.user_id,      visitor_profiles.user_id)`,
      [fingerprint, geo.ip, geo.country, geo.country_code, geo.city, geo.region, userId]
    );

    res.status(201).json({
      session_id: sessionId,
      country_code: geo.country_code,
      city: geo.city,
    });
  } catch (err) { next(err); }
}

/** PATCH /api/analytics/sessions/:id — heartbeat / final update */
async function updateSession(req, res, next) {
  try {
    const { duration_seconds, pages_viewed } = req.body;
    await query(
      `UPDATE visitor_sessions
         SET duration_seconds = COALESCE($1, duration_seconds),
             pages_viewed     = COALESCE($2, pages_viewed),
             last_activity_at = NOW(),
             ended_at         = NOW()
       WHERE id = $3`,
      [duration_seconds ?? null, pages_viewed ?? null, req.params.id]
    );

    const session = await query(
      'SELECT fingerprint FROM visitor_sessions WHERE id = $1',
      [req.params.id]
    );
    if (session.rows.length > 0 && session.rows[0].fingerprint && duration_seconds) {
      await query(
        'UPDATE visitor_profiles SET total_duration = total_duration + $1, last_seen = NOW() WHERE fingerprint = $2',
        [duration_seconds, session.rows[0].fingerprint]
      );
    }

    res.json({ message: 'Session updated' });
  } catch (err) { next(err); }
}

/* ==================================================================
 * PAGE views
 * ================================================================== */

/** POST /api/analytics/page-view */
async function trackPageView(req, res, next) {
  try {
    if (isBotRequest(req)) return res.status(202).json({ skipped: 'bot' });
    const { session_id, fingerprint, path, view_name, referrer, duration_ms } = req.body;
    if (!path) return res.status(400).json({ error: 'path required' });

    const geo = await resolveGeo(req);
    const userId = req.user?.id || null;

    await query(
      `INSERT INTO page_views
        (session_id, fingerprint, user_id, path, view_name, referrer,
         duration_ms, ip_address, country_code, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        session_id || null,
        fingerprint || null,
        userId,
        String(path).slice(0, 500),
        view_name ? String(view_name).slice(0, 60) : null,
        referrer ? String(referrer).slice(0, 500) : null,
        duration_ms ? Math.max(0, Math.min(parseInt(duration_ms) || 0, 6 * 60 * 60 * 1000)) : 0,
        geo.ip, geo.country_code, geo.city,
      ]
    );

    if (session_id) {
      await query(
        `UPDATE visitor_sessions
            SET pages_viewed = pages_viewed + 1,
                last_activity_at = NOW()
          WHERE id = $1`,
        [session_id]
      );
    }

    res.status(201).json({ message: 'Page view tracked' });
  } catch (err) { next(err); }
}

/* ==================================================================
 * LISTING tracking
 * ================================================================== */

/** POST /api/analytics/listing-view */
async function trackListingView(req, res, next) {
  try {
    if (isBotRequest(req)) return res.status(202).json({ skipped: 'bot' });
    const { listing_id, session_id, fingerprint } = req.body;
    if (!listing_id) return res.status(400).json({ error: 'listing_id required' });

    // Dedupe: a single visitor refreshing or re-rendering the listing detail
    // page should not inflate views_count. Count one view per (fingerprint OR
    // user_id OR ip) per listing per 30-minute window. We still INSERT a row
    // for completeness so the audit trail stays accurate, but we only bump
    // the public counter when this is a genuinely new view.
    const userId = req.user?.id || null;
    const geo = await resolveGeo(req);
    const ip = geo.ip;

    let isNewView = true;
    try {
      const dedupeKey = fingerprint || (userId ? `user:${userId}` : null) || (ip ? `ip:${ip}` : null);
      if (dedupeKey) {
        const existing = await query(
          `SELECT 1 FROM listing_views
            WHERE listing_id = $1
              AND created_at > NOW() - INTERVAL '30 minutes'
              AND (
                ($2::text IS NOT NULL AND fingerprint = $2)
                OR ($3::uuid IS NOT NULL AND user_id = $3)
                OR ($4::inet IS NOT NULL AND ip = $4)
              )
            LIMIT 1`,
          [listing_id, fingerprint || null, userId, ip || null]
        );
        if (existing.rows.length > 0) isNewView = false;
      }
    } catch { /* table shape mismatch — fall through and count it */ }

    await query(
      `INSERT INTO listing_views (listing_id, session_id, user_id, fingerprint, country_code, ip)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [listing_id, session_id || null, userId, fingerprint || null, geo.country_code, ip]
    );
    if (isNewView) {
      await query('UPDATE listings SET views_count = views_count + 1 WHERE id = $1', [listing_id]);
    }
    res.status(201).json({ message: 'View tracked', counted: isNewView });
  } catch (err) { next(err); }
}

/** POST /api/analytics/listing-click — card click from a list/search/home */
async function trackListingClick(req, res, next) {
  try {
    if (isBotRequest(req)) return res.status(202).json({ skipped: 'bot' });
    const { listing_id, session_id, fingerprint, source } = req.body;
    if (!listing_id) return res.status(400).json({ error: 'listing_id required' });
    const geo = await resolveGeo(req);

    await query(
      `INSERT INTO listing_clicks
        (listing_id, session_id, fingerprint, user_id, source, ip_address, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        listing_id, session_id || null, fingerprint || null, req.user?.id || null,
        source ? String(source).slice(0, 60) : null, geo.ip, geo.country_code,
      ]
    );
    res.status(201).json({ message: 'Click tracked' });
  } catch (err) { next(err); }
}

/** POST /api/analytics/listing-event */
async function trackListingEvent(req, res, next) {
  try {
    if (isBotRequest(req)) return res.status(202).json({ skipped: 'bot' });
    const { listing_id, event_type, session_id } = req.body;
    if (!listing_id || !event_type) return res.status(400).json({ error: 'listing_id and event_type required' });
    await query(
      'INSERT INTO listing_events (listing_id, event_type, session_id, user_id) VALUES ($1, $2, $3, $4)',
      [listing_id, event_type, session_id || null, req.user?.id || null]
    );
    res.status(201).json({ message: 'Event tracked' });
  } catch (err) { next(err); }
}

/* ==================================================================
 * ADMIN endpoints — power the "Audience" tab and ad-sales packs
 * ================================================================== */

/** GET /api/analytics/dashboard — high-level counters */
async function getDashboard(req, res, next) {
  try {
    const { period = '30d' } = req.query;
    const days = Math.min(Math.max(parseInt(period) || 30, 1), 365);
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

    const [visitors, sessions, listings, users, topCities, trafficSources, topListings] = await Promise.all([
      query('SELECT COUNT(DISTINCT fingerprint) as unique_visitors FROM visitor_sessions WHERE started_at >= $1', [sinceDate]),
      query('SELECT COUNT(*) as total, AVG(duration_seconds) as avg_duration, AVG(pages_viewed) as avg_pages FROM visitor_sessions WHERE started_at >= $1', [sinceDate]),
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM listings"),
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at >= $1) as new_users FROM users', [sinceDate]),
      query('SELECT city, COUNT(*) as visits FROM visitor_sessions WHERE city IS NOT NULL AND started_at >= $1 GROUP BY city ORDER BY visits DESC LIMIT 10', [sinceDate]),
      query('SELECT referral_source, COUNT(*) as count FROM visitor_sessions WHERE started_at >= $1 GROUP BY referral_source ORDER BY count DESC', [sinceDate]),
      query('SELECT id, title, brand, model, views_count, favorites_count FROM listings ORDER BY views_count DESC LIMIT 10')
    ]);

    res.json({
      unique_visitors: parseInt(visitors.rows[0].unique_visitors),
      total_sessions: parseInt(sessions.rows[0].total),
      avg_duration: Math.round(parseFloat(sessions.rows[0].avg_duration) || 0),
      avg_pages: Math.round(parseFloat(sessions.rows[0].avg_pages) || 0),
      total_listings: parseInt(listings.rows[0].total),
      active_listings: parseInt(listings.rows[0].active),
      total_users: parseInt(users.rows[0].total),
      new_users: parseInt(users.rows[0].new_users),
      top_cities: topCities.rows,
      traffic_sources: trafficSources.rows,
      top_listings: topListings.rows,
    });
  } catch (err) { next(err); }
}

/** GET /api/analytics/audience — KPIs + top countries / cities / pages / clicks (for ad sales) */
async function getAudience(req, res, next) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.period) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [
      kpis, byCountry, byCity, byDevice, byOs, byBrowser, topPages,
      topClickedListings, dailyTraffic,
    ] = await Promise.all([
      query(
        `SELECT
           COUNT(DISTINCT fingerprint) AS unique_visitors,
           COUNT(*)                    AS total_sessions,
           AVG(duration_seconds)::int  AS avg_duration,
           AVG(pages_viewed)::int      AS avg_pages,
           COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS logged_in_sessions
         FROM visitor_sessions WHERE started_at >= $1`,
        [since]
      ),
      query(
        // Group by country_code when present, otherwise fall back to the
        // country text (uppercased & sliced) so visitors with only a country
        // name still land in the right bucket instead of all collapsing to 'XX'.
        `SELECT COALESCE(NULLIF(country_code, ''),
                         UPPER(LEFT(NULLIF(country, ''), 2)),
                         'XX') AS country_code,
                MAX(COALESCE(NULLIF(country, ''), NULLIF(country_code, ''))) AS country,
                COUNT(*) AS sessions,
                COUNT(DISTINCT fingerprint) AS unique_visitors
           FROM visitor_sessions
          WHERE started_at >= $1
          GROUP BY 1
          ORDER BY sessions DESC
          LIMIT 25`,
        [since]
      ),
      query(
        // Coalesce city ↔ region so missing-city visitors still group by their
        // region (essential for TN where upstream often only returns the
        // governorate). Empty strings are treated as NULL.
        `SELECT COALESCE(NULLIF(city, ''), NULLIF(region, '')) AS city,
                COUNT(*) AS sessions
           FROM visitor_sessions
          WHERE started_at >= $1
            AND (NULLIF(city, '') IS NOT NULL OR NULLIF(region, '') IS NOT NULL)
          GROUP BY 1 ORDER BY sessions DESC LIMIT 15`,
        [since]
      ),
      query(
        `SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS sessions
           FROM visitor_sessions WHERE started_at >= $1
           GROUP BY device ORDER BY sessions DESC`,
        [since]
      ),
      query(
        `SELECT COALESCE(os, 'unknown') AS os, COUNT(*) AS sessions
           FROM visitor_sessions WHERE started_at >= $1
           GROUP BY os ORDER BY sessions DESC LIMIT 10`,
        [since]
      ),
      query(
        `SELECT COALESCE(browser, 'unknown') AS browser, COUNT(*) AS sessions
           FROM visitor_sessions WHERE started_at >= $1
           GROUP BY browser ORDER BY sessions DESC LIMIT 10`,
        [since]
      ),
      query(
        `SELECT view_name,
                COUNT(*) AS views,
                COUNT(DISTINCT fingerprint) AS unique_visitors,
                AVG(NULLIF(duration_ms,0))::int AS avg_duration_ms
           FROM page_views
          WHERE created_at >= $1
            AND view_name IS NOT NULL
            AND view_name <> ''
            AND view_name <> 'other'
          GROUP BY view_name
          ORDER BY views DESC
          LIMIT 15`,
        [since]
      ),
      query(
        `SELECT l.id, l.title, l.brand, l.model, l.price,
                COUNT(c.*) AS clicks,
                COUNT(DISTINCT c.fingerprint) AS unique_clicks
           FROM listing_clicks c
           JOIN listings l ON l.id = c.listing_id
          WHERE c.created_at >= $1
          GROUP BY l.id
          ORDER BY clicks DESC
          LIMIT 15`,
        [since]
      ),
      query(
        `SELECT date_trunc('day', started_at) AS day,
                COUNT(*) AS sessions,
                COUNT(DISTINCT fingerprint) AS visitors
           FROM visitor_sessions
          WHERE started_at >= $1
          GROUP BY day ORDER BY day ASC`,
        [since]
      ),
    ]);

    res.json({
      period_days: days,
      kpis: kpis.rows[0],
      by_country: byCountry.rows,
      by_city: byCity.rows,
      by_device: byDevice.rows,
      by_os: byOs.rows,
      by_browser: byBrowser.rows,
      top_pages: topPages.rows,
      top_clicked_listings: topClickedListings.rows,
      daily_traffic: dailyTraffic.rows,
    });
  } catch (err) { next(err); }
}

/** GET /api/analytics/visitors — paginated list of visitors (for monetization profiling) */
async function listVisitors(req, res, next) {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const country = req.query.country_code ? String(req.query.country_code).toUpperCase() : null;
    const search  = req.query.search ? `%${String(req.query.search).toLowerCase()}%` : null;

    // Build the filter portion separately from pagination params so the COUNT
    // query reuses ONLY the filter params. The previous version pushed limit +
    // offset into the same array and then sliced the last two off for the
    // count — fragile and crashed when the filter set was mutated later.
    const where = [];
    const filterParams = [];
    if (country) {
      filterParams.push(country);
      where.push(`p.country_code = $${filterParams.length}`);
    }
    if (search)  {
      filterParams.push(search);
      where.push(`(
        LOWER(p.fingerprint) LIKE $${filterParams.length}
        OR LOWER(COALESCE(p.city,'')) LIKE $${filterParams.length}
        OR LOWER(host(COALESCE(p.ip_address, '0.0.0.0'::inet))) LIKE $${filterParams.length}
        OR EXISTS (
          SELECT 1
            FROM listing_clicks lc
            JOIN listings l ON l.id = lc.listing_id
           WHERE lc.fingerprint = p.fingerprint
             AND (
               LOWER(COALESCE(l.model,'')) LIKE $${filterParams.length}
               OR LOWER(COALESCE(l.brand,'')) LIKE $${filterParams.length}
               OR LOWER(COALESCE(l.title,'')) LIKE $${filterParams.length}
             )
        )
        OR EXISTS (
          SELECT 1
            FROM listing_views lv
            JOIN listings l ON l.id = lv.listing_id
           WHERE lv.fingerprint = p.fingerprint
             AND (
               LOWER(COALESCE(l.model,'')) LIKE $${filterParams.length}
               OR LOWER(COALESCE(l.brand,'')) LIKE $${filterParams.length}
               OR LOWER(COALESCE(l.title,'')) LIKE $${filterParams.length}
             )
        )
      )`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listParams = [...filterParams, limit, offset];
    const limitIdx  = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;

    const { rows } = await query(
      `SELECT p.fingerprint, p.ip_address, p.country, p.country_code, p.city, p.region,
              p.total_visits, p.total_duration, p.first_seen, p.last_seen,
              p.user_id, u.email AS user_email, u.full_name AS user_name
         FROM visitor_profiles p
         LEFT JOIN users u ON u.id = p.user_id
         ${whereSql}
         ORDER BY p.last_seen DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    const totalRow = await query(
      `SELECT COUNT(*) AS total FROM visitor_profiles p ${whereSql}`,
      filterParams
    );

    res.json({
      total: parseInt(totalRow.rows[0].total),
      visitors: rows,
    });
  } catch (err) { next(err); }
}

/** GET /api/analytics/visitors/:fingerprint — full activity log of one visitor */
async function getVisitor(req, res, next) {
  try {
    const fp = req.params.fingerprint;

    const [profile, sessions, pages, clicks, listingViews] = await Promise.all([
      query(
        `SELECT p.*, u.email AS user_email, u.full_name AS user_name
           FROM visitor_profiles p
           LEFT JOIN users u ON u.id = p.user_id
          WHERE p.fingerprint = $1`,
        [fp]
      ),
      query(
        `SELECT id, ip_address, country, country_code, city, region, device, browser, os,
                referral_source, referral_url, landing_page, duration_seconds,
                pages_viewed, started_at, ended_at, last_activity_at
           FROM visitor_sessions
          WHERE fingerprint = $1
          ORDER BY started_at DESC LIMIT 50`,
        [fp]
      ),
      query(
        `SELECT id, path, view_name, referrer, duration_ms, created_at
           FROM page_views WHERE fingerprint = $1
           ORDER BY created_at DESC LIMIT 200`,
        [fp]
      ),
      query(
        `SELECT c.id, c.listing_id, l.title, l.brand, l.model, c.source, c.created_at
           FROM listing_clicks c
           LEFT JOIN listings l ON l.id = c.listing_id
          WHERE c.fingerprint = $1
          ORDER BY c.created_at DESC LIMIT 100`,
        [fp]
      ),
      query(
        `SELECT v.id, v.listing_id, l.title, l.brand, l.model, v.created_at
           FROM listing_views v
           LEFT JOIN listings l ON l.id = v.listing_id
          WHERE v.fingerprint = $1
          ORDER BY v.created_at DESC LIMIT 100`,
        [fp]
      ),
    ]);

    if (profile.rows.length === 0) return res.status(404).json({ error: 'Visitor not found' });

    res.json({
      profile: profile.rows[0],
      sessions: sessions.rows,
      page_views: pages.rows,
      listing_clicks: clicks.rows,
      listing_views: listingViews.rows,
    });
  } catch (err) { next(err); }
}

/* ------------------------------------------------------------------
 * Funnel helpers — shared by /funnel and /funnel/by-source
 * ------------------------------------------------------------------ */

// Map raw referral_source enum values to high-level marketing buckets.
// The frontend renders one funnel per bucket so the team can compare
// channel performance side-by-side.
const SOURCE_BUCKETS = {
  organic:  ['google'],
  social:   ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'],
  direct:   ['direct'],
  referral: ['whatsapp', 'email', 'other'],
};

const BUCKET_LABELS = {
  organic:  { label: 'Organique',  description: 'SEO Google' },
  social:   { label: 'Social',     description: 'Facebook, Instagram, TikTok…' },
  direct:   { label: 'Direct',     description: 'URL ou favori' },
  referral: { label: 'Référence',  description: 'WhatsApp, email, autres' },
};

/**
 * Compute the 4-step funnel for a given cohort of fingerprints.
 * Pass `cohortSql` returning a single column `fingerprint`. If null,
 * the funnel runs across ALL visitors in the period (legacy behaviour).
 */
async function computeFunnel(since, cohortCte) {
  // Build the cohort filter once and reuse across the 4 step queries.
  // When cohortCte is null we use a no-op CTE so all SQL stays uniform.
  const cohortClause = cohortCte
    ? `AND fingerprint IN (SELECT fingerprint FROM cohort)`
    : '';
  const cohortClauseAliased = (alias) => cohortCte
    ? `AND ${alias}.fingerprint IN (SELECT fingerprint FROM cohort)`
    : '';
  const withCohort = cohortCte ? `WITH cohort AS (${cohortCte})` : '';

  const [s1, s2, sTech, s3, s4] = await Promise.all([
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM visitor_sessions
        WHERE started_at >= $1 AND fingerprint IS NOT NULL ${cohortClause}`,
      [since]
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM page_views
        WHERE created_at >= $1
          AND fingerprint IS NOT NULL
          AND view_name IN ('search', 'search-results')
          ${cohortClause}`,
      [since]
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM listing_views
        WHERE created_at >= $1 AND fingerprint IS NOT NULL ${cohortClause}`,
      [since]
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM page_views
        WHERE created_at >= $1
          AND fingerprint IS NOT NULL
          AND (
            view_name IN ('tech-specs-brands', 'tech-specs-models', 'tech-specs-details')
            OR path ILIKE '/fiche-technique%'
            OR path ILIKE '/fiches-techniques%'
            OR path ILIKE '/tech-specs%'
          )
          ${cohortClause}`,
      [since]
    ),
    query(
      `${withCohort}${cohortCte ? ', ' : 'WITH '}contacts AS (
         SELECT DISTINCT vs.fingerprint
           FROM listing_contacts lc
           JOIN visitor_sessions vs ON vs.user_id = lc.user_id
          WHERE lc.created_at >= $1 AND vs.fingerprint IS NOT NULL
            ${cohortClauseAliased('vs')}
         UNION
         SELECT DISTINCT vs.fingerprint
           FROM listing_events le
           JOIN visitor_sessions vs ON vs.id = le.session_id
          WHERE le.created_at >= $1
            AND le.event_type IN ('phone_reveal', 'message_seller', 'contact_seller', 'whatsapp_click')
            AND vs.fingerprint IS NOT NULL
            ${cohortClauseAliased('vs')}
       )
       SELECT COUNT(*) AS count FROM contacts`,
      [since]
    ),
  ]);

  const visitors  = parseInt(s1.rows[0].count) || 0;
  const searchers = Math.min(parseInt(s2.rows[0].count) || 0, visitors);
  const techSpecs = Math.min(parseInt(sTech.rows[0].count) || 0, searchers || visitors);
  const viewers   = Math.min(parseInt(s3.rows[0].count) || 0, Math.max(searchers, techSpecs) || visitors);
  const contacts  = Math.min(parseInt(s4.rows[0].count) || 0, viewers || visitors);

  const pct = (num, denom) => denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;

  return {
    steps: [
      { key: 'visitor', label: 'Visiteurs',     description: 'Toute personne arrivant sur le site',
        count: visitors,  rate_from_top: 100,                       drop_off: 0 },
      { key: 'search',  label: 'Recherche',     description: 'A consulté la page de recherche',
        count: searchers, rate_from_top: pct(searchers, visitors),  drop_off: visitors - searchers },
      { key: 'tech_spec', label: 'Fiche technique', description: 'A consulté au moins une fiche technique',
        count: techSpecs, rate_from_top: pct(techSpecs, visitors), drop_off: searchers - techSpecs },
      { key: 'detail',  label: 'Fiche annonce', description: 'A ouvert au moins une annonce',
        count: viewers,   rate_from_top: pct(viewers,   visitors),  drop_off: Math.max(searchers, techSpecs) - viewers },
      { key: 'contact', label: 'Contact vendeur', description: 'Téléphone révélé, message ou WhatsApp',
        count: contacts,  rate_from_top: pct(contacts,  visitors),  drop_off: viewers - contacts },
    ],
    overall_conversion_rate: pct(contacts, visitors),
  };
}

/** GET /api/analytics/funnel — global product funnel */
async function getFunnel(req, res, next) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.period) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const funnel = await computeFunnel(since, null);
    res.json({ period_days: days, ...funnel });
  } catch (err) { next(err); }
}

/** GET /api/analytics/funnel/by-source — funnel split per traffic source bucket */
async function getFunnelBySource(req, res, next) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.period) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // For each bucket, compute a funnel where the cohort = fingerprints
    // whose FIRST session in the period was attributed to that bucket.
    // (Using "first session" prevents a visitor from appearing in two
    // buckets across the period.)
    const buckets = await Promise.all(
      Object.entries(SOURCE_BUCKETS).map(async ([key, sources]) => {
        // Build cohort CTE: fingerprints whose first session in window came
        // from one of the bucket's sources.
        const placeholders = sources.map((_, i) => `$${i + 2}`).join(',');
        const cohortCte = `
          SELECT DISTINCT ON (fingerprint) fingerprint
            FROM visitor_sessions
           WHERE started_at >= $1 AND fingerprint IS NOT NULL
           ORDER BY fingerprint, started_at ASC`;
        // Then filter that cohort by source via the WHERE clause inside
        // the helper queries — but simpler: inline the source filter into
        // the cohort definition itself.
        const cohortWithSource = `
          SELECT fingerprint FROM (
            SELECT DISTINCT ON (fingerprint) fingerprint, referral_source
              FROM visitor_sessions
             WHERE started_at >= $1 AND fingerprint IS NOT NULL
             ORDER BY fingerprint, started_at ASC
          ) first_sessions
          WHERE referral_source IN (${placeholders})`;

        // We need a separate query call here because the cohort takes
        // extra params. Inline a small variant of computeFunnel that
        // accepts extra params.
        const funnel = await computeFunnelWithParams(since, cohortWithSource, sources);
        return {
          key,
          ...BUCKET_LABELS[key],
          sources,
          ...funnel,
        };
      })
    );

    res.json({ period_days: days, buckets });
  } catch (err) { next(err); }
}

/** Variant of computeFunnel that supports an extra param array for the cohort. */
async function computeFunnelWithParams(since, cohortCte, extraParams) {
  // Param layout: $1 = since (used by both cohort + step queries),
  // $2..$N = extraParams (used only by cohort).
  const params = [since, ...extraParams];
  const cohortClause = `AND fingerprint IN (SELECT fingerprint FROM cohort)`;
  const cohortClauseAliased = (alias) => `AND ${alias}.fingerprint IN (SELECT fingerprint FROM cohort)`;
  const withCohort = `WITH cohort AS (${cohortCte})`;

  const [s1, s2, sTech, s3, s4] = await Promise.all([
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM visitor_sessions
        WHERE started_at >= $1 AND fingerprint IS NOT NULL ${cohortClause}`,
      params
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM page_views
        WHERE created_at >= $1
          AND fingerprint IS NOT NULL
          AND view_name IN ('search', 'search-results')
          ${cohortClause}`,
      params
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM listing_views
        WHERE created_at >= $1 AND fingerprint IS NOT NULL ${cohortClause}`,
      params
    ),
    query(
      `${withCohort}
       SELECT COUNT(DISTINCT fingerprint) AS count
         FROM page_views
        WHERE created_at >= $1
          AND fingerprint IS NOT NULL
          AND (
            view_name IN ('tech-specs-brands', 'tech-specs-models', 'tech-specs-details')
            OR path ILIKE '/fiche-technique%'
            OR path ILIKE '/fiches-techniques%'
            OR path ILIKE '/tech-specs%'
          )
          ${cohortClause}`,
      params
    ),
    query(
      `${withCohort}, contacts AS (
         SELECT DISTINCT vs.fingerprint
           FROM listing_contacts lc
           JOIN visitor_sessions vs ON vs.user_id = lc.user_id
          WHERE lc.created_at >= $1 AND vs.fingerprint IS NOT NULL
            ${cohortClauseAliased('vs')}
         UNION
         SELECT DISTINCT vs.fingerprint
           FROM listing_events le
           JOIN visitor_sessions vs ON vs.id = le.session_id
          WHERE le.created_at >= $1
            AND le.event_type IN ('phone_reveal', 'message_seller', 'contact_seller', 'whatsapp_click')
            AND vs.fingerprint IS NOT NULL
            ${cohortClauseAliased('vs')}
       )
       SELECT COUNT(*) AS count FROM contacts`,
      params
    ),
  ]);

  const visitors  = parseInt(s1.rows[0].count) || 0;
  const searchers = Math.min(parseInt(s2.rows[0].count) || 0, visitors);
  const techSpecs = Math.min(parseInt(sTech.rows[0].count) || 0, searchers || visitors);
  const viewers   = Math.min(parseInt(s3.rows[0].count) || 0, Math.max(searchers, techSpecs) || visitors);
  const contacts  = Math.min(parseInt(s4.rows[0].count) || 0, viewers || visitors);

  const pct = (num, denom) => denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;

  return {
    steps: [
      { key: 'visitor', label: 'Visiteurs',     description: 'Toute personne arrivant sur le site',
        count: visitors,  rate_from_top: 100,                       drop_off: 0 },
      { key: 'search',  label: 'Recherche',     description: 'A consulté la page de recherche',
        count: searchers, rate_from_top: pct(searchers, visitors),  drop_off: visitors - searchers },
      { key: 'tech_spec', label: 'Fiche technique', description: 'A consulté au moins une fiche technique',
        count: techSpecs, rate_from_top: pct(techSpecs, visitors), drop_off: searchers - techSpecs },
      { key: 'detail',  label: 'Fiche annonce', description: 'A ouvert au moins une annonce',
        count: viewers,   rate_from_top: pct(viewers,   visitors),  drop_off: Math.max(searchers, techSpecs) - viewers },
      { key: 'contact', label: 'Contact vendeur', description: 'Téléphone révélé, message ou WhatsApp',
        count: contacts,  rate_from_top: pct(contacts,  visitors),  drop_off: viewers - contacts },
    ],
    overall_conversion_rate: pct(contacts, visitors),
  };
}

module.exports = {
  createSession, updateSession,
  trackPageView, trackListingView, trackListingClick, trackListingEvent,
  getDashboard, getAudience, getFunnel, getFunnelBySource, listVisitors, getVisitor,
};
