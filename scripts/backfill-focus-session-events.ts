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
         fs.paused_count,
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

  // Restore original paused_count on pre-existing rows (keeps NULL semantics:
  // a NULL is "pause data untracked", which must NOT count as flow_state bonus).
  const restored = await pool.query(
    `update focus_session_events e
       set paused_count = fs.paused_count
     from focus_sessions fs
     where e.session_id = fs.id and e.profile_id = fs.profile_id`,
  );
  console.log(`Restored original paused_count on ${restored.rowCount ?? 0} existing rows.`);

  // Reconcile co-focus history that only survives in the legacy event ledger.
  // Those rooms were deleted (room_id -> NULL, room_participants cascaded away),
  // so participant_count can't be reconstructed from live room rows. The
  // achievement_progress_events rows prove these sessions were co-focus
  // completions — mark them as such so no earned progress is lost.
  const reconciled = await pool.query(
    `update focus_session_events e
       set participant_count = greatest(e.participant_count, 2),
           is_completed = true
     from achievement_progress_events ap
     where ap.achievement_id = 'focus_companion'
       and ap.source_id = e.session_id
       and ap.profile_id = e.profile_id`,
  );
  console.log(`Reconciled ${reconciled.rowCount ?? 0} legacy co-focus events.`);

  console.log(`Done. Total events inserted: ${totalInserted}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
