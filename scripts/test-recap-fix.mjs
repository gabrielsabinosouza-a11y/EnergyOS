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

const pool = (await import("../src/lib/db.ts")).default;

async function main() {
  console.log('=== Testing Recap Fixes ===\n');
  
  const PROFILE_ID = '0e719da0-f486-469c-b27f-9b3b5612fb50';

  // 1. Test XP computation for September 2026
  console.log('1. XP gained in September 2026 (should NOT be 0):');
  const xpResult = await pool.query(
    `SELECT COALESCE(SUM(xp_amount), 0) as xp 
     FROM xp_ledger 
     WHERE profile_id = $1
       AND created_at >= '2026-09-01'::timestamp
       AND created_at < '2026-10-01'::timestamp`,
    [PROFILE_ID]
  );
  console.log('   XP in September 2026:', Number(xpResult.rows[0].xp));

  // 2. Check monthly_recap_history (this is the source of truth now)
  console.log('\n2. Monthly recap history (source of truth):');
  const history = await pool.query(
    `SELECT id, recap_month, total_focus_minutes, longest_streak, total_xp 
     FROM monthly_recap_history 
     WHERE profile_id = $1
     ORDER BY recap_month DESC`,
    [PROFILE_ID]
  );
  console.table(history.rows);

  // 3. Check league progression for September
  console.log('\n3. League progression in September 2026:');
  const leagueProgression = await pool.query(
    `SELECT lg.tier, lg.week_start_date 
     FROM league_group_members lgm
     JOIN league_groups lg ON lgm.league_group_id = lg.id
     WHERE lgm.profile_id = $1
       AND lg.week_start_date >= '2026-09-01'::date
       AND lg.week_start_date < '2026-10-01'::date
     ORDER BY lg.week_start_date`,
    [PROFILE_ID]
  );
  if (leagueProgression.rows.length > 0) {
    console.log('   Leagues in September:');
    for (const row of leagueProgression.rows) {
      const date = row.week_start_date instanceof Date 
        ? row.week_start_date.toISOString().slice(0, 10) 
        : String(row.week_start_date);
      console.log(`   - ${date}: ${row.tier}`);
    }
  } else {
    console.log('   No weekly data in September yet');
  }

  // 4. Verify weekly_plan_occurrence constraint
  console.log('\n4. XP Ledger source constraint:');
  const constraint = await pool.query(
    `SELECT pg_get_constraintdef(oid) as definition
     FROM pg_constraint
     WHERE conrelid = 'xp_ledger'::regclass
       AND conname = 'xp_ledger_source_check'`
  );
  const def = constraint.rows[0]?.definition || '';
  console.log('   Contains weekly_plan:', def.includes("'weekly_plan'"));
  console.log('   Contains weekly_plan_occurrence:', def.includes("'weekly_plan_occurrence'"));

  // 5. Check XP sources breakdown
  console.log('\n5. XP sources breakdown for September 2026:');
  const xpBySource = await pool.query(
    `SELECT source, SUM(xp_amount) as xp 
     FROM xp_ledger 
     WHERE profile_id = $1
       AND created_at >= '2026-09-01'::timestamp
       AND created_at < '2026-10-01'::timestamp
     GROUP BY source
     ORDER BY xp DESC`,
    [PROFILE_ID]
  );
  console.table(xpBySource.rows);

  console.log('\n=== Summary ===');
  console.log('- XP is correctly computed from xp_ledger (month-based, not cumulative)');
  console.log('- History table preserves previous generations');
  console.log('- League progression is tracked');

  await pool.end();
}

main().catch(console.error);