/** Read-only report of suspicious focus sessions and garden inflation candidates.
 * Run: npx tsx scripts/diagnose-focus-data.ts [profile-id]
 * Omitting profile-id scans all profiles. This script never writes to the database.
 */
import pool from "../src/lib/db";

async function main() {
  const profileId = process.argv[2] ?? null;
  const params = profileId ? [profileId] : [];
  const whereProfile = profileId ? "and fs.profile_id = $1" : "";

  const [duplicates, invalid, days, gardenInflation, totals, dedupedTotals] = await Promise.all([
    pool.query(
      `select profile_id, started_at, duration_minutes, room_id, count(*)::int as copies,
              array_agg(id order by id) as session_ids
         from focus_sessions
        where ended_at is not null ${whereProfile}
        group by profile_id, started_at, duration_minutes, room_id
       having count(*) > 1 order by copies desc, profile_id`, params),
    pool.query(
      `select profile_id, id, started_at, ended_at, duration_minutes, target_duration_minutes
         from focus_sessions fs
        where (started_at is null or (ended_at is not null and ended_at < started_at)
               or duration_minutes < 0 or duration_minutes > 120
               or target_duration_minutes < 1 or target_duration_minutes > 120)
          ${whereProfile} order by profile_id, id`, params),
    pool.query(
      `select profile_id, (started_at at time zone 'America/Sao_Paulo')::date as local_day,
              sum(duration_minutes)::numeric as minutes, count(*)::int as sessions
         from focus_sessions fs
        where ended_at is not null ${whereProfile}
        group by profile_id, local_day having sum(duration_minutes) > 1440
        order by minutes desc`, params),
    pool.query(
      `select fs.profile_id, fs.id as session_id, fs.started_at, fs.duration_minutes,
              count(ge.id)::int as energy_rows,
              (count(ge.id) * fs.duration_minutes)::numeric as old_row_sum_minutes
         from focus_sessions fs join garden_entries ge on ge.session_id = fs.id and ge.profile_id = fs.profile_id
        where fs.ended_at is not null ${whereProfile}
        group by fs.profile_id, fs.id, fs.started_at, fs.duration_minutes
       having count(ge.id) > 1
        order by old_row_sum_minutes desc`, params),
    pool.query(
      `select profile_id, count(*)::int as sessions, coalesce(sum(duration_minutes),0)::numeric as minutes
         from focus_sessions fs where ended_at is not null ${whereProfile}
        group by profile_id order by profile_id`, params),
    pool.query(
      `with ranked as (
         select profile_id, duration_minutes,
                row_number() over (partition by profile_id, started_at, duration_minutes, room_id order by id) as duplicate_number
           from focus_sessions fs where ended_at is not null ${whereProfile}
       )
       select profile_id, count(*)::int as sessions, coalesce(sum(duration_minutes),0)::numeric as minutes
         from ranked where duplicate_number = 1 group by profile_id order by profile_id`, params),
  ]);

  console.log(JSON.stringify({ profileId: profileId ?? "all", totals: totals.rows,
    totalsAfterExactDeduplication: dedupedTotals.rows,
    duplicateSessions: duplicates.rows, invalidSessions: invalid.rows,
    daysOver24Hours: days.rows, sessionsWithRepeatedGardenMinutes: gardenInflation.rows }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
