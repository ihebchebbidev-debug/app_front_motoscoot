const { query, getClient } = require('../config/database');
const { buildUpdate, validateRequired } = require('../utils/queryHelpers');
const { sendListingApprovedEmail, sendListingRejectedEmail } = require('../services/mailer');

const SITE_URL = (process.env.FRONTEND_URL || 'https://www.moto-scoot.tn').replace(/\/+$/, '');

function _slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'annonce';
}

const AD_FIELDS = ['title', 'client', 'zone', 'description', 'media_type', 'media_url',
  'link_url', 'cta_text', 'target_location', 'start_date', 'end_date', 'is_active'];

/**
 * Escape ILIKE meta-characters (%, _, \) in user-supplied search terms so an
 * admin who searches for "foo_bar" doesn't accidentally match "fooXbar". The
 * caller still wraps the result in `%...%` for substring search.
 */
function escapeLike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function getUsers(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;
    const { search, role } = req.query;

    const params = []; const conditions = []; let idx = 1;
    if (search) {
      conditions.push(`(
        u.id::text ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.email ILIKE $${idx}
        OR COALESCE(u.phone, '') ILIKE $${idx} OR COALESCE(u.city, '') ILIKE $${idx}
        OR COALESCE(u.governorate, '') ILIKE $${idx} OR COALESCE(u.seller_type::text, '') ILIKE $${idx}
        OR COALESCE(ur.role::text, '') ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    if (role)   { conditions.push(`ur.role = $${idx++}`); params.push(role); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const join  = role ? 'JOIN user_roles ur ON u.id = ur.user_id' : 'LEFT JOIN user_roles ur ON u.id = ur.user_id';

    // Total count (must use the same JOIN/WHERE so search/role filtering matches).
    const countSql = `SELECT COUNT(DISTINCT u.id) AS total FROM users u ${join} ${where}`;
    const totalRow = await query(countSql, params);
    const total    = parseInt(totalRow.rows[0].total) || 0;

    // Pagination params come AFTER the filter params; use distinct placeholders.
    const limitIdx  = idx;
    const offsetIdx = idx + 1;
    params.push(limitNum, offset);

    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.seller_type, u.city,
              u.avatar_url, u.is_verified, u.is_active, u.created_at, u.last_login_at,
              array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL) AS roles
         FROM users u ${join} ${where}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    res.json({
      users: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (err) { next(err); }
}

async function setUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!['user', 'pro', 'admin', 'moderator'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    // Reject role assignment to a non-existent user so the admin gets a clear
    // 404 instead of a silently-orphaned user_roles row.
    const exists = await query('SELECT 1 FROM users WHERE id = $1', [req.params.id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
      [req.params.id, role]
    );
    // Audit trail — every role mutation is recorded with the actor admin id.
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'role_assigned', 'user', req.params.id, role]
    ).catch(() => { /* admin_logs is best-effort */ });
    res.json({ message: `Role ${role} assigned` });
  } catch (err) { next(err); }
}

async function removeUserRole(req, res, next) {
  try {
    // Accept role from body OR query — DELETE bodies are stripped by some
    // proxies/CDNs, so the frontend may send it as `?role=admin`.
    const role = (req.body && req.body.role) || req.query.role;
    if (!role) return res.status(400).json({ error: 'role required' });

    // Self-demotion guard: an admin must NOT be able to remove their own
    // 'admin' role. Without this an admin could lock themselves out and (if
    // they were the last admin) lock the entire instance out of moderation.
    if (role === 'admin' && String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas révoquer votre propre rôle administrateur.' });
    }

    await query('DELETE FROM user_roles WHERE user_id = $1 AND role = $2', [req.params.id, role]);
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'role_removed', 'user', req.params.id, role]
    ).catch(() => { /* admin_logs is best-effort */ });
    res.json({ message: `Role ${role} removed` });
  } catch (err) { next(err); }
}

async function banUser(req, res, next) {
  try {
    const ban = req.body.ban !== false;
    // Self-ban guard: don't let an admin deactivate their own account from
    // the admin panel — they'd immediately lose access.
    if (ban && String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
    }
    await query('UPDATE users SET is_active = $1 WHERE id = $2', [!ban, req.params.id]);
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, ban ? 'user_banned' : 'user_unbanned', 'user', req.params.id, null]
    ).catch(() => { /* admin_logs is best-effort */ });
    res.json({ message: ban ? 'User banned' : 'User unbanned' });
  } catch (err) { next(err); }
}

/**
 * PATCH /admin/users/:id/avatar — set or remove a user's profile photo.
 *
 * The admin uploads the file first through the regular upload pipeline
 * (POST /api/uploads/single — same storage as listing images and the
 * self-service avatar upload), then sends the resulting URL here.
 *
 * Body: { avatar_url: string | null } — null/'' removes the photo.
 * Absolute URLs pointing at our own /uploads/ storage are normalized to the
 * relative "/uploads/<file>" form so the column stays consistent with what
 * the self-service avatar upload writes.
 */
async function setUserAvatar(req, res, next) {
  try {
    let avatarUrl = req.body ? req.body.avatar_url : undefined;
    if (avatarUrl === undefined) return res.status(400).json({ error: 'avatar_url required (null to remove)' });

    if (avatarUrl === null || avatarUrl === '') {
      avatarUrl = null;
    } else {
      if (typeof avatarUrl !== 'string' || avatarUrl.length > 500) {
        return res.status(400).json({ error: 'Invalid avatar_url' });
      }
      avatarUrl = avatarUrl.trim();
      if (avatarUrl.startsWith('/uploads/')) {
        // already in the canonical relative form
      } else if (/^https?:\/\//i.test(avatarUrl)) {
        try {
          const u = new URL(avatarUrl);
          if (u.pathname.startsWith('/uploads/')) avatarUrl = u.pathname;
        } catch {
          return res.status(400).json({ error: 'Invalid avatar_url' });
        }
      } else {
        return res.status(400).json({ error: 'avatar_url must be an /uploads/ path or an http(s) URL' });
      }
    }

    const { rowCount, rows } = await query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [avatarUrl, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });

    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, avatarUrl ? 'avatar_updated' : 'avatar_removed', 'user', req.params.id, avatarUrl]
    ).catch(() => { /* admin_logs is best-effort */ });

    res.json({ message: avatarUrl ? 'Avatar updated' : 'Avatar removed', avatar_url: avatarUrl });
  } catch (err) { next(err); }
}

/**
 * DELETE /admin/users/:id — hard-delete a user account.
 * Cascades through every table that references users(id) ON DELETE CASCADE
 * (listings, favorites, conversations, messages, reviews, notifications…).
 * We additionally delete the user's listings explicitly inside the same
 * transaction so the cascade chain to listing_views/listing_clicks/
 * listing_contacts/listing_shares/favorites is exercised before we drop
 * the user row, and so the operation is recorded with a row count we can
 * surface in the admin log.
 *
 * Guards:
 *  - Cannot delete yourself (you'd lock the panel).
 *  - Cannot delete the last remaining admin.
 */
async function deleteUser(req, res, next) {
  const targetId = req.params.id;
  if (String(req.user.id) === String(targetId)) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const target = await client.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Refuse to delete the last admin so the panel stays operable.
    const isAdmin = await client.query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
      [targetId]
    ).catch(() => ({ rows: [] }));
    if (isAdmin.rows.length > 0) {
      const others = await client.query(
        `SELECT COUNT(*)::int AS n FROM user_roles WHERE role = 'admin' AND user_id <> $1`,
        [targetId]
      ).catch(() => ({ rows: [{ n: 1 }] }));
      if ((others.rows[0]?.n || 0) === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Impossible de supprimer le dernier administrateur." });
      }
    }

    // Explicitly drop the user's listings first so the CASCADE chain wipes
    // listing_views/clicks/contacts/shares/events/media/favorites tied to
    // them. The subsequent DELETE on users then cascades the rest
    // (favorites the user had, conversations, messages, notifications,
    // saved searches, site reviews, blocks, user_roles).
    const delListings = await client.query(
      'DELETE FROM listings WHERE user_id = $1',
      [targetId]
    );

    await client.query('DELETE FROM users WHERE id = $1', [targetId]);

    await client.query('COMMIT');

    query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'user_deleted', 'user', targetId, JSON.stringify({ listings_deleted: delListings.rowCount || 0 })]
    ).catch(() => { /* best-effort */ });

    res.json({
      message: 'User deleted',
      listings_deleted: delListings.rowCount || 0,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
}

async function getPendingListings(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT l.*, u.full_name as seller_name, u.email as seller_email
       FROM listings l JOIN users u ON l.user_id = u.id
       WHERE l.status = 'pending' ORDER BY l.created_at ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/**
 * GET /admin/listings — list listings with pagination + filters.
 *
 * Backwards-compat: when `page` is NOT provided we return the legacy
 * bare-array shape so older clients (e.g. cached frontends) keep working.
 * When `page` IS provided we return the paginated envelope
 * { listings, total, page, limit, total_pages } so the admin UI can render
 * proper Previous/Next controls — same pattern as `getUsers`.
 */
async function getAllListings(req, res, next) {
  try {
    const { status, search } = req.query;
    const paginated = req.query.page !== undefined;
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    // Cap the limit so a malicious or buggy client can't request 100k rows
    // and OOM the DB / response. Default 100 (legacy) or 25 (paginated UI),
    // hard ceiling 500.
    const limitNum = Math.min(
      Math.max(parseInt(req.query.limit) || (paginated ? 25 : 100), 1),
      500,
    );
    const offset   = (pageNum - 1) * limitNum;

    const params = []; const conditions = []; let idx = 1;
    if (status) { conditions.push(`l.status = $${idx++}`); params.push(status); }
    if (search) {
      conditions.push(`(
        l.id::text ILIKE $${idx} OR l.title ILIKE $${idx} OR COALESCE(l.description, '') ILIKE $${idx}
        OR l.brand ILIKE $${idx} OR l.model ILIKE $${idx} OR l.type::text ILIKE $${idx}
        OR l.condition::text ILIKE $${idx} OR COALESCE(l.city, '') ILIKE $${idx}
        OR COALESCE(l.governorate, '') ILIKE $${idx} OR COALESCE(l.color, '') ILIKE $${idx}
        OR COALESCE(l.year::text, '') ILIKE $${idx} OR l.price::text ILIKE $${idx}
        OR COALESCE(l.mileage::text, '') ILIKE $${idx} OR COALESCE(l.cc::text, '') ILIKE $${idx}
        OR u.full_name ILIKE $${idx} OR u.email ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    if (paginated) {
      const countSql = `SELECT COUNT(*) AS total FROM listings l JOIN users u ON l.user_id = u.id ${where}`;
      const totalRow = await query(countSql, params);
      total = parseInt(totalRow.rows[0].total) || 0;
    }

    const limitIdx  = idx;
    const offsetIdx = idx + 1;
    params.push(limitNum, offset);

    const { rows } = await query(
      `SELECT l.*, u.full_name as seller_name, u.email as seller_email
       FROM listings l JOIN users u ON l.user_id = u.id
       ${where} ORDER BY l.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    if (!paginated) return res.json(rows); // legacy shape
    res.json({
      listings: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (err) { next(err); }
}

async function moderateListing(req, res, next) {
  try {
    const { action, reason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Action must be approve or reject' });

    const status = action === 'approve' ? 'active' : 'rejected';
    const extra = action === 'approve' ? ', published_at = NOW()' : '';

    const upd = await query(
      `UPDATE listings SET status = $1${extra}, updated_at = NOW() WHERE id = $2 RETURNING id, title, user_id`,
      [status, req.params.id]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: 'Listing not found' });
    // admin_logs is best-effort — never let an audit-log failure 500 the moderation.
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, `listing_${action}`, 'listing', req.params.id, reason || null]
    ).catch(() => {});

    // Notify the owner by e-mail (best-effort, fire-and-forget).
    // Failures here must NEVER break the moderation response.
    (async () => {
      try {
        const { id: listingId, title: listingTitle, user_id: ownerId } = upd.rows[0];
        const ownerRes = await query(
          'SELECT email, full_name FROM users WHERE id = $1 LIMIT 1',
          [ownerId]
        );
        const owner = ownerRes.rows[0];
        if (!owner || !owner.email) return;

        const dashboardUrl = `${SITE_URL}/tableau-de-bord`;
        if (action === 'approve') {
          const listingUrl = `${SITE_URL}/annonce/${_slugify(listingTitle)}-${listingId}`;
          await sendListingApprovedEmail({
            to: owner.email,
            recipientName: owner.full_name || '',
            listingTitle: listingTitle || '',
            listingUrl,
            dashboardUrl,
          });
        } else {
          await sendListingRejectedEmail({
            to: owner.email,
            recipientName: owner.full_name || '',
            listingTitle: listingTitle || '',
            reason: reason || '',
            dashboardUrl,
          });
        }
      } catch (mailErr) {
        // Swallow — moderation must not depend on mail delivery.
        // eslint-disable-next-line no-console
        console.warn(`[moderateListing] notification email failed: ${mailErr.message}`);
      }
    })();

    res.json({ message: `Listing ${action}d` });
  } catch (err) { next(err); }
}

/** GET /admin/site-reviews?status=pending|published */
async function getSiteReviewsForModeration(req, res, next) {
  try {
    const status = req.query.status || 'pending';
    const isPublished = status === 'published';
    const { rows } = await query(
      `SELECT id, user_id, name, role, avatar_url, content, rating, is_published, created_at
         FROM site_reviews
        WHERE is_published = $1
        ORDER BY created_at DESC LIMIT 200`,
      [isPublished]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/**
 * GET /admin/garages — list garages (admin view, includes unverified).
 *
 * Backwards-compat: when `page` is omitted we return the legacy bare-array
 * shape (capped at 200). When `page` is provided we return the paginated
 * envelope { garages, total, page, limit, total_pages }.
 */
async function getAllGarages(req, res, next) {
  try {
    const { search, verified } = req.query;
    const paginated = req.query.page !== undefined;
    const pageNum   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum  = Math.min(
      Math.max(parseInt(req.query.limit) || (paginated ? 25 : 200), 1),
      500,
    );
    const offset    = (pageNum - 1) * limitNum;

    const params = []; const conditions = []; let idx = 1;
    if (search) {
      conditions.push(`(
        g.id::text ILIKE $${idx} OR g.name ILIKE $${idx} OR COALESCE(g.description, '') ILIKE $${idx}
        OR COALESCE(g.address, '') ILIKE $${idx} OR COALESCE(g.city, '') ILIKE $${idx}
        OR COALESCE(g.governorate, '') ILIKE $${idx} OR COALESCE(g.phone, '') ILIKE $${idx}
        OR COALESCE(g.email, '') ILIKE $${idx} OR COALESCE(g.website, '') ILIKE $${idx}
        OR COALESCE(g.specialties::text, '') ILIKE $${idx} OR COALESCE(u.full_name, '') ILIKE $${idx}
        OR COALESCE(u.email, '') ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    if (verified === 'true' || verified === 'false') {
      conditions.push(`g.is_verified = $${idx++}`);
      params.push(verified === 'true');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    if (paginated) {
      const countSql = `SELECT COUNT(*) AS total FROM garages g LEFT JOIN users u ON g.owner_id = u.id ${where}`;
      const totalRow = await query(countSql, params);
      total = parseInt(totalRow.rows[0].total) || 0;
    }

    const limitIdx  = idx;
    const offsetIdx = idx + 1;
    params.push(limitNum, offset);

    const { rows } = await query(
      `SELECT g.id, g.name, g.city, g.governorate, g.phone, g.email, g.image,
              g.is_verified, g.rating, g.reviews_count, g.created_at, g.owner_id,
              u.full_name as owner_name
         FROM garages g LEFT JOIN users u ON g.owner_id = u.id
         ${where} ORDER BY g.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    if (!paginated) return res.json(rows); // legacy shape
    res.json({
      garages: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (err) { next(err); }
}

/** PATCH /admin/garages/:id/verify */
async function setGarageVerified(req, res, next) {
  try {
    const verified = req.body.verified !== false;
    const { rows } = await query(
      'UPDATE garages SET is_verified = $1 WHERE id = $2 RETURNING id, is_verified',
      [verified, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Garage not found' });
    // Audit trail — every verification toggle is recorded with the actor admin id
    // (best-effort: never block the action if admin_logs is unavailable).
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, verified ? 'garage_verified' : 'garage_unverified', 'garage', req.params.id, null]
    ).catch(() => {});
    res.json(rows[0]);
  } catch (err) { next(err); }
}

/**
 * POST /admin/garages — admin-only garage creation.
 *
 * Unlike the public `POST /garages` (which requires a Pro account), this route
 * lets an admin create a fully-formed garage profile on behalf of a partner —
 * with the option to attach an existing user as `owner_id`, mark the garage as
 * verified, and set the `status` directly. Used by the admin GaragesTab.
 */
async function createGarageAsAdmin(req, res, next) {
  try {
    const err = validateRequired(req.body, ['name']);
    if (err) return res.status(400).json({ error: err });

    const {
      name, description, address, city, governorate, phone, email, website,
      image, cover_image, logo, images, specialties, hours, opening_hours,
      services, status, owner_id,
    } = req.body;
    const is_verified = req.body.is_verified === true;

    const safeImages      = Array.isArray(images)      ? images.filter((s) => typeof s === 'string') : [];
    const safeSpecialties = Array.isArray(specialties) ? specialties.filter((s) => typeof s === 'string') : [];
    const safeServices    = Array.isArray(services)    ? services : [];
    const safeStatus      = ['active', 'pending', 'suspended', 'closed'].includes(status) ? status : 'active';

    // Validate coordinate ranges to avoid persisting garbage that breaks the map.
    let { latitude, longitude } = req.body;
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

    // Optional owner — if provided, must reference an existing user.
    let safeOwnerId = null;
    if (owner_id) {
      const u = await query('SELECT id FROM users WHERE id = $1', [owner_id]);
      if (u.rows.length === 0) {
        return res.status(400).json({ error: 'Propriétaire introuvable.' });
      }
      safeOwnerId = u.rows[0].id;
    }

    const { rows } = await query(
      `INSERT INTO garages (
         owner_id, name, description, address, city, governorate, phone, email, website,
         image, cover_image, logo, images, specialties, latitude, longitude, hours,
         opening_hours, services, status, is_verified
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        safeOwnerId, name, description || null, address || null, city || null,
        governorate || null, phone || null, email || null, website || null,
        image || null, cover_image || image || null, logo || null,
        safeImages, safeSpecialties, latitude, longitude, hours || null,
        opening_hours || {}, JSON.stringify(safeServices), safeStatus, is_verified,
      ]
    );

    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'garage_created', 'garage', rows[0].id, null]
    ).catch(() => {});

    res.status(201).json(rows[0]);
  } catch (err) {
    // Friendly error for the unique-slug collision installed by migration 014.
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'Un garage avec ce nom existe déjà.' });
    }
    next(err);
  }
}

async function getReports(req, res, next) {
  try {
    const { resolved } = req.query;
    const isResolved = resolved === 'true';
    const { rows } = await query(
      `SELECT r.*, u.full_name as reporter_name, l.title as listing_title
       FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
       LEFT JOIN listings l ON r.listing_id = l.id
       WHERE r.is_resolved = $1 ORDER BY r.created_at ASC`,
      [isResolved]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function resolveReport(req, res, next) {
  try {
    const result = await query(
      'UPDATE reports SET is_resolved = true, resolved_by = $1 WHERE id = $2 RETURNING id',
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'report_resolved', 'report', req.params.id, null]
    ).catch(() => {});
    res.json({ message: 'Report resolved' });
  } catch (err) { next(err); }
}

async function createAdCampaign(req, res, next) {
  try {
    const err = validateRequired(req.body, ['title', 'client', 'zone', 'start_date', 'end_date']);
    if (err) return res.status(400).json({ error: err });

    const { title, client, zone, description, media_type, media_url, link_url, cta_text, target_location, start_date, end_date } = req.body;
    const { rows } = await query(
      `INSERT INTO ad_campaigns (title, client, zone, description, media_type, media_url, link_url, cta_text, target_location, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, client, zone, description, media_type, media_url, link_url, cta_text, target_location, start_date, end_date]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function getAdCampaigns(req, res, next) {
  try {
    const { active } = req.query;
    let sql = 'SELECT * FROM ad_campaigns';
    const params = [];
    if (active === 'true') {
      sql += ' WHERE is_active = true AND end_date >= NOW()';
    } else if (active === 'false') {
      // Previously this branch was missing — passing active=false silently
      // returned ALL campaigns. Now it correctly filters to inactive/expired.
      sql += ' WHERE is_active = false OR end_date < NOW()';
    }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getAdCampaignAnalytics(req, res, next) {
  try {
    const period = Math.min(Math.max(parseInt(req.query.period, 10) || 30, 1), 365);
    const campaignResult = await query('SELECT * FROM ad_campaigns WHERE id = $1', [req.params.id]);
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignResult.rows[0];

    const daily = await query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'), CURRENT_DATE, INTERVAL '1 day')::date AS day
       ), impressions AS (
         SELECT created_at::date AS day, COUNT(*)::int AS impressions
         FROM ad_impressions
         WHERE campaign_id = $1 AND created_at >= CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day')
         GROUP BY created_at::date
       ), clicks AS (
         SELECT created_at::date AS day, COUNT(*)::int AS clicks
         FROM ad_clicks
         WHERE campaign_id = $1 AND created_at >= CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day')
         GROUP BY created_at::date
       )
       SELECT days.day::text,
              COALESCE(impressions.impressions, 0) AS impressions,
              COALESCE(clicks.clicks, 0) AS clicks
       FROM days
       LEFT JOIN impressions ON impressions.day = days.day
       LEFT JOIN clicks ON clicks.day = days.day
       ORDER BY days.day ASC`,
      [req.params.id, period]
    );

    const totals = daily.rows.reduce((acc, row) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      return acc;
    }, { impressions: 0, clicks: 0 });

    const topLandingPages = await query(
      `SELECT COALESCE(NULLIF(landing_page, ''), $2) AS landing_page, COUNT(*)::int AS clicks
       FROM ad_clicks
       WHERE campaign_id = $1 AND created_at >= CURRENT_DATE - (($3::int - 1) * INTERVAL '1 day')
       GROUP BY COALESCE(NULLIF(landing_page, ''), $2)
       ORDER BY clicks DESC
       LIMIT 8`,
      [req.params.id, campaign.link_url || 'Sans lien configuré', period]
    );

    res.json({
      campaign,
      period_days: period,
      totals: {
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      },
      daily: daily.rows.map((row) => ({
        day: row.day,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        ctr: Number(row.impressions || 0) > 0 ? (Number(row.clicks || 0) / Number(row.impressions || 0)) * 100 : 0,
      })),
      top_landing_pages: topLandingPages.rows.length ? topLandingPages.rows.map((row) => ({
        landing_page: row.landing_page,
        clicks: Number(row.clicks || 0),
      })) : [],
    });
  } catch (err) { next(err); }
}

async function updateAdCampaign(req, res, next) {
  try {
    // ad_campaigns has no updated_at column, build SET manually
    const sets = []; const params = []; let idx = 1;
    for (const field of AD_FIELDS) {
      if (req.body[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        params.push(req.body[field]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteAdCampaign(req, res, next) {
  try {
    const result = await query('DELETE FROM ad_campaigns WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ message: 'Campaign deleted' });
  } catch (err) { next(err); }
}

async function getDashboardStats(req, res, next) {
  try {
    // Use allSettled so a missing optional table (e.g. visitor_sessions in
    // older deployments) does NOT 500 the entire admin dashboard — that
    // would lock admins out of moderation just because analytics is broken.
    const [users, listings, reports, sessions, garages] = await Promise.allSettled([
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = false) as banned FROM users'),
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active, COUNT(*) FILTER (WHERE status = 'pending') as pending FROM listings"),
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_resolved = false) as unresolved FROM reports'),
      query("SELECT COUNT(*) as total FROM visitor_sessions WHERE started_at >= NOW() - INTERVAL '30 days'"),
      // Garage counts — added so the OverviewTab "Garages" tile stops
      // showing a hardcoded em-dash. Backwards-compat: existing clients
      // that don't read `garages` simply ignore the extra key.
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_verified = true) as verified FROM garages')
    ]);
    const u = users.status === 'fulfilled' ? users.value.rows[0] : { total: 0, banned: 0 };
    const l = listings.status === 'fulfilled' ? listings.value.rows[0] : { total: 0, active: 0, pending: 0 };
    const r = reports.status === 'fulfilled' ? reports.value.rows[0] : { total: 0, unresolved: 0 };
    const s = sessions.status === 'fulfilled' ? sessions.value.rows[0] : { total: 0 };
    const g = garages.status === 'fulfilled' ? garages.value.rows[0] : { total: 0, verified: 0 };
    res.json({
      users: { total: +u.total, banned: +u.banned },
      listings: { total: +l.total, active: +l.active, pending: +l.pending },
      reports: { total: +r.total, unresolved: +r.unresolved },
      sessions_30d: +s.total,
      garages: { total: +g.total, verified: +g.verified }
    });
  } catch (err) { next(err); }
}

module.exports = {
  getUsers, setUserRole, removeUserRole, banUser, setUserAvatar, deleteUser,
  getPendingListings, getAllListings, moderateListing,
  getReports, resolveReport,
  createAdCampaign, getAdCampaigns, getAdCampaignAnalytics, updateAdCampaign, deleteAdCampaign,
  getDashboardStats,
  getSiteReviewsForModeration,
  getAllGarages, setGarageVerified, createGarageAsAdmin
};
