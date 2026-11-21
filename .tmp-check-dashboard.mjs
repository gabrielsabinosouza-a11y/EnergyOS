// Load /dashboard as an authenticated user by seeding Firebase auth state in IndexedDB,
// then dump the Next.js dev overlay badge state and the focus card layout.
import { chromium } from "playwright";
import fs from "node:fs";

function readEnvValue(file, key) {
  const text = fs.readFileSync(file, "utf8");
  return new RegExp(`^${key}=(.+)$`, "m").exec(text)?.[1];
}

const envFiles = [".env", ".env.local", ".env.vercel"];
const apiKeys = [...new Set(envFiles.map((f) => readEnvValue(f, "NEXT_PUBLIC_FIREBASE_API_KEY")).filter(Boolean))];
const devProfileId = readEnvValue(".env.local", "DEV_PROFILE_ID");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (devProfileId) await context.setExtraHTTPHeaders({ "x-dev-profile-id": devProfileId });
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

for (const apiKey of apiKeys) {
  await page.addInitScript((key, rec) => {
    const open = indexedDB.open("firebaseLocalStorageDb", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("firebaseLocalStorage", "readwrite");
      tx.objectStore("firebaseLocalStorage").put({ fbase_key: `firebase:authUser:${key}:[DEFAULT]`, value: rec });
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    };
  }, apiKey, {
    uid: "seed-dev-user-1",
    email: "dev@example.com",
    displayName: "Dev User",
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    stsTokenManager: { refreshToken: "fake-refresh-token", accessToken: "fake-access-token", expirationTime: Date.now() + 3600_000 },
  });
}

await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(9000);

const dump = await page.evaluate(() => {
  const out = { url: location.pathname, badge: null, issuesOpen: [], devButtons: [], focusCard: null, bodySnippet: "" };
  const portal = document.querySelector("nextjs-portal");
  const sr = portal?.shadowRoot;
  if (sr) {
    const badge = sr.querySelector("[data-next-badge]");
    if (badge) {
      const r = badge.getBoundingClientRect();
      out.badge = {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        attrs: [...badge.attributes].map((a) => `${a.name}=${a.value}`),
        bg: getComputedStyle(badge).backgroundColor,
      };
    }
    for (const el of sr.querySelectorAll("[data-issues-open], [data-dot]")) {
      out.issuesOpen.push({ tag: el.tagName, text: el.innerText.trim().slice(0, 60), attrs: [...el.attributes].map((a) => `${a.name}=${a.value.slice(0, 30)}`) });
    }
  }
  out.devButtons = [...document.querySelectorAll("button")].filter((b) => /^dev:?\s*\+?\s*(10|75|500)$/i.test(b.innerText.trim())).map((b) => b.innerText);
  const startBtn = [...document.querySelectorAll("button")].find((b) => /iniciar foco/i.test(b.innerText));
  if (startBtn) {
    const r = startBtn.getBoundingClientRect();
    out.focusCard = { startBtn: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  }
  out.bodySnippet = document.body.innerText.slice(0, 300);
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: ".tmp-dashboard.png", fullPage: false }).catch((e) => console.log("screenshot err", e.message));
await browser.close();
