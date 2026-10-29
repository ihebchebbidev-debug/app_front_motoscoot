const router = require('express').Router();
const { query } = require('../config/database');

router.get('/brands', async (req, res, next) => {
  try {
    const { category, accessory_type: accessoryType } = req.query;

    // ---- 1. Accessory-scoped brand list -------------------------------------
    // When the user picks Accessoires + an accessory type (Casque, Gant…)
    // we want only the brands an admin has explicitly tagged with that
    // accessory type. No fallback here — if the admin hasn't curated the
    // list yet we return [] so the dropdown is empty rather than misleading.
    if (accessoryType) {
      try {
        const { rows } = await query(
          `SELECT DISTINCT b.id, b.name, b.logo_url
             FROM brands b
             JOIN brand_accessory_types bat ON bat.brand_id = b.id
            WHERE bat.accessory_type ILIKE $1
            ORDER BY b.name`,
          [accessoryType]
        );
        return res.json(rows);
      } catch {
        // Migration 019 not applied yet — fall through to the unfiltered list.
      }
    }

    // ---- 2. Vehicle-category-scoped brand list ------------------------------
    if (category && category !== 'Accessoires') {
      // Prefer the explicit brand_categories join table (admin-curated).
      // Fall back to the legacy models.category inference so a freshly
      // upgraded DB without any curated rows still returns sensible data.
      try {
        const { rows } = await query(
          `SELECT DISTINCT b.id, b.name, b.logo_url
             FROM brands b
             JOIN brand_categories bc ON bc.brand_id = b.id
            WHERE bc.category ILIKE $1
            ORDER BY b.name`,
          [category]
        );
        if (rows.length > 0) return res.json(rows);
      } catch { /* table may not exist yet — fall through */ }

      const { rows } = await query(
        `SELECT DISTINCT b.id, b.name, b.logo_url
         FROM brands b
         JOIN models m ON m.brand_id = b.id
         WHERE m.category ILIKE $1
         ORDER BY b.name`,
        [category]
      );
      if (rows.length > 0) return res.json(rows);
    }

    // ---- 3. Accessoires without a chosen type → return only brands that
    // serve at least one accessory type (admin-curated). Falls back to the
    // full list if the join table is empty / missing so we never strand the UI.
    if (category === 'Accessoires') {
      try {
        const { rows } = await query(
          `SELECT DISTINCT b.id, b.name, b.logo_url
             FROM brands b
             JOIN brand_accessory_types bat ON bat.brand_id = b.id
            ORDER BY b.name`
        );
        if (rows.length > 0) return res.json(rows);
      } catch { /* fall through */ }
    }

    // ---- 4. Default — every brand --------------------------------------------
    const { rows } = await query('SELECT * FROM brands ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/brands/:brand/models', async (req, res, next) => {
  try {
    const { accessory_type: accessoryType } = req.query;
    if (accessoryType) {
      try {
        const { rows } = await query(
          `SELECT DISTINCT m.* FROM models m
             JOIN brands b ON m.brand_id = b.id
             JOIN model_accessory_types mat ON mat.model_id = m.id
            WHERE b.name ILIKE $1 AND mat.accessory_type ILIKE $2
            ORDER BY m.name`,
          [req.params.brand, accessoryType]
        );
        return res.json(rows);
      } catch { /* migration 019 not applied — fall through */ }
    }
    const { rows } = await query(
      `SELECT m.* FROM models m JOIN brands b ON m.brand_id = b.id
       WHERE b.name ILIKE $1 ORDER BY m.name`, [req.params.brand]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/models', async (req, res, next) => {
  try {
    const { brand, accessory_type: accessoryType } = req.query;

    // Accessory-scoped narrowing — only return models tagged with the type.
    if (accessoryType) {
      try {
        const params = [accessoryType];
        let sql = `SELECT DISTINCT m.* FROM models m
                     JOIN model_accessory_types mat ON mat.model_id = m.id
                    WHERE mat.accessory_type ILIKE $1`;
        if (brand) {
          params.push(brand);
          sql += ` AND m.brand_id = (SELECT id FROM brands WHERE name ILIKE $2 LIMIT 1)`;
        }
        sql += ' ORDER BY m.name';
        const { rows } = await query(sql, params);
        return res.json(rows);
      } catch { /* fall through */ }
    }

    if (!brand) {
      const { rows } = await query('SELECT * FROM models ORDER BY name');
      return res.json(rows);
    }
    const { rows } = await query(
      `SELECT m.* FROM models m JOIN brands b ON m.brand_id = b.id
       WHERE b.name ILIKE $1 ORDER BY m.name`, [brand]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/cities', async (req, res, next) => {
  try {
    const { governorate } = req.query;
    let sql = 'SELECT * FROM cities';
    const params = [];
    if (governorate) { sql += ' WHERE governorate = $1'; params.push(governorate); }
    sql += ' ORDER BY governorate, name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/governorates', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT DISTINCT governorate FROM cities ORDER BY governorate');
    res.json(rows.map(r => r.governorate));
  } catch (err) { next(err); }
});

// Categories — admin-managed list with optional image_url / icon_url /
// description (added in migration 011). Returns rich objects when those
// columns exist, falls back to plain `{name}` rows on older databases so
// the frontend (which already handles both shapes) keeps working.
router.get('/categories', async (_req, res) => {
  try {
    let rows;
    try {
      ({ rows } = await query(
        `SELECT name, position, image_url, icon_url, description
           FROM vehicle_categories
          WHERE is_active = TRUE
          ORDER BY position, name`
      ));
    } catch (e) {
      // 42703 = undefined_column → DB hasn't run migration 011 yet.
      if (e.code !== '42703') throw e;
      ({ rows } = await query(
        'SELECT name, position FROM vehicle_categories WHERE is_active = TRUE ORDER BY position, name'
      ));
    }
    if (rows.length === 0) {
      return res.json([
        { name: 'Scooter' }, { name: 'Moto' }, { name: 'Quad' },
        { name: 'Accessoires' }, { name: 'Pièces' },
      ]);
    }
    res.json(rows);
  } catch {
    res.json([
      { name: 'Scooter' }, { name: 'Moto' }, { name: 'Quad' },
      { name: 'Accessoires' }, { name: 'Pièces' },
    ]);
  }
});

router.get('/equipment', async (req, res, next) => {
  try {
    const { accessory_type: accessoryType } = req.query;
    if (accessoryType) {
      try {
        const { rows } = await query(
          'SELECT * FROM equipment WHERE accessory_type ILIKE $1 ORDER BY category, name',
          [accessoryType]
        );
        return res.json(rows);
      } catch { /* migration 019 not applied — fall through */ }
    }
    // Default: bike-equipment only (accessory_type IS NULL). Keeps the
    // existing wizard step for Moto/Scooter/Quad untouched.
    try {
      const { rows } = await query(
        'SELECT * FROM equipment WHERE accessory_type IS NULL ORDER BY category, name'
      );
      return res.json(rows);
    } catch {
      // Column doesn't exist yet (migration 019 not applied) — return all.
      const { rows } = await query('SELECT * FROM equipment ORDER BY category, name');
      res.json(rows);
    }
  } catch (err) { next(err); }
});

router.get('/colors', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM colors ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/conditions', (_req, res) => {
  res.json(['Neuf', 'État neuf', 'Excellent', 'Très bon', 'Bon', 'Correct', 'À réparer', 'Pour pièces']);
});

// Accessory types (dynamic)
router.get('/accessory-types', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM accessory_types WHERE is_active = TRUE ORDER BY position, name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Garage specialties (dynamic)
router.get('/garage-specialties', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM garage_specialties WHERE is_active = TRUE ORDER BY position, name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Garage service catalog (dynamic)
router.get('/garage-services', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM garage_service_catalog WHERE is_active = TRUE ORDER BY position, name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
