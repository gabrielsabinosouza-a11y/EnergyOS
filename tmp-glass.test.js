import { test } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

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

test("glass: capturas do modal", async ({ page }) => {
  test.setTimeout(180000);
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await page.goto("/planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator('button[aria-label^="Adicionar plano"]').first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "test-results/glass-desktop.png" });

  // Estado com repetição + lembrete
  await page.getByRole("button", { name: "Semanalmente" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/glass-desktop-repeating.png" });

  // Popover do calendário
  await page.locator("#planner-plan-date").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/glass-calendar.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/glass-mobile.png" });
});
