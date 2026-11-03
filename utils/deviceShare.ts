/**
 * The device's share sheet (Web Share API), one at a time.
 *
 * The sheet takes a moment to appear (≈0.5 s on Android) and the page gives
 * no feedback meanwhile, so people tap again. That second navigator.share()
 * rejects with InvalidStateError ("an earlier share has not yet completed"),
 * which callers used to read as "no sheet" and answer with their own
 * fallback (share modal, clipboard) on top of the sheet. Taps made while our
 * own share is still opening are now reported as 'busy' and ignored.
 *
 * The guard is time-capped: once the sheet is up it covers the page, so a
 * tap more than SHEET_OPENING_MS later means the sheet is gone even if the
 * browser never settled the promise — that tap gets a real attempt (and the
 * caller's fallback if the browser is stuck).
 */
export type DeviceShareResult =
  | 'shared'      // the user picked a target
  | 'cancelled'   // the user closed the sheet: their choice, no fallback
  | 'busy'        // a sheet from an earlier tap is still opening: ignore
  | 'unavailable' // no Web Share, or this data can't be shared: use a fallback
  | 'failed';     // the browser refused (blocked in-app browser…): use a fallback

export const SHEET_OPENING_MS = 3000;

let pendingSince = 0;

export async function openShareSheet(data: ShareData): Promise<DeviceShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unavailable';
  if (pendingSince && Date.now() - pendingSince < SHEET_OPENING_MS) return 'busy';
  if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) return 'unavailable';
  const startedAt = (pendingSince = Date.now());
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError' ? 'cancelled' : 'failed';
  } finally {
    if (pendingSince === startedAt) pendingSince = 0;
  }
}
