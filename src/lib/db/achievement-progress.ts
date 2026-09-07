import pool from "../db";

/**
 * Records one completed qualifying co-focus session for a profile.
 * The ledger makes retries and concurrent completion requests idempotent.
 *
 * Only the raw count is bumped here. The unlocked tier / unlocked_at / seen_at
 * bookkeeping is left exclusively to `listAchievementProgress`, whose
 * justUnlocked detection needs the persisted tier to be one step behind the
 * freshly-computed tier so it can tell the client a level-up just happened
 * (pre-bumping the tier here silently swallowed the unlock modal on level-ups).
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
         (profile_id, achievement_id, current_value)
       values ($1, 'focus_companion', 1)
       on conflict (profile_id, achievement_id) do update set
         current_value = user_achievement_progress.current_value + 1`,
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
