const { query } = require('../config/database');

async function send(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'name, email, message required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
    const { rows } = await query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [name, email.toLowerCase().trim(), subject || null, message]
    );
    res.status(201).json({ message: 'Message envoyé', ...rows[0] });
  } catch (e) { next(e); }
}

async function adminList(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200'
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function adminResolve(req, res, next) {
  try {
    const { rows } = await query(
      'UPDATE contact_messages SET is_resolved = TRUE, resolved_by = $1 WHERE id = $2 RETURNING *',
      [req.user.id, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

module.exports = { send, adminList, adminResolve };
