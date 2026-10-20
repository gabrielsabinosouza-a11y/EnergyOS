# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-create.test.js >> debug: criação do plano recorrente
- Location: debug-create.test.js:7:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('input[placeholder="Ex.: Ir à academia"]')

```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "energyOS energyOS" [ref=f2e4] [cursor=pointer]:
        - /url: /
        - img "energyOS" [ref=f2e5]
        - generic [ref=f2e6]: energyOS
      - navigation [ref=f2e7]:
        - link "Visão geral" [ref=f2e8] [cursor=pointer]:
          - /url: /dashboard
        - link "Planejamento" [ref=f2e11] [cursor=pointer]:
          - /url: /planner
        - link "Consistência" [ref=f2e16] [cursor=pointer]:
          - /url: /dashboard/consistencia
        - link "Salas de foco" [ref=f2e19] [cursor=pointer]:
          - /url: /salas-de-foco
        - link "Amigos" [ref=f2e22] [cursor=pointer]:
          - /url: /amigos
        - link "Liga" [ref=f2e25] [cursor=pointer]:
          - /url: /liga
        - link "Grupos" [ref=f2e28] [cursor=pointer]:
          - /url: /grupos
        - link "Loja" [ref=f2e31] [cursor=pointer]:
          - /url: /loja
        - link "Meu jardim" [ref=f2e34] [cursor=pointer]:
          - /url: /jardim
        - link "Meu perfil" [ref=f2e37] [cursor=pointer]:
          - /url: /perfil
        - link "Configurações" [ref=f2e40] [cursor=pointer]:
          - /url: /configuracoes
    - generic [ref=f2e46]:
      - banner [ref=f2e48]:
        - generic [ref=f2e49]:
          - heading "Planejamento" [level=1] [ref=f2e54]
          - generic [ref=f2e55]:
            - button "Período anterior (semana)" [ref=f2e56] [cursor=pointer]
            - button "Ir para hoje" [ref=f2e59] [cursor=pointer]: Hoje
            - button "Próximo período (semana)" [ref=f2e60] [cursor=pointer]
        - heading "19–25 de outubro de 2026" [level=2] [ref=f2e63]
        - group "Modo de visualização" [ref=f2e64]:
          - button "Mês" [ref=f2e65] [cursor=pointer]
          - button "Semana" [pressed] [ref=f2e69] [cursor=pointer]
          - button "Dia" [ref=f2e74] [cursor=pointer]
      - region "Planejador semanal" [ref=f2e80]:
        - generic [ref=f2e81]:
          - generic [ref=f2e82]:
            - generic [ref=f2e83]: Esta semana
            - generic [ref=f2e84]: Hoje
          - generic [ref=f2e85]: 0 planos
        - generic [ref=f2e87]:
          - article [ref=f2e88]:
            - generic [ref=f2e89]:
              - generic [ref=f2e90]: seg.
              - button "19 outubro de 2026" [ref=f2e91] [cursor=pointer]: "19"
            - generic [ref=f2e92]:
              - button "Adicionar plano para segunda-feira, 19 de outubro" [active] [ref=f2e93] [cursor=pointer]
              - generic [ref=f2e95]: Sem planos
          - article [ref=f2e96]:
            - generic [ref=f2e97]:
              - generic [ref=f2e98]: ter.
              - button "20 outubro de 2026" [ref=f2e99] [cursor=pointer]: "20"
            - generic [ref=f2e100]:
              - button "Adicionar plano para terça-feira, 20 de outubro" [ref=f2e101] [cursor=pointer]
              - generic [ref=f2e103]: Sem planos
          - article [ref=f2e104]:
            - generic [ref=f2e105]:
              - generic [ref=f2e106]: qua.
              - button "21 outubro de 2026" [ref=f2e107] [cursor=pointer]: "21"
            - generic [ref=f2e108]:
              - button "Adicionar plano para quarta-feira, 21 de outubro" [ref=f2e109] [cursor=pointer]
              - generic [ref=f2e111]: Sem planos
          - article [ref=f2e112]:
            - generic [ref=f2e113]:
              - generic [ref=f2e114]: qui.
              - button "22 outubro de 2026" [ref=f2e115] [cursor=pointer]: "22"
            - generic [ref=f2e116]:
              - button "Adicionar plano para quinta-feira, 22 de outubro" [ref=f2e117] [cursor=pointer]
              - generic [ref=f2e119]: Sem planos
          - article [ref=f2e120]:
            - generic [ref=f2e121]:
              - generic [ref=f2e122]: sex.
              - button "23 outubro de 2026" [ref=f2e123] [cursor=pointer]: "23"
            - generic [ref=f2e124]:
              - button "Adicionar plano para sexta-feira, 23 de outubro" [ref=f2e125] [cursor=pointer]
              - generic [ref=f2e127]: Sem planos
          - article [ref=f2e128]:
            - generic [ref=f2e129]:
              - generic [ref=f2e130]: sáb.
              - button "24 outubro de 2026" [ref=f2e131] [cursor=pointer]: "24"
            - generic [ref=f2e132]:
              - button "Adicionar plano para sábado, 24 de outubro" [ref=f2e133] [cursor=pointer]
              - generic [ref=f2e135]: Sem planos
          - article [ref=f2e136]:
            - generic [ref=f2e137]:
              - generic [ref=f2e138]: dom.
              - button "25 outubro de 2026" [ref=f2e139] [cursor=pointer]: "25"
            - generic [ref=f2e140]:
              - button "Adicionar plano para domingo, 25 de outubro" [ref=f2e141] [cursor=pointer]
              - generic [ref=f2e143]: Sem planos
  - button "Open Next.js Dev Tools" [ref=f2e149] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const EMAIL = "e2e.planner@energyos.test";
  4  | const PASS = "Planner123!";
  5  | const TITLE = `DEBUG recorrente ${Date.now()}`;
  6  | 
  7  | test("debug: criação do plano recorrente", async ({ page }) => {
  8  |   test.setTimeout(120000);
  9  |   page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  10 |   page.on("console", (msg) => { if (msg.type() === "error") console.log("[console]", msg.text()); });
  11 |   page.on("response", async (res) => {
  12 |     if (!res.url().includes("/api/weekly-plans")) return;
  13 |     let body = "";
  14 |     try { body = JSON.stringify(await res.json()).slice(0, 300); } catch { body = "(não json)"; }
  15 |     console.log(`[API] ${res.status()} ${res.request().method()} ${res.url()} → ${body}`);
  16 |   });
  17 | 
  18 |   await page.goto("/login", { waitUntil: "networkidle" });
  19 |   if (page.url().includes("/login")) {
  20 |     await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 10000 });
  21 |     await page.locator('input[type="email"]').fill(EMAIL);
  22 |     await page.locator('input[type="password"]').fill(PASS);
  23 |     await page.getByRole("button", { name: /Entrar/ }).click();
  24 |     await page.waitForTimeout(2000);
  25 |   }
  26 |   const skip = page.locator('button:has-text("Pular tour")');
  27 |   if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
  28 | 
  29 |   await page.goto("/planner", { waitUntil: "networkidle" });
  30 |   await page.waitForTimeout(600);
  31 |   await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  32 |   await page.waitForTimeout(800);
  33 | 
  34 |   await page.locator('button[aria-label^="Adicionar plano para segunda-feira"]').first().click();
  35 |   await page.waitForTimeout(500);
> 36 |   await page.locator('input[placeholder="Ex.: Ir à academia"]').fill(TITLE);
     |                                                                 ^ Error: locator.fill: Test timeout of 120000ms exceeded.
  37 |   await page.getByRole("button", { name: "Semanalmente" }).click();
  38 |   await page.waitForTimeout(300);
  39 |   console.log("[DEBUG] data exibida:", await page.locator("#planner-plan-date").textContent());
  40 |   console.log("[DEBUG] valor data:", await page.locator("#planner-plan-date").getAttribute("aria-label"));
  41 |   console.log("[DEBUG] categoria:", await page.locator("#planner-plan-category").inputValue());
  42 | 
  43 |   await page.getByRole("button", { name: "Criar plano" }).click();
  44 |   await page.waitForTimeout(3000);
  45 | 
  46 |   const alert = page.locator('[role="alert"]');
  47 |   if (await alert.count()) console.log("[DEBUG] erro no modal:", await alert.first().textContent());
  48 |   console.log("[DEBUG] modal aberto?", await page.getByRole("button", { name: "Criar plano" }).count());
  49 |   console.log("[DEBUG] linhas:", await page.locator('[data-testid^="plan-series:"]').count());
  50 | });
  51 | 
```