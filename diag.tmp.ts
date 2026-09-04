import { readFileSync } from "node:fs";
import { Pool } from "pg";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    // trim optional double quotes
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const email = "pciskolargx@gmail.com";
  const prof = await pool.query(
    `select id as pid, email, current_streak, longest_streak, streak_shield_count, created_at
       from profiles where email = $1`,
    [email],
  );
  console.log("PROFILE:", prof.rows);
  if (!prof.rows[0]) return;
  const pid = prof.rows[0].pid;

  const sessions = await pool.query(
    `select to_char((ended_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as day,
            count(*) as n,
            max(duration_minutes) as max_dur, max(target_duration_minutes) as max_target
       from focus_sessions
      where profile_id = $1
        and (ended_at at time zone 'America/Sao_Paulo')::date > ($2::date - interval '12 days')
      group by day order by day`,
    [pid, new Date().toISOString().slice(0, 10)],
  );
  console.log("SESSIONS (last 12d):", sessions.rows);

  const log = await pool.query(
    `select to_char(log_date, 'YYYY-MM-DD') as day, status
       from streak_day_log where profile_id = $1 order by log_date desc limit 12`,
    [pid],
  );
  console.log("STREAK_DAY_LOG:", log.rows);

  const shields = await pool.query(
    `select to_char(used_on_date, 'YYYY-MM-DD') as day, streak_value_at_use
       from streak_shield_usage where profile_id = $1 order by used_on_date desc limit 12`,
    [pid],
  );
  console.log("SHIELD_USAGE:", shields.rows);
}

run().catch((e) => console.error(e)).finally(() => pool.end());