import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/opencode/recap";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });

async function check(width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.locator('input[type="email"]').fill("e2e.planner@energyos.test");
    await page.locator('input[type="password"]').fill("Planner123!");
    await page.locator('button:has-text("Entrar")').click();
    await page.waitForTimeout(3000);
  }
  await page.goto(BASE + "/__recap-preview", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Ver recap de")', { timeout: 30000 });
  await page.locator('button:has-text("Ver recap de")').click();
  await page.waitForTimeout(1500);

  const card = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    const el = dialog?.querySelector('div[style*="aspect-ratio"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  });
  console.log(`\n[${tag}] ${width}x${height} -> cartão ${JSON.stringify(card)}`);

  for (let slide = 0; slide < 7; slide += 1) {
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${tag}-s${slide}.png` });

    const report = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      const card = dialog?.querySelector('div[style*="aspect-ratio"]');
      if (!card) return null;
      const cr = card.getBoundingClientRect();
      const outside = [];
      const overlaps = [];
      const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const controls = [...dialog.querySelectorAll('button[aria-label="Slide anterior"], button[aria-label="Próximo slide"], button[aria-label="Fechar"], button[aria-label*="sons"]')];
      for (const el of card.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.left < cr.left - 1 || r.right > cr.right + 1) outside.push({ tag: el.tagName, text: (el.textContent || "").trim().slice(0, 20), left: Math.round(r.left), right: Math.round(r.right) });
      }
      for (const c of controls) {
        const rc = c.getBoundingClientRect();
        if (!rc.width) continue;
        for (const el of dialog.querySelectorAll("p, h1, h2, h3, span")) {
          if (c.contains(el) || el.contains(c)) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || !el.textContent?.trim()) continue;
          if (hit(rc, r)) overlaps.push({ control: c.getAttribute("aria-label"), text: (el.textContent || "").trim().slice(0, 20) });
        }
      }
      // texto do slide vs. largura do cartão
      const big = [...card.querySelectorAll("span, p, h2")].map((el) => ({ t: (el.textContent || "").trim().slice(0, 18), w: Math.round(el.getBoundingClientRect().width) })).filter((x) => x.w > cr.width - 20);
      return { outside: outside.slice(0, 4), overlaps: overlaps.slice(0, 4), wide: big.slice(0, 4) };
    });
    if (report?.outside?.length) console.log(`  s${slide} fora do cartão:`, JSON.stringify(report.outside));
    if (report?.overlaps?.length) console.log(`  s${slide} SOBREPOSIÇÃO:`, JSON.stringify(report.overlaps));
    if (report?.wide?.length) console.log(`  s${slide} texto largo:`, JSON.stringify(report.wide));

    if (slide < 6) {
      await page.locator('button[aria-label="Próximo slide"]').click({ force: true });
      await page.waitForTimeout(600);
    }
  }

  const dl = page.locator('button:has-text("Baixar")').first();
  if (await dl.count()) {
    const downloadPromise = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await dl.click();
    const download = await downloadPromise;
    console.log("  download:", download ? await download.suggestedFilename() : "FALHOU");
    if (download) {
      const p = `${OUT}/${tag}-export.png`;
      await download.saveAs(p);
      console.log("  export:", fs.statSync(p).size, "bytes");
    }
  }
  console.log("  erros:", errors.length ? errors : "nenhum");
  await page.close();
}

await check(320, 640, "w320");
await check(360, 780, "w360");
await check(768, 1024, "w768");
await check(1440, 900, "w1440");

await browser.close();
