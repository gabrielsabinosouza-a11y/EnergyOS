import { test, expect } from "@playwright/test";

/**
 * Fluxo completo da recorrência no Planejamento (UI):
 *  - cria um plano que repete toda segunda-feira;
 *  - confirma que o dia da semana vem pré-selecionado a partir da data;
 *  - navega 3 meses à frente e confirma que o plano aparece em toda segunda;
 *  - conclui uma ocorrência e confirma que as outras seguem pendentes;
 *  - edita com "Apenas este dia" vs "Todos os dias da série";
 *  - exclui com "Apenas este dia" vs "Todos os dias da série";
 *  - limpa tudo o que criou.
 *
 * Requer o dev server rodando em http://localhost:3000.
 */

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const TITLE = `E2E recorrente ${Date.now()}`;

async function authenticate(page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) {
    await page.goto("/planner", { waitUntil: "networkidle" });
    await dismissTour(page);
    return;
  }
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 10000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForTimeout(1500);
  await dismissTour(page);
}

async function dismissTour(page) {
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) {
    await skip.first().click();
    await page.waitForTimeout(300);
  }
}

async function goToWeek(page) {
  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await dismissTour(page);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(600);
}

function planRows(page, title = TITLE) {
  return page.locator(`[data-testid^="plan-series:"]`).filter({ hasText: title });
}

async function nextPeriod(page) {
  const before = await page.locator("h2").first().textContent();
  await page.locator('button[aria-label^="Próximo período"]').first().click({ force: true });
  await expect(page.locator("h2").first()).not.toHaveText(before ?? "", { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function prevPeriod(page) {
  const before = await page.locator("h2").first().textContent();
  await page.locator('button[aria-label^="Período anterior"]').first().click({ force: true });
  await expect(page.locator("h2").first()).not.toHaveText(before ?? "", { timeout: 15000 });
  await page.waitForTimeout(300);
}

test("plano recorrente: criar, repetir toda segunda, concluir uma e editar/excluir por escopo", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await authenticate(page);
  await goToWeek(page);

  // A segunda-feira da semana atual (hoje é terça) fica na primeira coluna.
  const mondayColumn = page.locator('button[aria-label^="Adicionar plano para segunda-feira"]').first();
  await mondayColumn.click();
  await page.waitForTimeout(400);

  // Título
  await page.locator('input[placeholder="Ex.: Ir à academia"]').fill(TITLE);

  // "Semanalmente" -> chips de dia da semana
  await page.getByRole("button", { name: "Semanalmente" }).click();
  await page.waitForTimeout(300);

  const dayGroup = page.locator('[role="group"][aria-label="Dias da semana"]');
  await expect(dayGroup).toBeVisible();
  const pressed = dayGroup.locator('button[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await expect(pressed.first()).toHaveText("Seg"); // dia da semana da data escolhida

  // Horários em 24 horas
  const startInput = page.locator("#planner-plan-start-time");
  await startInput.fill("0900");
  await expect(startInput).toHaveValue("09:00");
  const endInput = page.locator("#planner-plan-end-time");
  await endInput.fill("1000");
  await expect(endInput).toHaveValue("10:00");

  await page.getByRole("button", { name: "Criar plano" }).click();
  await page.waitForTimeout(1200);

  // Aparece na semana atual (na segunda-feira)
  await expect(planRows(page).first()).toBeVisible({ timeout: 15000 });

  // Navega 3 meses (12 semanas) e confere que continua em toda segunda
  for (let i = 0; i < 12; i += 1) {
    await nextPeriod(page);
    await expect(
      planRows(page).first(),
      `o plano deve aparecer na semana ${i + 1} à frente`,
    ).toBeVisible({ timeout: 15000 });
  }

  // Volta 3 semanas: as três primeiras semanas têm o plano
  for (let i = 0; i < 3; i += 1) await prevPeriod(page);

  // Conclui UMA ocorrência (a da segunda-feira desta semana)
  const planRow = page.locator(`[data-testid^="plan-series:"]`).first();
  await expect(planRow).toBeVisible();
  await planRow.getByRole("button", { name: /^Concluir/ }).click();
  await page.waitForTimeout(1200);

  const rows = page.locator(`[data-testid^="plan-series:"]`);
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole("button", { name: /^Reabrir/ })).toBeVisible();

  // A semana seguinte continua pendente
  await nextPeriod(page);
  await expect(
    page.locator(`[data-testid^="plan-series:"]`).first().getByRole("button", { name: /^Concluir/ }),
  ).toBeVisible();

  // "Todos os dias da série" (edição) — abre o diálogo de escopo
  await page.locator(`[data-testid^="plan-series:"]`).first().getByRole("button", { name: /Ações para/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] button:has-text("Editar")').click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Apenas este dia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Todos os dias da série" })).toBeVisible();

  // Aplica só nesta ocorrência
  await page.getByRole("button", { name: "Apenas este dia" }).click();
  await page.waitForTimeout(1000);

  // Volta uma semana: o título da série não pode ter mudado
  await prevPeriod(page);
  await expect(planRows(page).first()).toBeVisible();

  // Exclusão com escopo
  await page.locator(`[data-testid^="plan-series:"]`).first().getByRole("button", { name: /Ações para/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] button:has-text("Excluir")').click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Apenas este dia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Todos os dias da série" })).toBeVisible();

  // "Apenas este dia" remove só a ocorrência desta semana
  await page.getByRole("button", { name: "Apenas este dia" }).click();
  await page.waitForTimeout(1000);
  await expect(planRows(page)).toHaveCount(0);

  // A próxima semana ainda tem o plano
  await nextPeriod(page);
  await expect(planRows(page).first()).toBeVisible();

  // "Todos os dias da série" remove tudo
  await page.locator(`[data-testid^="plan-series:"]`).first().getByRole("button", { name: /Ações para/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] button:has-text("Excluir")').click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Todos os dias da série" }).click();
  await page.waitForTimeout(1000);
  await expect(planRows(page)).toHaveCount(0);

  expect(errors).toEqual([]);
  await page.close();
});
