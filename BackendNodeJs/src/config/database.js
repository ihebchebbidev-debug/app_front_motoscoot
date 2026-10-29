const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err.message);
});

/**
 * Helper: run a single query
 */
const query = (text, params) => pool.query(text, params);

/**
 * Helper: get a client for transactions
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
