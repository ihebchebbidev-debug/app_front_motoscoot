const router = require('express').Router();
const { query } = require('../config/database');

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    const { rows } = await query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE, unsubscribed_at = NULL
       RETURNING id, email, subscribed_at`,
      [email.toLowerCase().trim()]
    );

    res.status(201).json({ message: 'Subscribed successfully.', subscriber: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/newsletter/unsubscribe
router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    await query(
      `UPDATE newsletter_subscribers SET is_active = FALSE, unsubscribed_at = NOW() WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    res.json({ message: 'Unsubscribed successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
