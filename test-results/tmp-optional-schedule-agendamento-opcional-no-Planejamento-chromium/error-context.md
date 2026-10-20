# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tmp-optional-schedule.test.js >> agendamento opcional no Planejamento
- Location: tmp-optional-schedule.test.js:87:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('section[aria-label="Tarefas sem data"]').getByText('E2E Study JavaScript')
Expected: visible
Error: strict mode violation: locator('section[aria-label="Tarefas sem data"]').getByText('E2E Study JavaScript') resolved to 2 elements:
    1) <button type="button" title="E2E Study JavaScript" class="min-w-0 flex-1 truncate text-left text-xs font-medium focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] text-[var(--text)]">E2E Study JavaScript</button> aka getByTestId('plan-plan:64').getByRole('button', { name: 'E2E Study JavaScript', exact: true })
    2) <button type="button" title="E2E Study JavaScript" class="min-w-0 flex-1 truncate text-left text-xs font-medium focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] text-[var(--text)]">E2E Study JavaScript</button> aka getByTestId('plan-plan:60').getByRole('button', { name: 'E2E Study JavaScript', exact: true })

Call log:
  - Expect "toBeVisible" locator('section[aria-label="Tarefas sem data"]').getByText('E2E Study JavaScript') with timeout 15000ms
  - waiting for locator('section[aria-label="Tarefas sem data"]').getByText('E2E Study JavaScript')

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Verificação do agendamento opcional no Planejamento:
  5   |  *  1. criar tarefa só com título e categoria
  6   |  *  2. criar tarefa só com data
  7   |  *  3. criar tarefa com data + início (sem fim)
  8   |  *  4. criar tarefa com data + início + fim
  9   |  *  5. editar e limpar a data
  10  |  *  6. editar e limpar os horários
  11  |  *  7. criar tarefa recorrente e conferir as ocorrências
  12  |  *  8. tarefas sem data continuam acessíveis
  13  |  *  9. tarefas agendadas continuam no calendário
  14  |  * 10. conclusão + recompensa de XP
  15  |  * 11. mobile + desktop
  16  |  */
  17  | 
  18  | const EMAIL = "e2e.planner@energyos.test";
  19  | const PASS = "Planner123!";
  20  | 
  21  | const TITLES = {
  22  |   semData: "E2E Study JavaScript",
  23  |   soData: "E2E Finish portfolio",
  24  |   dataInicio: "E2E Practice English",
  25  |   completo: "E2E Workout",
  26  |   recurring: "E2E Weekly sync",
  27  | };
  28  | 
  29  | async function login(page) {
  30  |   await page.goto("/login", { waitUntil: "domcontentloaded" });
  31  |   if (page.url().includes("/login")) {
  32  |     await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 60000 });
  33  |     await page.locator('input[type="email"]').fill(EMAIL);
  34  |     await page.locator('input[type="password"]').fill(PASS);
  35  |     await page.getByRole("button", { name: /Entrar/ }).click();
  36  |     await page.waitForTimeout(2500);
  37  |   }
  38  |   const skip = page.locator('button:has-text("Pular tour")');
  39  |   if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
  40  | }
  41  | 
  42  | async function openPlanner(page) {
  43  |   await page.goto("/planner", { waitUntil: "domcontentloaded" });
  44  |   await page.waitForTimeout(1200);
  45  |   await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  46  |   await page.waitForTimeout(700);
  47  | }
  48  | 
  49  | /** Abre o modal "Novo plano" pelo botão de adicionar da primeira coluna. */
  50  | async function openModal(page) {
  51  |   await page.locator('button[aria-label^="Adicionar plano"]').first().click();
  52  |   await page.waitForTimeout(500);
  53  |   await expect(page.locator("#planner-plan-title")).toBeVisible();
  54  | }
  55  | 
  56  | /** Escolhe a data de hoje pelo atalho "Hoje" do popover (sempre na semana visível). */
  57  | async function pickDay(page) {
  58  |   await page.locator("#planner-plan-date").click();
  59  |   await page.waitForTimeout(400);
  60  |   const popover = page.locator('[role="dialog"][aria-label^="Calendário"]');
  61  |   await expect(popover).toBeVisible();
  62  |   await popover.getByRole("button", { name: "Hoje" }).click();
  63  |   await page.waitForTimeout(400);
  64  | }
  65  | 
  66  | /** Limpa a data pelo "×" do campo. */
  67  | async function clearDate(page) {
  68  |   const clear = page.locator('button[aria-label="Limpar data"], span[aria-label="Limpar data"]');
  69  |   if (await clear.count()) {
  70  |     await clear.first().click();
  71  |     await page.waitForTimeout(300);
  72  |   }
  73  | }
  74  | 
  75  | async function createPlan(page, title, { date = null, start = null, end = null } = {}) {
  76  |   await openModal(page);
  77  |   await page.locator("#planner-plan-title").fill(title);
  78  |   if (date === null) await clearDate(page);
  79  |   else await pickDay(page, date);
  80  |   if (start) await page.locator("#planner-plan-start-time").fill(start);
  81  |   if (end) await page.locator("#planner-plan-end-time").fill(end);
  82  |   await page.getByRole("button", { name: "Criar plano" }).click();
  83  |   await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(0, { timeout: 20000 });
  84  |   await page.waitForTimeout(600);
  85  | }
  86  | 
  87  | test("agendamento opcional no Planejamento", async ({ page }) => {
  88  |   test.setTimeout(300000);
  89  |   const errors = [];
  90  |   page.on("pageerror", (e) => errors.push(e.message));
  91  | 
  92  |   await login(page);
  93  |   await openPlanner(page);
  94  | 
  95  |   // ── 1. somente título + categoria ─────────────────────────────────────────
  96  |   await createPlan(page, TITLES.semData);
  97  |   await expect(
  98  |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.semData),
> 99  |   ).toBeVisible({ timeout: 15000 });
      |     ^ Error: expect(locator).toBeVisible() failed
  100 | 
  101 |   // ── 2. somente data ───────────────────────────────────────────────────────
  102 |   await createPlan(page, TITLES.soData, { date: "hoje" });
  103 |   await expect(page.getByText(TITLES.soData).first()).toBeVisible({ timeout: 15000 });
  104 |   await expect(
  105 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData),
  106 |   ).toHaveCount(0);
  107 | 
  108 |   // ── 3. data + início (sem fim) ────────────────────────────────────────────
  109 |   await createPlan(page, TITLES.dataInicio, { date: "hoje", start: "09:00" });
  110 |   await expect(page.getByText(TITLES.dataInicio).first()).toBeVisible({ timeout: 15000 });
  111 |   await expect(page.getByText("09:00").first()).toBeVisible();
  112 | 
  113 |   // ── 4. data + início + fim ────────────────────────────────────────────────
  114 |   await createPlan(page, TITLES.completo, { date: "hoje", start: "10:00", end: "11:00" });
  115 |   await expect(page.getByText(TITLES.completo).first()).toBeVisible({ timeout: 15000 });
  116 |   await expect(page.getByText("10:00 – 11:00").first()).toBeVisible();
  117 | 
  118 |   // ── 5. editar e limpar a data ─────────────────────────────────────────────
  119 |   const rowSemData = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.soData }).first();
  120 |   await rowSemData.getByRole("button", { name: /Ações para/ }).click();
  121 |   await page.waitForTimeout(300);
  122 |   await page.locator('[role="menu"] button:has-text("Editar")').click();
  123 |   await page.waitForTimeout(600);
  124 |   await expect(page.locator("#planner-plan-title")).toHaveValue(TITLES.soData);
  125 |   await clearDate(page);
  126 |   await page.getByRole("button", { name: "Salvar alterações" }).click();
  127 |   await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  128 |   await expect(
  129 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData),
  130 |   ).toBeVisible({ timeout: 15000 });
  131 | 
  132 |   // ── 6. editar e limpar os horários ────────────────────────────────────────
  133 |   const rowCompleto = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.completo }).first();
  134 |   await rowCompleto.getByRole("button", { name: /Ações para/ }).click();
  135 |   await page.waitForTimeout(300);
  136 |   await page.locator('[role="menu"] button:has-text("Editar")').click();
  137 |   await page.waitForTimeout(600);
  138 |   await expect(page.locator("#planner-plan-start-time")).toHaveValue("10:00");
  139 |   await page.locator("#planner-plan-start-time").fill("");
  140 |   await page.locator("#planner-plan-end-time").fill("");
  141 |   await page.getByRole("button", { name: "Salvar alterações" }).click();
  142 |   await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  143 |   await page.waitForTimeout(800);
  144 |   await expect(page.getByText("10:00 – 11:00")).toHaveCount(0);
  145 | 
  146 |   // ── 7. recorrente + ocorrências ───────────────────────────────────────────
  147 |   await openModal(page);
  148 |   await page.locator("#planner-plan-title").fill(TITLES.recurring);
  149 |   await pickDay(page);
  150 |   await page.getByRole("button", { name: "Semanalmente" }).click();
  151 |   await page.waitForTimeout(300);
  152 |   await page.getByRole("button", { name: "Criar plano" }).click();
  153 |   await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(0, { timeout: 20000 });
  154 |   await expect(page.getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });
  155 | 
  156 |   // A mesma recorrência aparece na semana seguinte (mesmo dia da semana).
  157 |   await page.locator('button[aria-label^="Próximo período"]').first().click();
  158 |   await page.waitForTimeout(1200);
  159 |   await expect(page.getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });
  160 | 
  161 |   // ── 8. tarefas sem data acessíveis ────────────────────────────────────────
  162 |   await page.locator('button[aria-label^="Período anterior"]').first().click();
  163 |   await page.waitForTimeout(1000);
  164 |   await expect(page.locator('section[aria-label="Tarefas sem data"]')).toBeVisible();
  165 |   await expect(
  166 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.semData),
  167 |   ).toBeVisible();
  168 | 
  169 |   // ── 10. conclusão + recompensa ────────────────────────────────────────────
  170 |   const rewardBefore = await page.evaluate(async () => {
  171 |     const res = await fetch("/api/weekly-plans?unscheduled=1", {
  172 |       headers: { "x-dev-profile-id": "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3" },
  173 |     });
  174 |     return res.status;
  175 |   });
  176 |   console.log("[e2e] api unscheduled status:", rewardBefore);
  177 | 
  178 |   const rowToComplete = page.locator(`[data-testid^="plan:"]`).filter({ hasText: TITLES.semData }).first();
  179 |   await rowToComplete.getByRole("button", { name: /^Concluir/ }).click();
  180 |   await page.waitForTimeout(1500);
  181 |   await expect(rowToComplete.getByRole("button", { name: /^Reabrir/ })).toBeVisible({ timeout: 15000 });
  182 | 
  183 |   // ── 11. mobile ────────────────────────────────────────────────────────────
  184 |   await page.setViewportSize({ width: 390, height: 844 });
  185 |   await page.waitForTimeout(800);
  186 |   await openModal(page);
  187 |   await expect(page.locator("#planner-plan-title")).toBeVisible();
  188 |   await page.locator("#planner-plan-title").fill("E2E mobile");
  189 |   await expect(page.locator("#planner-plan-title")).toHaveValue("E2E mobile");
  190 |   await page.screenshot({ path: "test-results/optional-mobile.png" });
  191 |   await page.getByRole("button", { name: "Cancelar" }).click();
  192 |   await page.waitForTimeout(400);
  193 | 
  194 |   expect(errors).toEqual([]);
  195 | });
  196 | 
  197 | test.afterAll(async () => {
  198 |   // limpeza das tarefas criadas pelo teste
  199 |   const { execSync } = await import("node:child_process");
```