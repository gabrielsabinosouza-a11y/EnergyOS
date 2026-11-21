// Inspect the Next.js devtools badge (bottom-left) for issue count + red state.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

const dump = await page.evaluate(() => {
  const out = { badge: null, issuesOpen: [], toast: null };
  const portal = document.querySelector("nextjs-portal");
  const sr = portal?.shadowRoot;
  if (!sr) return out;

  const badge = sr.querySelector("[data-next-badge]");
  if (badge) {
    const r = badge.getBoundingClientRect();
    const cs = getComputedStyle(badge);
    out.badge = {
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      attrs: [...badge.attributes].map((a) => `${a.name}=${a.value}`),
      bg: cs.backgroundColor, boxShadow: cs.boxShadow?.slice(0, 100),
      html: badge.innerHTML.slice(0, 400),
      text: badge.innerText,
    };
  }

  for (const el of sr.querySelectorAll("[data-issues-open], [data-issues-collapse], [data-dot], [data-error], [data-cache-badge], [data-insights-only]")) {
    if (!out.badge) break;
    const r = el.getBoundingClientRect();
    out.issuesOpen.push({
      tag: el.tagName,
      attrs: [...el.attributes].map((a) => `${a.name}=${a.value.slice(0, 40)}`),
      text: el.innerText.trim().slice(0, 80),
      rect: { x: Math.round(r.x), y: Math.round(r.y) },
      bg: getComputedStyle(el).backgroundColor,
    });
  }

  const toast = sr.querySelector("[data-nextjs-toast]");
  if (toast) {
    out.toast = { text: toast.innerText.trim().slice(0, 500), attrs: [...toast.attributes].map((a) => `${a.name}=${a.value.slice(0, 40)}`) };
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
