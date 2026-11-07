import pool from "../src/lib/db";
import { getRecaps, generateRecap } from "../src/lib/db/recap";

async function recomputeRecaps(profileId?: string) {
  console.log("=== RECOMPUTE MONTHLY RECAPS ===\n");

  let profiles: Array<{ id: string }>;

  if (profileId) {
    console.log(`Recomputing recaps for profile: ${profileId}`);
    profiles = [{ id: profileId }];
  } else {
    console.log("Fetching all profiles with focus sessions...");
    const result = await pool.query<{ id: string }>(
      `SELECT DISTINCT profile_id as id FROM focus_sessions ORDER BY profile_id`
    );
    profiles = result.rows;
    console.log(`Found ${profiles.length} profiles\n`);
  }

  for (const profile of profiles) {
    try {
      console.log(`\nRecomputing recaps for ${profile.id}...`);
      const recaps = await getRecaps(profile.id);
      
      for (const recap of recaps) {
        console.log(
          `  ${recap.recapMonth}: ${recap.totalFocusMinutes}min (${Math.round(recap.totalFocusMinutes / 60)}h), ` +
          `streak: ${recap.longestStreak}, status: ${recap.status}`
        );
      }
    } catch (error) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await pool.end();
}

const profileId = process.argv[2];
recomputeRecaps(profileId).catch(console.error);
