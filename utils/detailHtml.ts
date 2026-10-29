/** Shared, browser-safe HTML helpers for the existing hosting entry points. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function mergeDetailShell(shell: string, detail: string): string {
  const head = detail.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '';
  const body = detail.match(/<body>([\s\S]*?)<\/body>/i)?.[1] || '';
  return shell
    .replace(/\sdata-pre-hydrate/g, '')
    .replace(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+(?:name="(?:description|robots|twitter:[^"]+)"|property="(?:og:[^"]+|product:[^"]+)")[^>]*>/gi, '')
    .replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>/gi, '')
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
    .replace('</head>', `${head}</head>`)
    .replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root"><div data-seo-fallback>${body}</div></div>`);
}

export async function renderWithApp(req: any, detail: string): Promise<string> {
  if (typeof req.appShell === 'string') return mergeDetailShell(req.appShell, detail);
  const response = await fetch('https://www.moto-scoot.tn/spa.html', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('App shell unavailable');
  const shell = await response.text();
  if (!shell.includes('id="root"')) throw new Error('Invalid app shell');
  return mergeDetailShell(shell, detail);
}

export function detailIdentifier(kind: string, tail: string): string {
  const pattern = kind === 'fiche-technique'
    ? /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    : /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;
  const clean = tail.replace(/\/$/, '');
  return clean.match(pattern)?.[1] || clean;
}