import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Parse .env ourselves so we never echo secrets to stdout. Skip malformed lines.
function loadEnv() {
  const file = path.resolve(process.cwd(), ".env");
  const out = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}
const env = loadEnv();
const url = env.DATABASE_URL;
if (!url) { console.error("NO_DATABASE_URL"); process.exit(2); }
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
async function run(q, p = []) { const r = await pool.query(q, p); return r.rows; }
try {
  console.log("DB_OK");
  console.log("CONSTRAINT:", JSON.stringify(await run(`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='xp_ledger'::regclass and contype='c'`)));
  console.log("DTL_COLS:", JSON.stringify(await run(`select column_name, data_type, column_default from information_schema.columns where table_name='daily_task_log' order by ordinal_position`)));
  console.log("BONUS_TBL:", JSON.stringify(await run(`select to_regclass('daily_habit_bonus_log') as exists`)));
  console.log("SOURCES_WEEK:", JSON.stringify(await run(`select source, count(*) from xp_ledger where created_at > now() - interval '7 days' group by source order by source`)));
  console.log("DUP_ENGLISH:", JSON.stringify(await run(`select title, count(*) as n from profile_daily_tasks where is_active=true and title ilike '%english%' group by title having count(*)>1`)));
  console.log("DUP_ALL:", JSON.stringify(await run(`select title, count(*) as n, count(distinct profile_id) as users from profile_daily_tasks where is_active=true group by title having count(*)>1 order by n desc limit 20`)));
  console.log("SAMPLE_ENGLISH:", JSON.stringify(await run(`select id, profile_id, title, is_active, daily_target from profile_daily_tasks where is_active=true and title ilike '%english%' limit 8`)));
} catch (e) { console.error("ERR", e.message); }
finally { await pool.end(); }
