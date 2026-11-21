import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (["error","warning"].includes(m.type())) errors.push(m.text().slice(0,160)); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0,160)));
for (const url of ["http://localhost:3000/", "http://localhost:3000/auth", "http://localhost:3000/dev/tour-preview?tour=1"]) {
  errors.length = 0;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(3500);
  // also do a client-side nav to trigger layout re-render paths
  await page.evaluate(() => { const a = document.querySelector("a[href]"); if (a) a.click(); }).catch(()=>{});
  await page.waitForTimeout(1500);
  const hits = errors.filter(e => /script tag|next\/script|theme-init/i.test(e));
  console.log(url, "→", hits.length ? hits.join(" | ") : "clean");
}
await browser.close();
