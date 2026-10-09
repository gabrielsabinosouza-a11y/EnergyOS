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

const { default: pool } = await import("../src/lib/db.ts");

async function main() {
  console.log('=== XP Ledger Analysis ===\n');

  // Check xp_ledger by source
  console.log('1. XP Ledger by Source:');
  const bySource = await pool.query(
    "SELECT source, COUNT(*) as count, SUM(xp_amount) as total_xp " +
    "FROM xp_ledger GROUP BY source ORDER BY total_xp DESC"
  );
  console.table(bySource.rows);

  // Check monthly_recaps - compare with user_xp
  console.log('\n2. Monthly Recap Sample:');
  const recaps = await pool.query(
    'SELECT id, profile_id, recap_month, total_focus_minutes, longest_streak, generated_at FROM monthly_recaps ORDER BY recap_month DESC LIMIT 5'
  );
  console.table(recaps.rows);

  // Check user_xp totals
  console.log('\n3. User XP Totals:');
  const userXp = await pool.query(
    'SELECT profile_id, total_xp, level FROM user_xp ORDER BY total_xp DESC'
  );
  console.table(userXp.rows);

  // Check if user_xp matches xp_ledger sum
  console.log('\n4. XP Ledger Total vs User XP:');
  const ledgerTotal = await pool.query(
    "SELECT SUM(xp_amount) as ledger_total FROM xp_ledger"
  );
  console.log('Total XP in ledger:', Number(ledgerTotal.rows[0].ledger_total) || 0);
  console.log('Sum of user_xp.total_xp:', userXp.rows.reduce((sum, r) => sum + Number(r.total_xp), 0));

  // Check league_group_members for current tiers
  console.log('\n5. Current League Tiers (most recent):');
  const currentTiers = await pool.query(`
    WITH latest_week AS (
      SELECT profile_id, tier, week_start_date
      FROM (
        SELECT profile_id, tier, week_start_date,
               ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY week_start_date DESC) as rn
        FROM league_group_members lgm
        JOIN league_groups lg ON lgm.league_group_id = lg.id
      ) t
      WHERE rn = 1
    )
    SELECT tier, COUNT(*) as count FROM latest_week GROUP BY tier
  `);
  console.table(currentTiers.rows);

  // Check focus sessions in a specific month (e.g., September 2026)
  console.log('\n6. Focus Sessions in September 2026:');
  const septFocus = await pool.query(
    "SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes " +
    "FROM focus_sessions " +
    "WHERE started_at >= '2026-09-01'::date AND started_at < '2026-10-01'::date"
  );
  console.table(septFocus.rows);

  // Check profile info
  console.log('\n7. Sample Profiles:');
  const profiles = await pool.query(
    'SELECT id, display_name, created_at FROM profiles ORDER BY created_at LIMIT 5'
  );
  console.table(profiles.rows);

  await pool.end();
}

main().catch(console.error);