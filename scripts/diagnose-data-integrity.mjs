// Diagnostic: Confirm data integrity for the habits system (read-only)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  const file = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of file.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const connectionString = process.env.DATABASE_URL;
const isNeon = /neon\.tech/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: isNeon ? { rejectUnauthorized: false } : undefined });

try {
  await client.connect();

  const TARGET_PROFILE = "0e719da0-f486-469c-b27f-9b3b5612fb50";

  // 1. Count habits per user
  console.log("\n=== Habits (profile_daily_tasks) count per user ===");
  const habitCounts = await client.query(
    `select profile_id, count(*)::int as total, 
            count(*) filter (where is_active = true and archived = false) as active
     from profile_daily_tasks 
     group by profile_id order by profile_id`
  );
  console.log(habitCounts.rows);

  // 2. Count daily_task_log rows per user
  console.log("\n=== daily_task_log count per user ===");
  const logCounts = await client.query(
    `select t.profile_id, count(*)::int as log_rows, 
            count(*) filter (where l.is_completed = true) as completed_logs
     from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     group by t.profile_id order by t.profile_id`
  );
  console.log(logCounts.rows);

  // 3. The 4 active habits for the target profile
  console.log("\n=== Active habits for target profile (0e719...) ===");
  const active = await client.query(
    `select id, title, icon_type, icon_value, color, frequency_type, daily_target, sort_order, is_active, archived
     from profile_daily_tasks 
     where profile_id = $1 and is_active = true and archived = false
     order by sort_order, id`,
    [TARGET_PROFILE]
  );
  console.log("Active habit count:", active.rows.length);
  active.rows.forEach(r => console.log(`  ID=${r.id} title="${r.title}" icon=${r.icon_type}:${r.icon_value} color=${r.color} dt=${r.daily_target}`));

  // 4. Check-ins (completed entries) for the 4 active habits
  console.log("\n=== Check-ins for active habits (last 10) ===");
  const checkins = await client.query(
    `select l.task_id, t.title, l.log_date, l.is_completed, l.completed_at, l.completion_count, l.rewards_claimed
     from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     where t.profile_id = $1 and t.is_active = true and t.archived = false
     order by l.log_date desc, l.task_id
     limit 10`,
    [TARGET_PROFILE]
  );
  console.log(checkins.rows);

  // 5. Total check-in count
  const totalCheckins = await client.query(
    `select count(*)::int as n from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     where t.profile_id = $1`,
    [TARGET_PROFILE]
  );
  console.log("\nTotal daily_task_log rows for target profile:", totalCheckins.rows[0]);

  // 6. Most recent check-in dates (heatmap data)
  const recentDates = await client.query(
    `select l.log_date::text as date, count(*)::int as completed, 
            string_agg(t.title, ', ') as habits
     from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     where t.profile_id = $1 and l.is_completed = true
     group by l.log_date
     order by l.log_date desc
     limit 10`,
    [TARGET_PROFILE]
  );
  console.log("\n=== Recent active days (heatmap) ===");
  console.log(recentDates.rows);

  // 7. Streak-related: check if there's streak data
  console.log("\n=== Profile streak data ===");
  const streak = await client.query(
    `select current_streak, longest_streak from profiles where id = $1`,
    [TARGET_PROFILE]
  );
  console.log(streak.rows);

} catch (error) {
  console.error("Error:", error);
} finally {
  await client.end();
}
