#!/usr/bin/env node
/**
 * Migration 2: Add remaining columns to monthly_recaps and daily_task_log
 */

import { readFileSync } from 'node:fs';

// Load .env
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    process.env[key] = val;
  }
}

const { Pool } = await import('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Adding recap-related columns...\n');

  // Add columns to monthly_recaps
  const columns = [
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS league_at_start TEXT',
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS generation_number INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS xp_sources JSONB',
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS streak_start_date DATE',
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS streak_end_date DATE',
    'ALTER TABLE monthly_recaps ADD COLUMN IF NOT EXISTS streak_is_alive BOOLEAN NOT NULL DEFAULT false',
  ];

  for (const col of columns) {
    console.log('  ', col);
    await pool.query(col);
  }

  // Add columns to monthly_recap_history if needed
  console.log('\nEnsuring monthly_recap_history has all columns...');
  const historyColumns = [
    'ALTER TABLE monthly_recap_history ADD COLUMN IF NOT EXISTS streak_start_date DATE',
    'ALTER TABLE monthly_recap_history ADD COLUMN IF NOT EXISTS streak_end_date DATE',
    'ALTER TABLE monthly_recap_history ADD COLUMN IF NOT EXISTS streak_is_alive BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE monthly_recap_history ADD COLUMN IF NOT EXISTS xp_sources JSONB',
  ];

  for (const col of historyColumns) {
    console.log('  ', col);
    await pool.query(col);
  }

  console.log('\nAll columns added successfully!');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
});