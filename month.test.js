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

test("month view functional", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message, stack: e.stack }));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console-error", message: msg.text() });
  });

  await authenticate(page);
  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const skipTour = page.locator('button:has-text("Pular tour")');
  if ((await skipTour.count()) > 0) { await skipTour.first().click(); await page.waitForTimeout(500); }

  await page.locator('button:has-text("Mês")').click();
  await page.waitForTimeout(800);
  console.log("month label:", await page.locator("text=outubro de 2026").first().textContent());

  // Click the day cell "15" (today)
  const cells = page.locator('button[type="button"]');
  let clicked = false;
  for (let i = 0; i < await cells.count(); i++) {
    const txt = (await cells.nth(i).textContent() || "").trim();
    const aria = await cells.nth(i).getAttribute("aria-label") || "";
    if (txt === "15" && aria.includes("Dia 15")) {
      await cells.nth(i).click();
      clicked = true;
      break;
    }
  }
  console.log("clicked day 15:", clicked);
  await page.waitForTimeout(800);
  console.log("url after click:", page.url());
  if (page.url().includes("/planner")) {
    console.log("day h2:", await page.locator("h2").first().textContent());
    console.log("day p:", await page.locator('p:has-text("de out.")').first().textContent());
  }

  console.log("=== ERRORS ===");
  console.log(JSON.stringify(errors));
  await page.close();
});
