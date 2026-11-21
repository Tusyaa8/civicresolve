/**
 * Database Initialization & Schema Migration
 * Automatically creates and extends tables and indexes on server startup.
 */

const { query } = require('./pool');

const CREATE_TABLES_SQL = `
-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  tracking_id VARCHAR(16) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  language VARCHAR(20) DEFAULT 'en',
  input_category VARCHAR(50),
  ai_category VARCHAR(50),
  priority VARCHAR(20),
  priority_reason TEXT,
  department VARCHAR(50),
  english_summary TEXT,
  citizen_message TEXT,
  status VARCHAR(30) DEFAULT 'Reported',
  needs_review BOOLEAN DEFAULT FALSE,
  location_address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  image_data TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Safe extensions for Stage 3 fields
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS english_title TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS english_description TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS detected_language VARCHAR(50);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS image_matches VARCHAR(20);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS category_mismatch BOOLEAN DEFAULT FALSE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- Complaint status change logs
CREATE TABLE IF NOT EXISTS complaint_logs (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & lookup indexes
CREATE INDEX IF NOT EXISTS idx_complaints_tracking_id ON complaints(tracking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_logs_complaint_id ON complaint_logs(complaint_id);
`;

async function initDb() {
  try {
    await query(CREATE_TABLES_SQL);
    console.log('[Database] Schema checked and migrated successfully.');
  } catch (err) {
    console.error('[Database Init Error]:', err.message);
    throw err;
  }
}

module.exports = {
  initDb
};
