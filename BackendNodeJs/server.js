require('dotenv').config();
// Validate JWT_SECRET at boot — hard-exits in production if missing/insecure.
require('./src/config/jwt');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { pool, query } = require('./src/config/database');
const { initializeSocket } = require('./src/socket');
const logger = require('./src/utils/logger');
const { startBoostExpiryJob } = require('./src/jobs/boostExpiry');
const { startSimilarListingsDigestJob } = require('./src/jobs/similarListingsDigest');

const PORT = process.env.PORT || 4000;

// Process-level safety nets. Without these, a single un-awaited promise
// rejection or stray throw in a setInterval crashes the worker silently
// (Node 15+ default). Log loudly; in PM2 cluster mode the process will be
// restarted automatically. We do NOT exit on unhandledRejection — many
// fire-and-forget paths (email, analytics) can reject and the rest of the
// API should keep serving requests.
process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason && (reason.stack || reason.message || reason));
});
process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException]', err && (err.stack || err.message || err));
  // Give logger a tick to flush, then exit so PM2 restarts us in a clean state.
  setTimeout(() => process.exit(1), 100);
});

// Graceful shutdown: drain HTTP + DB pool on SIGTERM/SIGINT (e.g. Docker stop,
// PM2 reload). Without this, in-flight requests are killed and the DB pool
// leaks connections for ~30s before Postgres reaps them.
let httpServer = null;
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  const done = () => {
    pool.end().catch(() => {}).finally(() => process.exit(0));
  };
  if (httpServer) httpServer.close(done); else done();
  // Hard kill after 10s so we never hang a deploy.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Periodic background tasks owned by this process:
 *  - Boost expiry sweep: handled by `src/jobs/boostExpiry.js` (every 10 min,
 *    plus a one-shot run shortly after boot to clean up anything that expired
 *    while the server was down).
 *  - listing_views GC: drop dedupe rows older than 30 days so the table stays
 *    light.
 *
 * All best-effort: failures are logged, never crash the process.
 */
function startBackgroundJobs() {
  // Boost expiry — extracted into its own module so other code paths
  // (admin trigger, hot reads) can call into the same logic.
  startBoostExpiryJob();
  startSimilarListingsDigestJob();

  // listing_views GC every 10 min, first run 60s after boot.
  const gc = async () => {
    try {
      await query(`DELETE FROM listing_views WHERE created_at < NOW() - INTERVAL '30 days'`);
    } catch (e) {
      logger.warn('listing_views GC failed:', e.message);
    }
  };
  setTimeout(gc, 60_000);
  setInterval(gc, 10 * 60 * 1000);

  // brand_visit_events GC — keep raw events for 7 days; brand_visit_daily is
  // the long-term rollup. Runs hourly, first 90s after boot.
  const brandEventsGc = async () => {
    try {
      await query(`DELETE FROM brand_visit_events WHERE created_at < NOW() - INTERVAL '7 days'`);
    } catch (e) {
      logger.warn('brand_visit_events GC failed:', e.message);
    }
  };
  setTimeout(brandEventsGc, 90_000);
  setInterval(brandEventsGc, 60 * 60 * 1000);
}

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed:', err.message);
    logger.warn('Server starting without database...');
  }

  // Create HTTP server and attach Socket.IO
  const server = http.createServer(app);
  httpServer = server;
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Initialize WebSocket handlers
  initializeSocket(io);

  // Make io accessible in routes (for sending messages via REST + socket)
  app.set('io', io);

  startBackgroundJobs();

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 MotoScoot API running on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔌 WebSocket ready on ws://0.0.0.0:${PORT}`);
  });
}

start();
