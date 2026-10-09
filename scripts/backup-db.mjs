#!/usr/bin/env node
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
  console.log('Creating backup of monthly_recaps...');
  await pool.query('CREATE TABLE IF NOT EXISTS monthly_recaps_backup AS SELECT * FROM monthly_recaps');
  console.log('Backup created at monthly_recaps_backup table');

  // Show current data
  const recaps = await pool.query('SELECT id, profile_id, recap_month, total_focus_minutes, longest_streak, generated_at FROM monthly_recaps ORDER BY recap_month DESC');
  console.log('Current monthly_recaps rows:', recaps.rows.length);
  console.table(recaps.rows);

  await pool.end();
}

main().catch(console.error);