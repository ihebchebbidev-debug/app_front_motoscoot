/**
 * Admin CRUD for every reference table:
 * brands, models, cities, vehicle_categories, accessory_types,
 * garage_specialties, garage_service_catalog, equipment, colors.
 *
 * All routes are mounted behind authenticate + requireAdmin (see admin.js).
 */
const { query } = require('../config/database');

/**
 * Read the curated category list for a single brand. Best-effort:
 * returns [] if the join table doesn't exist (e.g. migration 018 not
 * yet applied) so the admin UI still renders.
 */
async function readBrandCategories(brandId) {
  try {
    const { rows } = await query(
      'SELECT category FROM brand_categories WHERE brand_id = $1 ORDER BY category',
      [brandId]
    );
    return rows.map(r => r.category);
  } catch { return []; }
}

/**
 * Replace a brand's category links with the supplied list. Wraps the
 * delete + insert in a transaction so a failed insert never leaves the
 * brand with no categories at all.
 */
async function writeBrandCategories(brandId, categories) {
  if (!Array.isArray(categories)) return;
  const cleaned = Array.from(new Set(
    categories
      .filter(c => typeof c === 'string')
      .map(c => c.trim())
      .filter(Boolean)
  ));
  try {
    await query('BEGIN');
    await query('DELETE FROM brand_categories WHERE brand_id = $1', [brandId]);
    for (const cat of cleaned) {
      await query(
        'INSERT INTO brand_categories (brand_id, category) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [brandId, cat]
      );
    }
    await query('COMMIT');
  } catch (e) {
    try { await query('ROLLBACK'); } catch { /* ignore */ }
    // Don't fail the whole request — the brand row was already saved.
  }
}

/**
 * Same shape as readBrandCategories / writeBrandCategories, but for the
 * brand_accessory_types join table introduced in migration 019. Used to
 * scope the buyer-side brand dropdown when category=Accessoires + a
 * given accessory type (Casque, Gant, Veste, …) is chosen.
 */
async function readBrandAccessoryTypes(brandId) {
  try {
    const { rows } = await query(
      'SELECT accessory_type FROM brand_accessory_types WHERE brand_id = $1 ORDER BY accessory_type',
      [brandId]
    );
    return rows.map(r => r.accessory_type);
  } catch { return []; }
}
async function writeBrandAccessoryTypes(brandId, types) {
  if (!Array.isArray(types)) return;
  const cleaned = Array.from(new Set(
    types.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean)
  ));
  try {
    await query('BEGIN');
    await query('DELETE FROM brand_accessory_types WHERE brand_id = $1', [brandId]);
    for (const t of cleaned) {
      await query(
        'INSERT INTO brand_accessory_types (brand_id, accessory_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [brandId, t]
      );
    }
    await query('COMMIT');
  } catch {
    try { await query('ROLLBACK'); } catch { /* ignore */ }
  }
}

// Same helpers for model ↔ accessory_type.
async function readModelAccessoryTypes(modelId) {
  try {
    const { rows } = await query(
      'SELECT accessory_type FROM model_accessory_types WHERE model_id = $1 ORDER BY accessory_type',
      [modelId]
    );
    return rows.map(r => r.accessory_type);
  } catch { return []; }
}
async function writeModelAccessoryTypes(modelId, types) {
  if (!Array.isArray(types)) return;
  const cleaned = Array.from(new Set(
    types.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean)
  ));
  try {
    await query('BEGIN');
    await query('DELETE FROM model_accessory_types WHERE model_id = $1', [modelId]);
    for (const t of cleaned) {
      await query(
        'INSERT INTO model_accessory_types (model_id, accessory_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [modelId, t]
      );
    }
    await query('COMMIT');
  } catch {
    try { await query('ROLLBACK'); } catch { /* ignore */ }
  }
}

// ---------- BRANDS ----------
async function listBrands(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM brands ORDER BY name');
    // Attach curated categories per brand. One round-trip per brand is fine
    // for the small (~50 row) reference set; if it ever grows we can swap
    // to a single GROUP BY join.
    let catMap = new Map();
    let accMap = new Map();
    try {
      const r = await query(
        'SELECT brand_id, ARRAY_AGG(category ORDER BY category) AS cats FROM brand_categories GROUP BY brand_id'
      );
      r.rows.forEach(row => catMap.set(row.brand_id, row.cats));
    } catch { /* table missing — ignore */ }
    try {
      const r = await query(
        'SELECT brand_id, ARRAY_AGG(accessory_type ORDER BY accessory_type) AS types FROM brand_accessory_types GROUP BY brand_id'
      );
      r.rows.forEach(row => accMap.set(row.brand_id, row.types));
    } catch { /* migration 019 not applied — ignore */ }
    res.json(rows.map(b => ({
      ...b,
      categories: catMap.get(b.id) || [],
      accessory_types: accMap.get(b.id) || [],
    })));
  } catch (e) { next(e); }
}
async function createBrand(req, res, next) {
  try {
    const { name, logo_url, categories, accessory_types } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      'INSERT INTO brands (name, logo_url) VALUES ($1, $2) RETURNING *',
      [name, logo_url || null]
    );
    if (Array.isArray(categories) && categories.length) {
      await writeBrandCategories(rows[0].id, categories);
    }
    if (Array.isArray(accessory_types) && accessory_types.length) {
      await writeBrandAccessoryTypes(rows[0].id, accessory_types);
    }
    res.status(201).json({
      ...rows[0],
      categories: await readBrandCategories(rows[0].id),
      accessory_types: await readBrandAccessoryTypes(rows[0].id),
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'brand already exists' });
    next(e);
  }
}
async function updateBrand(req, res, next) {
  try {
    const { name, logo_url, categories, accessory_types } = req.body;
    const { rows } = await query(
      `UPDATE brands SET
         name = COALESCE($1, name),
         logo_url = COALESCE($2, logo_url)
       WHERE id = $3 RETURNING *`,
      [name, logo_url, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    // Only touch the join tables when the client explicitly sent the
    // corresponding array — otherwise PATCHing logo_url alone would wipe
    // the curated lists.
    if (Array.isArray(categories)) {
      await writeBrandCategories(rows[0].id, categories);
    }
    if (Array.isArray(accessory_types)) {
      await writeBrandAccessoryTypes(rows[0].id, accessory_types);
    }
    res.json({
      ...rows[0],
      categories: await readBrandCategories(rows[0].id),
      accessory_types: await readBrandAccessoryTypes(rows[0].id),
    });
  } catch (e) { next(e); }
}
async function deleteBrand(req, res, next) {
  try {
    // FK pre-check — refuse to delete a brand that is still referenced by listings
    // or models. Without this we'd either FK-error (23503 → 500) or, if the FK
    // is ON DELETE SET NULL, silently orphan a chunk of the catalog.
    try {
      const used = await query(
        `SELECT
           (SELECT COUNT(*)::int FROM listings WHERE brand = (SELECT name FROM brands WHERE id = $1)) AS l,
           (SELECT COUNT(*)::int FROM models WHERE brand_id = $1) AS m`,
        [req.params.id]
      );
      const { l, m } = used.rows[0] || { l: 0, m: 0 };
      if ((l || 0) + (m || 0) > 0) {
        return res.status(409).json({ error: `Cannot delete: ${l} listing(s) and ${m} model(s) still reference this brand.` });
      }
    } catch { /* fall through — best effort */ }
    try {
      const r = await query('DELETE FROM brands WHERE id = $1 RETURNING id', [req.params.id]);
      if (!r.rowCount) return res.status(404).json({ error: 'not found' });
      res.json({ success: true });
    } catch (e) {
      if (e && e.code === '23503') {
        return res.status(409).json({ error: 'Brand is still referenced by other records.' });
      }
      throw e;
    }
  } catch (e) { next(e); }
}

// ---------- MODELS ----------
async function listModels(req, res, next) {
  try {
    const { brand_id } = req.query;
    const params = [];
    let sql = `SELECT m.*, b.name AS brand_name
               FROM models m JOIN brands b ON m.brand_id = b.id`;
    if (brand_id) { params.push(brand_id); sql += ` WHERE m.brand_id = $1`; }
    sql += ' ORDER BY b.name, m.name';
    const { rows } = await query(sql, params);
    // Attach curated accessory_types per model (best-effort).
    let accMap = new Map();
    try {
      const r = await query(
        'SELECT model_id, ARRAY_AGG(accessory_type ORDER BY accessory_type) AS types FROM model_accessory_types GROUP BY model_id'
      );
      r.rows.forEach(row => accMap.set(row.model_id, row.types));
    } catch { /* migration 019 not applied — ignore */ }
    res.json(rows.map(m => ({ ...m, accessory_types: accMap.get(m.id) || [] })));
  } catch (e) { next(e); }
}
async function createModel(req, res, next) {
  try {
    const { brand_id, name, category, accessory_types } = req.body;
    if (!brand_id || !name) return res.status(400).json({ error: 'brand_id and name required' });
    const { rows } = await query(
      'INSERT INTO models (brand_id, name, category) VALUES ($1, $2, $3) RETURNING *',
      [brand_id, name, category || null]
    );
    if (Array.isArray(accessory_types) && accessory_types.length) {
      await writeModelAccessoryTypes(rows[0].id, accessory_types);
    }
    res.status(201).json({
      ...rows[0],
      accessory_types: await readModelAccessoryTypes(rows[0].id),
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'model already exists for this brand' });
    next(e);
  }
}
async function updateModel(req, res, next) {
  try {
    const { name, category, brand_id, accessory_types } = req.body;
    const { rows } = await query(
      `UPDATE models SET
         name = COALESCE($1, name),
         category = COALESCE($2, category),
         brand_id = COALESCE($3, brand_id)
       WHERE id = $4 RETURNING *`,
      [name, category, brand_id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    if (Array.isArray(accessory_types)) {
      await writeModelAccessoryTypes(rows[0].id, accessory_types);
    }
    res.json({
      ...rows[0],
      accessory_types: await readModelAccessoryTypes(rows[0].id),
    });
  } catch (e) { next(e); }
}
async function deleteModel(req, res, next) {
  try {
    try {
      const used = await query(
        `SELECT COUNT(*)::int AS n FROM listings
          WHERE model = (SELECT name FROM models WHERE id = $1)`,
        [req.params.id]
      );
      if ((used.rows[0]?.n || 0) > 0) {
        return res.status(409).json({ error: `Cannot delete: ${used.rows[0].n} listing(s) still reference this model.` });
      }
    } catch { /* best effort */ }
    try {
      const r = await query('DELETE FROM models WHERE id = $1 RETURNING id', [req.params.id]);
      if (!r.rowCount) return res.status(404).json({ error: 'not found' });
      res.json({ success: true });
    } catch (e) {
      if (e && e.code === '23503') {
        return res.status(409).json({ error: 'Model is still referenced.' });
      }
      throw e;
    }
  } catch (e) { next(e); }
}

// ---------- CITIES ----------
async function listCities(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM cities ORDER BY governorate, name');
    res.json(rows);
  } catch (e) { next(e); }
}
async function createCity(req, res, next) {
  try {
    const { name, governorate } = req.body;
    if (!name || !governorate) return res.status(400).json({ error: 'name and governorate required' });
    const { rows } = await query(
      'INSERT INTO cities (name, governorate) VALUES ($1, $2) RETURNING *',
      [name, governorate]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'city already exists' });
    next(e);
  }
}
async function updateCity(req, res, next) {
  try {
    const { name, governorate } = req.body;
    const { rows } = await query(
      `UPDATE cities SET
         name = COALESCE($1, name),
         governorate = COALESCE($2, governorate)
       WHERE id = $3 RETURNING *`,
      [name, governorate, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}
async function deleteCity(req, res, next) {
  try {
    try {
      const used = await query(
        `SELECT COUNT(*)::int AS n FROM listings
          WHERE city = (SELECT name FROM cities WHERE id = $1)`,
        [req.params.id]
      );
      if ((used.rows[0]?.n || 0) > 0) {
        return res.status(409).json({ error: `Cannot delete: ${used.rows[0].n} listing(s) still reference this city.` });
      }
    } catch { /* best effort */ }
    try {
      const r = await query('DELETE FROM cities WHERE id = $1 RETURNING id', [req.params.id]);
      if (!r.rowCount) return res.status(404).json({ error: 'not found' });
      res.json({ success: true });
    } catch (e) {
      if (e && e.code === '23503') {
        return res.status(409).json({ error: 'City is still referenced.' });
      }
      throw e;
    }
  } catch (e) { next(e); }
}

// ---------- Generic name-position handler for the small lookup tables ----------
// `extraCols` lists optional admin-editable columns (e.g. `image_url`,
// `description`, `icon_url`) added by later migrations. Each handler
// transparently falls back to the legacy (name/position/is_active) shape
// when the column is missing — so older databases keep responding 200
// instead of 500 until migration 011 has been applied.
function makeLookupHandlers(table, extraCols = []) {
  const pickExtras = (body) => {
    const out = {};
    for (const c of extraCols) {
      if (body[c] !== undefined) out[c] = body[c] === '' ? null : body[c];
    }
    return out;
  };

  return {
    list: async (_req, res, next) => {
      try {
        const { rows } = await query(`SELECT * FROM ${table} ORDER BY position, name`);
        res.json(rows);
      } catch (e) { next(e); }
    },
    create: async (req, res, next) => {
      try {
        const { name, position = 0, is_active = true } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });
        const extras = pickExtras(req.body);
        const cols = ['name', 'position', 'is_active', ...Object.keys(extras)];
        const vals = [name, position, is_active, ...Object.values(extras)];
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        try {
          const { rows } = await query(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            vals
          );
          return res.status(201).json(rows[0]);
        } catch (e) {
          // Column missing (older DB without migration 011) — retry with the
          // base columns only so the admin form still works.
          if (e.code === '42703') {
            const { rows } = await query(
              `INSERT INTO ${table} (name, position, is_active) VALUES ($1, $2, $3) RETURNING *`,
              [name, position, is_active]
            );
            return res.status(201).json(rows[0]);
          }
          throw e;
        }
      } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'name already exists' });
        next(e);
      }
    },
    update: async (req, res, next) => {
      try {
        const { name, position, is_active } = req.body;
        const extras = pickExtras(req.body);
        const sets = ['name = COALESCE($1, name)', 'position = COALESCE($2, position)', 'is_active = COALESCE($3, is_active)'];
        const vals = [name, position, is_active];
        Object.entries(extras).forEach(([k, v]) => {
          vals.push(v);
          sets.push(`${k} = COALESCE($${vals.length}, ${k})`);
        });
        vals.push(req.params.id);
        try {
          const { rows } = await query(
            `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
            vals
          );
          if (!rows.length) return res.status(404).json({ error: 'not found' });
          return res.json(rows[0]);
        } catch (e) {
          if (e.code === '42703') {
            const { rows } = await query(
              `UPDATE ${table} SET
                 name = COALESCE($1, name),
                 position = COALESCE($2, position),
                 is_active = COALESCE($3, is_active)
               WHERE id = $4 RETURNING *`,
              [name, position, is_active, req.params.id]
            );
            if (!rows.length) return res.status(404).json({ error: 'not found' });
            return res.json(rows[0]);
          }
          throw e;
        }
      } catch (e) { next(e); }
    },
    remove: async (req, res, next) => {
      try {
        const r = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!r.rowCount) return res.status(404).json({ error: 'not found' });
        res.json({ success: true });
      } catch (e) { next(e); }
    },
  };
}

const vehicleCategories  = makeLookupHandlers('vehicle_categories', ['image_url', 'icon_url', 'description']);
const accessoryTypes     = makeLookupHandlers('accessory_types',    ['image_url', 'icon_url']);
const garageSpecialties  = makeLookupHandlers('garage_specialties');
const garageServices     = makeLookupHandlers('garage_service_catalog');

// equipment + colors have richer schemas (category / accessory_type / hex)
async function listEquipment(_req, res, next) {
  try {
    // Try to read accessory_type column (added in migration 019). If the
    // column is missing, fall back to a SELECT * so the admin UI keeps
    // rendering on databases that haven't been migrated yet.
    try {
      const { rows } = await query(
        'SELECT id, name, category, accessory_type FROM equipment ORDER BY accessory_type NULLS FIRST, category, name'
      );
      return res.json(rows);
    } catch {
      const { rows } = await query('SELECT * FROM equipment ORDER BY category, name');
      res.json(rows);
    }
  } catch (e) { next(e); }
}
async function createEquipment(req, res, next) {
  try {
    const { name, category, accessory_type } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const { rows } = await query(
        'INSERT INTO equipment (name, category, accessory_type) VALUES ($1, $2, $3) RETURNING *',
        [name, category || null, accessory_type || null]
      );
      return res.status(201).json(rows[0]);
    } catch {
      const { rows } = await query(
        'INSERT INTO equipment (name, category) VALUES ($1, $2) RETURNING *',
        [name, category || null]
      );
      res.status(201).json(rows[0]);
    }
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'name already exists' });
    next(e);
  }
}
async function updateEquipment(req, res, next) {
  try {
    const { name, category, accessory_type } = req.body;
    try {
      const { rows } = await query(
        `UPDATE equipment SET
           name = COALESCE($1, name),
           category = COALESCE($2, category),
           accessory_type = COALESCE($3, accessory_type)
         WHERE id = $4 RETURNING *`,
        [name, category, accessory_type, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      return res.json(rows[0]);
    } catch {
      const { rows } = await query(
        `UPDATE equipment SET
           name = COALESCE($1, name),
           category = COALESCE($2, category)
         WHERE id = $3 RETURNING *`,
        [name, category, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    }
  } catch (e) { next(e); }
}
async function deleteEquipment(req, res, next) {
  try {
    const r = await query('DELETE FROM equipment WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function listColors(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM colors ORDER BY name');
    res.json(rows);
  } catch (e) { next(e); }
}
async function createColor(req, res, next) {
  try {
    const { name, hex } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      'INSERT INTO colors (name, hex) VALUES ($1, $2) RETURNING *',
      [name, hex || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'color already exists' });
    next(e);
  }
}
async function updateColor(req, res, next) {
  try {
    const { name, hex } = req.body;
    const { rows } = await query(
      `UPDATE colors SET
         name = COALESCE($1, name),
         hex = COALESCE($2, hex)
       WHERE id = $3 RETURNING *`,
      [name, hex, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}
async function deleteColor(req, res, next) {
  try {
    const r = await query('DELETE FROM colors WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = {
  // brands
  listBrands, createBrand, updateBrand, deleteBrand,
  // models
  listModels, createModel, updateModel, deleteModel,
  // cities
  listCities, createCity, updateCity, deleteCity,
  // generic lookup tables
  vehicleCategories, accessoryTypes, garageSpecialties, garageServices,
  // equipment / colors
  listEquipment, createEquipment, updateEquipment, deleteEquipment,
  listColors, createColor, updateColor, deleteColor,
};
