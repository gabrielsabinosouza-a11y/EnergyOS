import pool from "@/lib/db";
import { computeStreak } from "@/lib/db/tasks";
import { todayIso } from "@/lib/db/dates";
import { getDailyQuests } from "@/lib/db/daily-quests";
import { getGarden } from "@/lib/db/focus";
import { getLeagueSnapshot } from "@/lib/db/league";
import { listGroups } from "@/lib/db/groups";
import { listFriends } from "@/lib/db/social";

const pid = "0e719da0-f486-469c-b27f-9b3b5612fb50";

async function tryCall(name: string, fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    console.log(`OK   ${name}`);
    return out;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    console.log((e as Error).stack?.split("\n").slice(1, 4).join("\n"));
    throw e;
  }
}

async function main() {
  const today = todayIso();
  console.log("todayIso:", today);
  await tryCall("computeStreak", () => computeStreak(pid, today));
  await tryCall("getDailyQuests", () => getDailyQuests(pid, today));
  await tryCall("getGarden", () => getGarden(pid));
  await tryCall("getLeagueSnapshot", () => getLeagueSnapshot(pid));
  await tryCall("listGroups", () => listGroups(pid));
  await tryCall("listFriends", () => listFriends(pid));
  await pool.end();
}

main().catch((e) => {
  console.error("ABORTING after failure:", e);
  process.exit(1);
});