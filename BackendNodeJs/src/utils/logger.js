/**
 * Lightweight structured-ish logger.
 *
 * Each entry is prefixed with an ISO timestamp and a level. The `requestId`
 * middleware (see middlewares/requestId.js) wraps this with a per-request
 * `req.log` that also injects the request id, HTTP method, and URL — prefer
 * that wrapper inside controllers so every line is correlated.
 *
 * Use the bare `logger` here only for boot, background workers, and code
 * paths that genuinely don't have a `req` object.
 */
const ts = () => new Date().toISOString();

const logger = {
  info: (...args) => console.log(`[${ts()}] INFO :`, ...args),
  warn: (...args) => console.warn(`[${ts()}] WARN :`, ...args),
  error: (...args) => console.error(`[${ts()}] ERROR:`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${ts()}] DEBUG:`, ...args);
    }
  },
};

module.exports = logger;
