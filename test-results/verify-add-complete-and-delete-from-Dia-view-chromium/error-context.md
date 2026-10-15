# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify.test.js >> add, complete and delete from Dia view
- Location: verify.test.js:58:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - link "energyOS energyOS" [ref=f1e4] [cursor=pointer]:
        - /url: /
        - img "energyOS" [ref=f1e5]
        - generic [ref=f1e6]: energyOS
      - navigation [ref=f1e7]:
        - link "Visão geral" [ref=f1e8] [cursor=pointer]:
          - /url: /dashboard
        - link "Planejamento" [ref=f1e11] [cursor=pointer]:
          - /url: /planner
        - link "Consistência" [ref=f1e16] [cursor=pointer]:
          - /url: /dashboard/consistencia
        - link "Salas de foco" [ref=f1e19] [cursor=pointer]:
          - /url: /salas-de-foco
        - link "Amigos" [ref=f1e22] [cursor=pointer]:
          - /url: /amigos
        - link "Liga" [ref=f1e25] [cursor=pointer]:
          - /url: /liga
        - link "Grupos" [ref=f1e28] [cursor=pointer]:
          - /url: /grupos
        - link "Loja" [ref=f1e31] [cursor=pointer]:
          - /url: /loja
        - link "Meu jardim" [ref=f1e34] [cursor=pointer]:
          - /url: /jardim
        - link "Meu perfil" [ref=f1e37] [cursor=pointer]:
          - /url: /perfil
        - link "Configurações" [ref=f1e40] [cursor=pointer]:
          - /url: /configuracoes
    - generic [ref=f1e46]:
      - generic [ref=f1e47]:
        - heading "Planejamento" [level=1] [ref=f1e51]
        - generic [ref=f1e52]:
          - generic [ref=f1e53]:
            - button "Anterior" [ref=f1e54] [cursor=pointer]
            - button "Hoje" [ref=f1e57] [cursor=pointer]
            - button "Próximo" [ref=f1e58] [cursor=pointer]
          - generic [ref=f1e61]: quinta-feira, 15 de outubro
          - generic [ref=f1e62]:
            - button "Mês" [ref=f1e63] [cursor=pointer]
            - button "Semana" [ref=f1e64] [cursor=pointer]
            - button "Dia" [pressed] [ref=f1e65] [cursor=pointer]
      - generic [ref=f1e67]:
        - generic [ref=f1e68]:
          - generic [ref=f1e69]:
            - heading "quinta-feira" [level=2] [ref=f1e70]
            - paragraph [ref=f1e71]: 15 de out. de 2026 · hoje
          - button "Adicionar plano" [ref=f1e72] [cursor=pointer]
        - generic [ref=f1e76]:
          - generic [ref=f1e78]:
            - generic "Tarefa do dia 15" [ref=f1e80]
            - generic [ref=f1e81]:
              - button "Concluir plano" [ref=f1e82] [cursor=pointer]
              - button "Excluir plano" [ref=f1e85] [cursor=pointer]
          - generic [ref=f1e90]:
            - generic "Dia tarefa completa" [ref=f1e92]
            - generic [ref=f1e93]:
              - button "Concluir plano" [ref=f1e94] [cursor=pointer]
              - button "Excluir plano" [ref=f1e97] [cursor=pointer]
  - generic [ref=f1e105] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=f1e106]
    - generic [ref=f1e110]:
      - button "Open issues overlay" [ref=f1e111]:
        - generic [ref=f1e112]:
          - generic [aria-hidden] [ref=f1e113]: "0"
          - generic [ref=f1e114]: "1"
        - generic [ref=f1e115]: Issue
      - button "Collapse issues badge" [ref=f1e116]
  - alert [ref=f1e119]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const EMAIL = "e2e.planner@energyos.test";
  4   | const PASS = "Planner123!";
  5   | 
  6   | async function authenticate(page) {
  7   |   await page.goto("/login", { waitUntil: "networkidle" });
  8   |   // Se já estiver autenticado (cookie da sessão), o login redireciona.
  9   |   if (!page.url().includes("/login")) {
  10  |     await page.goto("/planner", { waitUntil: "networkidle" });
  11  |     await page.waitForTimeout(500);
  12  |     await dismissTour(page);
  13  |     return;
  14  |   }
  15  |   await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 10000 });
  16  |   await page.waitForTimeout(300);
  17  |   await page.locator('input[type="email"]').fill(EMAIL);
  18  |   await page.locator('input[type="password"]').fill(PASS);
  19  |   await page.locator('button:has-text("Entrar")').click();
  20  |   await page.waitForTimeout(1500);
  21  |   await dismissTour(page);
  22  | }
  23  | 
  24  | async function dismissTour(page) {
  25  |   const skip = page.locator('button:has-text("Pular tour")');
  26  |   if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
  27  | }
  28  | 
  29  | async function openAddAndSubmit(page, title) {
  30  |   // Try Dia add button first, then Semana column add button.
  31  |   const diaAdd = page.getByRole("button", { name: /Adicionar plano/ });
  32  |   if ((await diaAdd.count()) > 0) {
  33  |     await diaAdd.first().click();
  34  |   } else {
  35  |     await page.locator('button:has-text("+ Adicionar")').first().click();
  36  |   }
  37  |   await page.waitForTimeout(300);
  38  |   await page.locator('input[placeholder="Ex.: Ir à academia"]').fill(title);
  39  |   await page.getByRole("button", { name: /Criar plano/ }).click();
  40  |   await page.waitForTimeout(800);
  41  | }
  42  | 
  43  | async function completeAndDelete(page) {
  44  |   // Complete the first task
  45  |   const concluir = page.getByRole("button", { name: "Concluir plano" });
  46  |   if ((await concluir.count()) > 0) {
  47  |     await concluir.first().click();
  48  |     await page.waitForTimeout(500);
  49  |   }
  50  |   // Delete the first task
  51  |   const excluir = page.getByRole("button", { name: "Excluir plano" });
  52  |   if ((await excluir.count()) > 0) {
  53  |     await excluir.first().click();
  54  |     await page.waitForTimeout(500);
  55  |   }
  56  | }
  57  | 
  58  | test("add, complete and delete from Dia view", async ({ page }) => {
  59  |   const errors = [];
  60  |   page.on("pageerror", (e) => errors.push(e.message));
  61  |   page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  62  | 
  63  |   await authenticate(page);
  64  |   await page.goto("/planner", { waitUntil: "networkidle" });
  65  |   await page.waitForTimeout(500);
  66  |   await dismissTour(page);
  67  |   await page.locator('button:has-text("Dia")').first().click({ force: true });
  68  |   await page.waitForTimeout(700);
  69  | 
  70  |   await openAddAndSubmit(page, "Dia tarefa completa");
  71  |   expect(await page.locator('text="Dia tarefa completa"').count()).toBeGreaterThan(0);
  72  |   expect(errors.filter((e) => String(e).includes("pageerror"))).toEqual([]);
  73  | 
  74  |   await completeAndDelete(page);
> 75  |   expect(await page.locator('text="Dia tarefa completa"').count()).toBe(0);
      |                                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  76  |   console.log("DIA: add+complete+delete OK");
  77  |   await page.close();
  78  | });
  79  | 
  80  | test("add, complete and delete from Semana view", async ({ page }) => {
  81  |   const errors = [];
  82  |   page.on("pageerror", (e) => errors.push(e.message));
  83  |   page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  84  | 
  85  |   await authenticate(page);
  86  |   await page.goto("/planner", { waitUntil: "networkidle" });
  87  |   await page.waitForTimeout(500);
  88  |   await dismissTour(page);
  89  |   await page.locator('button:has-text("Semana")').first().click({ force: true });
  90  |   await page.waitForTimeout(700);
  91  | 
  92  |   await openAddAndSubmit(page, "Semana tarefa completa");
  93  |   expect(await page.locator('text="Semana tarefa completa"').count()).toBeGreaterThan(0);
  94  | 
  95  |   await completeAndDelete(page);
  96  |   expect(await page.locator('text="Semana tarefa completa"').count()).toBe(0);
  97  |   console.log("SEMANA: add+complete+delete OK");
  98  |   await page.close();
  99  | });
  100 | 
  101 | test("month day with task opens Dia showing exactly those tasks", async ({ page }) => {
  102 |   await authenticate(page);
  103 |   await page.goto("/planner", { waitUntil: "networkidle" });
  104 |   await page.waitForTimeout(500);
  105 |   await dismissTour(page);
  106 | 
  107 |   // Add a task on today (15/10) from Dia view.
  108 |   await page.locator('button:has-text("Dia")').first().click({ force: true });
  109 |   await page.waitForTimeout(700);
  110 |   await openAddAndSubmit(page, "Tarefa do dia 15");
  111 | 
  112 |   // Switch to month and click day 15.
  113 |   await page.locator('button:has-text("Mês")').first().click({ force: true });
  114 |   await page.waitForTimeout(700);
  115 |   const cells = page.locator('button[type="button"]');
  116 |   let clicked = false;
  117 |   for (let i = 0; i < await cells.count(); i++) {
  118 |     const txt = (await cells.nth(i).textContent() || "").trim();
  119 |     const aria = await cells.nth(i).getAttribute("aria-label") || "";
  120 |     if (txt === "15" && aria.includes("Dia 15")) { await cells.nth(i).click(); clicked = true; break; }
  121 |   }
  122 |   expect(clicked).toBe(true);
  123 |   await page.waitForTimeout(700);
  124 | 
  125 |   expect(await page.locator("h2").first().textContent()).toContain("quinta-feira");
  126 |   expect(await page.locator('text="Tarefa do dia 15"').count()).toBeGreaterThan(0);
  127 |   console.log("MONTH->DIA: day 15 shows its task OK");
  128 |   await page.close();
  129 | });
  130 | 
  131 | test("Hoje, prev and next in each view", async ({ page }) => {
  132 |   await authenticate(page);
  133 |   await page.goto("/planner", { waitUntil: "networkidle" });
  134 |   await page.waitForTimeout(500);
  135 |   await dismissTour(page);
  136 | 
  137 |   for (const view of ["Dia", "Semana", "Mês"]) {
  138 |     await page.locator(`button:has-text("${view}")`).first().click({ force: true });
  139 |     await page.waitForTimeout(700);
  140 |     await page.locator('button:has-text("Próximo")').first().click({ force: true });
  141 |     await page.waitForTimeout(700);
  142 |     await page.locator('button:has-text("Anterior")').first().click({ force: true });
  143 |     await page.waitForTimeout(700);
  144 |     await page.locator('button:has-text("Hoje")').first().click({ force: true });
  145 |     await page.waitForTimeout(700);
  146 |     console.log(view, " prev/next/hoje OK");
  147 |   }
  148 |   await page.close();
  149 | });
  150 | 
  151 | test("month boundary Oct->Nov->Dec->Jan and prev", async ({ page }) => {
  152 |   await authenticate(page);
  153 |   await page.goto("/planner", { waitUntil: "networkidle" });
  154 |   await page.waitForTimeout(500);
  155 |   await dismissTour(page);
  156 |   await page.locator('button:has-text("Mês")').first().click({ force: true });
  157 |   await page.waitForTimeout(700);
  158 | 
  159 |   expect(await page.locator("text=outubro de 2026").first().isVisible()).toBeTruthy();
  160 |   await page.locator('button:has-text("Próximo")').first().click({ force: true }); await page.waitForTimeout(700);
  161 |   expect(await page.locator("text=novembro de 2026").first().isVisible()).toBeTruthy();
  162 |   await page.locator('button:has-text("Próximo")').first().click({ force: true }); await page.waitForTimeout(700);
  163 |   expect(await page.locator("text=dezembro de 2026").first().isVisible()).toBeTruthy();
  164 |   await page.locator('button:has-text("Próximo")').first().click({ force: true }); await page.waitForTimeout(700);
  165 |   expect(await page.locator("text=janeiro de 2027").first().isVisible()).toBeTruthy();
  166 |   // prev back to outubro
  167 |   await page.locator('button:has-text("Anterior")').first().click({ force: true }); await page.waitForTimeout(700);
  168 |   expect(await page.locator("text=dezembro de 2026").first().isVisible()).toBeTruthy();
  169 |   console.log("MONTH BOUNDARIES OK");
  170 |   await page.close();
  171 | });
  172 | 
  173 | test("week spanning two months (Dec 2026 -> Jan 2027)", async ({ page }) => {
  174 |   await authenticate(page);
  175 |   await page.goto("/planner", { waitUntil: "networkidle" });
```