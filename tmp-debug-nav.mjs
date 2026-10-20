import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/opencode/recap-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo" });
const page = await context.newPage();

page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("  [nav]", f.url()); });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console error]", m.text().slice(0, 200)); });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 300000 });
await page.locator('input[type="email"]').fill("e2e.planner@energyos.test");
await page.locator('input[type="password"]').fill("Planner123!");
await page.locator('button[type="submit"]:has-text("Entrar")').click();
await page.waitForURL("**/dashboard", { timeout: 60000 });

await page.goto(`${BASE}/perfil`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForTimeout(10000);
const skip = page.locator('button:has-text("Pular tour")');
if (await skip.count()) await skip.first().click();

const trigger = page.locator('button:has-text("Ver recap de")');
console.log("triggers:", await trigger.count());
await trigger.first().click();
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000);
  const dlg = await page.locator('[role="dialog"]').count();
  console.log(`  t=${i + 1}s url=${page.url()} dialog=${dlg}`);
}
await page.screenshot({ path: `${OUT}/debug-modal.png` });
await browser.close();
