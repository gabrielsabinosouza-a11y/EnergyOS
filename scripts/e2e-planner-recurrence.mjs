/**
 * Teste end-to-end da recorrência do Planejamento (camada de dados).
 *
 * Usa as funções reais do app (src/lib/db/weekly-plans-series.ts) contra o
 * banco configurado em DATABASE_URL, para um perfil de teste.
 *
 *   node --import tsx scripts/e2e-planner-recurrence.mjs
 *
 * Verifica:
 *  1. cria uma série semanal (toda segunda-feira);
 *  2. as ocorrências aparecem em TODA segunda de 3 meses à frente;
 *  3. concluir uma ocorrência NÃO conclui as outras (chave plano + data);
 *  4. re-concluir não recompensa de novo (anti-abuso);
 *  5. "Apenas este dia" (skip) remove só a ocorrência escolhida;
 *  6. "Todos os dias da série" remove a série inteira;
 *  7. o plano de teste é removido no final (nada fica no banco).
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(root, envFile), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // arquivo opcional
    }
  }
  return undefined;
}

const databaseUrl = await resolveDatabaseUrl();
if (!databaseUrl) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}
process.env.DATABASE_URL = databaseUrl;

const {
  createWeeklyPlanSeries,
  listWeeklyPlanOccurrences,
  listWeeklyPlanSeries,
  setOccurrenceCompleted,
  skipOccurrence,
  updateOccurrenceOverride,
  updateWeeklyPlanSeries,
  deleteWeeklyPlanSeries,
} = await import("../src/lib/db/weekly-plans-series.ts");

const PROFILE_ID = process.env.E2E_PROFILE_ID ?? "0e719da0-f486-469c-b27f-9b3b5612fb50";
const TITLE = `E2E plano recorrente ${Date.now()}`;

/** Segunda-feira da semana que contém a data (calendário local, sem UTC). */
function weekStart(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(y, m - 1, d - offset)).toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const firstMonday = weekStart(today);

let seriesId = null;

test("cria a série semanal de segunda-feira", async () => {
  const series = await createWeeklyPlanSeries(PROFILE_ID, {
    title: TITLE,
    repeatType: "weekly",
    repeatDays: [1],
    startDate: firstMonday,
    startTime: "09:00",
    durationMinutes: 60,
    endType: "never",
    timezone: "America/Sao_Paulo",
  });
  assert.equal(series.repeatType, "weekly");
  assert.deepEqual(series.repeatDays, [1]);
  assert.equal(series.startDate, firstMonday);
  seriesId = series.id;
});

test("a série aparece em toda segunda de 3 meses à frente", async () => {
  const seen = new Map();
  for (let i = 0; i < 14; i += 1) {
    const week = addDays(firstMonday, i * 7);
    const items = await listWeeklyPlanOccurrences(PROFILE_ID, week);
    for (const item of items) {
      if (item.title !== TITLE) continue;
      assert.equal(item.seriesId, seriesId);
      assert.equal(item.isRecurring, true);
      assert.equal(item.startTime, "09:00");
      seen.set(item.planDate, item);
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const monday = addDays(firstMonday, i * 7);
    assert.ok(seen.has(monday), `falta a ocorrência de ${monday}`);
    assert.equal(weekdayOf(monday), 1);
  }
  assert.equal(seen.size, 14);
});

test("a ocorrência não aparece antes da data inicial", async () => {
  const previous = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, -7));
  assert.equal(previous.filter((item) => item.title === TITLE).length, 0);
});

test("concluir uma ocorrência NÃO conclui as outras", async () => {
  const reward = await setOccurrenceCompleted(PROFILE_ID, seriesId, firstMonday, true);
  assert.ok(reward.xpAwarded > 0, "deve conceder XP");
  assert.ok(reward.coinsAwarded > 0, "deve conceder moedas");

  const week = await listWeeklyPlanOccurrences(PROFILE_ID, firstMonday);
  const inWeek = week.filter((item) => item.title === TITLE);
  assert.equal(inWeek.length, 1);
  assert.ok(inWeek[0].completedAt, "a ocorrência concluída deve estar marcada");

  const nextWeek = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, 7));
  const next = nextWeek.filter((item) => item.title === TITLE);
  assert.equal(next.length, 1);
  assert.equal(next[0].completedAt, null, "a próxima segunda NÃO pode estar concluída");
});

test("re-concluir a mesma ocorrência não recompensa de novo", async () => {
  const reward = await setOccurrenceCompleted(PROFILE_ID, seriesId, firstMonday, true);
  assert.equal(reward.xpAwarded, 0);
  assert.equal(reward.coinsAwarded, 0);
});

test("\"Apenas este dia\" (edição da ocorrência) não afeta a série", async () => {
  await updateOccurrenceOverride(PROFILE_ID, seriesId, firstMonday, { title: `${TITLE} (editado só aqui)` });
  const week = await listWeeklyPlanOccurrences(PROFILE_ID, firstMonday);
  const edited = week.find((item) => item.title.includes("(editado só aqui)"));
  assert.ok(edited, "a ocorrência deve ter o título sobrescrito");

  const nextWeek = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, 7));
  const next = nextWeek.filter((item) => item.title === TITLE);
  assert.equal(next.length, 1, "as outras ocorrências mantêm o título da série");
});

test("\"Todos os dias da série\" (edição da série) atualiza todas as ocorrências", async () => {
  await updateWeeklyPlanSeries(PROFILE_ID, seriesId, { title: `${TITLE} (série inteira)` });
  for (const offset of [0, 7, 14]) {
    const week = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, offset));
    const items = week.filter((item) => item.seriesId === seriesId);
    assert.equal(items.length, 1);
    // A ocorrência com título sobrescrito ("Apenas este dia") mantém o seu
    // próprio título; as demais seguem o título da série.
    const expected = offset === 0 ? `${TITLE} (editado só aqui)` : `${TITLE} (série inteira)`;
    assert.equal(items[0].title, expected);
  }
});

test("\"Apenas este dia\" (excluir) remove só a ocorrência escolhida", async () => {
  await skipOccurrence(PROFILE_ID, seriesId, firstMonday);
  const week = await listWeeklyPlanOccurrences(PROFILE_ID, firstMonday);
  assert.equal(week.filter((item) => item.seriesId === seriesId).length, 0);

  const nextWeek = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, 7));
  assert.equal(nextWeek.filter((item) => item.seriesId === seriesId).length, 1);
});

test("\"Todos os dias da série\" (excluir) remove a série inteira", async () => {
  await deleteWeeklyPlanSeries(PROFILE_ID, seriesId);
  const active = await listWeeklyPlanSeries(PROFILE_ID);
  assert.equal(active.filter((series) => series.id === seriesId).length, 0);

  for (const offset of [0, 7, 14]) {
    const week = await listWeeklyPlanOccurrences(PROFILE_ID, addDays(firstMonday, offset));
    assert.equal(week.filter((item) => item.seriesId === seriesId).length, 0);
  }
});

test("limpeza: o teste não deixa lixo no banco", async () => {
  const { default: pool } = await import("../src/lib/db.ts");
  await pool.query("delete from weekly_plan_occurrences where series_id = $1", [seriesId]);
  await pool.query("delete from weekly_plan_series where id = $1", [seriesId]);
  // A recompensa da ocorrência concluída também sai: ela aponta para um plano
  // que não existe mais.
  await pool.query(
    "delete from xp_ledger where source = 'weekly_plan_occurrence' and source_id = $1",
    [`${seriesId}:${firstMonday}`],
  );
  const leftovers = await pool.query(
    "select count(*)::int as count from weekly_plan_series where title like $1",
    ["E2E plano recorrente%"],
  );
  assert.equal(leftovers.rows[0].count, 0);
  await pool.end();
});
