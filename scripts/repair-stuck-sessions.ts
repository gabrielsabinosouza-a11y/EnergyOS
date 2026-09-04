import pool from "@/lib/db";
import { endFocusSession } from "@/lib/db/focus";

// Repairs focus sessions that were left "open" (ended_at null, duration 0)
// because the end-of-session save crashed on the daily-quests unique-title bug.
// Each session is completed as if it reached its full target duration, granting
// XP, coins, mission progress, streak and garden finalization — identical to a
// normal successful completion (creditXP is idempotent).
async function main() {
  const open = await pool.query<{ id: number; profile_id: string; target_duration_minutes: number; started_at: Date }>(
    `select id, profile_id, target_duration_minutes, started_at
     from focus_sessions
     where ended_at is null
       and started_at < now() - interval '2 minutes'
     order by started_at asc`,
    [],
  );
  console.log(`found ${open.rows.length} stuck open session(s)`);

  for (const s of open.rows) {
    try {
      const { session, xpAwarded, coinsAwarded } = await endFocusSession(
        s.profile_id,
        Number(s.id),
        s.target_duration_minutes * 60,
        false,
      );
      console.log(
        `✓ #${s.id} ${s.profile_id.slice(0, 8)} target=${s.target_duration_minutes}m -> ` +
          `duration=${session.durationMinutes}m xp=${xpAwarded} coins=${coinsAwarded}`,
      );
    } catch (error) {
      console.error(`✗ #${s.id}:`, (error as Error).message);
    }
  }

  await pool.end();
}

main();