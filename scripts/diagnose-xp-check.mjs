// Diagnostic: check xp_ledger source values and try ensureDailyTasksSchema
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

  // 1. Check xp_ledger source values
  console.log("\n=== xp_ledger source value counts ===");
  const sources = await client.query(
    `select source, count(*)::int as n from xp_ledger group by source order by n desc`
  );
  console.log(sources.rows);

  const allowedSources = ['task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement'];
  const violating = sources.rows.filter(r => !allowedSources.includes(r.source));
  console.log("\nViolating source values (not in ensureDailyTasksSchema constraint list):");
  console.log(violating);

  // 2. Check if 'weekly_plan' source exists
  console.log("\n=== xp_ledger rows with source not in list ===");
  const bad = await client.query(
    `select source, source_id, profile_id from xp_ledger where source not in ('task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement') limit 20`
  );
  console.log(bad.rows);

  // 3. Try adding the constraint to see if it fails
  console.log("\n=== Try adding xp_ledger_source_check constraint (dry test) ===");
  try {
    await client.query(`
      do $$ begin
        alter table xp_ledger add constraint xp_ledger_source_check
          check (source in ('task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement'));
        raise notice 'CONSTRAINT ADDED SUCCESSFULLY';
      exception when check_violation then
        raise notice 'CHECK VIOLATION: existing rows violate the constraint';
      exception when others then
        raise notice 'OTHER ERROR: %', SQLERRM;
      end $$;
    `);
    console.log("Constraint add attempt completed (check pg notice above)");
  } catch (e) {
    console.error("Constraint add FAILED:", e.message);
  }

  // 4. Now test with the profile that has the 4 active habits
  const profileId = "0e719da0-f486-469c-b27f-9b3b5612fb50";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  console.log("\n=== Test getAllHabits for correct profile ===");
  console.log("Profile:", profileId, "Today:", today);
  try {
    const r = await client.query(
      `select
          t.id as "t.id", t.title as "t.title",
          t.icon_type as "t.icon_type", t.icon_value as "t.icon_value", t.color as "t.color",
          t.frequency_type as "t.frequency_type", t.frequency_days as "t.frequency_days", t.frequency_target as "t.frequency_target",
          t.goal_type as "t.goal_type", t.target_value as "t.target_value", t.unit as "t.unit",
          t.current_progress as "t.current_progress", t.description as "t.description", t.category as "t.category",
          t.start_date as "t.start_date", t.reminder_time as "t.reminder_time", t.archived as "t.archived",
          t.sort_order as "t.sort_order", t.daily_target as "t.daily_target",
          l.log_date as "l.log_date", l.is_completed as "l.is_completed", l.completed_at as "l.completed_at",
          l.completion_count as "l.completion_count"
       from profile_daily_tasks t
       left join daily_task_log l
         on l.task_id = t.id and l.log_date = $2::date
       where t.profile_id = $1 and t.is_active = true and t.archived = false
       order by t.sort_order, t.id`,
      [profileId, today]
    );
    console.log("Rows:", r.rowCount);
    for (const row of r.rows) {
      console.log("  -", row["t.id"], row["t.title"], "freq_type=" + row["t.frequency_type"], "freq_days=" + JSON.stringify(row["t.frequency_days"]), "completed=" + row["l.is_completed"], "count=" + row["l.completion_count"]);
    }
  } catch (e) {
    console.error("FAILED:", e.message);
  }

  // 5. Check daily_task_log for the habits
  console.log("\n=== daily_task_log for profile with habits ===");
  const logs = await client.query(
    `select l.task_id, l.log_date, l.is_completed, l.completed_at, l.completion_count, l.rewards_claimed, t.title
     from daily_task_log l
     join profile_daily_tasks t on t.id = l.task_id
     where t.profile_id = $1
     order by l.log_date desc, l.task_id`,
    [profileId]
  );
  console.log("Log rows:", logs.rowCount);
  console.log(logs.rows.slice(0, 10));

  // 6. Test rowToTask logic: check frequency_days type
  console.log("\n=== frequency_days type check ===");
  const freqCheck = await client.query(
    `select id, title, frequency_days, frequency_type, frequency_target, pg_typeof(frequency_days) as ft
     from profile_daily_tasks where profile_id = $1 and is_active = true`,
    [profileId]
  );
  console.log(freqCheck.rows);

} catch (error) {
  console.error("Error:", error);
} finally {
  await client.end();
}
