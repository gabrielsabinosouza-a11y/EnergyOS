// Adds daily targets and completion counters; old completed habits remain 1/1.
// Run: npm run db:migrate-habit-daily-target
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  for (const name of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", name), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) { connectionString = match[1].trim().replace(/^['"]|['"]$/g, ""); break; }
    } catch { /* optional env file */ }
  }
}
if (!connectionString) throw new Error("DATABASE_URL não configurada.");

const isNeon = /neon\.tech/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: isNeon ? { rejectUnauthorized: false } : undefined });
try {
  await client.connect();
  await client.query("begin");
  await client.query(`alter table profile_daily_tasks add column if not exists daily_target integer not null default 1`);
  await client.query(`do $$ begin alter table profile_daily_tasks add constraint profile_daily_tasks_daily_target_check check (daily_target >= 1); exception when duplicate_object then null; end $$`);
  await client.query(`alter table daily_task_log add column if not exists completion_count integer not null default 0`);
  await client.query(`alter table daily_task_log add column if not exists rewards_claimed boolean not null default false`);
  await client.query(`update daily_task_log l set completion_count = t.daily_target from profile_daily_tasks t where l.task_id = t.id and l.is_completed = true and l.completion_count = 0`);
  await client.query(`update daily_task_log set rewards_claimed = true where is_completed = true and rewards_claimed = false`);
  await client.query("commit");
  console.log("Meta diária e contagem de conclusão aplicadas; hábitos existentes mantidos em 1/1.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
