// Diagnostic script: inspects the real database schema for the habits system.
// Read-only — does NOT modify any data.
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
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  // 1. Check profile_daily_tasks columns
  console.log("\n=== profile_daily_tasks columns ===");
  const cols = await client.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_name = 'profile_daily_tasks'
     order by ordinal_position`
  );
  console.log(cols.rows);

  // 2. Check daily_task_log columns
  console.log("\n=== daily_task_log columns ===");
  const logCols = await client.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_name = 'daily_task_log'
     order by ordinal_position`
  );
  console.log(logCols.rows);

  // 3. Check xp_ledger constraint
  console.log("\n=== xp_ledger constraints ===");
  const constraints = await client.query(
    `select conname, contype, pg_get_constraintdef(oid) as condef
     from pg_constraint
     where conrelid = 'xp_ledger'::regclass`
  );
  console.log(constraints.rows);

  // 4. Check if the 4 habits exist and get counts
  console.log("\n=== profile_daily_tasks rows (all users, all habits) ===");
  const habitCount = await client.query(
    `select count(*)::int as n from profile_daily_tasks`
  );
  console.log("Total habit rows:", habitCount.rows[0]);

  const habitTitles = await client.query(
    `select id, profile_id, title, icon_type, icon_value, color, frequency_type, frequency_days, frequency_target, goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived, sort_order, daily_target, is_active
     from profile_daily_tasks
     order by id`
  );
  console.log("All habit rows:", JSON.stringify(habitTitles.rows, null, 2));

  // 5. Check daily_task_log rows
  console.log("\n=== daily_task_log row count ===");
  const logCount = await client.query(`select count(*)::int as n from daily_task_log`);
  console.log("Total daily_task_log rows:", logCount.rows[0]);

  // 6. Try to reproduce the error: run getAllHabits query directly
  // Use a known profile_id if available
  console.log("\n=== Sample profile_id ===");
  const profile = await client.query(`select id from profiles limit 1`);
  console.log("Profiles:", profile.rows);

  if (profile.rows.length > 0) {
    const pid = profile.rows[0].id;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    console.log("\nToday (Sao Paulo):", today);
    console.log("Profile ID:", pid);

    // Test getAllHabits query
    console.log("\n=== Test getAllHabits query ===");
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
        [pid, today]
      );
      console.log("getAllHabits result rows:", r.rowCount);
      console.log("Rows:", JSON.stringify(r.rows.slice(0, 2), null, 2));
    } catch (e) {
      console.error("getAllHabits query FAILED:", e.message);
    }

    // Test listDailyTaskHistory query
    console.log("\n=== Test listDailyTaskHistory query ===");
    try {
      const from = "2026-01-01";
      const to = "2026-12-31";
      const r = await client.query(
        `select l.task_id, l.log_date::text as date, l.completed_at
         from daily_task_log l
         join profile_daily_tasks t on t.id = l.task_id
         where t.profile_id = $1 and l.is_completed = true
           and l.log_date >= $2::date and l.log_date <= $3::date
         order by l.log_date, l.task_id`,
        [pid, from, to]
      );
      console.log("listDailyTaskHistory result rows:", r.rowCount);
      console.log("Rows:", JSON.stringify(r.rows.slice(0, 5), null, 2));
      console.log("Completed_at null check:", r.rows.filter(r => r.completed_at === null).length, "rows with null completed_at");
    } catch (e) {
      console.error("listDailyTaskHistory query FAILED:", e.message);
    }
  }

  // 7. Try to run ensureDailyTasksSchema steps individually
  console.log("\n=== Testing ensureDailyTasksSchema steps ===");
  const steps = [
    `alter table profile_daily_tasks add column if not exists is_active boolean not null default true`,
    `alter table profile_daily_tasks add column if not exists icon_type text not null default 'asset'`,
    `alter table profile_daily_tasks add column if not exists icon_value text not null default 'target'`,
    `alter table profile_daily_tasks add column if not exists color text not null default '#71d4ff'`,
    `alter table profile_daily_tasks add column if not exists frequency_type text not null default 'daily'`,
    `alter table profile_daily_tasks add column if not exists frequency_days int[]`,
    `alter table profile_daily_tasks add column if not exists frequency_target integer`,
    `alter table profile_daily_tasks add column if not exists goal_type text not null default 'check'`,
    `alter table profile_daily_tasks add column if not exists target_value numeric`,
    `alter table profile_daily_tasks add column if not exists unit text`,
    `alter table profile_daily_tasks add column if not exists current_progress numeric not null default 0`,
    `alter table profile_daily_tasks add column if not exists description text`,
    `alter table profile_daily_tasks add column if not exists category text`,
    `alter table profile_daily_tasks add column if not exists start_date date`,
    `alter table profile_daily_tasks add column if not exists reminder_time time`,
    `alter table profile_daily_tasks add column if not exists archived boolean not null default false`,
    `alter table profile_daily_tasks add column if not exists daily_target integer not null default 1`,
  ];
  for (const step of steps) {
    try {
      await client.query(step);
      console.log("OK:", step.slice(0, 80));
    } catch (e) {
      console.error("FAILED:", step.slice(0, 80), "->", e.message);
    }
  }
} catch (error) {
  console.error("Connection error:", error);
} finally {
  await client.end();
}
