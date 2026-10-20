import { chromium } from "playwright";
import fs from "node:fs";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const OUT = "/tmp/opencode/recap";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });

const SYNTHETIC_RECAP = {
  id: 999999,
  profileId: "e2e",
  recapMonth: "2026-10-01",
  totalFocusMinutes: 3120, // 52h
  longestStreak: 47,
  streakIsAlive: true,
  leagueTier: "LENDAS",
  leagueAtStart: "OURO",
  leaguePromoted: true,
  productivityTag: "Foco",
  gardenCount: 293,
  totalXp: 6209,
  coinsGained: 120,
  missionsCompleted: 18,
  goalsCompleted: 4,
  achievementsUnlocked: 7,
  topFocusCategory: "Estudo",
  hasBeenShared: false,
  generatedAt: new Date().toISOString(),
  status: "live",
};

async function openRecap(width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height }, timezoneId: "America/Sao_Paulo", serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  // Recap sintético com valores grandes (293 energias, 6.209 XP, 52h)
  await page.route("**/api/recap**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recaps: [SYNTHETIC_RECAP] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ recap: SYNTHETIC_RECAP }),
    });
  });

  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.locator('button:has-text("Entrar")').click();
    await page.waitForTimeout(2500);
  }
  await page.goto(BASE + "/perfil", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }

  // Rola até a seção de recap
  const trigger = page.locator('button:has-text("Ver recap de")').first();
  let count = await trigger.count();
  if (count === 0) {
    const generate = page.locator('button:has-text("Gerar recap")').first();
    if (await generate.count()) {
      console.log(`[${tag}] gerando recap...`);
      await generate.scrollIntoViewIfNeeded();
      await generate.click();
      await page.waitForTimeout(6000);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
    }
  }
  const trigger2 = page.locator('button:has-text("Ver recap de")').first();
  count = await trigger2.count();
  if (count === 0) {
    console.log(`[${tag}] nenhum recap disponível na conta de teste`);
    await page.close();
    return;
  }
  await trigger2.scrollIntoViewIfNeeded();
  await trigger2.click();
  await page.waitForTimeout(1200);

  const card = page.locator('div[role="dialog"] > div').first();
  const box = await card.boundingBox();
  console.log(`\n[${tag}] viewport ${width}x${height} | cartão ${Math.round(box.width)}x${Math.round(box.height)}`);

  // Mede sobreposições dentro do cartão
  const overlap = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return null;
    const card = dialog.querySelector('div[aspect-ratio], div[style*="aspect-ratio"]');
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
    const cardRect = card ? rect(card) : null;
    const out = [];
    for (const el of dialog.querySelectorAll("*")) {
      const r = rect(el);
      if (r.w === 0 || r.h === 0) continue;
      if (r.x < 0 || r.right > window.innerWidth) out.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), reason: "fora da viewport horizontal", x: Math.round(r.x), right: Math.round(r.right) });
    }
    return { cardRect: cardRect && { x: Math.round(cardRect.x), y: Math.round(cardRect.y), w: Math.round(cardRect.w), h: Math.round(cardRect.h), right: Math.round(cardRect.right), bottom: Math.round(cardRect.bottom) }, overflow: out.slice(0, 6) };
  });
  console.log("  cartão:", JSON.stringify(overlap?.cardRect));
  if (overlap?.overflow?.length) console.log("  overflow horizontal:", JSON.stringify(overlap.overflow));

  for (let slide = 0; slide < 7; slide += 1) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${tag}-slide${slide}.png` });
    // verificação de overflow horizontal do conteúdo do slide
    const info = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      const card = dialog?.querySelector('div[style*="aspect-ratio"]');
      if (!card) return null;
      const cr = card.getBoundingClientRect();
      const bad = [];
      for (const el of card.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < cr.left - 1 || r.right > cr.right + 1) {
          bad.push({ tag: el.tagName, text: (el.textContent || "").trim().slice(0, 22), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return bad.slice(0, 5);
    });
    if (info?.length) console.log(`  slide ${slide}: elementos fora do cartão ->`, JSON.stringify(info));

    // Overlap entre setas/botões do cabeçalho e textos do slide
    const hits = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return [];
      const controls = [...dialog.querySelectorAll('button[aria-label="Slide anterior"], button[aria-label="Próximo slide"], button[aria-label="Fechar"], button[aria-label*="sons"]')];
      const out = [];
      const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      for (const control of controls) {
        const cr = control.getBoundingClientRect();
        if (cr.width === 0) continue;
        for (const el of dialog.querySelectorAll("p, h1, h2, h3, span, button")) {
          if (control.contains(el) || el.contains(control)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (!el.textContent?.trim()) continue;
          if (overlaps(cr, r)) {
            out.push({ control: control.getAttribute("aria-label"), text: (el.textContent || "").trim().slice(0, 24) });
          }
        }
      }
      return out.slice(0, 6);
    });
    if (hits?.length) console.log(`  slide ${slide}: SOBREPOSIÇÃO ->`, JSON.stringify(hits));
    if (slide < 6) {
      await page.locator('button[aria-label="Próximo slide"]').click({ force: true });
      await page.waitForTimeout(500);
    }
  }

  // Testa o download no slide final
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  const dl = page.locator('button:has-text("Baixar")').first();
  if (await dl.count()) {
    await dl.click();
    const download = await downloadPromise;
    console.log("  download:", download ? await download.suggestedFilename() : "FALHOU");
    if (download) {
      const p = `${OUT}/${tag}-export.png`;
      await download.saveAs(p);
      console.log("  export salvo em", p, fs.statSync(p).size, "bytes");
    }
  }

  console.log("  erros de página:", errors);
  await page.close();
}

await openRecap(360, 780, "mobile360");
await openRecap(768, 1024, "tablet768");
await openRecap(1440, 900, "desktop1440");

await browser.close();
