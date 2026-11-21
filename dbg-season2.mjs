import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

for (const url of ["https://energyos-tan.vercel.app/", "https://energyos-tan.vercel.app/auth", "https://energyos-tan.vercel.app/dashboard"]) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => ({
      dataSeason: document.documentElement.getAttribute("data-season"),
      seasonLayer: document.querySelectorAll(".season-layer").length,
      seasonLights: document.querySelectorAll(".season-lights, .season-lights i").length,
      seasonSnow: document.querySelectorAll(".season-snow").length,
      seasonBats: document.querySelectorAll(".season-bat").length,
      seasonLogoAccessory: document.querySelectorAll(".season-logo-accessory").length,
      title: document.title,
    }));
    console.log(url, JSON.stringify(info));
  } catch (e) {
    console.log(url, "ERR", e.message.slice(0, 150));
  }
}
console.log("errors:", JSON.stringify(errors.slice(0, 10)));
await browser.close();
