const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../config/database');
const { isValidTunisiaPhone, formatTunisiaPhone, TUNISIA_PHONE_ERROR } = require('../utils/phone');

async function getProfile(req, res, next) {
  try {
    // Try the full select first; fall back gracefully on older DBs that don't
    // have the shop_* / address / lat-lng columns yet (42703 = column missing).
    let rows;
    try {
      ({ rows } = await query(
        `SELECT id, email, full_name, phone, whatsapp, avatar_url, seller_type,
                city, governorate, bio, address, latitude, longitude,
                shop_name, shop_address, shop_logo,
                is_verified, created_at
         FROM users WHERE id = $1`, [req.params.id]
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT id, email, full_name, phone, avatar_url, seller_type,
                  city, governorate, bio, is_verified, created_at
           FROM users WHERE id = $1`, [req.params.id]
        ));
      } else { throw innerErr; }
    }
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Fetch listings count and roles in parallel — roles are needed for /users/me
    // so the frontend can correctly compute admin/moderator state.
    const [listings, roles] = await Promise.all([
      query("SELECT COUNT(*) FROM listings WHERE user_id = $1 AND status = 'active'", [req.params.id]),
      query('SELECT role FROM user_roles WHERE user_id = $1', [req.params.id]).catch(() => ({ rows: [] })),
    ]);

    // -------- PII gating --------
    // Phone, WhatsApp, address and exact coordinates are sensitive. Expose them
    // only to:
    //   - the owner themselves
    //   - admins
    //   - users with an active (non-archived) conversation with the profile owner
    // Everyone else gets the public projection (name, avatar, city, bio, etc.).
    const profile = rows[0];
    const profileId = String(profile.id);
    const viewerId = req.user?.id ? String(req.user.id) : null;
    const isOwner = viewerId && viewerId === profileId;

    let canSeePII = isOwner;
    if (!canSeePII && viewerId) {
      // Admin?
      try {
        const ar = await query(
          "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'",
          [viewerId]
        );
        if (ar.rows.length > 0) canSeePII = true;
      } catch { /* ignore */ }
    }
    if (!canSeePII && viewerId) {
      // Active conversation between viewer and profile owner?
      try {
        const conv = await query(
          `SELECT 1 FROM conversations
            WHERE is_archived = false
              AND ((buyer_id = $1 AND seller_id = $2) OR (buyer_id = $2 AND seller_id = $1))
            LIMIT 1`,
          [viewerId, profileId]
        );
        if (conv.rows.length > 0) canSeePII = true;
      } catch { /* ignore */ }
    }

    if (!canSeePII) {
      delete profile.phone;
      delete profile.whatsapp;
      delete profile.address;
      delete profile.latitude;
      delete profile.longitude;
    }

    res.json({
      ...profile,
      listings_count: parseInt(listings.rows[0].count),
      roles: roles.rows.map((r) => r.role),
    });
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const b = req.body || {};

    // Accept both legacy and new FE shapes:
    //   - full_name (legacy)  OR first_name + last_name (new FE)
    //   - avatar_url (legacy) OR avatar (new FE alias)
    //   - whatsapp is now persisted alongside phone (column added in 005_dynamic_garage_data.sql,
    //     but we COALESCE so older DBs without the column just ignore it).
    const composedFullName = [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
    const full_name = (b.full_name && String(b.full_name).trim()) || composedFullName || null;
    const avatar_url = b.avatar_url || b.avatar || null;
    let whatsapp = b.whatsapp ?? null;

    let { phone, city, governorate, bio, address } = b;

    // Pro-only fields. Trim + treat empty string as null so partial updates
    // don't accidentally wipe an existing value with ''.
    const norm = (v) => {
      if (v === undefined) return undefined;          // not provided → keep current
      if (v === null) return null;                    // explicit null → also keep (COALESCE)
      const s = String(v).trim();
      return s === '' ? null : s;
    };
    const shop_name    = norm(b.shop_name);
    const shop_address = norm(b.shop_address);
    const shop_logo    = norm(b.shop_logo);

    // Map coordinates from a Leaflet picker — accept both top-level lat/lng
    // and a nested { coordinates: { lat, lng } } payload for convenience.
    let latitude  = b.latitude  ?? b.lat ?? b?.coordinates?.lat ?? null;
    let longitude = b.longitude ?? b.lng ?? b?.coordinates?.lng ?? null;

    // Validate phone (Tunisia) if the client sent a non-empty value. We allow
    // null/undefined so partial profile updates that don't touch the phone
    // still work (the COALESCE in the UPDATE keeps the existing value).
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      if (!isValidTunisiaPhone(phone)) {
        return res.status(400).json({ error: TUNISIA_PHONE_ERROR });
      }
      phone = formatTunisiaPhone(phone);
    }
    if (whatsapp !== undefined && whatsapp !== null && String(whatsapp).trim() !== '') {
      if (!isValidTunisiaPhone(whatsapp)) {
        return res.status(400).json({ error: 'WhatsApp ' + TUNISIA_PHONE_ERROR });
      }
      whatsapp = formatTunisiaPhone(whatsapp);
    }

    // Coerce + validate coordinates if supplied. Reject impossible values
    // outright so we never persist garbage that would break the map render.
    if (latitude !== null && latitude !== undefined && latitude !== '') {
      const n = Number(latitude);
      if (!Number.isFinite(n) || n < -90 || n > 90) {
        return res.status(400).json({ error: 'Latitude invalide (doit être entre -90 et 90).' });
      }
      latitude = n;
    } else { latitude = null; }
    if (longitude !== null && longitude !== undefined && longitude !== '') {
      const n = Number(longitude);
      if (!Number.isFinite(n) || n < -180 || n > 180) {
        return res.status(400).json({ error: 'Longitude invalide (doit être entre -180 et 180).' });
      }
      longitude = n;
    } else { longitude = null; }

    if (address !== undefined && address !== null) {
      address = String(address).trim();
      if (address.length > 500) {
        return res.status(400).json({ error: 'Adresse trop longue (max 500 caractères).' });
      }
      if (address === '') address = null;
    }

    // Build a dynamic UPDATE so that fields the client did NOT send keep their
    // current value, while fields explicitly sent (including empty string ⇒
    // null) actually overwrite. Previously we used COALESCE(..., column) which
    // meant clearing the address or moving the map pin to a new spot would be
    // ignored if the new value normalized to null.
    const sets = [];
    const vals = [];
    const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

    if (b.full_name !== undefined || b.first_name !== undefined || b.last_name !== undefined) {
      push('full_name', full_name);
    }
    if (b.phone !== undefined)        push('phone', phone ?? null);
    if (b.city !== undefined)         push('city', city ?? null);
    if (b.governorate !== undefined)  push('governorate', governorate ?? null);
    if (b.bio !== undefined)          push('bio', bio ?? null);
    if (b.avatar_url !== undefined || b.avatar !== undefined) push('avatar_url', avatar_url);
    if (b.whatsapp !== undefined)     push('whatsapp', whatsapp);
    if (b.address !== undefined)      push('address', address ?? null);
    if (b.latitude !== undefined || b.lat !== undefined || b?.coordinates?.lat !== undefined) {
      push('latitude', latitude);
    }
    if (b.longitude !== undefined || b.lng !== undefined || b?.coordinates?.lng !== undefined) {
      push('longitude', longitude);
    }
    if (b.shop_name !== undefined)    push('shop_name', shop_name ?? null);
    if (b.shop_address !== undefined) push('shop_address', shop_address ?? null);
    if (b.shop_logo !== undefined)    push('shop_logo', shop_logo ?? null);

    if (sets.length === 0) {
      // Nothing to update — just return the current row.
      const { rows: cur } = await query(
        `SELECT id, email, full_name, phone, whatsapp, avatar_url, seller_type,
                city, governorate, bio, address, latitude, longitude,
                shop_name, shop_address, shop_logo
           FROM users WHERE id = $1`, [req.user.id]
      );
      return res.json(cur[0] || {});
    }

    sets.push(`updated_at = NOW()`);
    vals.push(req.user.id);
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')}
        WHERE id = $${vals.length}
       RETURNING id, email, full_name, phone, whatsapp, avatar_url, seller_type,
                 city, governorate, bio, address, latitude, longitude,
                 shop_name, shop_address, shop_logo`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    // The DB is missing one of the new columns (migrations 010/011 not applied
    // on this deployment). Fail loudly instead of silently dropping the
    // address / coordinates / shop fields, which previously made the dashboard
    // appear to "save" while the data was actually lost.
    if (err && err.code === '42703') {
      return res.status(503).json({
        error:
          "La base de données n'est pas à jour (colonne manquante). " +
          "Exécutez les migrations sur le serveur (npm run migrate) puis réessayez.",
        detail: err.message,
      });
    }
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    // Accept BOTH snake_case (legacy) and camelCase (current FE) field names
    // so a future FE refactor can't silently break password change again.
    const b = req.body || {};
    const current_password = b.current_password ?? b.oldPassword ?? b.old_password;
    const new_password     = b.new_password     ?? b.newPassword;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (new_password.length > 200) return res.status(400).json({ error: 'Password too long' });

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
}

/**
 * DELETE /users/me — soft-delete the current account.
 *  1. Mark user inactive + anonymize PII (email/phone/name/avatar/bio/address).
 *  2. Soft-delete (status='deleted') all their listings so they disappear from
 *     search but stay referenced in past conversations / orders for integrity.
 *  3. Archive every conversation they're part of so the peer no longer sees a
 *     live thread but message history is preserved.
 *  4. Blacklist the current JWT so it can't be reused even before expiry.
 * All steps run in a single transaction — if anything fails, nothing changes.
 */
async function deleteAccount(req, res, next) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;

    // 1. Anonymize + deactivate. Email is suffixed with the user id so the
    //    UNIQUE constraint isn't violated and the slot can be re-registered.
    const anonEmail = `deleted+${userId}@deleted.local`;
    await client.query(
      `UPDATE users SET
         is_active   = false,
         email       = $2,
         full_name   = 'Compte supprimé',
         phone       = NULL,
         whatsapp    = NULL,
         avatar_url  = NULL,
         bio         = NULL,
         address     = NULL,
         latitude    = NULL,
         longitude   = NULL,
         shop_name   = NULL,
         shop_address= NULL,
         shop_logo   = NULL,
         updated_at  = NOW()
       WHERE id = $1`,
      [userId, anonEmail]
    ).catch(async (err) => {
      // Older DBs may not have all the new columns — fall back to the minimum.
      if (err && err.code === '42703') {
        await client.query(
          `UPDATE users SET is_active=false, email=$2, full_name='Compte supprimé',
             phone=NULL, avatar_url=NULL, updated_at=NOW() WHERE id=$1`,
          [userId, anonEmail]
        );
      } else { throw err; }
    });

    // 2. Soft-delete listings — set them to 'expired' (the closest existing
    //    enum value to "no longer for sale") so they disappear from search but
    //    rows are preserved for FK integrity in messages/favorites. We don't
    //    use a 'deleted' status because the listing_status enum doesn't include
    //    it (and adding it would require a migration just for this code path).
    await client.query(
      `UPDATE listings SET status='expired', updated_at=NOW()
        WHERE user_id = $1 AND status NOT IN ('expired','sold')`,
      [userId]
    );

    // 3. Archive every conversation the user is part of.
    await client.query(
      `UPDATE conversations SET is_archived = true
        WHERE (buyer_id = $1 OR seller_id = $1) AND is_archived = false`,
      [userId]
    );

    // 4. Blacklist the current JWT (best-effort — table is created by migration 012).
    try {
      const header = req.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        const token = header.split(' ')[1];
        const decoded = jwt.decode(token);
        const expiresAt = decoded?.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 3600e3);
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        await client.query(
          `INSERT INTO token_blacklist (token_hash, user_id, expires_at)
           VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING`,
          [hash, userId, expiresAt]
        );
      }
    } catch { /* table missing — non-fatal */ }

    await client.query('COMMIT');
    res.json({ message: 'Account deleted', deleted: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    next(err);
  } finally {
    client.release();
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // compressAndSave is called via the upload middleware, result is in req.compressedImage
    const { compressAndSave } = require('./uploadController');
    const result = await compressAndSave(req.file.buffer, req.file.originalname, req);

    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [result.url, req.user.id]);
    res.json({ avatar_url: result.url, thumbnail_url: result.thumbnail_url });
  } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile, changePassword, deleteAccount, uploadAvatar };
