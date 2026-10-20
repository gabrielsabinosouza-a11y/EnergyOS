/**
 * Limpa as tarefas de teste do Planejamento (prefixo "E2E ").
 * Usado pelo teste e2e de agendamento opcional.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", envFile), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // arquivo opcional
    }
  }
  return undefined;
}

const url = await resolveDatabaseUrl();
if (!url) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const profiles = await client.query(`select id from profiles where email = 'e2e.planner@energyos.test'`);
const profileId = profiles.rows[0]?.id ?? "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3";

const plans = await client.query(
  `select id from weekly_plans where profile_id = $1 and title like 'E2E %'`,
  [profileId],
);
for (const row of plans.rows) {
  await client.query("delete from weekly_plans where id = $1", [row.id]);
}
console.log(`removidos ${plans.rowCount} plano(s) de teste`);

const series = await client.query(
  `select id from weekly_plan_series where profile_id = $1 and title like 'E2E %'`,
  [profileId],
);
for (const row of series.rows) {
  await client.query("delete from weekly_plan_occurrences where series_id = $1", [row.id]);
  await client.query("delete from weekly_plan_series where id = $1", [row.id]);
  await client.query(
    "delete from xp_ledger where source = 'weekly_plan_occurrence' and source_id like $1",
    [`${row.id}:%`],
  );
}
console.log(`removidos ${series.rowCount} série(s) de teste`);

await client.release();
await pool.end();
