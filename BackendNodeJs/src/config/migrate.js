require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');
const logger = require('../utils/logger');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const { rows: executed } = await pool.query('SELECT name FROM _migrations');
  const executedNames = new Set(executed.map(r => r.name));

  let count = 0;
  for (const file of files) {
    if (executedNames.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`✅ Migration: ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`❌ Migration failed: ${file}`, err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  logger.info(count ? `${count} migration(s) applied.` : 'No new migrations.');
  await pool.end();
}

runMigrations();
