# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tmp-glass.test.js >> glass: capturas do modal
- Location: tmp-glass.test.js:19:5

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 180000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]') to be visible

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation [ref=e6]:
          - button [disabled] [ref=e7]:
            - img "previous" [ref=e8]
          - generic [ref=e10]:
            - generic [ref=e11]: 1/
            - generic [ref=e12]: "1"
          - button [disabled] [ref=e13]:
            - img "next" [ref=e14]
        - link "Next.js 16.3.2 (stale) Turbopack" [ref=e17] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - generic "There is a newer version (16.4.2) available, upgrade recommended!" [ref=e20]: Next.js 16.3.2 (stale)
          - generic [ref=e21]: Turbopack
      - dialog "Build Error" [ref=e23]:
        - generic [ref=e26]:
          - generic [ref=e28]:
            - generic [ref=e29]:
              - generic [ref=e30]: Build Error
              - generic [ref=e32]:
                - button "Copy Error Info" [ref=e33] [cursor=pointer]
                - button "No related documentation found" [disabled] [ref=e36]
                - button "Attach Node.js inspector" [ref=e39] [cursor=pointer]
            - generic [ref=e48]: "the name `selectDate` is defined multiple times"
          - generic [ref=e51]:
            - generic [ref=e53]:
              - generic [ref=e58]: ./src/components/planning/PlannerDatePicker.tsx (138:9)
              - button "Open in editor" [ref=e59] [cursor=pointer]
            - generic [ref=e64]:
              - text: Error
              - generic [ref=e65]: ": the name `selectDate` is defined multiple times"
              - generic [ref=e66]: 136 |
              - generic [ref=e67]: "}, [activeDate, month, open]);"
              - generic [ref=e68]: 137 |
              - text: ">"
              - generic [ref=e69]: 138 |
              - text: const
              - generic [ref=e70]: "selectDate = (date: str..."
              - generic [ref=e71]: "|"
              - text: ^^^^^^^^^^
              - generic [ref=e72]: 139 |
              - text: if
              - generic [ref=e73]: "(value === date) {"
              - generic [ref=e74]: 140 |
              - generic [ref=e75]: "// Toggle: clicking the s..."
              - generic [ref=e76]: 141 |
              - generic [ref=e77]: onChange(
              - text: "null"
              - generic [ref=e78]: "); Ecmascript file had an error Import traces: Client Component Browser: ./src/components/planning/PlannerDatePicker.tsx [Client Component Browser] ./src/components/planning/PlanDialog.tsx [Client Component Browser] ./src/app/planner/page.tsx [Client Component Browser] ./src/app/planner/page.tsx [Server Component] Client Component SSR: ./src/components/planning/PlannerDatePicker.tsx [Client Component SSR] ./src/components/planning/PlanDialog.tsx [Client Component SSR] ./src/app/planner/page.tsx [Client Component SSR] ./src/app/planner/page.tsx [Server Component]"
    - generic [ref=e83] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e84]
      - button "Open issues overlay" [ref=e89]:
        - generic [ref=e90]:
          - generic [aria-hidden] [ref=e91]: "0"
          - generic [ref=e92]: "1"
        - generic [ref=e93]: Issue
  - alert [ref=e94]
```

# Test source

```ts
  1  | import { test } from "@playwright/test";
  2  | 
  3  | const EMAIL = "e2e.planner@energyos.test";
  4  | const PASS = "Planner123!";
  5  | 
  6  | async function login(page) {
  7  |   await page.goto("/login", { waitUntil: "domcontentloaded" });
  8  |   if (page.url().includes("/login")) {
> 9  |     await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 60000 });
     |                                               ^ Error: locator.waitFor: Test timeout of 180000ms exceeded.
  10 |     await page.locator('input[type="email"]').fill(EMAIL);
  11 |     await page.locator('input[type="password"]').fill(PASS);
  12 |     await page.getByRole("button", { name: /Entrar/ }).click();
  13 |     await page.waitForTimeout(2500);
  14 |   }
  15 |   const skip = page.locator('button:has-text("Pular tour")');
  16 |   if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
  17 | }
  18 | 
  19 | test("glass: capturas do modal", async ({ page }) => {
  20 |   test.setTimeout(180000);
  21 |   page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  22 |   page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });
  23 | 
  24 |   await page.setViewportSize({ width: 1280, height: 900 });
  25 |   await login(page);
  26 |   await page.goto("/planner", { waitUntil: "domcontentloaded" });
  27 |   await page.waitForTimeout(1500);
  28 |   await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  29 |   await page.waitForTimeout(800);
  30 |   await page.locator('button[aria-label^="Adicionar plano"]').first().click();
  31 |   await page.waitForTimeout(900);
  32 |   await page.screenshot({ path: "test-results/glass-desktop.png" });
  33 | 
  34 |   // Estado com repetição + lembrete
  35 |   await page.getByRole("button", { name: "Semanalmente" }).click();
  36 |   await page.waitForTimeout(500);
  37 |   await page.screenshot({ path: "test-results/glass-desktop-repeating.png" });
  38 | 
  39 |   // Popover do calendário
  40 |   await page.locator("#planner-plan-date").click();
  41 |   await page.waitForTimeout(600);
  42 |   await page.screenshot({ path: "test-results/glass-calendar.png" });
  43 |   await page.keyboard.press("Escape");
  44 |   await page.waitForTimeout(400);
  45 | 
  46 |   // Mobile
  47 |   await page.setViewportSize({ width: 390, height: 844 });
  48 |   await page.waitForTimeout(700);
  49 |   await page.screenshot({ path: "test-results/glass-mobile.png" });
  50 | });
  51 | 
```