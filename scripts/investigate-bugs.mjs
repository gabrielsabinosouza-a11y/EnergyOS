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
  console.log('=== ROOT CAUSE INVESTIGATION ===\n');

  // 1. Check XP ledger for weekly_plan source (should fail validation)
  console.log('1. Weekly Plan XP (missing from constraint):');
  const weeklyXp = await pool.query(
    "SELECT source, source_id, xp_amount FROM xp_ledger WHERE source IN ('weekly_plan', 'weekly_plan_occurrence')"
  );
  if (weeklyXp.rows.length === 0) {
    console.log('   No weekly_plan or weekly_plan_occurrence records found');
  } else {
    console.table(weeklyXp.rows);
  }

  // 2. Check the xp_ledger constraint
  console.log('\n2. XP Ledger Constraint Definition:');
  const constraint = await pool.query(`
    SELECT pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'xp_ledger'::regclass
      AND conname = 'xp_ledger_source_check'
  `);
  console.log('   Current constraint:', constraint.rows[0]?.definition || 'NOT FOUND');

  // 3. Check monthly_recaps for the test user
  console.log('\n3. Test user\'s (0e719da0...) monthly recaps:');
  const testRecaps = await pool.query(
    `SELECT id, profile_id, recap_month, total_focus_minutes, longest_streak, generated_at 
     FROM monthly_recaps 
     WHERE profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50' 
     ORDER BY recap_month DESC`
  );
  console.table(testRecaps.rows);

  // 4. Check focus sessions in September 2026 for test user
  console.log('\n4. Test user focus sessions in September 2026:');
  const septFocus = await pool.query(
    `SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes, 
            AVG(duration_minutes) as avg_minutes
     FROM focus_sessions 
     WHERE profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'
       AND started_at >= '2026-09-01'::date 
       AND started_at < '2026-10-01'::date
       AND ended_at is not null
       AND duration_minutes >= 25`
  );
  console.table(septFocus.rows);

  // 5. Check XP ledger for test user in September 2026
  console.log('\n5. Test user XP ledger in September 2026:');
  const septXp = await pool.query(
    `SELECT source, SUM(xp_amount) as xp 
     FROM xp_ledger 
     WHERE profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'
       AND created_at >= '2026-09-01'::date
       AND created_at < '2026-10-01'::date
     GROUP BY source`
  );
  console.table(septXp.rows);

  // 6. Check user_xp for test user
  console.log('\n6. Test user total XP:');
  const userXp = await pool.query(
    `SELECT total_xp, level FROM user_xp 
     WHERE profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'`
  );
  console.table(userXp.rows);

  // 7. Check league history for test user
  console.log('\n7. Test user league history:');
  const leagueHistory = await pool.query(
    `SELECT lg.tier, lg.week_start_date, lg.week_end_date 
     FROM league_group_members lgm
     JOIN league_groups lg ON lgm.league_group_id = lg.id
     WHERE lgm.profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'
     ORDER BY lg.week_start_date DESC`
  );
  console.table(leagueHistory.rows);

  // 8. Check if monthly_recaps had total_xp column
  console.log('\n8. monthly_recaps column check:');
  const hasXpCol = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'monthly_recaps' AND column_name = 'total_xp'
    ) as exists
  `);
  console.log('   Has total_xp column:', hasXpCol.rows[0].exists);

  // 9. Check garden entries for test user in September
  console.log('\n9. Test user garden entries in September 2026:');
  const septGarden = await pool.query(
    `SELECT COUNT(*) as count 
     FROM garden_entries 
     WHERE profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'
       AND DATE_TRUNC('month', planted_at) = '2026-09-01'::date`
  );
  console.table(septGarden.rows);

  await pool.end();
}

main().catch(console.error);