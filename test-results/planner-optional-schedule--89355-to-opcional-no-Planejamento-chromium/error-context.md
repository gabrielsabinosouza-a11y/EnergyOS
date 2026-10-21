# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planner-optional-schedule.test.js >> agendamento opcional no Planejamento
- Location: planner-optional-schedule.test.js:88:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: 'Criar plano' })
Expected: 0
Received: 1

Call log:
  - Expect "toHaveCount" getByRole('button', { name: 'Criar plano' }) with timeout 20000ms
  - waiting for getByRole('button', { name: 'Criar plano' })
    4 × locator resolved to 1 element
      - unexpected value "1"
  - Target page, context or browser has been closed

```

```
Error: Channel closed
```

```
Error: Command failed: node scripts/cleanup-e2e-planner-tasks.mjs
```

# Test source

```ts
  101 | 
  102 |   // ── 2. somente data ───────────────────────────────────────────────────────
  103 |   await createPlan(page, TITLES.soData, { date: "hoje" });
  104 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText(TITLES.soData).first()).toBeVisible({ timeout: 15000 });
  105 |   await expect(
  106 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData).first(),
  107 |   ).toHaveCount(0);
  108 | 
  109 |   // ── 3. data + início (sem fim) ────────────────────────────────────────────
  110 |   await createPlan(page, TITLES.dataInicio, { date: "hoje", start: "09:00" });
  111 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText(TITLES.dataInicio).first()).toBeVisible({ timeout: 15000 });
  112 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText("09:00").first()).toBeVisible();
  113 | 
  114 |   // ── 4. data + início + fim ────────────────────────────────────────────────
  115 |   await createPlan(page, TITLES.completo, { date: "hoje", start: "10:00", end: "11:00" });
  116 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText(TITLES.completo).first()).toBeVisible({ timeout: 15000 });
  117 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText("10:00").first()).toBeVisible();
  118 | 
  119 |   // ── 5. editar e limpar a data ─────────────────────────────────────────────
  120 |   const rowSemData = page.locator(`[data-testid^="plan-plan:"]`).filter({ hasText: TITLES.soData }).first();
  121 |   await rowSemData.getByRole("button", { name: /Ações para/ }).click();
  122 |   await page.waitForTimeout(300);
  123 |   await page.locator('[role="menu"] button:has-text("Editar")').click();
  124 |   await page.waitForTimeout(600);
  125 |   await expect(page.locator("#planner-plan-title")).toHaveValue(TITLES.soData);
  126 |   await clearDate(page);
  127 |   await page.getByRole("button", { name: "Salvar alterações" }).click();
  128 |   await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  129 |   await expect(
  130 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.soData).first(),
  131 |   ).toBeVisible({ timeout: 15000 });
  132 | 
  133 |   // ── 6. editar e limpar os horários ────────────────────────────────────────
  134 |   const rowCompleto = page.locator(`[data-testid^="plan-plan:"]`).filter({ hasText: TITLES.completo }).first();
  135 |   await rowCompleto.getByRole("button", { name: /Ações para/ }).click();
  136 |   await page.waitForTimeout(300);
  137 |   await page.locator('[role="menu"] button:has-text("Editar")').click();
  138 |   await page.waitForTimeout(600);
  139 |   await expect(page.locator("#planner-plan-start-time")).toHaveValue("10:00");
  140 |   await page.locator("#planner-plan-start-time").fill("");
  141 |   await page.locator("#planner-plan-end-time").fill("");
  142 |   await page.getByRole("button", { name: "Salvar alterações" }).click();
  143 |   await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0, { timeout: 20000 });
  144 |   await page.waitForTimeout(800);
  145 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText("10:00")).toHaveCount(0);
  146 | 
  147 |   // ── 7. recorrente + ocorrências ───────────────────────────────────────────
  148 |   await openModal(page);
  149 |   await page.locator("#planner-plan-title").fill(TITLES.recurring);
  150 |   await pickDay(page);
  151 |   await page.getByRole("button", { name: "Semanalmente" }).click();
  152 |   await page.waitForTimeout(300);
  153 |   await page.getByRole("button", { name: "Criar plano" }).click();
  154 |   await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(0, { timeout: 20000 });
  155 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });
  156 | 
  157 |   // A mesma recorrência aparece na semana seguinte (mesmo dia da semana).
  158 |   await page.locator('button[aria-label^="Próximo período"]').first().click();
  159 |   await page.waitForTimeout(1200);
  160 |   await expect(page.locator('section[aria-label="Planejador semanal"]').getByText(TITLES.recurring).first()).toBeVisible({ timeout: 15000 });
  161 | 
  162 |   // ── 8. tarefas sem data acessíveis ────────────────────────────────────────
  163 |   await page.locator('button[aria-label^="Período anterior"]').first().click();
  164 |   await page.waitForTimeout(1000);
  165 |   await expect(page.locator('section[aria-label="Tarefas sem data"]')).toBeVisible();
  166 |   await expect(
  167 |     page.locator('section[aria-label="Tarefas sem data"]').getByText(TITLES.semData).first(),
  168 |   ).toBeVisible();
  169 | 
  170 |   // ── 10. conclusão + recompensa ────────────────────────────────────────────
  171 |   const rewardBefore = await page.evaluate(async () => {
  172 |     const res = await fetch("/api/weekly-plans?unscheduled=1", {
  173 |       headers: { "x-dev-profile-id": "bf4489eb-03eb-43a2-ac95-2f9d6b3c0ef3" },
  174 |     });
  175 |     return res.status;
  176 |   });
  177 |   console.log("[e2e] api unscheduled status:", rewardBefore);
  178 | 
  179 |   const rowToComplete = page.locator(`[data-testid^="plan-plan:"]`).filter({ hasText: TITLES.semData }).first();
  180 |   await rowToComplete.getByRole("button", { name: /^Concluir/ }).click();
  181 |   await page.waitForTimeout(1500);
  182 |   await expect(rowToComplete.getByRole("button", { name: /^Reabrir/ })).toBeVisible({ timeout: 15000 });
  183 | 
  184 |   // ── 11. mobile ────────────────────────────────────────────────────────────
  185 |   await page.setViewportSize({ width: 390, height: 844 });
  186 |   await page.waitForTimeout(800);
  187 |   await openModal(page);
  188 |   await expect(page.locator("#planner-plan-title")).toBeVisible();
  189 |   await page.locator("#planner-plan-title").fill("E2E mobile");
  190 |   await expect(page.locator("#planner-plan-title")).toHaveValue("E2E mobile");
  191 |   await page.screenshot({ path: "test-results/optional-mobile.png" });
  192 |   await page.getByRole("button", { name: "Cancelar" }).click();
  193 |   await page.waitForTimeout(400);
  194 | 
  195 |   expect(errors).toEqual([]);
  196 | });
  197 | 
  198 | test.afterAll(async () => {
  199 |   // limpeza das tarefas criadas pelo teste
  200 |   const { execSync } = await import("node:child_process");
> 201 |   execSync("node scripts/cleanup-e2e-planner-tasks.mjs", { cwd: "/home/gabriel/Documentos/EnergyOS", stdio: "inherit" });
      |   ^ Error: Command failed: node scripts/cleanup-e2e-planner-tasks.mjs
  202 | });
```