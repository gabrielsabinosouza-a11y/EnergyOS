import { test, expect } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

test("debug: o que a API devolve ao navegar", async ({ page }) => {
  test.setTimeout(120000);
  page.on("response", async (res) => {
    if (!res.url().includes("/api/weekly-plans")) return;
    let body = "";
    try {
      const json = await res.json();
      body = Array.isArray(json) ? `${json.length} itens: ${json.map((i) => `${i.planDate}/${i.title}`).join(", ")}` : JSON.stringify(json).slice(0, 200);
    } catch (e) {
      body = `erro ao ler: ${e}`;
    }
    console.log(`[API] ${res.status()} ${res.url()} → ${body}`);
  });

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

  for (let i = 0; i < 13; i += 1) {
    await page.locator('button[aria-label^="Próximo período"]').first().click({ force: true });
    await page.waitForTimeout(900);
  }
  await expect(page.locator("h2").first()).toBeVisible();
});
