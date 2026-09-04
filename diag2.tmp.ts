import { readFileSync } from "node:fs";
import { Pool } from "pg";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const pid = "0e719da0-f486-469c-b27f-9b3b5612fb50";
  const shields = await pool.query(
    `select to_char(used_on_date, 'YYYY-MM-DD') as day, streak_value_at_use, created_at
       from streak_shield_usage where profile_id = $1 order by used_on_date`,
    [pid],
  );
  console.log("ALL SHIELD_USAGE:", JSON.stringify(shields.rows));

  const shieldCount = await pool.query(`select streak_shield_count from profiles where id=$1`, [pid]);
  console.log("shield_count:", shieldCount.rows[0].streak_shield_count);
}
run().catch((e) => console.error(e)).finally(() => pool.end());