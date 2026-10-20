import pool from "./src/lib/db";

async function main() {
  const pid = "0e719da0-f486-469c-b27f-9b3b5612fb50";
  const g = await pool.query(
    "select to_char(planted_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as m, count(*)::int as n from garden_entries where profile_id = $1 group by 1 order by 1",
    [pid],
  );
  console.log("garden per month:", g.rows);
  const total = await pool.query("select count(*)::int as n from garden_entries where profile_id = $1", [pid]);
  console.log("garden total:", total.rows);
  const r = await pool.query("select recap_month, xp_sources from monthly_recaps where profile_id = $1 order by recap_month desc", [pid]);
  console.log("xp_sources:", r.rows);
  await pool.end();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
