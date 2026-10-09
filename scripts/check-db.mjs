#!/usr/bin/env node
/**
 * Quick DB check for the recap feature.
 */

import { readFileSync } from 'node:fs';

// Load .env BEFORE importing db.ts (which reads DATABASE_URL at module scope).
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    process.env[key] = val;
  }
}

const { default: pool } = await import("../src/lib/db.ts");

// Check if monthly_recaps table exists and its structure
const tableExists = await pool.query(
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_recaps') as exists_flag"
);
console.log('monthly_recaps table exists:', tableExists.rows[0]?.exists_flag);

// Check columns
const columns = await pool.query(
  "SELECT column_name, data_type " +
  "FROM information_schema.columns " +
  "WHERE table_name = 'monthly_recaps' " +
  "ORDER BY ordinal_position"
);
console.log('columns:', columns.rows.map(r => `${r.column_name} (${r.data_type})`));

// Check user_xp table
const xpCount = await pool.query('SELECT COUNT(*) FROM user_xp');
console.log('user_xp count:', xpCount.rows[0]);

// Check xp_ledger sources
const sources = await pool.query("SELECT DISTINCT source FROM xp_ledger ORDER BY source");
console.log('xp_ledger sources:', sources.rows.map(r => r.source));

// Check focus_sessions
const focusCount = await pool.query("SELECT COUNT(*) FROM focus_sessions WHERE duration_minutes > 0 AND ended_at is not null");
console.log('completed focus_sessions:', focusCount.rows[0]);

// Check profiles
const profileCount = await pool.query('SELECT COUNT(*) FROM profiles');
console.log('profiles count:', profileCount.rows[0]);

// Check garden_entries
const gardenCount = await pool.query("SELECT COUNT(*) FROM garden_entries");
console.log('garden_entries count:', gardenCount.rows[0]);

// Check xp_ledger total
const xpLedgerCount = await pool.query("SELECT COUNT(*) FROM xp_ledger WHERE source = 'daily_task'");
console.log('xp_ledger daily_task count:', xpLedgerCount.rows[0]);

// Check league_groups
const leagueCount = await pool.query("SELECT COUNT(*) FROM league_groups");
console.log('league_groups count:', leagueCount.rows[0]);

// Check league_group_members
const lgmCount = await pool.query("SELECT COUNT(*) FROM league_group_members");
console.log('league_group_members count:', lgmCount.rows[0]);

// Check weekly_plans
const weeklyPlansCount = await pool.query("SELECT COUNT(*) FROM weekly_plans");
console.log('weekly_plans count:', weeklyPlansCount.rows[0]);

await pool.end();