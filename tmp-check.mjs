import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync("/home/gabriel/Documentos/EnergyOS/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const PROFILE = "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3";

const s = await client.query(`select * from weekly_plan_series where profile_id = $1 order by id`, [PROFILE]);
console.log("== séries ==");
for (const r of s.rows) console.log(JSON.stringify(r, null, 1));

const o = await client.query(
  `select * from weekly_plan_occurrences where series_id in (select id from weekly_plan_series where profile_id = $1)`,
  [PROFILE],
);
console.log("== ocorrências ==", o.rows.length);
for (const r of o.rows) console.log(JSON.stringify(r));

await client.release();
await pool.end();
