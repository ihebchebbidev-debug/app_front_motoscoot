/**
 * Newsletter broadcast — admin-only.
 * POST /api/admin/newsletter/broadcast { subject, contentHtml, preheader? }
 *
 * Sends to all active subscribers in batches of 25 with a 500ms gap to stay
 * under SMTP throttling. Each recipient gets a personalized unsubscribe link.
 * Records broadcast id + delivery counts.
 */
const router = require('express').Router();
const { query } = require('../config/database');
const { sendNewsletterEmail } = require('../services/mailer');
const logger = require('../utils/logger');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.moto-scoot.tn';
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POST /api/admin/newsletter/broadcast
router.post('/broadcast', async (req, res, next) => {
  try {
    const subject = (req.body?.subject || '').toString().trim().slice(0, 200);
    const contentHtml = (req.body?.contentHtml || '').toString();
    const preheader = (req.body?.preheader || '').toString().slice(0, 200);

    if (!subject || !contentHtml || contentHtml.length < 10) {
      return res.status(400).json({ error: 'subject and contentHtml are required' });
    }

    const { rows: subs } = await query(
      `SELECT email FROM newsletter_subscribers WHERE is_active = TRUE`
    );
    if (subs.length === 0) {
      return res.json({ sent: 0, failed: 0, total: 0, message: 'Aucun abonné actif' });
    }

    // Respond immediately; continue sending in background so the admin UI
    // doesn't time out on large lists.
    res.json({ accepted: true, total: subs.length });

    let sent = 0, failed = 0;
    for (let i = 0; i < subs.length; i += BATCH_SIZE) {
      const batch = subs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (s) => {
        try {
          const unsubscribeUrl = `${FRONTEND_URL}/newsletter/unsubscribe?email=${encodeURIComponent(s.email)}`;
          await sendNewsletterEmail({
            to: s.email,
            subject,
            contentHtml,
            preheader,
            unsubscribeUrl,
          });
          sent += 1;
        } catch (e) {
          failed += 1;
          logger.warn(`[newsletter] send to ${s.email} failed:`, e.message);
        }
      }));
      if (i + BATCH_SIZE < subs.length) await sleep(BATCH_DELAY_MS);
    }
    logger.info(`[newsletter] broadcast done — sent=${sent} failed=${failed} total=${subs.length}`);
  } catch (err) { next(err); }
});

module.exports = router;
