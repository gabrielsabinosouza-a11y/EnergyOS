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
}

async function dismissTour(page) {
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
}

async function goView(page, name) {
  await dismissTour(page);
  await page.locator(`button:has-text("${name}")`).first().click({ force: true });
  await page.waitForTimeout(700);
}

test("no errors while navigating all views", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message }));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push({ type: "console-error", message: msg.text() }); });

  await authenticate(page);
  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await dismissTour(page);
  await page.waitForTimeout(500);

  await goView(page, "Mês");
  await goView(page, "Semana");
  await goView(page, "Dia");
  await page.locator('button:has-text("Hoje")').first().click({ force: true }); await page.waitForTimeout(700);

  console.log("NAV ERRORS:", JSON.stringify(errors));
  expect(errors).toEqual([]);
  await page.close();
});
