import { test, expect } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

test("repro: foco no campo Título", async ({ page }) => {
  test.setTimeout(120000);
  page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

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

  await page.goto("/planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Semana", exact: true }).first().click({ force: true });
  await page.waitForTimeout(800);

  await page.locator('button[aria-label^="Adicionar plano"]').first().click();
  await page.waitForTimeout(800);

  const input = page.locator("#planner-plan-title");
  await input.click();
  await page.waitForTimeout(200);

  // Marca o nó para detectar remount
  await page.evaluate(() => {
    const el = document.querySelector("#planner-plan-title");
    if (el) el.setAttribute("data-marker", "original");
  });

  const text = "Gravar video do YouTube";
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(60);
  }

  const state = await page.evaluate(() => {
    const el = document.querySelector("#planner-plan-title");
    return {
      value: el?.value,
      marker: el?.getAttribute("data-marker"),
      focusedId: document.activeElement?.id,
      activeTag: document.activeElement?.tagName,
    };
  });
  console.log("[repro] estado final:", JSON.stringify(state));

  await page.screenshot({ path: "test-results/repro-titulo.png" });
});
