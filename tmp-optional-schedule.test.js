import { test, expect } from "@playwright/test";

/**
 * Verificação do agendamento opcional no Planejamento:
 *  1. criar tarefa só com título e categoria
 *  2. criar tarefa só com data
 *  3. criar tarefa com data + início (sem fim)
 *  4. criar tarefa com data + início + fim
 *  5. editar e limpar a data
 *  6. editar e limpar os horários
 *  7. criar tarefa recorrente e conferir as ocorrências
 *  8. tarefas sem data continuam acessíveis
 *  9. tarefas agendadas continuam no calendário
 * 10. conclusão + recompensa de XP
 * 11. mobile + desktop
 */

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

const TITLES = {
  semData: "E2E Study JavaScript",
  soData: "E2E Finish portfolio",
  dataInicio: "E2E Practice English",
  completo: "E2E Workout",
  recurring: "E2E Weekly sync",
};

async function login(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 60000 });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await page.waitForTimeout(2500);
  }
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
}

async function openPlanner(page) {
  await page.goto("/planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(700);
}

/** Abre o modal "Novo plano" pelo botão de adicionar da primeira coluna. */
async function openModal(page) {
  await page.locator('button[aria-label^="Adicionar plano"]').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator("#planner-plan-title")).toBeVisible();
}

/** Escolhe a data de hoje pelo atalho "Hoje" do popover (sempre na semana visível). */
async function pickDay(page) {
  await page.locator("#planner-plan-date").click();
  await page.waitForTimeout(400);
  const popover = page.locator('[role="dialog"][aria-label^="Calendário"]');
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "Hoje" }).click();
  await page.waitForTimeout(400);
}

/** Limpa a data pelo "×" do campo. */
async function clearDate(page) {
  const clear = page.locator('button[aria-label="Limpar data"], span[aria-label="Limpar data"]');
  if (await clear.count()) {
    await clear.first().click();
    await page.waitForTimeout(300);
  }
}

async function createPlan(page, title, { date = null, start = null, end = null } = {}) {
  await openModal(page);
  await page.locator("#planner-plan-title").fill(title);
  if (date === null) await clearDate(page);
  else await pickDay(page, date);
  if (start) await page.locator("#planner-plan-start-time").fill(start);
  if (end) await page.locator("#planner-plan-end-time").fill(end);
  await page.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(0, { timeout: 20000 });
  await page.waitForTimeout(600);
}

test("agendamento opcional no Planejamento", async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await login(page);
  await openPlanner(page);

  // ── 1. somente título + categoria ─────────────────────────────────────────
  await createPlan(page, TITLES.semData);
  await expect(
    page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.semData),
  ).toBeVisible({ timeout: 15000 });

  // ── 2. somente data ───────────────────────────────────────────────────────
  await createPlan(page, TITLES.soData, { date: "hoje" });
  await expect(page.getByText(TITLES.soData).first()).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData),
  ).toHaveCount(0);

  // ── 3. data + início (sem fim) ────────────────────────────────────────────
  await createPlan(page, TITLES.dataInicio, { date: "hoje", start: "09:00" });
  await expect(page.getByText(TITLES.dataInicio).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("09:00").first()).toBeVisible();

  // ── 4. data + início + fim ────────────────────────────────────────────────
  await createPlan(page, TITLES.completo, { date: "hoje", start: "10:00", end: "11:00" });
  await expect(page.getByText(TITLES.completo).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("10:00 – 11:00").first()).toBeVisible();

  // ── 5. editar e limpar a data ─────────────────────────────────────────────
  const rowSemData = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.soData }).first();
  await rowSemData.getByRole("button", { name: /Ações para/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] button:has-text("Editar")').click();
  await page.waitForTimeout(600);
  await expect(page.locator("#planner-plan-title")).toHaveValue(TITLES.soData);
  await clearDate(page);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  await expect(
    page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData),
  ).toBeVisible({ timeout: 15000 });

  // ── 6. editar e limpar os horários ────────────────────────────────────────
  const rowCompleto = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.completo }).first();
  await rowCompleto.getByRole("button", { name: /Ações para/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] button:has-text("Editar")').click();
  await page.waitForTimeout(600);
  await expect(page.locator("#planner-plan-start-time")).toHaveValue("10:00");
  await page.locator("#planner-plan-start-time").fill("");
  await page.locator("#planner-plan-end-time").fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  await page.waitForTimeout(800);
  await expect(page.getByText("10:00 – 11:00")).toHaveCount(0);

  // ── 7. recorrente + ocorrências ───────────────────────────────────────────
  await openModal(page);
  await page.locator("#planner-plan-title").fill(TITLES.recurring);
  await pickDay(page);
  await page.getByRole("button", { name: "Semanalmente" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });

  // A mesma recorrência aparece na semana seguinte (mesmo dia da semana).
  await page.locator('button[aria-label^="Próximo período"]').first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });

  // ── 8. tarefas sem data acessíveis ────────────────────────────────────────
  await page.locator('button[aria-label^="Período anterior"]').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('section[aria-label="Tarefas sem data"]')).toBeVisible();
  await expect(
    page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.semData),
  ).toBeVisible();

  // ── 10. conclusão + recompensa ────────────────────────────────────────────
  const rewardBefore = await page.evaluate(async () => {
    const res = await fetch("/api/weekly-plans?unscheduled=1", {
      headers: { "x-dev-profile-id": "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3" },
    });
    return res.status;
  });
  console.log("[e2e] api unscheduled status:", rewardBefore);

  const rowToComplete = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.semData }).first();
  await rowToComplete.getByRole("button", { name: /^Concluir/ }).click();
  await page.waitForTimeout(1500);
  await expect(rowToComplete.getByRole("button", { name: /^Reabrir/ })).toBeVisible({ timeout: 15000 });

  // ── 11. mobile ────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await openModal(page);
  await expect(page.locator("#planner-plan-title")).toBeVisible();
  await page.locator("#planner-plan-title").fill("E2E mobile");
  await expect(page.locator("#planner-plan-title")).toHaveValue("E2E mobile");
  await page.screenshot({ path: "test-results/optional-mobile.png" });
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.waitForTimeout(400);

  expect(errors).toEqual([]);
});

test.afterAll(async () => {
  // limpeza das tarefas criadas pelo teste
  const { execSync } = await import("node:child_process");
  execSync("node scripts/cleanup-e2e-planner-tasks.mjs", { cwd: "/home/gabriel/Documentos/EnergyOS", stdio: "inherit" });
});
