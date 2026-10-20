import { test, expect } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

test("debug: navegação do planner", async ({ page }) => {
  test.setTimeout(120000);
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("[console]", msg.text()); });

  await page.goto("/login", { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 10000 });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await page.waitForTimeout(2000);
  }
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }

  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(800);

  for (let i = 0; i < 14; i += 1) {
    await page.locator('button[aria-label^="Próximo período"]').first().click({ force: true });
    await page.waitForTimeout(900);
    const label = await page.locator("h2").first().textContent();
    const rows = await page.locator('[data-testid^="plan-series:"]').count();
    console.log(`clique ${i + 1}: "${label?.trim()}" → ${rows} plano(s) na tela`);
  }
});
