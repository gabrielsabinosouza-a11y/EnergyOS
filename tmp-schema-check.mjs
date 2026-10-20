import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync("/home/gabriel/Documentos/EnergyOS/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const cols = await client.query(`
  select table_name, column_name, is_nullable, data_type
  from information_schema.columns
  where table_schema='public' and table_name in ('weekly_plans','weekly_plan_series','weekly_plan_occurrences')
    and column_name in ('plan_date','start_date')
  order by table_name, column_name`);
console.log("== colunas ==");
for (const r of cols.rows) console.log(` ${r.table_name}.${r.column_name} nullable=${r.is_nullable} (${r.data_type})`);

const idx = await client.query(`select indexname from pg_indexes where tablename='weekly_plans' order by indexname`);
console.log("\n== índices de weekly_plans ==", idx.rows.map((r) => r.indexname).join(", "));

const counts = await client.query(`
  select (select count(*) from weekly_plans)::text as plans,
         (select count(*) from weekly_plans where plan_date is null)::text as unscheduled,
         (select count(*) from weekly_plan_series)::text as series`);
console.log("\n== dados ==", JSON.stringify(counts.rows[0]));

await client.release();
await pool.end();
