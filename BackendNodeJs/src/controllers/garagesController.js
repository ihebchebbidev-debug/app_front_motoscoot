const { query } = require('../config/database');
const { buildUpdate, parsePagination, paginationMeta, validateRequired, checkOwnership } = require('../utils/queryHelpers');
const { encodeCursor, parseCursorParams } = require('../utils/cursor');

const GARAGE_FIELDS = ['name', 'description', 'address', 'city', 'governorate', 'phone', 'email',
  'website', 'image', 'images', 'specialties', 'latitude', 'longitude', 'hours'];

/**
 * GET /api/garages
 *
 * Two pagination modes are supported on the same endpoint for back-compat:
 *
 *   1. Legacy offset (default): ?page=1&limit=20
 *      Returns { garages, pagination: { page, limit, total, pages } }.
 *
 *   2. Cursor: ?cursor=<opaque>&limit=20
 *      Returns { garages, nextCursor }. `nextCursor === null` means end-of-list.
 *      Ordering tuple: (is_verified DESC, rating DESC, id ASC).
 *      The cursor encodes { is_verified, rating, id } of the LAST row served.
 *
 * Filters (city / governorate / search / specialty) work in both modes.
 */
async function getAll(req, res, next) {
  try {
    const useCursor = req.query.cursor !== undefined || req.query.mode === 'cursor';
    const { city, governorate, search, specialty } = req.query;

    // Build the WHERE clause once, reused below.
    const params = []; const conditions = []; let idx = 1;
    if (city) { conditions.push(`g.city ILIKE $${idx++}`); params.push(city); }
    if (governorate) { conditions.push(`g.governorate ILIKE $${idx++}`); params.push(governorate); }
    if (search) { conditions.push(`g.name ILIKE $${idx++}`); params.push(`%${search}%`); }
    if (specialty) { conditions.push(`$${idx++} = ANY(g.specialties)`); params.push(specialty); }

    if (useCursor) {
      const { limit, cursor } = parseCursorParams(req.query, 20, 50);

      // Seek predicate: rows strictly AFTER the cursor in the chosen ordering.
      // Tuple: (is_verified DESC, rating DESC, id ASC). Postgres tuple comparison
      // is the cleanest way, but DESC ordering on booleans / numeric needs us
      // to compare manually on each component to stay correct under DESC keys.
      if (cursor && cursor.id) {
        // Translate DESC keys via boolean math: smaller "rank" comes later.
        // (is_verified, rating, id) is_after cursor when:
        //   is_verified <  cursor.is_verified          -- already past
        //   OR (is_verified == cursor.is_verified AND rating <  cursor.rating)
        //   OR (is_verified == cursor.is_verified AND rating == cursor.rating AND id > cursor.id)
        const cIsVerified = !!cursor.is_verified;
        const cRating = cursor.rating == null ? 0 : Number(cursor.rating);
        const cId = String(cursor.id);
        // Compare ids as text to stay portable across uuid / bigint / serial
        // primary keys (avoids 22P02 when the cursor encodes a non-uuid id).
        conditions.push(
          `(g.is_verified < $${idx} ` +
          `OR (g.is_verified = $${idx} AND COALESCE(g.rating,0) < $${idx + 1}) ` +
          `OR (g.is_verified = $${idx} AND COALESCE(g.rating,0) = $${idx + 1} AND g.id::text > $${idx + 2}))`
        );
        params.push(cIsVerified, cRating, cId);
        idx += 3;
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      // Fetch one extra row to know if there's a next page.
      params.push(limit + 1);
      const { rows } = await query(
        `SELECT g.* FROM garages g ${where}
         ORDER BY g.is_verified DESC, COALESCE(g.rating, 0) DESC, g.id ASC
         LIMIT $${idx}`,
        params
      );

      let nextCursor = null;
      let pageRows = rows;
      if (rows.length > limit) {
        pageRows = rows.slice(0, limit);
        const last = pageRows[pageRows.length - 1];
        nextCursor = encodeCursor({
          is_verified: !!last.is_verified,
          rating: last.rating == null ? 0 : Number(last.rating),
          id: last.id,
        });
      }
      return res.json({ garages: pageRows, nextCursor });
    }

    // ---- Legacy offset mode (unchanged) ----
    const { page, limit, offset } = parsePagination(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM garages g ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT g.* FROM garages g ${where} ORDER BY g.is_verified DESC, g.rating DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    res.json({ garages: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM garages WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Garage not found' });

    const [reviews, services] = await Promise.all([
      query(`SELECT gr.*, u.full_name, u.avatar_url FROM garage_reviews gr
             JOIN users u ON gr.user_id = u.id WHERE gr.garage_id = $1 ORDER BY gr.created_at DESC LIMIT 10`, [req.params.id]),
      query('SELECT * FROM garage_services WHERE garage_id = $1', [req.params.id])
    ]);

    // Optional auth: if a valid token was sent, decode it to flag ownership.
    let isOwner = false;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../config/jwt');
        const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
        // Coerce to string: decoded.id is from JWT payload (may be number), owner_id from DB is UUID string.
        isOwner = decoded?.id != null && String(decoded.id) === String(rows[0].owner_id);
      } catch { /* ignore */ }
    }

    res.json({ ...rows[0], reviews: reviews.rows, services: services.rows, is_owner: isOwner });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const err = validateRequired(req.body, ['name']);
    if (err) return res.status(400).json({ error: err });

    // Role gate: garage profiles are a Pro/business feature. Allow only:
    //   - users flagged seller_type = 'pro' (or 'professionnel') in users
    //   - admins / moderators (any role in user_roles other than 'user')
    // Otherwise any user could create a "verified-looking" garage page.
    let allowed = false;
    try {
      const u = await query('SELECT seller_type FROM users WHERE id = $1', [req.user.id]);
      const st = String(u.rows[0]?.seller_type || '').toLowerCase();
      if (st.includes('pro')) allowed = true;
    } catch { /* ignore */ }
    if (!allowed) {
      try {
        const r = await query(
          "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin','moderator','pro')",
          [req.user.id]
        );
        if (r.rows.length > 0) allowed = true;
      } catch { /* ignore */ }
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Compte Pro requis pour créer un garage.' });
    }

    const { name, description, address, city, governorate, phone, email, website, image, images, specialties, hours } = req.body;
    let { latitude, longitude } = req.body;
    const safeImages      = Array.isArray(images)      ? images.filter((s) => typeof s === 'string') : [];
    const safeSpecialties = Array.isArray(specialties) ? specialties.filter((s) => typeof s === 'string') : [];

    // Validate coordinate ranges to avoid persisting garbage that breaks the map.
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const n = Number(latitude);
      if (!Number.isFinite(n) || n < -90 || n > 90) {
        return res.status(400).json({ error: 'Latitude invalide (doit être entre -90 et 90).' });
      }
      latitude = n;
    } else { latitude = null; }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const n = Number(longitude);
      if (!Number.isFinite(n) || n < -180 || n > 180) {
        return res.status(400).json({ error: 'Longitude invalide (doit être entre -180 et 180).' });
      }
      longitude = n;
    } else { longitude = null; }
    // Force is_verified = false on creation; only admins may flip the flag.
    const { rows } = await query(
      `INSERT INTO garages (owner_id, name, description, address, city, governorate, phone, email, website, image, images, specialties, latitude, longitude, hours, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false) RETURNING *`,
      [req.user.id, name, description, address, city, governorate, phone, email, website, image, safeImages, safeSpecialties, latitude, longitude, hours]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const ownership = await checkOwnership(query, 'garages', req.params.id, req.user.id, 'owner_id');
    if (!ownership.exists) return res.status(404).json({ error: 'Garage not found' });
    if (!ownership.owned) return res.status(403).json({ error: 'Not your garage' });

    const upd = buildUpdate(req.body, GARAGE_FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });

    upd.params.push(req.params.id);
    const { rows } = await query(`UPDATE garages SET ${upd.sets} WHERE id = $${upd.nextIdx} RETURNING *`, upd.params);
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ownership = await checkOwnership(query, 'garages', req.params.id, req.user.id, 'owner_id');
    if (!ownership.exists) return res.status(404).json({ error: 'Garage not found' });
    if (!ownership.owned) return res.status(403).json({ error: 'Not your garage' });

    await query('DELETE FROM garages WHERE id = $1', [req.params.id]);
    res.json({ message: 'Garage deleted' });
  } catch (err) { next(err); }
}

async function addReview(req, res, next) {
  try {
    const { rating, content } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });

    // Block self-reviews — owner can't rate their own garage.
    try {
      const g = await query('SELECT owner_id FROM garages WHERE id = $1', [req.params.id]);
      if (g.rows.length === 0) return res.status(404).json({ error: 'Garage not found' });
      if (String(g.rows[0].owner_id) === String(req.user.id)) {
        return res.status(403).json({ error: 'Vous ne pouvez pas évaluer votre propre garage.' });
      }
    } catch { /* fall through */ }

    let rows;
    try {
      ({ rows } = await query(
        'INSERT INTO garage_reviews (garage_id, user_id, rating, content) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.params.id, req.user.id, rating, content]
      ));
    } catch (insErr) {
      // 23505 = unique_violation — enforced by migration 012's UNIQUE(user_id, garage_id).
      if (insErr && insErr.code === '23505') {
        return res.status(409).json({ error: 'Vous avez déjà évalué ce garage.' });
      }
      throw insErr;
    }

    await query(
      `UPDATE garages SET rating = (SELECT AVG(rating) FROM garage_reviews WHERE garage_id = $1),
       reviews_count = (SELECT COUNT(*) FROM garage_reviews WHERE garage_id = $1) WHERE id = $1`,
      [req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, addReview };
