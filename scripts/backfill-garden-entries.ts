/**
 * Backfill garden entries that are stuck as "growing".
 *
 * A garden entry is only truly growing while its focus session is running.
 * Historical rows (old sessions planted before finalization existed, plus
 * legacy localStorage imports) were never reconciled, so they render as
 * eternal seedlings instead of their final ("Completo") illustration.
 *
 * This heals the whole database so every user's garden matches the finalize
 * rule used at session end: completed session → alive; abandoned → withered.
 *
 * Run with: npx tsx scripts/backfill-garden-entries.ts
 */

import pool from "../src/lib/db";

async function backfill() {
  console.log("Starting garden entries backfill...");

  // Non-room sessions that already ended: resolve status/stage from the
  // authoritative session record (mirrors finalizeGardenEntries).
  const sessions = await pool.query(
    `update garden_entries ge
     set status = case
           when fs.duration_minutes >= fs.target_duration_minutes then 'alive'
           else 'withered'
         end,
         growth_stage = case
           when fs.duration_minutes >= 60 then 'mature'
           when fs.duration_minutes >= 30 then 'young'
           else 'sprout'
         end,
         duration_minutes = fs.duration_minutes
     from focus_sessions fs
     where ge.session_id = fs.id
       and ge.status = 'growing'
       and fs.ended_at is not null`,
  );
  console.log(`✓ Reconciled ${sessions.rowCount ?? 0} session-linked entries`);

  // Legacy imports (session_id null + legacy_key set) are always completed.
  const legacy = await pool.query(
    `update garden_entries
     set status = 'alive',
         growth_stage = case
           when duration_minutes >= 60 then 'mature'
           when duration_minutes >= 30 then 'young'
           else 'sprout'
         end
     where status = 'growing'
       and session_id is null
       and legacy_key is not null`,
  );
  console.log(`✓ Marked ${legacy.rowCount ?? 0} legacy entries as alive`);

  const remaining = await pool.query(
    `select count(*)::int as n from garden_entries where status = 'growing'`,
  );
  console.log(
    `Remaining "growing" entries (active sessions / pending room sessions): ${remaining.rows[0].n}`,
  );

  const byStatus = await pool.query(
    `select status, count(*)::int as n from garden_entries group by status order by status`,
  );
  for (const row of byStatus.rows) console.log(`  ${row.status}: ${row.n}`);

  console.log("Backfill completed successfully!");
}

backfill()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });