import { test, expect } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

async function authenticate(page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(1500);
  console.log("=== after login URL ===", page.url());
}

test("reproduce all planner bugs (Sao_Paulo TZ)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message, stack: e.stack }));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console-error", message: msg.text() });
  });

  await authenticate(page);
  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const d = await page.evaluate(() => new Date("2026-10-15").toString());
  console.log("=== browser timezone:", tz, "| new Date('2026-10-15'):", d, "===");
  console.log("=== URL ===", page.url());

  // ---- BUG 2: date off-by-one in Day view ----
  await page.locator('button:has-text("Dia")').click();
  await page.waitForTimeout(800);
  console.log("=== DAY VIEW (SP TZ) ===");
  console.log("day h2:", JSON.stringify(await page.locator("h2").first().textContent()));
  console.log("day date p:", JSON.stringify(await page.locator('p:has-text("de out.")').first().textContent()));

  // ---- BUG 1: add task from Day view ----
  const addBtn = page.getByRole("button", { name: /Adicionar plano/ });
  console.log("day add-btn count:", await addBtn.count());
  await addBtn.first().click();
  await page.waitForTimeout(500);
  const titleInput = page.locator('input[placeholder="Ex.: Ir à academia"]');
  await titleInput.fill("Tarefa dia view");
  await page.getByRole("button", { name: /Criar plano/ }).click();
  await page.waitForTimeout(1200);
  console.log("after day-add errors:", JSON.stringify(errors));
  console.log("day-add task present:", (await page.locator('text="Tarefa dia view"').count()) > 0);

  // ---- BUG 1b: add task from Week view "Adicionar" ----
  await page.locator('button:has-text("Semana")').click();
  await page.waitForTimeout(800);
  console.log("=== WEEK VIEW ===");
  // Add via "Adicionar" on a column (Qui 15)
  const semanaAdd = page.locator('button:has-text("+ Adicionar")');
  console.log("semana add count:", await semanaAdd.count());
  // click the add on today column
  await semanaAdd.first().click();
  await page.waitForTimeout(500);
  const ti2 = page.locator('input[placeholder="Ex.: Ir à academia"]');
  await ti2.fill("Tarefa semana view");
  await page.getByRole("button", { name: /Criar plano/ }).click();
  await page.waitForTimeout(1200);
  console.log("after semana-add errors:", JSON.stringify(errors));
  console.log("semana-add task present:", (await page.locator('text="Tarefa semana view"').count()) > 0);

  console.log("=== ALL ERRORS ===");
  console.log(JSON.stringify(errors, null, 1));

  await page.close();
});
