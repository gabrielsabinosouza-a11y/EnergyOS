const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const pid = "n1Gqy0xJeyOqOTaDaZcKj9LGKXc2";
  const p = await c.query("select profile_id, display_name, email from profiles where profile_id = $1", [pid]);
  console.log("profile:", p.rows);
  const r = await c.query("select * from monthly_recaps where profile_id = $1 order by recap_month desc limit 5", [pid]);
  console.log(
    "recaps:",
    r.rows.map((x) => ({
      m: x.recap_month,
      f: x.total_focus_minutes,
      s: x.longest_streak,
      t: x.league_tier,
      g: x.garden_count,
      xp: x.total_xp,
      st: x.status,
      missions: x.missions_completed,
      goals: x.goals_completed,
      ach: x.achievements_unlocked,
      coins: x.coins_gained,
      tag: x.productivity_tag,
      top: x.top_focus_category,
    })),
  );
  const all = await c.query(
    "select profile_id, count(*) from monthly_recaps group by profile_id order by count(*) desc limit 10",
  );
  console.log("top recap owners:", all.rows);
  await c.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
