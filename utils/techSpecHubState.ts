import { BRAND_VIEWS, ALL_IMPORTERS, type BrandView } from './brandListView';

/**
 * What the visitor set on the brand list (/fiches-techniques): sort,
 * importer, « Disponibles en Tunisie » and search. Same rule as a brand's
 * page (utils/techSpecPageState.ts): kept for this tab only (sessionStorage)
 * and given back only on the browser's Back button. Opening a brand and
 * coming back used to clear every choice. A new visit from a link starts
 * fresh. Nothing goes in the address: the page keeps one URL for Google.
 */
export interface HubState { view: BrandView; importer: string; inTunisia: boolean; q: string }

export const defaultHubState = (inTunisia = false): HubState => ({ view: 'default', importer: ALL_IMPORTERS, inTunisia, q: '' });

const KEY = 'ms_fiches_marques';
const VIEWS = new Set<string>(['default', ...BRAND_VIEWS.map((v) => v.value)]);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null);

/** A saved value, checked field by field (anything odd falls back to the default). */
export function parseHubState(raw: string | null): HubState | null {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const d = defaultHubState();
  return {
    view: typeof o.view === 'string' && VIEWS.has(o.view) ? (o.view as BrandView) : d.view,
    importer: str(o.importer, 80) || d.importer,
    inTunisia: typeof o.inTunisia === 'boolean' ? o.inTunisia : d.inTunisia,
    q: str(o.q, 120) ?? d.q,
  };
}

export function readHubState(): HubState | null {
  try { return parseHubState(sessionStorage.getItem(KEY)); } catch { return null; }
}

export function saveHubState(state: HubState): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: nothing kept */ }
}
