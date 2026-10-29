const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { requestId } = require('./middlewares/requestId');

const app = express();

// Trust the first proxy (Render/Heroku/NGINX) so req.ip is meaningful in logs.
app.set('trust proxy', 1);

// --- Request correlation (must be FIRST so all subsequent middleware can use req.id / req.log) ---
app.use(requestId);

// --- Security (Helmet) ---
// IMPORTANT: every Cross-Origin-* policy is loosened so the API and the
// /uploads static assets can be embedded / fetched from ANY frontend origin
// (Lovable preview, prod domain, custom domains, mobile webviews, etc.)
// without the browser blocking them. We keep the rest of Helmet's hardening
// (X-Frame-Options, HSTS, noSniff, referrer, etc.) intact.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // <img>, <script>, fetch from any origin
  crossOriginEmbedderPolicy: false,                       // don't require COEP on consumers
  crossOriginOpenerPolicy:   false,                       // don't isolate browsing context
  contentSecurityPolicy:     false,                       // CSP would otherwise block third-party embeds
}));

// --- CORS: echo the request Origin so credentialed requests (cookies / auth
// headers in `credentials: 'include'` mode) are accepted by the browser.
// The CORS spec forbids `Access-Control-Allow-Origin: *` together with
// `Access-Control-Allow-Credentials: true`, so we reflect the Origin header
// instead. This still allows ANY origin in practice (we don't filter), but
// stays spec-compliant for credentialed fetches from the frontend.
const corsOptions = {
  origin: (origin, cb) => cb(null, origin || true),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  exposedHeaders: ['X-Request-Id', 'Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
// Explicitly handle preflight on every route so OPTIONS never falls through
// to a 404 (which some CDNs/proxies then cache).
app.options('*', cors(corsOptions));

// --- Rate limiting ---
// Disabled per user request. All limiters removed.

// --- Parsing ---
// Hardcoded 25MB body limit for uploads (do not lower).
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// --- Logging ---
if (process.env.NODE_ENV !== 'test') {
  // Inject request id into morgan tokens so the access log lines up with our
  // app-level lines (req.log).
  morgan.token('id', (req) => req.id || '-');
  app.use(morgan(':id :remote-addr :method :url :status :res[content-length] - :response-time ms'));
}

// --- Static uploads (main + thumbnails) ---
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, _path, stat) => {
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    // Belt-and-braces cross-origin headers so <img>/fetch from any frontend
    // origin works. Note: we do NOT set Access-Control-Allow-Origin here
    // because the cors() middleware already reflects the request Origin
    // (required when credentials mode is enabled). Setting `*` here would
    // override cors() and break credentialed requests.
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Timing-Allow-Origin', '*');
  }
}));

// --- Routes ---
app.use('/api', routes);

// --- Error handling ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
