import pg from "pg";
import fs from "fs";

const env = fs.readFileSync("/run/media/gabriel/ExternalHDD/Projects/EnergyOS/.env", "utf8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString: url });
await client.connect();
const out = [];
async function q(label, sql, params) {
  out.push("---" + label + "---");
  try {
    const r = await client.query(sql, params);
    for (const row of r.rows) out.push(JSON.stringify(row));
  } catch (e) {
    out.push("ERR: " + e.message);
  }
}

await q("monthly_recaps_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["monthly_recaps"]);
await q("xp_ledger_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["xp_ledger"]);
await q("recap_rows",
  `select id, profile_id, recap_month, total_focus_minutes, longest_streak, league_tier, total_xp,
          generation_number, league_at_start, streak_start_date, streak_end_date, streak_is_alive, generated_at
     from monthly_recaps order by profile_id, recap_month`);
await q("history_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["monthly_recap_history"]);
await q("history_rows",
  `select count(*)::int as n from monthly_recap_history`);
await q("user_xp_rows",
  `select profile_id, total_xp from user_xp order by total_xp desc limit 8`);
await q("shields_for_main",
  `select profile_id, used_on_date from streak_shield_usage where profile_id='0e719da0-f486-469c-b27f-9b3b5612fb50' order by 2`);
await q("sep_days_detail",
  `select f.profile_id, to_char((f.ended_at at time zone 'America/Sao_Paulo')::date,'YYYY-MM-DD') as d,
          sum(f.duration_minutes)::int as mins, max(f.target_duration_minutes) as tgt
     from focus_sessions f
    where f.ended_at is not null and f.profile_id='0e719da0-f486-469c-b27f-9b3b5612fb50'
      and f.ended_at >= '2026-08-25T00:00:00Z' and f.ended_at < '2026-09-12T00:00:00Z'
    group by 1, 2 order by 2`);
await q("xp_main_months",
  `select to_char((created_at at time zone 'America/Sao_Paulo')::date,'YYYY-MM') as ym, sum(xp_amount)::int as xp
     from xp_ledger where profile_id='0e719da0-f486-469c-b27f-9b3b5612fb50' group by 1 order by 1`);
await q("league_groups_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["league_groups"]);
await q("profiles_cols",
  "select column_name from information_schema.columns where table_name=$1 order by ordinal_position",
  ["profiles"]);
await q("garden_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["garden_entries"]);
await q("streak_by_month",
  `with days as (
     select distinct to_char((ended_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as d
       from focus_sessions
      where ended_at is not null
        and duration_minutes * 1.0 >= target_duration_minutes * 0.8
   )
   select left(d, 7) as ym, count(*)::int as active_days from days group by 1 order by 1 desc limit 6`);
await q("focus_cols",
  "select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position",
  ["focus_sessions"]);
await q("tables_like",
  `select table_name from information_schema.tables
    where table_name in ('monthly_recap_history','user_xp','garden_entries','league_groups','league_group_members','profiles','streak_shield_usage')`);
await q("profile_count", "select count(*)::int as n from profiles");
await q("xp_ledger_sample",
  `select profile_id, source, xp_amount, created_at from xp_ledger order by created_at desc limit 5`);

await client.end();
fs.writeFileSync("/tmp/db1.txt", out.join("\n"));
console.log("WROTE /tmp/db1.txt");

