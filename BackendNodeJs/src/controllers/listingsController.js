const { query, getClient } = require('../config/database');
const { lazyExpireOne } = require('../jobs/boostExpiry');
const { buildWhere, buildUpdate, parsePagination, paginationMeta, validateRequired, checkOwnership } = require('../utils/queryHelpers');
const logger = require('../utils/logger');

// Whitelist of fields a user may PATCH on their own listing.
// `status` is intentionally EXCLUDED — status transitions go through the
// dedicated PATCH /listings/:id/status endpoint so moderation flows can
// hook into a single chokepoint. Allowing status here would let a user
// self-approve a pending listing (escalation bypass).
const LISTING_FIELDS = ['title', 'description', 'brand', 'model', 'type', 'price', 'condition',
  'year', 'mileage', 'cc', 'color', 'city', 'governorate', 'address', 'latitude', 'longitude',
  'images', 'equipment', 'contact_method', 'attributes'];

/**
 * Sanitize the free-form `attributes` JSONB blob coming from the client.
 * We intentionally accept a small whitelist of keys (matching the deposit
 * wizard's accessory schema) so a malicious caller can't store arbitrary
 * payloads — and so the column never grows beyond a few KB per row.
 */
const ALLOWED_ATTRIBUTE_KEYS = new Set([
  'accessoryType', 'helmetType', 'visorType', 'size', 'gender',
  'shoeSize', 'antiTheftType', 'intercomFeatures',
]);
function sanitizeAttributes(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const key of Object.keys(input)) {
    if (!ALLOWED_ATTRIBUTE_KEYS.has(key)) continue;
    const v = input[key];
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x === 'string' && x.length <= 100).slice(0, 20);
      if (arr.length) out[key] = arr;
    } else if (typeof v === 'string' && v.length <= 100) {
      out[key] = v;
    }
  }
  return out;
}

const VALID_CONTACT_METHODS = ['phone', 'callback'];

// Allowed `?sort=` values. `distance` is intentionally listed even though it's
// resolved separately (it needs the geo origin from the WHERE builder); keeping
// it in the map means `Object.keys(SORT_MAP)` is the single source of truth for
// "which sort options does the API support" — useful for admin UIs and for
// rejecting unknown sort keys instead of silently falling back to newest.
const SORT_MAP = {
  newest: 'l.created_at DESC', oldest: 'l.created_at ASC',
  price_asc: 'l.price ASC', price_desc: 'l.price DESC',
  mileage_asc: 'l.mileage ASC', year_desc: 'l.year DESC NULLS LAST',
  popular: 'l.views_count DESC',
  // Sentinel value — getAll resolves this to the Haversine distance expression
  // when lat/lng are present in the query. Without geo it falls back to newest.
  distance: '__GEO_DISTANCE__',
};

/**
 * Build the shared filter WHERE for listing queries.
 * Returns the WHERE clause, its params, and the next free placeholder index.
 * Geo filtering (lat/lng/radius_km) is appended as a Haversine bounding
 * predicate so we can sort/filter by approximate distance without PostGIS.
 *
 * The shop_url ILIKE wraps "Tunis" to match "Tunis Moto Shop" type entries.
 */
function buildListingFilters(q) {
  const { type, brand, model, city, governorate, location, min_price, max_price,
    min_year, max_year, min_mileage, max_mileage, min_cc, max_cc,
    condition, search, status = 'active', seller_type, only_pro,
    user_id, seller_id,
    lat, lng, radius_km } = q;
  const ownerId = user_id || seller_id;

  // 'Neuf' from the frontend implies mileage = 0 in addition to condition.
  // `l.condition` is an ENUM (listing_condition) — cast to text for ILIKE.
  const conditionRaw = condition && String(condition).toLowerCase() === 'neuf'
    ? "l.condition::text ILIKE ? AND COALESCE(l.mileage,0) = 0" : null;

  // The frontend sends location as `governorate`, but Tunisian listings often
  // store the same value in `city` only (or vice versa). Match either column
  // so a user picking "Tunis" sees ads tagged either as city or governorate.
  // Accept `location` as an alias for callers that use the generic name.
  const locValue = governorate || location;

  const filters = {
    'l.status': { value: status },
    // Filter by exact owner (used by the "Accéder à la boutique" link on a
    // listing details page → show only this seller's listings).
    'l.user_id': { value: ownerId },
    // `l.type` is a Postgres ENUM (listing_type). ILIKE doesn't work on enums,
    // so we cast to text for case-insensitive matching. Without this cast,
    // any `?type=Moto` query crashes with `operator does not exist:
    // listing_type ~~* unknown` and returns 500 → frontend shows 0 results.
    'l.type::text': { value: type, ilike: true },
    // Brand is selected from a fixed dropdown — exact (case-insensitive) match
    // avoids "Yamaha" matching "Yamaha Motor". Model is wrapped so partial
    // model strings (e.g. "MT-07" against "MT-07 ABS") still match.
    'l.brand': { value: brand, ilike: true },
    'l.model': { value: model, ilike: true, wrap: true },
    'l.city': { value: city, ilike: true },
    // Location: match governorate OR city so a single picker covers both.
    'loc_match': locValue ? {
      value: locValue,
      values: [locValue, locValue],
      raw: '(l.governorate ILIKE ? OR l.city ILIKE ?)',
    } : { value: undefined },
    'l.price >= ?': { value: min_price, raw: 'l.price >= ?', cast: parseInt },
    'l.price <= ?': { value: max_price, raw: 'l.price <= ?', cast: parseInt },
    'l.year >= ?': { value: min_year, raw: 'l.year >= ?', cast: parseInt },
    'l.year <= ?': { value: max_year, raw: 'l.year <= ?', cast: parseInt },
    'l.mileage >= ?': { value: min_mileage, raw: 'l.mileage >= ?', cast: parseInt },
    'l.mileage <= ?': { value: max_mileage, raw: 'l.mileage <= ?', cast: parseInt },
    'l.cc >= ?': { value: min_cc, raw: 'l.cc >= ?', cast: parseInt },
    'l.cc <= ?': { value: max_cc, raw: 'l.cc <= ?', cast: parseInt },
    // `u.seller_type` is an ENUM ('Particulier','Pro'). Compare on the text
    // form so the frontend can pass either case ('pro' / 'Pro') without
    // tripping the enum input validator.
    'seller_type_match': seller_type ? {
      value: String(seller_type).toLowerCase(),
      raw: 'LOWER(u.seller_type::text) = ?',
    } : { value: undefined },
    'only_pro': { value: only_pro === 'true' || only_pro === true ? 'pro' : undefined,
                  raw: 'LOWER(u.seller_type::text) = ?' },
  };
  if (conditionRaw) {
    filters.condition_neuf = { value: condition, raw: conditionRaw };
  } else if (condition) {
    // `l.condition` is an ENUM (listing_condition). A bare `=` against a text
    // param triggers `invalid input value for enum` if the value casing/spelling
    // doesn't match an enum label. Compare on the text form so the API stays
    // tolerant ("Excellent" / "excellent" / "État neuf" all work) and never 500s.
    filters.condition_match = {
      value: String(condition),
      raw: 'LOWER(l.condition::text) = LOWER(?)',
    };
  }
  if (search) {
    // Universal full-text-ish search. We split on whitespace so a query like
    // "yamaha tmax 2020 tunis" matches all four tokens AND-style across any
    // of the searchable columns. Each token must match at least one column.
    //
    // Searched columns: title, brand, model, description, type (enum→text),
    // condition (enum→text), color, city, governorate, address, equipment
    // (TEXT[] joined to a single string), year (cast to text), seller name,
    // and shop_name. This makes the input behave like a real "search anything"
    // box — users can type a brand, model, city, year, equipment keyword,
    // seller name, or any combination, and it just works.
    const tokens = String(search).trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (tokens.length) {
      const perToken = `(
        l.title ILIKE ? OR l.brand ILIKE ? OR l.model ILIKE ? OR
        l.description ILIKE ? OR l.type::text ILIKE ? OR l.condition::text ILIKE ? OR
        l.color ILIKE ? OR l.city ILIKE ? OR l.governorate ILIKE ? OR
        COALESCE(l.address,'') ILIKE ? OR
        array_to_string(COALESCE(l.equipment,'{}'::text[]),' ') ILIKE ? OR
        COALESCE(l.year::text,'') ILIKE ? OR
        u.full_name ILIKE ? OR COALESCE(u.shop_name,'') ILIKE ?
      )`;
      const placeholdersPerToken = 14;
      const raw = tokens.map(() => perToken).join(' AND ');
      const values = [];
      tokens.forEach((tok) => {
        const term = `%${tok}%`;
        for (let i = 0; i < placeholdersPerToken; i++) values.push(term);
      });
      filters.search = { value: search, values, raw };
    }
  }

  const built = buildWhere(filters);

  // Append Haversine bounding circle if geo provided
  const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius_km);
  let distanceExpr = null;
  if (Number.isFinite(latN) && Number.isFinite(lngN)) {
    const i = built.nextIdx;
    // 6371 km earth radius. Returns distance in km.
    distanceExpr =
      `(6371 * acos(LEAST(1, GREATEST(-1, ` +
        `cos(radians($${i})) * cos(radians(l.latitude)) * ` +
        `cos(radians(l.longitude) - radians($${i + 1})) + ` +
        `sin(radians($${i})) * sin(radians(l.latitude))` +
      `))))`;
    built.params.push(latN, lngN);
    built.nextIdx += 2;

    let geo = `l.latitude IS NOT NULL AND l.longitude IS NOT NULL`;
    if (Number.isFinite(radN) && radN > 0) {
      geo += ` AND ${distanceExpr} <= $${built.nextIdx}`;
      built.params.push(radN);
      built.nextIdx += 1;
    }
    built.where = built.where
      ? `${built.where} AND ${geo}`
      : `WHERE ${geo}`;
  }
  return { ...built, distanceExpr };
}

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const sort = req.query.sort || 'newest';

    const { where, params, nextIdx, distanceExpr } = buildListingFilters(req.query);

    // 'distance' sort requires a geo origin; fall back to newest otherwise.
    // We resolve the SORT_MAP['distance'] sentinel here so the map can stay
    // declarative and `Object.keys(SORT_MAP)` enumerates every supported key.
    let orderBy;
    if (sort === 'distance') {
      orderBy = distanceExpr ? `${distanceExpr} ASC` : SORT_MAP.newest;
    } else {
      orderBy = SORT_MAP[sort] || SORT_MAP.newest;
    }

    // Apply the same banned-owner filter to the count so pagination matches.
    const countResult = await query(
      `SELECT COUNT(*) FROM listings l JOIN users u ON l.user_id = u.id
       ${where ? where + ' AND' : 'WHERE'} COALESCE(u.is_active, TRUE) = TRUE`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Snapshot placeholder indices BEFORE pushing limit/offset so the catch
    // block reuses the same slots. `nextIdx` is the next free $N from the
    // WHERE builder, so LIMIT goes to $nextIdx and OFFSET to $nextIdx+1.
    const limitIdx = nextIdx;
    const offsetIdx = nextIdx + 1;
    params.push(limit, offset);
    // Public list: hide listings whose owner has been deactivated/banned.
    // Without this, a banned seller's ads stayed visible to anonymous users
    // even though they couldn't be acted on. Owner-scoped lookups (handled in
    // getByUser / getFavorites) keep their existing visibility logic.
    const ownerActiveSql = `AND COALESCE(u.is_active, TRUE) = TRUE`;
    const composedWhere = where ? `${where} ${ownerActiveSql}` : `WHERE TRUE ${ownerActiveSql}`;
    // Try with shop_* columns (migration 011); fall back gracefully on older DBs.
    const distSelect = distanceExpr ? `, ${distanceExpr} AS distance_km` : '';
    let rows;
    try {
      ({ rows } = await query(
        `SELECT l.*, u.full_name as seller_name, u.avatar_url as seller_avatar, u.seller_type,
                u.city as seller_city, u.governorate as seller_governorate,
                u.shop_name as seller_shop_name, u.shop_logo as seller_shop_logo${distSelect}
         FROM listings l JOIN users u ON l.user_id = u.id
         ${composedWhere} ORDER BY l.is_featured DESC, ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT l.*, u.full_name as seller_name, u.avatar_url as seller_avatar, u.seller_type, u.city as seller_city${distSelect}
           FROM listings l JOIN users u ON l.user_id = u.id
           ${composedWhere} ORDER BY l.is_featured DESC, ${orderBy}
           LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params
        ));
      } else { throw innerErr; }
    }

    // Self-healing boost expiry on the LIST path: the cron sweeps every 10
    // minutes, but in between sweeps a listing whose boost just ended would
    // still float to the top of search thanks to `is_featured = TRUE`. Fire
    // a per-listing lazy expiry on each featured row in this page (no-ops
    // most of the time thanks to the in-memory debounce in boostExpiry.js).
    for (const r of rows) {
      if (r.is_featured) lazyExpireOne(r.id);
    }

    res.json({ listings: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) { next(err); }
}

/**
 * GET /listings/facets
 * Returns aggregate counts for the current filter set so the UI can show
 * sidebar facet badges (e.g. "Honda (24)") without slicing the full inventory
 * client-side. Honors all filters EXCEPT the facet dimensions we enumerate
 * so the counts behave like Leboncoin (toggling a brand doesn't zero-out the
 * other brand counts).
 */
async function getFacets(req, res, next) {
  try {
    const baseQuery = { ...req.query };
    delete baseQuery.brand; delete baseQuery.type; delete baseQuery.governorate;
    delete baseQuery.location; delete baseQuery.model;
    delete baseQuery.condition; delete baseQuery.only_pro; delete baseQuery.seller_type;
    delete baseQuery.lat; delete baseQuery.lng; delete baseQuery.radius_km;
    const { where, params } = buildListingFilters(baseQuery);

    // Defensive copy of params for every parallel query (regression guard).
    // Each `run()` returns { key, rows, error } so we can surface partial
    // failures to the client instead of silently rendering "0 brands" when
    // an aggregation actually crashed (typical cause: a new column missing
    // on an old DB, or a transient lock). Frontend can ignore `partial`
    // unless it wants to badge the facet bar.
    const run = (key, sql) => query(sql, [...params])
      .then(r => ({ key, rows: r.rows, error: null }))
      .catch((err) => {
        logger.warn(`facets: aggregation '${key}' failed:`, err && err.message);
        return { key, rows: [], error: err && err.message ? err.message : 'failed' };
      });
    const [byBrand, byType, byGov, byCondition, sellerCounts, totalRow] = await Promise.all([
      run('brand',     `SELECT l.brand AS key, COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where} GROUP BY l.brand ORDER BY count DESC LIMIT 100`),
      run('type',      `SELECT l.type AS key, COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where} GROUP BY l.type ORDER BY count DESC`),
      run('gov',       `SELECT COALESCE(l.governorate, l.city) AS key, COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where} GROUP BY COALESCE(l.governorate, l.city) ORDER BY count DESC LIMIT 100`),
      run('condition', `SELECT l.condition AS key, COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where} GROUP BY l.condition ORDER BY count DESC`),
      run('seller',    `SELECT LOWER(COALESCE(u.seller_type::text, 'particulier'::text)) AS key, COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where} GROUP BY LOWER(COALESCE(u.seller_type::text, 'particulier'::text))`),
      query(`SELECT COUNT(*)::int AS count FROM listings l JOIN users u ON l.user_id=u.id ${where}`, [...params])
        .then(r => ({ key: 'total', rows: [r.rows[0]], error: null }))
        .catch((err) => {
          logger.warn('facets: total count failed:', err && err.message);
          return { key: 'total', rows: [{ count: 0 }], error: err && err.message ? err.message : 'failed' };
        }),
    ]);

    // Aggregate per-bucket failure flags so the UI can show a "couldn't load
    // brand counts" notice instead of a misleading empty list.
    const partial = {};
    [byBrand, byType, byGov, byCondition, sellerCounts, totalRow].forEach((r) => {
      if (r.error) partial[r.key] = r.error;
    });

    res.json({
      total: totalRow.rows[0]?.count || 0,
      brand: byBrand.rows,
      type: byType.rows,
      governorate: byGov.rows,
      condition: byCondition.rows,
      seller_type: sellerCounts.rows,
      ...(Object.keys(partial).length ? { partial } : {}),
    });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    // Short public URLs carry the listing number (/annonce/slug-12) instead
    // of the UUID. Resolve it once so the rest of the handler is unchanged.
    if (/^\d+$/.test(String(req.params.id))) {
      const r = await query('SELECT id FROM listings WHERE listing_number = $1', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
      req.params.id = r.rows[0].id;
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) {
      // Neither a listing number nor a UUID: answer 404 instead of a database cast error (500).
      return res.status(404).json({ error: 'Listing not found' });
    }
    let rows;
    try {
      ({ rows } = await query(
        `SELECT l.*, u.full_name as seller_name, u.avatar_url as seller_avatar,
                u.phone as seller_phone, u.whatsapp as seller_whatsapp, u.seller_type,
                u.city as seller_city, u.governorate as seller_governorate,
                u.shop_name as seller_shop_name, u.shop_address as seller_shop_address,
                u.shop_logo as seller_shop_logo,
                u.is_verified as seller_verified, u.is_active as seller_active,
                u.created_at as seller_since
         FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1`,
        [req.params.id]
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT l.*, u.full_name as seller_name, u.avatar_url as seller_avatar,
                  u.phone as seller_phone, u.seller_type, u.city as seller_city,
                  u.is_verified as seller_verified, u.created_at as seller_since
           FROM listings l JOIN users u ON l.user_id = u.id WHERE l.id = $1`,
          [req.params.id]
        ));
      } else { throw innerErr; }
    }
    if (rows.length === 0) return res.status(404).json({ error: 'Listing not found' });

    // Hide listings whose owner has been deactivated/banned, except for the
    // owner themselves and admins (who may need to inspect them in moderation).
    if (rows[0].seller_active === false) {
      const viewerId = req.user?.id ? String(req.user.id) : null;
      const isOwner = viewerId && viewerId === String(rows[0].user_id);
      let isAdmin = false;
      if (viewerId && !isOwner) {
        try {
          const a = await query("SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'", [viewerId]);
          isAdmin = a.rows.length > 0;
        } catch { /* ignore */ }
      }
      if (!isOwner && !isAdmin) return res.status(404).json({ error: 'Listing not found' });
    }

    // Listing contact details are public: anonymous visitors must be able to
    // see the phone number and open WhatsApp directly from listing details.
    // Internal-only flag — never leak to clients.
    delete rows[0].seller_active;

    // Self-healing boost expiry: if this listing is still flagged featured but
    // all its boosts have ended, fire-and-forget a one-row sweep so the cron's
    // 10-minute window can never leave a stale "Featured" badge on the page.
    if (rows[0].is_featured) lazyExpireOne(rows[0].id);

    // Throttled view counting:
    //  - skip when the viewer is the owner (logged-in & == user_id)
    //  - skip obvious bots / link-preview crawlers via UA sniff
    //  - dedupe per IP+listing in a 1h window using listing_views
    // All operations are best-effort: failures must NEVER block the read.
    try {
      const ownerId = rows[0].user_id;
      const viewerId = req.user?.id || null;
      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      const isBot = !ua || /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp|telegram|discord|linkedin|twitter|embedly|fetch|node|axios|curl|wget|headless/i.test(ua);
      const isOwner = viewerId && String(viewerId) === String(ownerId);
      if (!isBot && !isOwner) {
        // Use req.ip — Express respects the `trust proxy` setting (see app.js)
        // and parses x-forwarded-for correctly. Hand-parsing the header here
        // bypassed that and would pick up spoofed values when trust proxy was
        // disabled.
        const ip = req.ip || null;
        // Dedupe a view if EITHER:
        //   • the same authenticated user already viewed in the last hour, OR
        //   • the same IP already viewed in the last hour.
        // The IP-only check massively undercounts behind CDN/NAT (every
        // visitor from one ISP shares an egress IP), so we additionally
        // dedupe by user_id when the viewer is logged in. Anonymous traffic
        // still falls back to IP-bucket dedupe — imperfect but the best we
        // have without a session cookie scheme.
        const ins = await query(
          `INSERT INTO listing_views (listing_id, user_id, ip)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM listing_views
             WHERE listing_id = $1
               AND created_at > NOW() - INTERVAL '1 hour'
               AND (
                 ($2::uuid IS NOT NULL AND user_id = $2)
                 OR ($2::uuid IS NULL AND ip = $3)
               )
           )
           RETURNING id`,
          [req.params.id, viewerId, ip]
        ).catch(() => ({ rows: [] }));
        if (ins.rows.length) {
          await query('UPDATE listings SET views_count = views_count + 1 WHERE id = $1', [req.params.id]);
        }
      }
    } catch (_) { /* never block the read */ }
    res.json(rows[0]);
  } catch (err) { next(err); }
}

const VALID_LISTING_TYPES = ['Moto', 'Scooter', 'Quad', 'Accessoires', 'Pièces'];

async function create(req, res, next) {
  try {
    const err = validateRequired(req.body, ['title', 'brand', 'model', 'type', 'price', 'condition']);
    if (err) return res.status(400).json({ error: err });

    if (!VALID_LISTING_TYPES.includes(req.body.type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_LISTING_TYPES.join(', ')}` });
    }

    // Length caps to prevent DB bloat / abuse.
    if (typeof req.body.title === 'string' && req.body.title.length > 200) {
      return res.status(400).json({ error: 'Titre trop long (max 200 caractères).' });
    }
    if (typeof req.body.description === 'string' && req.body.description.length > 5000) {
      return res.status(400).json({ error: 'Description trop longue (max 5000 caractères).' });
    }

    const { title, description, brand, model, type, price, condition,
      year, mileage, cc, color, city, governorate, address, latitude, longitude, images, equipment,
      contact_method, attributes } = req.body;

    // Validate latitude / longitude ranges. Out-of-range values would still
    // INSERT (column is plain numeric) but break Haversine distance math and
    // map rendering downstream. Accept only plausible Earth coordinates;
    // silently drop invalid ones to NULL rather than 400-ing the whole submit.
    const latNum = latitude != null ? Number(latitude) : null;
    const lngNum = longitude != null ? Number(longitude) : null;
    const safeLat = Number.isFinite(latNum) && latNum >= -90  && latNum <= 90  ? latNum : null;
    const safeLng = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180 ? lngNum : null;
    // Trim & cap address length to match migration 017 (VARCHAR(500)).
    const safeAddress = typeof address === 'string' && address.trim()
      ? address.trim().slice(0, 500)
      : null;

    // node-postgres serializes JS arrays into Postgres `text[]` automatically.
    // Passing the literal string '{}' would be coerced as text and fail with 22P02
    // when the column is `text[]`. Always send a real array.
    const safeImages = Array.isArray(images) ? images.filter((s) => typeof s === 'string') : [];
    const safeEquipment = Array.isArray(equipment) ? equipment.filter((s) => typeof s === 'string') : [];

    // Contact preference (migration 023). Default to 'phone' so existing
    // callers that don't send the field keep the legacy behaviour.
    const safeContactMethod = VALID_CONTACT_METHODS.includes(contact_method)
      ? contact_method
      : 'phone';

    // Free-form per-category metadata (migration 024). Currently used to store
    // accessory-specific fields (helmet type, size, gender, etc.) so the
    // detail page can render rich specs for accessories the same way it does
    // for bikes. JSON.stringify here because node-pg won't auto-serialize a
    // plain object into a JSONB column.
    const safeAttributes = JSON.stringify(sanitizeAttributes(attributes));

    // Status is hard-coded to 'pending' so new listings always go through
    // moderation, regardless of any future change to the column default.
    // Use `??` (nullish coalescing) so legitimate 0 values for mileage / cc
    // survive instead of being silently saved as NULL.
    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO listings (user_id, title, description, brand, model, type, price, condition,
          year, mileage, cc, color, city, governorate, address, latitude, longitude, images, equipment,
          contact_method, attributes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'pending') RETURNING *`,
        [req.user.id, title, description, brand, model, type, price, condition,
         year ?? null, mileage ?? null, cc ?? null, color ?? null,
         city ?? null, governorate ?? null, safeAddress, safeLat, safeLng,
         safeImages, safeEquipment, safeContactMethod, safeAttributes]
      ));
    } catch (insertErr) {
      // Idempotency: migration 015 added a unique partial index on
      // (user_id, lower(title), date_trunc('minute', created_at)) so a
      // double-submit (mobile retry) can't create two identical listings.
      // When the index trips (Postgres SQLSTATE 23505), look up the row the
      // first request just wrote and return it as a 200 — the client gets
      // exactly the same response shape it would have gotten on a fresh
      // create, just without the duplicate side-effect.
      if (insertErr && insertErr.code === '23505' && /listings_user_title_minute_uq/.test(insertErr.constraint || insertErr.message || '')) {
        const dup = await query(
          `SELECT * FROM listings
            WHERE user_id = $1
              AND lower(title) = lower($2)
              AND date_trunc('minute', created_at::timestamp) = date_trunc('minute', NOW()::timestamp)
            ORDER BY created_at DESC
            LIMIT 1`,
          [req.user.id, title]
        );
        if (dup.rows.length) {
          return res.status(200).json({ ...dup.rows[0], _idempotent_replay: true });
        }
      }
      throw insertErr;
    }
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const ownership = await checkOwnership(query, 'listings', req.params.id, req.user.id);
    if (!ownership.exists) return res.status(404).json({ error: 'Listing not found' });
    if (!ownership.owned) return res.status(403).json({ error: 'Not your listing' });

    // Validate optional fields client may PATCH:
    //   - lat/lng must be plausible Earth coordinates (silently dropped otherwise)
    //   - title ≤ 200 chars, description ≤ 5000 chars (DoS / DB bloat guard)
    const b = req.body || {};
    // Lat/lng are fully optional. Empty/invalid values are silently coerced
    // to NULL so the seller can publish with just an address.
    if (b.latitude !== undefined) {
      if (b.latitude === null || b.latitude === '') {
        b.latitude = null;
      } else {
        const n = Number(b.latitude);
        b.latitude = Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
      }
    }
    if (b.longitude !== undefined) {
      if (b.longitude === null || b.longitude === '') {
        b.longitude = null;
      } else {
        const n = Number(b.longitude);
        b.longitude = Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
      }
    }
    if (typeof b.title === 'string' && b.title.length > 200) {
      return res.status(400).json({ error: 'Titre trop long (max 200 caractères).' });
    }
    if (typeof b.description === 'string' && b.description.length > 5000) {
      return res.status(400).json({ error: 'Description trop longue (max 5000 caractères).' });
    }
    // Trim & cap address to match migration 017 (VARCHAR(500)). Empty string
    // or explicit null clears the previously-saved address.
    if (b.address !== undefined && b.address !== null) {
      if (typeof b.address !== 'string') {
        return res.status(400).json({ error: 'Adresse invalide.' });
      }
      const trimmed = b.address.trim();
      b.address = trimmed ? trimmed.slice(0, 500) : null;
    }

    // Sanitize + serialize the JSONB `attributes` blob (migration 024). We
    // accept it on update so the seller can fix accessory metadata after
    // publish (e.g. corrected helmet type) without losing existing values.
    if (b.attributes !== undefined) {
      b.attributes = JSON.stringify(sanitizeAttributes(b.attributes));
    }

    const upd = buildUpdate(b, LISTING_FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });

    // Re-moderation rule: if the seller changed any "material" content
    // (title, description, photos, brand/model/type, price, condition,
    // year, mileage, cc, location), flip the listing back to `pending` so
    // an admin re-verifies it before it returns to public search results.
    // Trivial edits (e.g. only equipment tags) keep their current status.
    // Owner is exempt from re-moderation skip — admin-approved status field
    // is not editable here (LISTING_FIELDS excludes it), so we set it
    // explicitly outside buildUpdate when needed.
    const MATERIAL_FIELDS = ['title', 'description', 'brand', 'model', 'type',
      'price', 'condition', 'year', 'mileage', 'cc', 'images',
      'city', 'governorate', 'address', 'latitude', 'longitude'];
    const touchedMaterial = MATERIAL_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(b, f));

    let setsSql = upd.sets;
    let requeued = false;
    if (touchedMaterial) {
      // Only re-queue listings that were already public (active) or previously
      // rejected. Drafts stay drafts; pending stays pending; sold/expired stay.
      const cur = await query('SELECT status FROM listings WHERE id = $1', [req.params.id]);
      const curStatus = cur.rows[0]?.status;
      if (curStatus === 'active' || curStatus === 'rejected') {
        setsSql += `, status = 'pending', published_at = NULL`;
        requeued = true;
      }
    }

    upd.params.push(req.params.id);
    const { rows } = await query(
      `UPDATE listings SET ${setsSql} WHERE id = $${upd.nextIdx} RETURNING *`, upd.params
    );
    res.json({ ...rows[0], _requeued_for_review: requeued });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ownership = await checkOwnership(query, 'listings', req.params.id, req.user.id);
    if (!ownership.exists) return res.status(404).json({ error: 'Listing not found' });

    // Admins may delete any listing (used by the moderation queue). For
    // everybody else, ownership of the listing is required.
    let isAdmin = false;
    try {
      const r = await query(
        'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 LIMIT 1',
        [req.user.id, 'admin'],
      );
      isAdmin = r.rows.length > 0;
    } catch { /* user_roles may be missing in dev — treat as non-admin */ }

    if (!ownership.owned && !isAdmin) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    await query('DELETE FROM listings WHERE id = $1', [req.params.id]);

    if (isAdmin && !ownership.owned) {
      try {
        await query(
          `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.user.id, 'listing_deleted', 'listing', req.params.id, JSON.stringify({ reason: req.query?.reason || req.body?.reason || null })],
        );
      } catch { /* audit log optional */ }
    }

    res.json({ message: 'Listing deleted' });
  } catch (err) { next(err); }
}

async function getByUser(req, res, next) {
  try {
    // Privacy: non-owner callers (and unauthenticated visitors) may only see
    // ACTIVE listings of an ACTIVE seller. The owner sees their full inventory
    // (drafts, pending, rejected, sold).
    const isOwner = req.user?.id != null && String(req.user.id) === String(req.params.userId);
    if (isOwner) {
      const { rows } = await query(
        'SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC',
        [req.params.userId]
      );
      return res.json(rows);
    }
    // Non-owner: bail out early if the seller is deactivated/banned so we
    // don't leak any of their inventory.
    try {
      const u = await query('SELECT is_active FROM users WHERE id = $1', [req.params.userId]);
      if (u.rows.length === 0 || u.rows[0].is_active === false) return res.json([]);
    } catch { /* fall through on schema issues */ }
    const { rows } = await query(
      "SELECT * FROM listings WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC",
      [req.params.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function toggleFavorite(req, res, next) {
  // Wrap the existence check, the favorites mutation, AND the cached
  // `listings.favorites_count` bump in a single transaction so the counter
  // can never drift from the actual row count if either statement fails
  // mid-way (db blip, constraint violation, network drop). Without this,
  // a failed UPDATE after a successful INSERT would leave the count low,
  // and over time the badge on the listing card silently rots.
  //
  // We use INSERT ... ON CONFLICT DO NOTHING RETURNING id to make the toggle
  // race-safe: two parallel POSTs from the same user (rapid double-click)
  // used to both pass the "does it exist?" SELECT and both try INSERT, the
  // second one tripping favorites_user_listing_uq → 500 → frontend reverts
  // the optimistic state. With ON CONFLICT, the loser observes "no row
  // returned" and treats the click as a DELETE branch, which matches what
  // the user actually sees (their click toggled the heart back off).
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Try to add the favorite. If a row was created, the user just favorited.
    // If not (conflict), it already existed — fall through to the DELETE branch.
    const ins = await client.query(
      `INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING
       RETURNING id`,
      [req.user.id, req.params.id]
    );
    let favorited;
    if (ins.rows.length > 0) {
      // Genuinely new favorite — bump the cached counter.
      await client.query(
        'UPDATE listings SET favorites_count = favorites_count + 1 WHERE id = $1',
        [req.params.id]
      );
      favorited = true;
    } else {
      // Already existed → user is unfavoriting. DELETE returns rowCount so we
      // only decrement the counter if a row actually went away (defensive
      // against a parallel un-favorite from another tab racing this one).
      const del = await client.query(
        'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2',
        [req.user.id, req.params.id]
      );
      if (del.rowCount > 0) {
        await client.query(
          'UPDATE listings SET favorites_count = GREATEST(favorites_count - 1, 0) WHERE id = $1',
          [req.params.id]
        );
      }
      favorited = false;
    }
    await client.query('COMMIT');
    res.json({ favorited });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }
    next(err);
  } finally {
    client.release();
  }
}

async function getFavorites(req, res, next) {
  try {
    // Hide favourites whose seller has been deactivated — they're functionally
    // unreachable, so showing them in the favourites tab is just confusing.
    const { rows } = await query(
      `SELECT l.*, f.created_at as favorited_at FROM favorites f
       JOIN listings l ON f.listing_id = l.id
       JOIN users u ON l.user_id = u.id
       WHERE f.user_id = $1 AND COALESCE(u.is_active, TRUE) = TRUE
       ORDER BY f.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, getFacets, create, update, remove, getByUser, toggleFavorite, getFavorites };
