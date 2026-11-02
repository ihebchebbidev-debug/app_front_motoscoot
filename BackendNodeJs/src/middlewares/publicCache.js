/**
 * Short public cache for anonymous reads of public content.
 *
 * The public pages (home, /annonces, fiches, articles, guides) call these
 * routes on every visit and none of them sent Cache-Control, so the browser
 * re-downloaded every response on each navigation (SEO audit 2026-11: ~16
 * API calls per homepage, ~0.95 s TTFB on /listings and /tech-specs/popular).
 *
 * Only applied when all of these hold:
 *   - GET or HEAD on one of PUBLIC_PREFIXES
 *   - no Authorization header (logged-in responses can differ per user)
 *   - successful status (< 400), and the route did not set its own header
 * `Vary: Authorization` keeps a logged-in request from reusing an anonymous
 * response the browser cached for the same URL.
 */
const PUBLIC_PREFIXES = [
  '/listings',
  '/tech-specs',
  '/articles',
  '/tips',
  '/garages',
  '/brands',
  '/reference',
  '/faq',
  '/site-reviews',
  '/importers',
];

// Routes under a public prefix that are always per-user.
const PRIVATE_PATHS = /^\/(listings\/(favorites|drafts)|tips\/bookmarks)(\/|$)|\/stats(\/|$)/;

const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

function isCacheable(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (req.headers.authorization) return false;
  const path = req.path || '';
  if (PRIVATE_PATHS.test(path)) return false;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function publicCache(req, res, next) {
  if (!isCacheable(req)) return next();
  const writeHead = res.writeHead;
  res.writeHead = function patchedWriteHead(...args) {
    const status = typeof args[0] === 'number' ? args[0] : res.statusCode;
    if (status < 400 && !res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
      res.setHeader('Vary', [res.getHeader('Vary'), 'Authorization'].filter(Boolean).join(', '));
    }
    return writeHead.apply(this, args);
  };
  next();
}

module.exports = { publicCache, isCacheable, PUBLIC_CACHE_CONTROL };
