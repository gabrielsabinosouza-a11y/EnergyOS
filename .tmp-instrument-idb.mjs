// Instrument IDB: log get results + delete stack traces.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const userKey = "firebase:authUser:AIzaSyAyI5gYrdWM5_G6Wu4k3MKlCkNU1stcLPU:[DEFAULT]";

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
  const log = (m) => console.log("[idb]", m);
  const origPut = IDBObjectStore.prototype.put;
  const origDelete = IDBObjectStore.prototype.delete;
  const origGet = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.put = function (v, k) {
    const r = origPut.call(this, v, k);
    if (this.name === "firebaseLocalStorage") log(`put key=${JSON.stringify(v?.fbase_key ?? k)?.slice(0, 90)}`);
    return r;
  };
  IDBObjectStore.prototype.delete = function (k) {
    if (this.name === "firebaseLocalStorage") {
      log(`delete key=${JSON.stringify(k)?.slice(0, 90)}`);
      log("delete stack: " + new Error().stack.split("\n").slice(1, 6).join(" <- ").slice(0, 400));
    }
    return origDelete.call(this, k);
  };
  IDBObjectStore.prototype.get = function (k) {
    const r = origGet.call(this, k);
    if (this.name === "firebaseLocalStorage" && String(k).includes("authUser")) {
      r.onsuccess = () => log(`get key=${JSON.stringify(k)?.slice(0, 90)} result=${JSON.stringify(r.result)?.slice(0, 300)}`);
    }
    return r;
  };
  const open = indexedDB.open("firebaseLocalStorageDb", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction("firebaseLocalStorage", "readwrite");
    tx.objectStore("firebaseLocalStorage").put({
      fbase_key: key,
      value: {
        uid: "seed-dev-user-1", email: "dev@example.com", displayName: "Dev User",
        emailVerified: true, isAnonymous: false, providerData: [],
        stsTokenManager: { refreshToken: "fake-refresh-token", accessToken: "fake-access-token", expirationTime: Date.now() + 3600_000 },
      },
    });
    tx.oncomplete = () => db.close();
  };
}, userKey);

page.on("console", (m) => {
  const t = m.text();
  if (String(t).startsWith("[idb]")) console.log("[page]", t.slice(0, 450));
  if (m.type() === "warning" || m.type() === "error") console.log(`[console.${m.type()}]`, t.slice(0, 400));
});

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" }).catch((e) => console.log("goto err", e.message));
await page.waitForTimeout(7000);
const dump = await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open("firebaseLocalStorageDb"); r.onsuccess = () => res(r.result); });
  const recs = {};
  for (const sn of db.objectStoreNames) {
    const req = db.transaction(sn, "readonly").objectStore(sn).getAll();
    await new Promise((res) => { req.onsuccess = () => res(); req.onerror = () => res(); });
    recs[sn] = req.result.map((o) => o.fbase_key);
  }
  db.close();
  return { url: location.pathname, title: document.title, recs };
});
console.log("final:", JSON.stringify(dump));
await browser.close();
