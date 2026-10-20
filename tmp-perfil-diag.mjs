import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block" });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 400)); });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 400)));
page.on("response", async (r) => {
  if (r.url().includes("/api/recap")) console.log("RECAP API:", r.status(), r.url());
});

await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);
}
await page.goto(BASE + "/perfil", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("url:", page.url());
console.log("h1:", await page.locator("h1").allTextContents());
console.log("botao Gerar recap:", await page.locator('button:has-text("Gerar recap")').count());
console.log("botao Ver recap:", await page.locator('button:has-text("Ver recap de")').count());
console.log("texto Recap mensal:", await page.locator('text=Recap mensal').count());
console.log("body snippet:", (await page.locator("body").innerText()).slice(0, 400));
await browser.close();
