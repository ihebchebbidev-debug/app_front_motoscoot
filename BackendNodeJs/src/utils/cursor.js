/**
 * Cursor pagination helpers.
 *
 * Cursors are opaque strings to clients. Internally they are URL-safe base64
 * of a JSON object holding the values needed to seek the next page in a
 * deterministic ORDER BY tuple. Always include the primary key as the final
 * tiebreaker so cursors are unique even when leading sort keys collide.
 */

function encodeCursor(payload) {
  if (payload === null || payload === undefined) return null;
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Read pagination params for a cursor-paginated endpoint.
 * Hard-caps `limit` to keep payloads sane.
 */
function parseCursorParams(query, defaultLimit = 20, maxLimit = 50) {
  const raw = parseInt(query.limit, 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(raw) ? raw : defaultLimit));
  return { limit, cursor: decodeCursor(query.cursor) };
}

module.exports = { encodeCursor, decodeCursor, parseCursorParams };
