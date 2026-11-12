/**
 * /assets/* is served "immutable" for a year (vercel.json), and browsers keep
 * a 404 under that rule too: a stylesheet or entry script requested in the
 * instant a deploy switches over can stay "missing" for that browser, which
 * then shows the page unstyled or blank on every visit. On a load error,
 * fetch(…, { cache: 'reload' }) gets the file from the network and replaces
 * the cached 404, so later visits are clean. Then:
 *  - stylesheet: applied right away from a fresh URL (?retry=…; the static
 *    file ignores the query);
 *  - entry script: one page reload. A fresh URL is not enough there: the
 *    other chunks import the entry by its plain URL, which must be repaired.
 *    At most one reload every 5 minutes: a cached 404 that Safari keeps
 *    despite the repair fetch must not reload the page forever (2026-11-12).
 * Applied to the built index.html (vite.config.ts); the SEO snapshots and
 * spa.html are copies of it, so they get it too.
 */
const ON_CSS_ERROR =
  `this.onerror=null;fetch(this.href,{cache:'reload'}).catch(function(){});` +
  `this.href=this.href.split('?')[0]+'?retry='+Date.now()`;

const ON_SCRIPT_ERROR =
  `this.onerror=null;fetch(this.src,{cache:'reload'}).then(function(r){if(!r.ok)return;` +
  `try{var k='asset-retry-reload',t=+sessionStorage.getItem(k)||0;if(Date.now()-t<3e5)return;` +
  `sessionStorage.setItem(k,String(Date.now()))}catch(e){return}location.reload()}).catch(function(){})`;

export function addAssetRetry(html: string): string {
  return html
    .replace(/<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="\/assets\/[^"]+\.css")(?![^>]*\bonerror=)([^>]*)>/g,
      `<link$1 onerror="${ON_CSS_ERROR}">`)
    .replace(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="\/assets\/[^"]+\.js")(?![^>]*\bonerror=)([^>]*)>/g,
      `<script$1 onerror="${ON_SCRIPT_ERROR}">`);
}
