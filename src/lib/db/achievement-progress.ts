import pool from "../db";

/**
 * Records one completed qualifying co-focus session for a profile.
 * The ledger makes retries and concurrent completion requests idempotent.
 */
export async function recordFocusCompanionProgress(
  profileId: string,
  sessionId: number,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const inserted = await client.query(
      `insert into achievement_progress_events
         (profile_id, achievement_id, source_id)
       values ($1, 'focus_companion', $2)
       on conflict (profile_id, achievement_id, source_id) do nothing
       returning id`,
      [profileId, sessionId],
    );
    if (!inserted.rows[0]) {
      await client.query("commit");
      return;
    }

    await client.query(
      `insert into user_achievement_progress
         (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at)
       values ($1, 'focus_companion', 1, 1, now())
       on conflict (profile_id, achievement_id) do update set
         current_value = user_achievement_progress.current_value + 1,
         unlocked_tier = case
           when user_achievement_progress.current_value + 1 >= 30 then 4
           when user_achievement_progress.current_value + 1 >= 10 then 3
           when user_achievement_progress.current_value + 1 >= 5 then 2
           else 1
         end,
         unlocked_at = coalesce(user_achievement_progress.unlocked_at, now())`,
      [profileId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
