/** Accept raw API numbers and already-formatted marketplace prices. */
export function formatListingPrice(value: unknown): string {
  if (value == null) return '—';
  const text = String(value).trim();
  if (!text) return '—';
  const normalized = text.replace(/[\s\u00a0\u202f]/g, '').replace(/(?:DT|TND)$/i, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return text;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(number)} DT`;
}