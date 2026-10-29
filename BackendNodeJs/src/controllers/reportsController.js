const { query } = require('../config/database');

const REPORT_REASON_MAP = {
  spam: 'spam',
  fraud: 'fraud',
  inappropriate: 'inappropriate',
  duplicate: 'duplicate',
  wrong_category: 'wrong_category',
  other: 'other',
  'annonce frauduleuse / arnaque': 'fraud',
  'véhicule déjà vendu': 'duplicate',
  'informations ou prix erronés': 'wrong_category',
  'photos trompeuses ou volées': 'inappropriate',
  'contenu inapproprié ou offensant': 'inappropriate',
  'autre raison': 'other',
};

function normalizeReportReason(reason) {
  const key = String(reason || '').trim().toLowerCase();
  return REPORT_REASON_MAP[key] || null;
}

/** POST /api/reports */
async function create(req, res, next) {
  try {
    const { listing_id, reason, details } = req.body;
    if (!listing_id || !reason) return res.status(400).json({ error: 'listing_id and reason required' });
    const normalizedReason = normalizeReportReason(reason);
    if (!normalizedReason) {
      return res.status(400).json({ error: 'Motif de signalement invalide.' });
    }

    // Self-report guard: a user cannot report their own listing — the only
    // outcome would be a noisy moderation queue full of mistakes / abuse.
    const owner = await query('SELECT user_id FROM listings WHERE id = $1', [listing_id]);
    if (owner.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (String(owner.rows[0].user_id) === String(req.user.id)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas signaler votre propre annonce.' });
    }

    // Prevent duplicate reports
    const existing = await query(
      'SELECT id FROM reports WHERE reporter_id = $1 AND listing_id = $2',
      [req.user.id, listing_id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Already reported' });

    // Cap the free-text fields so a hostile reporter can't dump megabytes of
    // PII / abuse into the moderation queue.
    const safeReason = normalizedReason;
    const safeDetails = details ? String(details).slice(0, 2000) : null;

    const { rows } = await query(
      'INSERT INTO reports (reporter_id, listing_id, reason, details) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, listing_id, safeReason, safeDetails]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

/** GET /api/reports/my - Get user's reports */
async function getMyReports(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT r.*, l.title as listing_title FROM reports r
       LEFT JOIN listings l ON r.listing_id = l.id
       WHERE r.reporter_id = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { create, getMyReports };
