/**
 * Importers (importateurs) CRUD — admin manages the catalog of
 * official brand importers/distributors. The public details page
 * for a fiche technique reads the importer assigned via
 * tech_specs.importer_id and renders its contact card.
 */
const { query } = require('../config/database');
const { buildUpdate, validateRequired } = require('../utils/queryHelpers');

const FIELDS = [
  'name', 'logo_url', 'address', 'city', 'phone', 'whatsapp',
  'email', 'website', 'description', 'rating', 'reviews_count', 'is_active',
];

async function list(req, res, next) {
  try {
    const { search, active, with_brands } = req.query;
    const conds = [];
    const params = [];
    let i = 1;
    if (search) {
      conds.push(`(name ILIKE $${i} OR COALESCE(city,'') ILIKE $${i} OR COALESCE(email,'') ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (active === 'true')  conds.push('is_active = TRUE');
    if (active === 'false') conds.push('is_active = FALSE');
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM importers ${where} ORDER BY name ASC`,
      params,
    );
    let importers = rows;
    if (with_brands === 'true' && rows.length) {
      // Derive each importer's brand list from tech_specs assignments —
      // single source of truth, no extra join table needed.
      const ids = rows.map((r) => r.id);
      const { rows: brandRows } = await query(
        `SELECT importer_id, ARRAY_AGG(DISTINCT brand ORDER BY brand) AS brands
           FROM tech_specs
          WHERE importer_id = ANY($1::uuid[])
          GROUP BY importer_id`,
        [ids],
      );
      const map = new Map(brandRows.map((b) => [b.importer_id, b.brands]));
      importers = rows.map((r) => ({ ...r, brands: map.get(r.id) || [] }));
    }
    res.json({ importers });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM importers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Importer not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const err = validateRequired(req.body, ['name']);
    if (err) return res.status(400).json({ error: err });
    const {
      name, logo_url = null, address = null, city = null,
      phone = null, whatsapp = null, email = null, website = null,
      description = null, rating = null, reviews_count = 0,
      is_active = true,
    } = req.body;
    const { rows } = await query(
      `INSERT INTO importers
         (name, logo_url, address, city, phone, whatsapp, email, website,
          description, rating, reviews_count, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name.trim(), logo_url, address, city, phone, whatsapp, email, website,
       description, rating, reviews_count, is_active],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un importateur avec ce nom existe déjà' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const upd = buildUpdate(req.body, FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });
    upd.params.push(req.params.id);
    const { rows } = await query(
      `UPDATE importers SET ${upd.sets}, updated_at = NOW()
        WHERE id = $${upd.nextIdx} RETURNING *`,
      upd.params,
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un importateur avec ce nom existe déjà' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const r = await query('DELETE FROM importers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };