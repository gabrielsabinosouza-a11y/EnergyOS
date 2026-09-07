import pool from "../src/lib/db";

/**
 * Backfills focus_session_events from existing focus_sessions rows so that
 * users retain their legitimate achievement progress when the achievement
 * computation switches from live focus_sessions to the immutable event log.
 *
 * Run AFTER the focus_session_events table has been created via db-schema.sql.
 * Idempotent: uses ON CONFLICT DO NOTHING.
 */
async function main() {
  const { rows: profiles } = await pool.query<{ id: string }>("select id from profiles");
  console.log(`Backfilling focus_session_events for ${profiles.length} profiles...`);

  let totalInserted = 0;

  for (const { id } of profiles) {
    const result = await pool.query(
      `insert into focus_session_events
         (profile_id, session_id, room_id, participant_count, duration_minutes, paused_count, is_completed, completed_at, created_at)
       select
         fs.profile_id,
         fs.id,
         fs.room_id,
         coalesce((
           select count(*)::int
           from room_participants rp
           where rp.room_id = fs.room_id
             and rp.joined_at <= fs.ended_at
             and rp.session_status in ('focusing', 'completed', 'left')
             and coalesce(rp.completed_at, rp.gave_up_at, now()) > fs.started_at
         ), 1),
         fs.duration_minutes,
         coalesce(fs.paused_count, 0),
         fs.duration_minutes >= fs.target_duration_minutes,
         fs.ended_at,
         fs.ended_at
       from focus_sessions fs
       where fs.profile_id = $1
         and fs.ended_at is not null
       on conflict (profile_id, session_id) do nothing`,
      [id],
    );
    totalInserted += result.rowCount ?? 0;
    if (result.rowCount) {
      console.log(`  ${id}: inserted ${result.rowCount} events`);
    }
  }

  console.log(`Done. Total events inserted: ${totalInserted}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
