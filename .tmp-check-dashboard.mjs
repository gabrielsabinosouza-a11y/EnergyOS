// Load /dashboard as an authenticated user:
//  - seed Firebase auth state in IndexedDB (real app API key)
//  - intercept identitytoolkit lookups with a fake response so user.reload() succeeds
// Then dump: dev overlay badge state, dev buttons presence, focus card layout.
import { chromium } from "playwright";
import fs from "node:fs";

const readEnvValue = (file, key) => {
  const text = fs.readFileSync(file, "utf8");
  return new RegExp(`^${key}=(.+)$`, "m").exec(text)?.[1];
};
const devProfileId = readEnvValue(".env.local", "DEV_PROFILE_ID");
const apiKey = readEnvValue(".env", "NEXT_PUBLIC_FIREBASE_API_KEY");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (devProfileId) await context.setExtraHTTPHeaders({ "x-dev-profile-id": devProfileId });
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 150)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 150)));

await page.route("**/identitytoolkit.googleapis.com/**", (route) => {
  const url = route.request().url();
  if (url.includes("accounts:lookup")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [{ localId: "seed-dev-user-1", displayName: "Dev User", email: "dev@example.com", emailVerified: true, photoUrl: "", providerUserInfo: [] }],
      }),
    });
  }
  return route.abort();
});

await page.addInitScript((key) => {
  const open = indexedDB.open("firebaseLocalStorageDb", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction("firebaseLocalStorage", "readwrite");
    tx.objectStore("firebaseLocalStorage").put({
      fbase_key: `firebase:authUser:${key}:[DEFAULT]`,
      value: {
        uid: "seed-dev-user-1",
        email: "dev@example.com",
        displayName: "Dev User",
        emailVerified: true,
        isAnonymous: false,
        providerData: [],
        stsTokenManager: { refreshToken: "fake-refresh-token", accessToken: "fake-access-token", expirationTime: Date.now() + 3600_000 },
      },
    });
    tx.oncomplete = () => db.close();
  };
}, apiKey);

await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto:", e.message));
await page.waitForTimeout(10000);

const dump = await page.evaluate(() => {
  const out = { url: location.pathname, badge: null, issuesOpen: [], devButtons: [], focusCard: null, startBtn: null, statsGrid: [] };
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
    for (const el of sr.querySelectorAll("[data-issues-open]")) out.issuesOpen.push({ text: el.innerText.trim().slice(0, 60) });
  }
  out.devButtons = [...document.querySelectorAll("button")].filter((b) => /^dev:?\s*\+?\s*(10|75|500)$/i.test(b.innerText.trim())).map((b) => b.innerText);
  const startBtn = [...document.querySelectorAll("button")].find((b) => /iniciar foco/i.test(b.innerText));
  if (startBtn) {
    const r = startBtn.getBoundingClientRect();
    out.startBtn = { text: startBtn.innerText.trim(), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    out.focusCard = { startBtnY: Math.round(r.y) };
  }
  out.statsGrid = [...document.querySelectorAll("div.grid.grid-cols-2")].slice(0, 2).map((g) => { const r = g.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), children: g.children.length }; });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: ".tmp-dashboard.png" }).catch((e) => console.log("screenshot err", e.message));
await browser.close();
