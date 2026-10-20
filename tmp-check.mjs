import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync("/home/gabriel/Documentos/EnergyOS/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const PROFILE = "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3";

const s = await client.query(
  `select id, title, repeat_type, repeat_days, start_date::text as start_date, end_type, archived, created_at from weekly_plan_series where profile_id = $1 order by id desc limit 5`,
  [PROFILE],
);
console.log("== séries do perfil e2e ==");
for (const r of s.rows) console.log(JSON.stringify(r));

const p = await client.query(
  `select id, title, plan_date::text as plan_date, created_at from weekly_plans where profile_id = $1 order by id desc limit 5`,
  [PROFILE],
);
console.log("== planos avulsos ==");
for (const r of p.rows) console.log(JSON.stringify(r));

await client.release();
await pool.end();
