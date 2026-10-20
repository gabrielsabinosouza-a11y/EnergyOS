// Verificação visual/funcional da tela final do recap (redesign).
// Uso: node tmp-recap-verify.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "e2e.planner@energyos.test";
const PASS = process.env.E2E_PASS ?? "Planner123!";
const OUT = "/tmp/opencode/recap-verify";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = (process.env.WIDTHS ?? "1440,1024,768,430,390,375,320")
  .split(",")
  .map((w) => Number(w.trim()));

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: "America/Sao_Paulo",
  acceptDownloads: true,
});
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

async function dismissTour(p) {
  const skip = p.locator('button:has-text("Pular tour")');
  if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(300); }
}

console.log("→ login");
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 300000 });
await page.waitForTimeout(800);
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button[type="submit"]:has-text("Entrar")').click();
  await page.waitForTimeout(8000);
}
await dismissTour(page);

console.log("→ profile");
await page.goto(`${BASE}/perfil`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForTimeout(12000);
await dismissTour(page);

const trigger = page.locator('button:has-text("Ver recap de")');
console.log("  recap triggers:", await trigger.count());
await trigger.first().click();
await page.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 60000 });
await page.waitForTimeout(1200);

// Navega até o último slide (7/7)
for (let i = 0; i < 6; i++) {
  await page.locator('button[aria-label="Próximo slide"]').click();
  await page.waitForTimeout(600);
}
await page.waitForTimeout(1500);

const body = page.locator('[role="dialog"] >> css=div.overflow-y-auto').first();

async function measure() {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const scroller = dialog ? Array.from(dialog.querySelectorAll("div")).find((d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY === "auto") : null;
    const rect = (el) => (el ? (({ x, y, width, height }) => ({ x, y, width, height }))(el.getBoundingClientRect()) : null);
    // Detecta elementos que estouram a largura do viewport
    const overflowing = [];
    document.querySelectorAll('[role="dialog"] *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
        overflowing.push(`${el.tagName}.${String(el.className).slice(0, 40)} → ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    });
    return {
      dialog: rect(dialog),
      scroller: rect(scroller),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollable: scroller ? { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight } : null,
      overflow: overflowing.slice(0, 6),
    };
  });
}

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(900);
  const m = await measure();
  console.log(`\n[${w}px] dialog=${JSON.stringify(m.dialog)}`);
  console.log(`   scroller=${JSON.stringify(m.scroller)} scrollable=${JSON.stringify(m.scrollable)}`);
  console.log(`   page scrollW=${m.scrollW} clientW=${m.clientW} overflow=${m.overflow.length ? JSON.stringify(m.overflow) : "none"}`);

  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const scroller = dialog ? Array.from(dialog.querySelectorAll("div")).find((d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY === "auto") : null;
    if (scroller) scroller.scrollTop = 0;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/w${w}-top.png` });

  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const scroller = dialog ? Array.from(dialog.querySelectorAll("div")).find((d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY === "auto") : null;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/w${w}-bottom.png` });
}

// ── Funcionalidades ───────────────────────────────────────────────────────
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(600);

console.log("\n→ download");
const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
await page.locator('button:has-text("Baixar PNG")').click();
const download = await dl;
console.log("  download:", download ? download.suggestedFilename() : "NÃO disparou");
if (download) {
  const p = `${OUT}/${download.suggestedFilename()}`;
  await download.saveAs(p);
  console.log("  saved:", p, fs.statSync(p).size, "bytes");
}

console.log("→ voltar");
await page.locator('button:has-text("Voltar")').click();
await page.waitForTimeout(900);
const backOk = await page.locator('button[aria-label="Próximo slide"]').count();
console.log("  voltou para o slide 9:16 (botão próximo visível):", backOk > 0);

console.log("→ fechar");
await page.locator('button[aria-label="Fechar"]').click();
await page.waitForTimeout(900);
console.log("  dialog fechado:", (await page.locator('[role="dialog"]').count()) === 0);

console.log("\nERRORS:\n" + (errors.slice(0, 20).join("\n") || "(nenhum)"));
await browser.close();
