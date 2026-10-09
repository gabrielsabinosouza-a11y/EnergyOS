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
  `select id, recap_month, total_focus_minutes, longest_streak, league_tier, generated_at
     from monthly_recaps order by recap_month desc limit 12`);
await q("xp_by_month",
  `select to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM') as ym,
          sum(xp_amount)::int as xp, count(*)::int as n
     from xp_ledger group by 1 order by 1 desc limit 6`);
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

