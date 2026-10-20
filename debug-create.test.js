import { test, expect } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const TITLE = `DEBUG recorrente ${Date.now()}`;

test("debug: criação do plano recorrente", async ({ page }) => {
  test.setTimeout(120000);
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("[console]", msg.text()); });
  page.on("response", async (res) => {
    if (!res.url().includes("/api/weekly-plans")) return;
    let body = "";
    try { body = JSON.stringify(await res.json()).slice(0, 300); } catch { body = "(não json)"; }
    console.log(`[API] ${res.status()} ${res.request().method()} ${res.url()} → ${body}`);
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
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(800);

  await page.locator('button[aria-label^="Adicionar plano para segunda-feira"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Ex.: Ir à academia"]').fill(TITLE);
  await page.getByRole("button", { name: "Semanalmente" }).click();
  await page.waitForTimeout(300);
  console.log("[DEBUG] data exibida:", await page.locator("#planner-plan-date").textContent());
  console.log("[DEBUG] valor data:", await page.locator("#planner-plan-date").getAttribute("aria-label"));
  console.log("[DEBUG] categoria:", await page.locator("#planner-plan-category").inputValue());

  await page.getByRole("button", { name: "Criar plano" }).click();
  await page.waitForTimeout(3000);

  const alert = page.locator('[role="alert"]');
  if (await alert.count()) console.log("[DEBUG] erro no modal:", await alert.first().textContent());
  console.log("[DEBUG] modal aberto?", await page.getByRole("button", { name: "Criar plano" }).count());
  console.log("[DEBUG] linhas:", await page.locator('[data-testid^="plan-series:"]').count());
});
