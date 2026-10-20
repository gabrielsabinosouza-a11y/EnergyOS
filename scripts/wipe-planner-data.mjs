/**
 * Removes planner definitions and per-occurrence state only.
 * Preserves xp_ledger, user_xp, user_settings, and all other feature data.
 *
 * Run with an explicit direct connection and matching host confirmation:
 * CONFIRM_WIPE_PLANNER=true PLANNER_WIPE_DATABASE_URL=... \
 *   PLANNER_WIPE_EXPECTED_HOST=... npm run db:wipe-planner
 */
import pg from "pg";

const tables = ["weekly_plan_occurrences", "weekly_plan_series", "weekly_plans"];

if (process.env.CONFIRM_WIPE_PLANNER !== "true") {
  console.error("Abortando: defina CONFIRM_WIPE_PLANNER=true para apagar os dados do Planejamento.");
  console.error("  CONFIRM_WIPE_PLANNER=true PLANNER_WIPE_DATABASE_URL=... PLANNER_WIPE_EXPECTED_HOST=... npm run db:wipe-planner");
  process.exit(1);
}

const connectionString = process.env.PLANNER_WIPE_DATABASE_URL;
const expectedHost = process.env.PLANNER_WIPE_EXPECTED_HOST;
if (!connectionString || !expectedHost) {
  console.error("Defina PLANNER_WIPE_DATABASE_URL e PLANNER_WIPE_EXPECTED_HOST para escolher o destino explicitamente.");
  process.exit(1);
}

const databaseUrl = new URL(connectionString);
if (databaseUrl.hostname !== expectedHost) {
  console.error(`Abortando: o host ${databaseUrl.hostname} não corresponde ao host confirmado ${expectedHost}.`);
  process.exit(1);
}
console.log(`Destino verificado: ${databaseUrl.hostname}/${databaseUrl.pathname.replace(/^\//, "")}`);

const pool = new pg.Pool({
  connectionString,
  ssl: /neon\.tech/.test(connectionString)
    ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === "true" || process.env.NODE_ENV === "production" }
    : undefined,
});

try {
  const client = await pool.connect();
  try {
    const present = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1::text[])`,
      [tables],
    );
    const presentTables = new Set(present.rows.map(({ table_name }) => table_name));
    const missingTables = tables.filter((table) => !presentTables.has(table));
    if (missingTables.length) {
      throw new Error(`Tabelas esperadas não encontradas: ${missingTables.join(", ")}. Nada foi apagado.`);
    }

    console.log("Tabelas afetadas (antes):");
    for (const table of tables) {
      const result = await client.query(`select count(*)::text as count from public.${table}`);
      console.log(`  ${table}: ${result.rows[0].count}`);
    }
    const rewards = await client.query(
      `select count(*)::text as count from public.xp_ledger
       where source in ('weekly_plan', 'weekly_plan_occurrence')`,
    );
    console.log(`  xp_ledger (preservado; recompensas do Planejamento): ${rewards.rows[0].count}`);

    await client.query("begin");
    try {
      for (const table of tables) {
        const result = await client.query(`delete from public.${table}`);
        console.log(`  removidas de ${table}: ${result.rowCount ?? 0}`);
      }
      await client.query("commit");
      console.log("Limpeza concluída.");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    console.log("Tabelas afetadas (depois):");
    for (const table of tables) {
      const result = await client.query(`select count(*)::text as count from public.${table}`);
      console.log(`  ${table}: ${result.rows[0].count}`);
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
