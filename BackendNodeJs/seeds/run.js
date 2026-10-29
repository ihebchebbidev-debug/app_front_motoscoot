require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function runSeeds() {
  const seedsDir = __dirname;
  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
    try {
      await pool.query(sql);
      logger.info(`🌱 Seed: ${file}`);
    } catch (err) {
      logger.error(`❌ Seed failed: ${file}`, err.message);
    }
  }

  await pool.end();
  logger.info('Seeding complete.');
}

runSeeds();
