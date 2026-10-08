/** Read-only diagnostic report of suspicious focus sessions and garden data issues.
 *
 * Checks for:
 * - Duplicate focus sessions (same profile + started_at + duration + room)
 * - Invalid sessions (missing timestamps, duration > 120 min, negative values)
 * - Days with > 24h of focus (impossible)
 * - Duplicate garden entries per session (the main cause of inflated garden counts)
 * - Garden entries with no matching session (orphaned)
 * - Totals before/after deduplication
 *
 * Run: npx tsx scripts/diagnose-focus-data.ts [profile-id]
 * Omitting profile-id scans all profiles. This script NEVER writes to the database.
 */
import pool from "../src/lib/db";

async function main() {
  const profileId = process.argv[2] ?? null;
  const params = profileId ? [profileId] : [];
  const whereProfile = profileId ? "and fs.profile_id = $1" : "";
  const whereGardenProfile = profileId ? "and ge.profile_id = $1" : "";

  const [
    duplicates,
    invalid,
    days,
    gardenInflation,
    duplicateGardenEntries,
    orphanedGardenEntries,
    totals,
    dedupedTotals,
    gardenTotals,
  ] = await Promise.all([
    // Duplicate focus sessions (same profile + started_at + duration + room)
    pool.query(
      `select profile_id, started_at, duration_minutes, room_id, count(*)::int as copies,
              array_agg(id order by id) as session_ids
         from focus_sessions
        where ended_at is not null ${whereProfile}
        group by profile_id, started_at, duration_minutes, room_id
       having count(*) > 1 order by copies desc, profile_id`, params),
    // Invalid sessions (missing timestamps, impossible durations)
    pool.query(
      `select profile_id, id, started_at, ended_at, duration_minutes, target_duration_minutes
         from focus_sessions fs
        where (started_at is null or (ended_at is not null and ended_at < started_at)
               or duration_minutes < 0 or duration_minutes > 120
               or target_duration_minutes < 1 or target_duration_minutes > 120)
          ${whereProfile} order by profile_id, id`, params),
    // Days with > 24h of focus (impossible)
    pool.query(
      `select profile_id, (started_at at time zone 'America/Sao_Paulo')::date as local_day,
              sum(duration_minutes)::numeric as minutes, count(*)::int as sessions
         from focus_sessions fs
        where ended_at is not null ${whereProfile}
        group by profile_id, local_day having sum(duration_minutes) > 1440
        order by minutes desc`, params),
    // Sessions with multiple garden entry rows (each row stores full duration, inflating totals)
    pool.query(
      `select fs.profile_id, fs.id as session_id, fs.started_at, fs.duration_minutes,
              count(ge.id)::int as energy_rows,
              (count(ge.id) * fs.duration_minutes)::numeric as old_row_sum_minutes
         from focus_sessions fs join garden_entries ge on ge.session_id = fs.id and ge.profile_id = fs.profile_id
        where fs.ended_at is not null ${whereProfile}
        group by fs.profile_id, fs.id, fs.started_at, fs.duration_minutes
       having count(ge.id) > 1
        order by old_row_sum_minutes desc`, params),
    // Duplicate garden entries: sessions with more garden rows than the expected reward count
    pool.query(
      `select ge.profile_id, ge.session_id, count(*)::int as garden_rows,
              fs.duration_minutes,
              case when fs.duration_minutes >= 90 then 4
                   when fs.duration_minutes >= 60 then 2
                   else 1 end as expected_rows,
              count(*) - case when fs.duration_minutes >= 90 then 4
                              when fs.duration_minutes >= 60 then 2
                              else 1 end as excess_rows
         from garden_entries ge
         join focus_sessions fs on fs.id = ge.session_id and fs.profile_id = ge.profile_id
        where 1=1 ${whereGardenProfile}
        group by ge.profile_id, ge.session_id, fs.duration_minutes
       having count(*) > case when fs.duration_minutes >= 90 then 4
                              when fs.duration_minutes >= 60 then 2
                              else 1 end
        order by excess_rows desc`, profileId ? [profileId] : []),
    // Orphaned garden entries (no matching focus session)
    pool.query(
      `select ge.profile_id, ge.id, ge.session_id, ge.energy_type, ge.duration_minutes,
              ge.planted_at, ge.status, ge.growth_stage
         from garden_entries ge
        left join focus_sessions fs on fs.id = ge.session_id and fs.profile_id = ge.profile_id
        where fs.id is null and ge.session_id is not null
          ${whereGardenProfile}
        order by ge.profile_id, ge.planted_at desc limit 100`, profileId ? [profileId] : []),
    // Total sessions and minutes per profile
    pool.query(
      `select profile_id, count(*)::int as sessions, coalesce(sum(duration_minutes),0)::numeric as minutes
         from focus_sessions fs where ended_at is not null ${whereProfile}
        group by profile_id order by profile_id`, params),
    // Totals after exact deduplication (keep only first session per duplicate group)
    pool.query(
      `with ranked as (
         select profile_id, duration_minutes,
                row_number() over (partition by profile_id, started_at, duration_minutes, room_id order by id) as duplicate_number
           from focus_sessions fs where ended_at is not null ${whereProfile}
       )
       select profile_id, count(*)::int as sessions, coalesce(sum(duration_minutes),0)::numeric as minutes
         from ranked where duplicate_number = 1 group by profile_id order by profile_id`, params),
    // Garden entry counts per profile (total rows vs expected)
    pool.query(
      `select ge.profile_id,
              count(*)::int as total_garden_rows,
              count(distinct ge.session_id)::int as distinct_sessions,
              coalesce(sum(ge.duration_minutes), 0)::numeric as raw_duration_sum
         from garden_entries ge
        where 1=1 ${whereGardenProfile}
        group by ge.profile_id order by ge.profile_id`, profileId ? [profileId] : []),
  ]);

  const report = {
    profileId: profileId ?? "all",
    summary: {
      totalSessions: totals.rows,
      totalsAfterDedup: dedupedTotals.rows,
      gardenStats: gardenTotals.rows,
    },
    issues: {
      duplicateSessions: {
        count: duplicates.rows.length,
        details: duplicates.rows,
      },
      invalidSessions: {
        count: invalid.rows.length,
        details: invalid.rows,
      },
      daysOver24Hours: {
        count: days.rows.length,
        details: days.rows,
      },
      sessionsWithMultipleGardenRows: {
        count: gardenInflation.rows.length,
        details: gardenInflation.rows,
      },
      duplicateGardenEntries: {
        count: duplicateGardenEntries.rows.length,
        details: duplicateGardenEntries.rows,
      },
      orphanedGardenEntries: {
        count: orphanedGardenEntries.rows.length,
        details: orphanedGardenEntries.rows,
      },
    },
  };

  console.log(JSON.stringify(report, null, 2));

  // Print a human-readable summary
  console.log("\n=== DIAGNOSTIC SUMMARY ===");
  console.log(`Profile: ${report.profileId}`);
  console.log(`Total completed sessions: ${totals.rows.reduce((s, r) => s + Number(r.sessions), 0)}`);
  console.log(`Total minutes (raw): ${totals.rows.reduce((s, r) => s + Number(r.minutes), 0)}`);
  console.log(`Total minutes (deduped): ${dedupedTotals.rows.reduce((s, r) => s + Number(r.minutes), 0)}`);
  console.log(`\nIssues found:`);
  console.log(`  Duplicate sessions: ${duplicates.rows.length}`);
  console.log(`  Invalid sessions: ${invalid.rows.length}`);
  console.log(`  Days over 24h: ${days.rows.length}`);
  console.log(`  Sessions with multiple garden rows: ${gardenInflation.rows.length}`);
  console.log(`  Duplicate garden entries (excess): ${duplicateGardenEntries.rows.length}`);
  console.log(`  Orphaned garden entries: ${orphanedGardenEntries.rows.length}`);
  if (duplicates.rows.length === 0 && invalid.rows.length === 0 && days.rows.length === 0
      && gardenInflation.rows.length === 0 && duplicateGardenEntries.rows.length === 0
      && orphanedGardenEntries.rows.length === 0) {
    console.log("\n✓ No issues found. Data looks clean.");
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
