/**
 * Agendamento opcional no Planejamento.
 *
 * Permite criar planos SEM data (e sem horário): `weekly_plans.plan_date`
 * deixa de ser NOT NULL e ganha índice para a consulta "sem data".
 *
 * Idempotente — pode rodar quantas vezes for.
 *
 * Uso: npm run db:migrate-planner-optional-schedule
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

const connectionString = await resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:migrate-planner-optional-schedule");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.DATABASE_SSL_STRICT === "true" || process.env.NODE_ENV === "production";

const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: sslStrict } : undefined,
});

const statements = [
  // Planos avulsos podem existir sem data (tarefa "sem data").
  `alter table weekly_plans alter column plan_date drop not null`,
  // Índice parcial para a listagem de tarefas sem data.
  `create index if not exists weekly_plans_unscheduled_idx on weekly_plans(profile_id) where plan_date is null`,
];

await client.connect();
try {
  for (const sql of statements) {
    await client.query(sql);
  }
  const check = await client.query(
    `select is_nullable from information_schema.columns
     where table_schema='public' and table_name='weekly_plans' and column_name='plan_date'`,
  );
  console.log(`Schema do Planejamento ensured: weekly_plans.plan_date nullable=${check.rows[0]?.is_nullable}.`);
} catch (error) {
  console.error("Falha na migração de agendamento opcional:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
