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

let ensured = false;
async function ensureSubscriptionColumn() {
  if (ensured) return;
  await query('ALTER TABLE importers ADD COLUMN IF NOT EXISTS subscription_until DATE');
  ensured = true;
}

/** '' / null → null (no subscription); 'YYYY-MM-DD' kept; anything else → undefined (invalid). */
function parseSubscriptionUntil(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined;
}

module.exports = { subscribedSql, subscriptionUntilSql, ensureSubscriptionColumn, parseSubscriptionUntil };
