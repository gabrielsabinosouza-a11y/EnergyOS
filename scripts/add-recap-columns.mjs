#!/usr/bin/env node
/**
 * Migration: Add missing columns to monthly_recaps and create history table.
 *
 * RUN THIS BEFORE deploying the new recap feature.
 *
 * Backups: monthly_recaps_backup table already created.
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
  console.log('Starting recap migration...\n');

  // 1. Add total_xp column to monthly_recaps
  console.log('1. Adding total_xp column to monthly_recaps...');
  await pool.query(`
    ALTER TABLE monthly_recaps 
    ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0
  `);
  console.log('   ✓ total_xp column added');

  // 2. Create monthly_recap_history table
  console.log('2. Creating monthly_recap_history table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monthly_recap_history (
      id SERIAL PRIMARY KEY,
      recap_id BIGINT NOT NULL REFERENCES monthly_recaps(id) ON DELETE CASCADE,
      profile_id TEXT NOT NULL,
      recap_month DATE NOT NULL,
      total_focus_minutes INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      streak_start_date DATE,
      streak_end_date DATE,
      streak_is_alive BOOLEAN NOT NULL DEFAULT false,
      league_at_start TEXT,
      league_at_end TEXT NOT NULL,
      league_promoted BOOLEAN NOT NULL DEFAULT false,
      productivity_tag TEXT,
      garden_count INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0,
      xp_sources JSONB,
      generation_number INTEGER NOT NULL DEFAULT 1,
      generation_count INTEGER NOT NULL DEFAULT 1,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(profile_id, recap_month, generation_number)
    )
  `);
  console.log('   ✓ monthly_recap_history table created');

  // 3. Create indexes on monthly_recap_history
  console.log('3. Creating indexes...');
  await pool.query(`
    CREATE INDEX IF NOT EXISTS monthly_recap_history_profile_idx 
    ON monthly_recap_history(profile_id, recap_month DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS monthly_recap_history_month_idx 
    ON monthly_recap_history(recap_month)
  `);
  console.log('   ✓ Indexes created');

  // 4. Migrate existing data to history
  console.log('4. Migrating existing monthly_recaps to history...');
  await pool.query(`
    INSERT INTO monthly_recap_history 
    (recap_id, profile_id, recap_month, total_focus_minutes, longest_streak, 
     league_at_end, league_promoted, productivity_tag, garden_count, total_xp,
     generation_number, generation_count, generated_at)
    SELECT 
      mr.id, mr.profile_id, mr.recap_month, mr.total_focus_minutes, mr.longest_streak,
      mr.league_tier, mr.league_promoted, mr.productivity_tag, 
      COALESCE((SELECT COUNT(*) FROM garden_entries g WHERE g.profile_id = mr.profile_id AND DATE_TRUNC('year', g.planted_at) = DATE_TRUNC('year', mr.recap_month)), 0), 
      COALESCE((SELECT SUM(xp_amount) FROM xp_ledger xp WHERE xp.profile_id = mr.profile_id AND DATE_TRUNC('month', xp.created_at) = mr.recap_month), 0),
      1, 1, mr.generated_at
    FROM monthly_recaps mr
    WHERE NOT EXISTS (
      SELECT 1 FROM monthly_recap_history h WHERE h.recap_id = mr.id
    )
  `);
  console.log('   ✓ Existing data migrated to history');

  console.log('\nMigration completed successfully!');
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
}).finally(() => pool.end());