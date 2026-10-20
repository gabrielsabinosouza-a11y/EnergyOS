import { test } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";

test("inspect: atributos do input e elemento com foco", async ({ page }) => {
  test.setTimeout(120000);
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

  console.log("[inspect] outerHTML:", await page.evaluate(() => document.querySelector("#planner-plan-title")?.outerHTML));
  console.log("[inspect] autofocus no dialog?", await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      found: !!dialog?.querySelector("[autofocus]"),
      dialogAttrs: dialog?.getAttribute("tabindex"),
      active: document.activeElement?.tagName + "." + (document.activeElement?.className || "").slice(0, 60),
    };
  }));

  // Digita e observa onde o foco vai após cada tecla
  await page.locator("#planner-plan-title").click();
  for (const ch of "ABC") {
    await page.keyboard.type(ch);
    await page.waitForTimeout(120);
    console.log("[inspect] após tecla:", await page.evaluate(() => {
      const el = document.querySelector("#planner-plan-title");
      const a = document.activeElement;
      return `valor="${el?.value}" foco=${a?.tagName}${a?.id ? "#" + a.id : ""}`;
    }));
  }
});
