const { query } = require('../config/database');

async function getAll(req, res, next) {
  try {
    const { category, all } = req.query;
    // Admin route passes ?all=true to bypass the published filter.
    const conditions = [];
    const params = [];
    if (all !== 'true') conditions.push('is_published = TRUE');
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM faqs ${where} ORDER BY position, created_at`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { question, answer, category = 'general', position = 0, is_published = true } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
    const { rows } = await query(
      `INSERT INTO faqs (question, answer, category, position, is_published)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [question, answer, category, position, is_published]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { question, answer, category, position, is_published } = req.body;
    const { rows } = await query(
      `UPDATE faqs SET
        question = COALESCE($1, question),
        answer = COALESCE($2, answer),
        category = COALESCE($3, category),
        position = COALESCE($4, position),
        is_published = COALESCE($5, is_published)
       WHERE id = $6 RETURNING *`,
      [question, answer, category, position, is_published, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'FAQ not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await query('DELETE FROM faqs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { getAll, create, update, remove };
