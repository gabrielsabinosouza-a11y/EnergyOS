// ─────────────────────────────────────────────────────────────────────────────
// Fase 1 — migração de terminologia (HÁBITO / META / PLANEJAMENTO).
//
//   HÁBITO = repete TODO dia  → profile_daily_tasks + daily_task_log
//   META    = tem fim         → goals (sem frequency)
//   PLANEJAMENTO              → planner_items + planner_completions
//
// NADA é apagado: as linhas legadas ganham migrated_at/migrated_to e os novos
// registros guardam migrated_from_* como chave de dedupe → rodar 2x não duplica.
//
// Uso:
//   npm run db:migrate-terminology            → dry-run (só imprime o plano)
//   npm run db:migrate-terminology -- --apply → grava de verdade
// ─────────────────────────────────────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

/**
 * Sobrescrita manual da regra automática: metas que, apesar de terem
 * frequency='daily' no legado, são na verdade METAS com alvo ("Ler 5 livros",
 * "Portfolio pronto"). Ex.: MIGRATE_AS_GOAL_IDS=14,29 npm run db:migrate-terminology
 */
const FORCE_AS_GOAL = new Set(
  (process.env.MIGRATE_AS_GOAL_IDS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0),
);

function isoDate(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.slice(0, 10);
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:migrate-terminology");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.NODE_ENV === "production" || process.env.DATABASE_SSL_STRICT === "true";
const client = new pg.Client({ connectionString, ssl: isNeon ? { rejectUnauthorized: sslStrict } : undefined });
await client.connect();

// ── 1. DDL (idempotente) ──────────────────────────────────────────────────────
const DDL = [
  // Hábito = template diário existente; só ganha categoria + chave de migração.
  `alter table profile_daily_tasks add column if not exists category_id bigint`,
  `alter table profile_daily_tasks add column if not exists migrated_from_goal_id bigint`,
  `create index if not exists profile_daily_tasks_migrated_idx on profile_daily_tasks(migrated_from_goal_id)`,
  // Id determinístico `${habitId}_${YYYY-MM-DD}` (equivalente ao documento).
  `alter table daily_task_log add column if not exists doc_id text
     generated always as (task_id::text || '_' || log_date::text) stored`,

  // Meta: alvo + unidade + prazo + conclusão. `frequency` continua no banco
  // (nada é apagado) mas deixa de ser obrigatório: default "unique".
  `alter table goals add column if not exists unit text`,
  `alter table goals add column if not exists deadline date`,
  `alter table goals add column if not exists completed_at timestamptz`,
  `alter table goals add column if not exists migrated_at timestamptz`,
  `alter table goals add column if not exists migrated_to text check (migrated_to in ('habit','goal'))`,
  `alter table goals alter column frequency set default 'unique'`,
  `create index if not exists goals_profile_deadline_idx on goals(profile_id, deadline)`,

  // Planejamento: 1 documento por item + conclusões por ocorrência.
  `create table if not exists planner_items (
     id bigserial primary key,
     profile_id text not null references profiles(id) on delete cascade,
     title text not null,
     category_id bigint not null references categories(id),
     kind text not null default 'task' check (kind in ('task','event')),
     date date not null,
     time time,
     all_day boolean not null default true,
     recurrence_type text not null default 'none' check (recurrence_type in ('none','weekly','monthly','yearly')),
     recurrence_weekdays smallint[] not null default '{}',
     recurrence_interval_weeks smallint,
     recurrence_until date,
     skipped_dates date[] not null default '{}',
     migrated_from_plan_id bigint,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists planner_items_profile_date_idx on planner_items(profile_id, date)`,
  `create index if not exists planner_items_migrated_idx on planner_items(migrated_from_plan_id)`,
  `create table if not exists planner_completions (
     item_id bigint not null references planner_items(id) on delete cascade,
     profile_id text not null references profiles(id) on delete cascade,
     completed_date date not null,
     completed_at timestamptz not null default now(),
     doc_id text generated always as (item_id::text || '_' || completed_date::text) stored,
     primary key (item_id, completed_date)
   )`,
  `create index if not exists planner_completions_profile_date_idx on planner_completions(profile_id, completed_date)`,

  // Marca de migração do plano legado (a linha continua existindo).
  `alter table weekly_plans add column if not exists migrated_at timestamptz`,
  `alter table weekly_plans add column if not exists migrated_to text check (migrated_to in ('planner_item'))`,
];

for (const sql of DDL) {
  if (APPLY) await client.query(sql);
}
// ── 2. Plano de conversão (sempre impresso, mesmo no --apply) ────────────────
// O plano precisa rodar ANTES do DDL existir, então tudo é checado no
// information_schema: o dry-run funciona numa banco ainda não migrado.
async function hasTable(table) {
  const r = await client.query(
    `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = $1) as ok`,
    [table],
  );
  return r.rows[0].ok;
}

async function hasColumn(table, column) {
  const r = await client.query(
    `select exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = $1 and column_name = $2) as ok`,
    [table, column],
  );
  return r.rows[0].ok;
}

const hasPlannerTables = await hasTable("planner_items");
const hasHabitKey = await hasColumn("profile_daily_tasks", "migrated_from_goal_id");
const plannerReady = hasPlannerTables && (await hasColumn("weekly_plans", "migrated_at"));
const alreadyHabitExpr = hasHabitKey
  ? "exists (select 1 from profile_daily_tasks p where p.migrated_from_goal_id = g.id)"
  : "false";
const alreadyPlanExpr = plannerReady
  ? "exists (select 1 from planner_items pi where pi.migrated_from_plan_id = w.id)"
  : "false";

const habitRows = await client.query(
  `select g.id, g.title, c.name as category, g.target_value,
          (select count(*)::int from goal_logs gl where gl.goal_id = g.id) as logs,
          coalesce((select sum(gl.amount) from goal_logs gl where gl.goal_id = g.id), 0) as log_total,
          ${alreadyHabitExpr} as already
     from goals g
     left join categories c on c.id = g.category_id
    where g.frequency = 'daily'
      and not (g.id = any($1::bigint[]))
    order by g.profile_id, g.id`,
  [[...FORCE_AS_GOAL]],
);

const goalRows = await client.query(
  `select g.id, g.title, c.name as category, g.target_value, g.frequency,
          g.current_value as legacy_current,
          coalesce((select sum(gl.amount) from goal_logs gl where gl.goal_id = g.id), 0) as log_total,
          ${alreadyHabitExpr} as already
     from goals g
     left join categories c on c.id = g.category_id
    where g.frequency is distinct from 'daily'
       or g.id = any($1::bigint[])
    order by g.profile_id, g.id`,
  [[...FORCE_AS_GOAL]],
);

const planRows = await client.query(
  `select w.id, w.title, c.name as category, w.plan_date, w.completed_at,
          ${alreadyPlanExpr} as already
     from weekly_plans w
     left join categories c on c.id = w.category_id
    order by w.profile_id, w.id`,
).catch(() => ({ rows: [] }));

const habits = habitRows.rows.filter((r) => !r.already);
const goals = goalRows.rows;
const plans = planRows.rows.filter((r) => !r.already);

console.log(`\n=== PLANO DE MIGRAÇÃO (${APPLY ? "APLICANDO" : "DRY-RUN"}) ===`);
if (FORCE_AS_GOAL.size > 0) {
  console.log(`\n⚠  Sobrescrita manual: metas #${[...FORCE_AS_GOAL].join(", #")} viram META mesmo com frequency='daily'.`);
}
console.log(`\nmetas legadas "Diária" → HÁBITO: ${habits.length} a criar (já migradas: ${habitRows.rows.length - habits.length})`);
for (const r of habits) {
  console.log(`  meta #${r.id} [${r.category ?? "—"}] "${r.title}" · alvo ${r.target_value} · ${r.logs} logs (soma ${r.log_total}) → hábito + ${r.logs} dias`);
}
console.log(`\nmetas legadas outras frequências → META: ${goals.length}`);
for (const r of goals) {
  const current = Number(r.log_total) > 0 ? r.log_total : r.legacy_current;
  const flag = FORCE_AS_GOAL.has(Number(r.id)) ? " [forçado]" : "";
  console.log(`  meta #${r.id} [${r.category ?? "—"}] "${r.title}" (${r.frequency}${flag}) · alvo ${r.target_value} · current=${current}`);
}
console.log(`\nplano da semana → PLANEJAMENTO: ${plans.length} a criar (já migrados: ${planRows.rows.length - plans.length})`);
for (const r of plans) {
  console.log(`  plano #${r.id} [${r.category ?? "—"}] "${r.title}" · ${isoDate(r.plan_date)}${r.completed_at ? " · concluída" : ""}`);
}

if (!APPLY) {
  console.log("\nNada foi escrito. Revise o plano e rode com --apply para gravar.\n");
  await client.end();
  process.exit(0);
}
// ── 3. Gravação (idempotente) ────────────────────────────────────────────────
await client.query("begin");
try {
  // 3.1 metas "Diária" → hábitos (template diário), com chave de dedupe.
  await client.query(
    `insert into profile_daily_tasks (profile_id, title, category_id, is_active, sort_order, migrated_from_goal_id)
     select g.profile_id, g.title, g.category_id, true,
            coalesce((select max(p.sort_order) + 1 from profile_daily_tasks p where p.profile_id = g.profile_id), 0),
            g.id
       from goals g
      where g.frequency = 'daily'
        and g.category_id is not null
        and not (g.id = any($1::bigint[]))
        and not exists (select 1 from profile_daily_tasks p where p.migrated_from_goal_id = g.id)`,
    [[...FORCE_AS_GOAL]],
  );
  // 3.2 histórico: goal_logs → daily_task_log (feito = amount > 0).
  await client.query(
    `insert into daily_task_log (task_id, log_date, is_completed, completed_at)
     select p.id, gl.log_date, gl.amount > 0, coalesce(gl.created_at, now())
       from goals g
       join profile_daily_tasks p on p.migrated_from_goal_id = g.id
       join goal_logs gl on gl.goal_id = g.id
      on conflict (task_id, log_date) do nothing`,
  );
  // 3.3 metas "Diária" marcadas (a linha legada continua existindo).
  await client.query(
    `update goals set migrated_at = now(), migrated_to = 'habit'
      where frequency = 'daily' and migrated_at is null and not (id = any($1::bigint[]))`,
    [[...FORCE_AS_GOAL]],
  );

  // 3.4 outras frequências → metas; current = progresso antigo (flag "concluído" ignorada).
  await client.query(
    `update goals g
        set current_value = coalesce((select sum(gl.amount) from goal_logs gl where gl.goal_id = g.id),
                                     g.current_value, 0),
            migrated_at = now(),
            migrated_to = 'goal'
      where (g.frequency is distinct from 'daily' or g.id = any($1::bigint[]))
        and g.migrated_at is null`,
    [[...FORCE_AS_GOAL]],
  );

  // 3.5 plano da semana → planner_items (1 doc por item) + conclusões.
  await client.query(
    `insert into planner_items (profile_id, title, category_id, kind, date, time, all_day,
                                recurrence_type, skipped_dates, migrated_from_plan_id)
     select w.profile_id, w.title, w.category_id, 'task', w.plan_date, null, true,
            'none', '{}'::date[], w.id
       from weekly_plans w
      where w.category_id is not null
        and not exists (select 1 from planner_items pi where pi.migrated_from_plan_id = w.id)`,
  );
  await client.query(
    `insert into planner_completions (item_id, profile_id, completed_date, completed_at)
     select pi.id, pi.profile_id, w.plan_date, coalesce(w.completed_at, now())
       from weekly_plans w
       join planner_items pi on pi.migrated_from_plan_id = w.id
      where w.completed_at is not null
      on conflict (item_id, completed_date) do nothing`,
  );
  await client.query(
    `update weekly_plans w set migrated_at = now(), migrated_to = 'planner_item'
      where w.migrated_at is null
        and exists (select 1 from planner_items pi where pi.migrated_from_plan_id = w.id)`,
  );

  await client.query("commit");
  console.log("\nMigração aplicada com sucesso.\n");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Falhou — nada foi gravado (rollback).", error);
  process.exitCode = 1;
} finally {
  await client.end();
}