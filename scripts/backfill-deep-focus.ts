import pool from "../src/lib/db";
import { listAchievementProgress } from "../src/lib/db/achievements";

async function main() {
  const { rows } = await pool.query<{ id: string }>("select id from profiles");
  console.log("Backfilling", rows.length, "profiles...");
  for (const { id } of rows) {
    const results = await listAchievementProgress(id);
    const df = results.find((a) => a.id === "deep_focus");
    console.log(`${id} → value: ${df?.currentValue} min, tier: ${df?.unlockedTier}`);
  }
  console.log("Done.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
