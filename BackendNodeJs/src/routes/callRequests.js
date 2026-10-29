/**
 * Call request endpoint — "Demander un rappel" CTA from listing details.
 *
 * Stores the request in `call_requests` and emails the listing owner. Public
 * (optional auth so we record requester_user_id when present), rate-limited
 * via DB dedupe (one request per (listing, phone) within 1h).
 */
const router = require('express').Router({ mergeParams: true });
const { query } = require('../config/database');
const { optionalAuth } = require('../middlewares/auth');
const { sendCallRequestEmail } = require('../services/mailer');
const logger = require('../utils/logger');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.moto-scoot.tn';

// POST /api/listings/:id/call-request { name, phone, message }
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { id: listingId } = req.params;
    const name = (req.body?.name || '').toString().trim().slice(0, 120);
    const phone = (req.body?.phone || '').toString().trim().slice(0, 40);
    const message = (req.body?.message || '').toString().trim().slice(0, 1000) || null;

    if (!phone || !/^[0-9+\s().-]{6,}$/.test(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    // Dedupe: same listing + same phone within last hour → 200 no-op.
    const dup = await query(
      `SELECT 1 FROM call_requests
        WHERE listing_id = $1 AND requester_phone = $2
          AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
      [listingId, phone]
    );
    if (dup.rows.length > 0) {
      return res.json({ success: true, deduped: true });
    }

    const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || null;

    const ins = await query(
      `INSERT INTO call_requests (listing_id, requester_user_id, requester_name, requester_phone, message, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [listingId, req.user?.id || null, name || null, phone, message, ip]
    );

    // Bump contacts_count just like the message channel.
    query('UPDATE listings SET contacts_count = contacts_count + 1 WHERE id = $1', [listingId]).catch(() => {});

    // Lookup owner email + listing title (best-effort; email is fire-and-forget).
    try {
      const { rows } = await query(
        `SELECT l.title, l.id AS listing_id, u.email, u.name AS owner_name
           FROM listings l JOIN users u ON u.id = l.user_id
          WHERE l.id = $1`,
        [listingId]
      );
      if (rows[0]?.email) {
        const r = rows[0];
        sendCallRequestEmail({
          to: r.email,
          recipientName: r.owner_name,
          requesterName: name,
          requesterPhone: phone,
          message,
          listingTitle: r.title,
          listingUrl: `${FRONTEND_URL}/annonces/${r.listing_id}`,
        }).catch((e) => logger.warn('[call-request] email failed:', e.message));
      }
    } catch (e) {
      logger.warn('[call-request] owner lookup failed:', e.message);
    }

    res.status(201).json({ success: true, id: ins.rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
