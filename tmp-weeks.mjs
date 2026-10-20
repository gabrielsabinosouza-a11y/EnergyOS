import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = here;
for (const envFile of [".env.local", ".env"]) {
  try {
    const contents = await readFile(join(root, envFile), "utf8");
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) { process.env.DATABASE_URL = match[1].trim(); break; }
  } catch { /* opcional */ }
}

const { listWeeklyPlanOccurrences } = await import("./src/lib/db/weekly-plans-series.ts");
const PROFILE = "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3";

for (const week of ["2026-10-19", "2026-11-02", "2026-11-30", "2026-12-07", "2026-12-21", "2026-12-28", "2027-01-04"]) {
  const items = await listWeeklyPlanOccurrences(PROFILE, week);
  console.log(week, "→", items.map((i) => `${i.planDate} ${i.title}`).join(" | ") || "(vazio)");
}
