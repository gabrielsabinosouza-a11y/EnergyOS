import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo" });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

async function dismissTour() {
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
}

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(2000);
}
await page.goto(BASE + "/planner", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await dismissTour();

async function report(label) {
  const addBtns = await page.getByRole("button", { name: /Adicionar plano/ }).all();
  const labels = [];
  for (const b of addBtns) labels.push(await b.getAttribute("aria-label"));
  const dashed = await page.locator('button:has-text("+ Adicionar")').count();
  console.log(`\n[${label}] botoes "Adicionar plano": ${addBtns.length}`);
  console.log(`  labels: ${JSON.stringify(labels, null, 0)}`);
  console.log(`  botoes "+ Adicionar" (dashed): ${dashed}`);
}

await page.locator('button:has-text("Semana")').first().click({ force: true });
await page.waitForTimeout(900);
await report("SEMANA");
await page.screenshot({ path: "/tmp/opencode/semana.png", fullPage: false });

// empty-state day card: count buttons inside the card that contains "Sem planos"
const cards = await page.locator('article').all();
for (const card of cards) {
  const text = (await card.textContent()) || "";
  const n = await card.getByRole("button", { name: /Adicionar plano/ }).count();
  console.log(`  card "${text.replace(/\s+/g, " ").trim().slice(0, 40)}" -> botoes adicionar: ${n}`);
}

// hit area of the add button
const first = page.getByRole("button", { name: /Adicionar plano/ }).first();
const box = await first.boundingBox();
console.log(`\n  hit area do 1o botao adicionar: ${box ? `${box.width}x${box.height}` : "n/a"}`);
await first.click();
await page.waitForTimeout(900);
const dialogVisible = await page.locator('input[placeholder="Ex.: Ir à academia"]').count();
console.log(`  clique abriu o dialogo de criar plano: ${dialogVisible > 0}`);
const dateValue = await page.locator('input[type="date"]').first().inputValue().catch(() => "n/a");
console.log(`  data pre-preenchida: ${dateValue}`);
await page.screenshot({ path: "/tmp/opencode/semana-dialog.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await page.locator('button:has-text("Dia")').first().click({ force: true });
await page.waitForTimeout(900);
await report("DIA");
await page.screenshot({ path: "/tmp/opencode/dia.png" });

await page.locator('button:has-text("Mês")').first().click({ force: true });
await page.waitForTimeout(900);
await report("MÊS");
await page.screenshot({ path: "/tmp/opencode/mes.png" });

console.log("\nerros de pagina:", errors);
await browser.close();
