#!/usr/bin/env node
/**
 * Migration: recap status (parcial/final) + uniqueness guard + dedup.
 *
 *   DATABASE_URL=... node scripts/migrate-recap-status.mjs
 *
 * 1. Garante unicidade de (profile_id, recap_month) via constraint/índice único,
 *    removendo duplicatas exatas (mantém a linha mais recentemente gerada).
 * 2. Adiciona coluna `status` ('parcial' | 'final') com CHECK constraint.
 * 3. Backfill: meses encerrados -> 'final'; mês corrente -> 'parcial'.
 *
 * Não apaga recaps exceto duplicatas exatas (userId, year, month); ao mesclar
 * duplicatas mantém o registro mais recentemente calculado.
 */

// Load .env.local / .env BEFORE anything reads DATABASE_URL.
import { readFileSync } from "node:fs";
for (const envFile of [".env.local", ".env"]) {
  try {
    const content = readFileSync(envFile, "utf8");
    for (const line of content.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // arquivo opcional
  }
}

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Data de hoje (YYYY-MM-DD) no fuso oficial do produto (America/Sao_Paulo).
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 0. Diagnóstico: duplicatas existentes (profile_id, recap_month) ──
    const dupsBefore = await client.query(
      `select profile_id, recap_month, count(*)::text as c
       from monthly_recaps
       group by profile_id, recap_month
       having count(*) > 1
       order by profile_id, recap_month`
    );
    console.log(`Duplicatas antes: ${dupsBefore.rows.length}`);
    for (const d of dupsBefore.rows) {
      console.log(`  ${d.profile_id} ${d.recap_month} -> ${d.c} linhas`);
    }

    // ── 1. Remover duplicatas exatas, mantendo a mais recentemente gerada ──
    // Empate em generated_at: mantém o maior id.
    await client.query(`
      delete from monthly_recaps m
      using monthly_recaps m2
      where m.profile_id = m2.profile_id
        and m.recap_month = m2.recap_month
        and (
          m2.generated_at > m.generated_at
          or (m2.generated_at = m.generated_at and m2.id > m.id)
        )
    `);

    const dupsAfter = await client.query(
      `select count(*)::text as c from monthly_recaps
       group by profile_id, recap_month having count(*) > 1`
    );
    console.log(`Duplicatas restantes: ${dupsAfter.rows.length}`);

    // ── 2. Garantir índice/constraint único (profile_id, recap_month) ──
    const hasUnique = await client.query(
      `select exists (
        select 1 from pg_constraint
        where conrelid = 'monthly_recaps'::regclass
          and conname = 'monthly_recaps_profile_id_recap_month_key'
          and contype = 'u'
      ) as exists`
    );
    if (!hasUnique.rows[0]?.exists) {
      await client.query(`
        alter table monthly_recaps
          add constraint monthly_recaps_profile_id_recap_month_key
          unique (profile_id, recap_month)
      `);
      console.log("Constraint unique (profile_id, recap_month) criada.");
    } else {
      console.log("Constraint unique (profile_id, recap_month) já existe.");
    }

    // ── 3. Coluna status ('parcial' | 'final') ──
    await client.query(`
      alter table monthly_recaps
        add column if not exists status text not null default 'parcial'
    `);

    const hasCheck = await client.query(
      `select exists (
        select 1 from pg_constraint
        where conrelid = 'monthly_recaps'::regclass
          and conname = 'monthly_recaps_status_check'
          and contype = 'c'
      ) as exists`
    );
    if (!hasCheck.rows[0]?.exists) {
      await client.query(`
        alter table monthly_recaps
          add constraint monthly_recaps_status_check
          check (status in ('parcial', 'final'))
      `);
      console.log("Check constraint monthly_recaps_status_check criada.");
    } else {
      console.log("Check constraint monthly_recaps_status_check já existe.");
    }

    // ── 4. Backfill de status ──
    // Mês corrente em America/Sao_Paulo.
    const currentMonth = todayIso().slice(0, 7) + "-01";
    const backfill = await client.query(
      `update monthly_recaps
        set status = case
          when recap_month < $1::date then 'final'
          else 'parcial'
        end
        where status is null or status = 'parcial'`,
      [currentMonth]
    );
    console.log(`Backfill status: ${backfill.rowCount} linhas atualizadas (mês corrente = ${currentMonth}).`);

    // ── 5. Resultado ──
    const statuses = await client.query(
      `select status, count(*)::text as c from monthly_recaps group by status order by status`
    );
    console.log("Status após migração:", statuses.rows.map((r) => `${r.status}: ${r.c}`).join(" | ") || "—");

    await client.query("COMMIT");
    console.log("\nMigração concluída com sucesso.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migração falhou:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
