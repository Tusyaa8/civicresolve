/**
 * PostgreSQL Database Connection Pool
 * Configured with SSL for Render Postgres.
 * Zero-secret logging policy enforced.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  // Log message only, never connection strings or credentials
  console.error('[Database Pool Error]:', err.message);
});

/**
 * Execute parameterized query safely
 * @param {string} text - SQL query with $1, $2 parameter placeholders
 * @param {Array} params - Query arguments
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      // Log execution timing only without params/secrets
      // console.log(`[Query executed in ${duration}ms]`);
    }
    return res;
  } catch (err) {
    console.error('[Query Error]:', err.message);
    throw err;
  }
}

/**
 * Obtain a dedicated client for transactions
 */
async function getClient() {
  return await pool.connect();
}

module.exports = {
  pool,
  query,
  getClient
};
