const logger = require('../utils/logger');

function notFound(req, res, _next) {
  res.status(404).json({
    error: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.id || undefined,
  });
}

function errorHandler(err, req, res, _next) {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.', requestId: req.id });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Too many files or unexpected field name.', requestId: req.id });
  }
  // Multer custom filter error
  if (err.message && err.message.includes('Only JPEG')) {
    return res.status(400).json({ error: err.message, requestId: req.id });
  }

  // Postgres unique constraint
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry. This record already exists.', requestId: req.id });
  }
  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.', requestId: req.id });
  }

  // Use the per-request logger when available so the id, method, url are included.
  const log = (req && req.log) || logger;

  const status = err.status || err.statusCode || 500;

  // Structured warn-level entry for auth failures so brute-force / abuse is
  // greppable in the access log without inflating it for every 5xx.
  if (status === 401 || status === 403) {
    log.warn(`AUTH_DENIED status=${status} ip=${req.ip || '-'} path=${req.method} ${req.originalUrl} reason=${err.message || 'unknown'}`);
  } else {
    log.error(err.stack || err.message);
  }

  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    requestId: req && req.id ? req.id : undefined,
  });
}

module.exports = { notFound, errorHandler };
