import pool from "../src/lib/db";
import { listAchievementProgress } from "../src/lib/db/achievements";

const CAFEINADO = "0e719da0-f486-469c-b27f-9b3b5612fb50"; // pciskolargx@gmail.com

async function main() {
  const results = await listAchievementProgress(CAFEINADO);
  const squad = results.find((a) => a.id === "squad_leader");
  console.log(
    `squad_leader → value: ${squad?.currentValue}, tier: ${squad?.unlockedTier}`,
  );
  const all = results.filter((a) => a.unlockedTier > 0).map((a) => `${a.id}@${a.unlockedTier}`);
  console.log("unlocked:", all.join(", ") || "(none)");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });