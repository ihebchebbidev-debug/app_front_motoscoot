/**
 * Tunisia phone helpers (server-side mirror of utils/phoneUtils.ts).
 *
 * Local format: 8 digits starting with 2/3/4/5/7/9.
 * International: optional +216 / 216 / 00216 prefix.
 */

const PREFIXES = new Set(['2', '3', '4', '5', '7', '9']);

function extractTunisiaLocal(raw) {
  if (!raw && raw !== 0) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00216')) digits = digits.slice(5);
  if (digits.length === 11 && digits.startsWith('216')) digits = digits.slice(3);
  if (digits.length !== 8) return null;
  if (!PREFIXES.has(digits[0])) return null;
  return digits;
}

function isValidTunisiaPhone(raw) {
  return extractTunisiaLocal(raw) !== null;
}

function formatTunisiaPhone(raw) {
  const local = extractTunisiaLocal(raw);
  if (!local) return raw;
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

const TUNISIA_PHONE_ERROR =
  'Numéro de téléphone tunisien invalide (ex: 22 123 456 ou +216 22 123 456).';

module.exports = {
  isValidTunisiaPhone,
  formatTunisiaPhone,
  extractTunisiaLocal,
  TUNISIA_PHONE_ERROR,
};
