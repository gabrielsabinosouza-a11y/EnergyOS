import pool from "../src/lib/db";
import { initializeUserDailyQuests, getUserQuestProgressWithQuests, ensureDailyQuestsExist } from "../src/lib/db/daily-quests";
import { todayIso } from "../src/lib/db/dates";

async function main() {
  await ensureDailyQuestsExist();
  const today = todayIso();
  const profiles = await pool.query<{ id: string }>("select id from profiles order by created_at");
  for (const { id } of profiles.rows) {
    try {
      await initializeUserDailyQuests(id, today);
      const quests = await getUserQuestProgressWithQuests(id, today);
      console.log(`profile ${id.slice(0, 8)}: ${quests.length} quests`);
      for (const q of quests) {
        console.log(`   #${q.questId} "${q.quest.title}" metric=${q.quest.metric} cur=${q.currentValue}/${q.quest.targetValue} done=${q.isCompleted} claimed=${q.isClaimed}`);
      }
    } catch (err) {
      console.log(`profile ${id.slice(0, 8)}: ERROR ${(err as Error).message}`);
      console.log((err as Error).stack?.split("\n").slice(0, 4).join("\n"));
    }
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error("FATAL", err);
  await pool.end();
  process.exit(1);
});