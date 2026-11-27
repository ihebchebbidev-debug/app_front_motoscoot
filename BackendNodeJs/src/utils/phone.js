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

/**
 * Phone at sign-up. A « Particulier » may sign up without one (buyers do not
 * need it; sellers give it with their first ad, which saves it on the
 * account). A « Pro » must give one. A number that is given must be valid.
 * Returns { phone } (formatted, or null) or { error }.
 */
const PRO_PHONE_REQUIRED = 'Le téléphone est requis pour un compte Professionnel.';
function resolveSignupPhone(raw, sellerType) {
  const given = raw != null && String(raw).trim() !== '';
  if (!given) {
    return sellerType === 'Pro' ? { error: PRO_PHONE_REQUIRED } : { phone: null };
  }
  if (!isValidTunisiaPhone(raw)) return { error: TUNISIA_PHONE_ERROR };
  return { phone: formatTunisiaPhone(raw) };
}

module.exports = {
  resolveSignupPhone,
  PRO_PHONE_REQUIRED,
  isValidTunisiaPhone,
  formatTunisiaPhone,
  extractTunisiaLocal,
  TUNISIA_PHONE_ERROR,
};
