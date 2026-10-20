import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync("/home/gabriel/Documentos/EnergyOS/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const PROFILE = "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3";
const s = await client.query(
  `select id, title, archived from weekly_plan_series where profile_id = $1 and (title like 'E2E%' or title like '%recorrente%' or title like '%E2E%')`,
  [PROFILE],
);
for (const row of s.rows) {
  const o = await client.query("delete from weekly_plan_occurrences where series_id = $1", [row.id]);
  const d = await client.query("delete from weekly_plan_series where id = $1", [row.id]);
  const l = await client.query(
    "delete from xp_ledger where source = 'weekly_plan_occurrence' and source_id like $1",
    [`${row.id}:%`],
  );
  console.log(`removido: série ${row.id} "${row.title}" (${d.rowCount}), ${o.rowCount} ocorrências, ${l.rowCount} recompensas`);
}
const p = await client.query(
  `select id, title from weekly_plans where profile_id = $1 and title like 'E2E%'`,
  [PROFILE],
);
for (const row of p.rows) {
  await client.query("delete from weekly_plans where id = $1", [row.id]);
  console.log(`removido: plano avulso ${row.id} "${row.title}"`);
}
const remaining = await client.query(
  `select (select count(*) from weekly_plans where profile_id=$1)::text as plans,
          (select count(*) from weekly_plan_series where profile_id=$1)::text as series`,
  [PROFILE],
);
console.log("restante do perfil e2e:", JSON.stringify(remaining.rows[0]));

await client.release();
await pool.end();
