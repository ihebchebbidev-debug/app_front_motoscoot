/**
 * Tunisia mobile / landline phone helpers.
 *
 * Local format: 8 digits, must start with one of 2, 3, 4, 5, 7, 9.
 *   - 2x: Tunisie Telecom mobile (rare, also some short codes)
 *   - 3x: landline / Topnet
 *   - 4x: Ooredoo / Orange (newer ranges)
 *   - 5x: Ooredoo mobile
 *   - 7x: landline (regional)
 *   - 9x: Tunisie Telecom mobile
 *
 * International format: optional `+216` or `216` country prefix, then 8 digits
 * with the same prefix rule.
 *
 * We accept users entering spaces, dashes, dots and parentheses, and we
 * normalize to the canonical `+216 XX XXX XXX` shape for storage / display.
 */

export const TUNISIA_PHONE_PREFIXES = ['2', '3', '4', '5', '7', '9'] as const;

/** Strip everything except digits and a leading `+`. */
export function cleanPhoneInput(raw: string): string {
  if (!raw) return '';
  // Keep a leading + if present, drop all non-digits elsewhere.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return (hasPlus ? '+' : '') + digits;
}

/**
 * Returns the 8-digit local part if the input is a valid Tunisia number,
 * otherwise null. Accepts: `12345678`, `+21612345678`, `21612345678`,
 * `00 216 12 345 678`, `+216-12-345-678`, etc.
 */
export function extractTunisiaLocal(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  // Strip "00216" international prefix
  if (digits.startsWith('00216')) digits = digits.slice(5);
  // Strip "216" country code (with or without leading +, both end up here)
  if (digits.length === 11 && digits.startsWith('216')) digits = digits.slice(3);
  if (digits.length !== 8) return null;
  if (!TUNISIA_PHONE_PREFIXES.includes(digits[0] as any)) return null;
  return digits;
}

export function isValidTunisiaPhone(raw: string): boolean {
  return extractTunisiaLocal(raw) !== null;
}

/**
 * Format to the canonical display form: `+216 XX XXX XXX`. Returns the input
 * unchanged if it can't be parsed (so we never silently mangle text we don't
 * understand).
 */
export function formatTunisiaPhone(raw: string): string {
  const local = extractTunisiaLocal(raw);
  if (!local) return raw;
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

/** Form-friendly error message used by both zod and inline validators. */
export const TUNISIA_PHONE_ERROR =
  'Numéro de téléphone tunisien invalide (ex: 22 123 456 ou +216 22 123 456).';

/**
 * Visible phone format (customer request): local Tunisian numbers are shown
 * without the country code, e.g. `29 249 512`. Links (tel:, wa.me) must keep
 * the international number. Non-Tunisian input is returned unchanged.
 */
export function displayPhone(raw?: string | null): string {
  if (!raw) return '';
  const local = extractTunisiaLocal(raw);
  if (!local) return raw;
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
