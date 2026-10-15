import { test } from "@playwright/test";

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

test("list planner buttons", async ({ page }) => {
  await authenticate(page);
  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const btns = page.locator("button");
  console.log("total buttons:", await btns.count());
  for (let i = 0; i < await btns.count(); i++) {
    const t = (await btns.nth(i).textContent() || "").trim();
    const aria = await btns.nth(i).getAttribute("aria-label");
    if (t) console.log("btn[" + i + "]:", JSON.stringify(t), "aria:", aria);
  }
  await page.close();
});
