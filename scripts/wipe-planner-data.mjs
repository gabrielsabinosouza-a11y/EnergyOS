/**
 * Limpeza única dos dados do Planejamento (weekly plans).
 *
 * Remove APENAS as tabelas do planner:
 *   - weekly_plan_occurrences (estado por ocorrência)
 *   - weekly_plan_series      (séries recorrentes)
 *   - weekly_plans            (planos avulsos)
 *
 * Preserva xp_ledger, user_xp, user_settings (XP/moedas) e todos os demais
 * recursos (tarefas, missões, kanban, pomodoro, hábitos, grupos...).
 *
 * Segurança:
 *   - exige CONFIRM_WIPE_PLANNER=true (sem isso o script não faz nada);
 *   - exige confirmação do host (PLANNER_WIPE_EXPECTED_HOST) quando ela é
 *     informada — evita apagar o banco errado;
 *   - `--dry-run` apenas mostra as contagens, sem apagar nada.
 *
 * Uso:
 *   npm run db:wipe-planner -- --dry-run
 *   CONFIRM_WIPE_PLANNER=true PLANNER_WIPE_EXPECTED_HOST=ep-xxx.neon.tech npm run db:wipe-planner
 *
 * Variáveis:
 *   CONFIRM_WIPE_PLANNER       precisa ser exatamente "true"
 *   PLANNER_WIPE_EXPECTED_HOST host esperado do banco (opcional, recomendado)
 *   PLANNER_WIPE_DATABASE_URL  conexão alvo (padrão: DATABASE_URL do ambiente)
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

/** Tabelas do Planejamento — as únicas que são apagadas. */
const TABLES = ["weekly_plan_occurrences", "weekly_plan_series", "weekly_plans"];

async function resolveDatabaseUrl() {
  if (process.env.PLANNER_WIPE_DATABASE_URL) return process.env.PLANNER_WIPE_DATABASE_URL.trim();
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

const dryRun = process.argv.includes("--dry-run") || process.env.PLANNER_WIPE_DRY_RUN === "true";

// O dry-run é somente leitura, então não exige a flag destrutiva.
if (!dryRun && process.env.CONFIRM_WIPE_PLANNER !== "true") {
  console.error("Abortando: defina CONFIRM_WIPE_PLANNER=true para apagar os dados do Planejamento.");
  console.error("  Preview:      npm run db:wipe-planner -- --dry-run");
  console.error("  Execução:     CONFIRM_WIPE_PLANNER=true PLANNER_WIPE_EXPECTED_HOST=<host> npm run db:wipe-planner");
  process.exit(1);
}

const connectionString = await resolveDatabaseUrl();
if (!connectionString) {
  console.error("Conexão não encontrada: defina PLANNER_WIPE_DATABASE_URL ou DATABASE_URL.");
  process.exit(1);
}

const databaseUrl = new URL(connectionString);
const expectedHost = process.env.PLANNER_WIPE_EXPECTED_HOST?.trim();
if (expectedHost && databaseUrl.hostname !== expectedHost) {
  console.error(`Abortando: o host ${databaseUrl.hostname} não corresponde ao host confirmado ${expectedHost}.`);
  process.exit(1);
}
const databaseName = databaseUrl.pathname.replace(/^\//, "") || "postgres";
console.log(`Destino: ${databaseUrl.hostname}/${databaseName}`);
if (dryRun) console.log("Modo: --dry-run (nada será apagado).");

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.DATABASE_SSL_STRICT === "true" || process.env.NODE_ENV === "production";

const pool = new pg.Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: sslStrict } : undefined,
});

async function countRows(client, table) {
  const result = await client.query(`select count(*)::text as count from public.${table}`);
  return Number(result.rows[0].count);
}

try {
  const client = await pool.connect();
  try {
    const present = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1::text[])`,
      [TABLES],
    );
    const presentTables = new Set(present.rows.map(({ table_name }) => table_name));
    const missingTables = TABLES.filter((table) => !presentTables.has(table));
    if (missingTables.length) {
      throw new Error(`Tabelas esperadas não encontradas: ${missingTables.join(", ")}. Nada foi apagado.`);
    }

    console.log("\nTabelas que serão afetadas (linhas antes):");
    let total = 0;
    for (const table of TABLES) {
      const count = await countRows(client, table);
      total += count;
      console.log(`  ${table}: ${count}`);
    }
    console.log(`  total: ${total}`);

    const rewards = await client.query(
      `select source, count(*)::text as count, coalesce(sum(xp_amount), 0)::text as xp
       from public.xp_ledger
       where source in ('weekly_plan', 'weekly_plan_occurrence')
       group by source order by source`,
    );
    console.log("\nRecompensas do Planejamento no xp_ledger (PRESERVADAS — não são revertidas):");
    if (!rewards.rows.length) console.log("  nenhuma");
    for (const row of rewards.rows) {
      console.log(`  ${row.source}: ${row.count} entradas, ${row.xp} XP`);
    }

    if (dryRun) {
      console.log("\nDry-run concluído: nenhuma linha foi apagada.");
    } else {
      await client.query("begin");
      try {
        console.log("\nLinhas removidas:");
        for (const table of TABLES) {
          const result = await client.query(`delete from public.${table}`);
          console.log(`  ${table}: ${result.rowCount ?? 0}`);
        }
        await client.query("commit");
        console.log("\nLimpeza concluída (commit).");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      }

      console.log("\nTabelas afetadas (depois):");
      for (const table of TABLES) {
        console.log(`  ${table}: ${await countRows(client, table)}`);
      }
    }
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Falha na limpeza do Planejamento:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
