import { runWeeklyLeagueReset, getUserLeagueSnapshot, getLiveCohort } from "./src/lib/db/league-new";

async function main() {
  try {
    console.log("calling runWeeklyLeagueReset...");
    await runWeeklyLeagueReset();
    console.log("runWeeklyLeagueReset OK");
  } catch (error) {
    console.error("runWeeklyLeagueReset FAILED:", error);
    process.exitCode = 1;
  }
  try {
    console.log("calling getUserLeagueSnapshot...");
    const snapshot = await getUserLeagueSnapshot("00000000-0000-0000-0000-000000000000");
    console.log("getUserLeagueSnapshot OK", JSON.stringify(snapshot).slice(0, 300));
  } catch (error) {
    console.error("getUserLeagueSnapshot FAILED:", error);
    process.exitCode = 1;
  }
  try {
    console.log("calling getLiveCohort...");
    const cohort = await getLiveCohort("00000000-0000-0000-0000-000000000000");
    console.log("getLiveCohort OK", JSON.stringify(cohort).slice(0, 300));
  } catch (error) {
    console.error("getLiveCohort FAILED:", error);
    process.exitCode = 1;
  }
}

void main();
