/**
 * Shared query builder helpers to DRY all controllers
 */

/**
 * Build WHERE clause + params from a filter map
 * @param {Object} filters - { column: { value, op?, ilike? } }
 * @returns {{ where: string, params: any[], nextIdx: number }}
 */
function buildWhere(filters, startIdx = 1) {
  const conditions = [];
  const params = [];
  let idx = startIdx;

  for (const [col, config] of Object.entries(filters)) {
    if (config.value === undefined || config.value === null || config.value === '') continue;

    if (config.raw) {
      // Raw SQL condition with one or more '?' placeholders.
      // - If `values` (array) is provided, each '?' is replaced with $N and
      //   each entry is pushed as a separate param (supports multi-column
      //   searches like "title ILIKE ? OR brand ILIKE ? OR model ILIKE ?").
      // - Otherwise the single `value` is reused for every '?' placeholder.
      const placeholderCount = (config.raw.match(/\?/g) || []).length;
      let rawSql = config.raw;
      const valuesList = Array.isArray(config.values)
        ? config.values
        : Array(placeholderCount).fill(config.cast ? config.cast(config.value) : config.value);
      for (let i = 0; i < placeholderCount; i++) {
        rawSql = rawSql.replace('?', `$${idx++}`);
        params.push(valuesList[i]);
      }
      conditions.push(rawSql);
    } else if (config.ilike) {
      conditions.push(`${col} ILIKE $${idx++}`);
      params.push(config.wrap ? `%${config.value}%` : config.value);
    } else if (config.op) {
      conditions.push(`${col} ${config.op} $${idx++}`);
      params.push(config.cast ? config.cast(config.value) : config.value);
    } else {
      conditions.push(`${col} = $${idx++}`);
      params.push(config.value);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params, nextIdx: idx };
}

/**
 * Build SET clause for UPDATE from allowed fields
 * @returns {{ sets: string, params: any[], nextIdx: number }} or null if no fields
 */
const ARRAY_FIELDS = new Set(['images', 'equipment', 'specialties', 'visor_type', 'intercom_features']);
function buildUpdate(body, allowedFields, startIdx = 1) {
  const sets = [];
  const params = [];
  let idx = startIdx;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      sets.push(`${field} = $${idx++}`);
      let value = body[field];
      // Coerce known array fields so node-postgres serializes them as text[].
      // A stray '{}' string would be cast as text and trigger 22P02 on text[] columns.
      if (ARRAY_FIELDS.has(field)) {
        if (!Array.isArray(value)) value = [];
        else value = value.filter((v) => typeof v === 'string');
      }
      params.push(value);
    }
  }

  if (sets.length === 0) return null;
  sets.push('updated_at = NOW()');
  return { sets: sets.join(', '), params, nextIdx: idx };
}

/**
 * Parse pagination from query params
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Format pagination response
 */
function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/**
 * Validate required fields, returns error message or null
 */
function validateRequired(body, fields) {
  const missing = fields.filter(f => !body[f] && body[f] !== 0 && body[f] !== false);
  if (missing.length > 0) return `Missing required fields: ${missing.join(', ')}`;
  return null;
}

/**
 * Check resource ownership
 * @returns {{ exists: boolean, owned: boolean, row: object }}
 */
async function checkOwnership(queryFn, table, id, userId, ownerCol = 'user_id') {
  const { rows } = await queryFn(`SELECT ${ownerCol} FROM ${table} WHERE id = $1`, [id]);
  if (rows.length === 0) return { exists: false, owned: false, row: null };
  // Coerce to string: DB returns UUID strings, JWT userId may be a number.
  return { exists: true, owned: String(rows[0][ownerCol]) === String(userId), row: rows[0] };
}

module.exports = { buildWhere, buildUpdate, parsePagination, paginationMeta, validateRequired, checkOwnership };
