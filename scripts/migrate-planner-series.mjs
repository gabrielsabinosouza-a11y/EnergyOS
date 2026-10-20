/**
 * Migração idempotente do schema do Planejamento (planos recorrentes).
 *
 * Cria/ajusta:
 *   - weekly_plan_series      (regra de repetição)
 *   - weekly_plan_occurrences (estado por ocorrência)
 *   - colunas reminder_offset_min em weekly_plans / série / ocorrência
 *   - índices de consulta
 *
 * Não apaga nem altera dados existentes. Idempotente: rodar várias vezes é
 * seguro.
 *
 * Uso: npm run db:migrate-planner-series
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
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:migrate-planner-series");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.DATABASE_SSL_STRICT === "true" || process.env.NODE_ENV === "production";

const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: sslStrict } : undefined,
});

const statements = [
  `create table if not exists weekly_plan_series (
     id               serial primary key,
     profile_id       text not null references profiles(id) on delete cascade,
     title            text not null,
     category_id      int not null references categories(id),
     icon_type        text default 'asset',
     icon_value       text,
     color            text,
     note             text,
     repeat_type      text not null default 'once',
     repeat_days      int[],
     repeat_interval  int,
     start_time       time,
     duration_minutes int,
     reminder_offset_min int,
     start_date       date not null,
     end_type         text not null default 'never',
     end_date         date,
     end_count        int,
     timezone         text not null default 'America/Sao_Paulo',
     archived         boolean not null default false,
     created_at       timestamptz not null default now()
   )`,
  `create table if not exists weekly_plan_occurrences (
     id                  serial primary key,
     series_id           int not null references weekly_plan_series(id) on delete cascade,
     occurrence_date     date not null,
     completed_at        timestamptz,
     skipped             boolean not null default false,
     override_title      text,
     override_start_time time,
     reminder_offset_min int,
     unique (series_id, occurrence_date)
   )`,
  `alter table weekly_plans add column if not exists reminder_offset_min int`,
  `alter table weekly_plan_series add column if not exists reminder_offset_min int`,
  `alter table weekly_plan_occurrences add column if not exists reminder_offset_min int`,
  `create index if not exists idx_wps_profile on weekly_plan_series(profile_id, archived)`,
  `create index if not exists idx_wpo_series_date on weekly_plan_occurrences(series_id, occurrence_date)`,
];

await client.connect();
try {
  for (const sql of statements) {
    await client.query(sql);
  }
  console.log("Schema do Planejamento ensured: weekly_plan_series, weekly_plan_occurrences, colunas de lembrete e índices.");
} catch (error) {
  console.error("Falha na migração do Planejamento:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
