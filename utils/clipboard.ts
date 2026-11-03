/**
 * Copies text to the clipboard. navigator.clipboard is missing or refused in
 * older iOS Safari, in the Facebook / Instagram in-app browsers and on
 * non-https pages; there the hidden-<textarea> + execCommand('copy') method
 * still works. Resolves false only when both fail, so the caller can tell the
 * user instead of failing silently.
 */
export async function copyText(text: string): Promise<boolean> {
  // No async API: copy synchronously, while the click still counts as a user gesture.
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return legacyCopy(text);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off-screen but selectable; 16px stops iOS from zooming on focus.
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  area.setSelectionRange(0, text.length); // iOS ignores select() alone
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  active?.focus?.();
  return ok;
}
