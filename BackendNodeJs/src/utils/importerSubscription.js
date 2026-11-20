/**
 * Importer subscription (« abonnement ») — owner, 2026-11-19: the Appel,
 * WhatsApp and Devis buttons of a fiche technique show only while its
 * importer is subscribed, i.e. importers.subscription_until >= today.
 *
 * Same safety as techSpecDrafts.js: reads go through to_jsonb(), so a
 * server where the column does not exist yet reads « not subscribed »
 * instead of failing the whole fiche; admin writes add the column first
 * (idempotent ALTER … IF NOT EXISTS).
 */
const { query } = require('../config/database');

/** SQL boolean: the importer row `alias` has a subscription running today. */
function subscribedSql(alias = 'i') {
  return `COALESCE((to_jsonb(${alias})->>'subscription_until')::date >= CURRENT_DATE, FALSE)`;
}

/** SQL text: the end date (YYYY-MM-DD) or NULL. */
function subscriptionUntilSql(alias = 'i') {
  return `(to_jsonb(${alias})->>'subscription_until')`;
}

/** Shown in the admin when the column is missing and cannot be added. */
const MISSING_COLUMN_MESSAGE =
  "La date d'abonnement ne peut pas être enregistrée : la colonne importers.subscription_until manque. "
  + 'Lancez migrations/041_importers_subscription.sql avec le compte propriétaire de la base.';

let ensured = false;
/**
 * Makes sure importers.subscription_until exists. Looks first: PostgreSQL
 * asks for table ownership on every ALTER TABLE, even « ADD COLUMN IF NOT
 * EXISTS » on a column already there, and the site's database account is
 * not the owner of importers in production — every importer save answered
 * 500 (2026-11-20). The ALTER now runs only when the column is missing;
 * if that fails too, the error carries a message the admin can act on.
 */
async function ensureSubscriptionColumn() {
  if (ensured) return;
  const { rows } = await query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'importers' AND column_name = 'subscription_until' LIMIT 1`,
  );
  if (!rows.length) {
    try {
      await query('ALTER TABLE importers ADD COLUMN IF NOT EXISTS subscription_until DATE');
    } catch (e) {
      const err = new Error(MISSING_COLUMN_MESSAGE);
      err.status = 503;
      err.publicMessage = MISSING_COLUMN_MESSAGE;
      err.cause = e;
      throw err;
    }
  }
  ensured = true;
}

/** '' / null → null (no subscription); 'YYYY-MM-DD' kept; anything else → undefined (invalid). */
function parseSubscriptionUntil(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined;
}

module.exports = { subscribedSql, subscriptionUntilSql, ensureSubscriptionColumn, parseSubscriptionUntil };
