// Instrument IDB and observe: seed via init script + log put/get/delete ops on firebaseLocalStorageDb.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const ops = [];

await page.addInitScript(() => {
  // Wrap IDB APIs to log operations
  const origPut = IDBObjectStore.prototype.put;
  const origDelete = IDBObjectStore.prototype.delete;
  const origGet = IDBObjectStore.prototype.get;
  const log = (m) => console.log("[idb]", m);
  IDBObjectStore.prototype.put = function (value, key) {
    if (this.name === "firebaseLocalStorage") log(`put name=${this.name} key=${JSON.stringify(key ?? value?.fbase_key)?.slice(0, 80)}`);
    return origPut.call(this, value, key);
  };
  IDBObjectStore.prototype.delete = function (key) {
    if (this.name === "firebaseLocalStorage") log(`delete name=${this.name} key=${JSON.stringify(key)?.slice(0, 80)}`);
    return origDelete.call(this, key);
  };
  IDBObjectStore.prototype.get = function (key) {
    if (this.name === "firebaseLocalStorage") log(`get name=${this.name} key=${JSON.stringify(key)?.slice(0, 80)}`);
    return origGet.call(this, key);
  };
  // Seed
  const open = indexedDB.open("firebaseLocalStorageDb", 1);
  open.onupgradeneeded = () => { open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); };
  open.onsuccess = () => {
    const db = open.result;
    const key = "firebase:authUser:AIzaSyAyI5gYrdWM5_G6Wu4k3MKlCkNU1stcLPU:[DEFAULT]";
    const tx = db.transaction("firebaseLocalStorage", "readwrite");
    const req = tx.objectStore("firebaseLocalStorage").put({
      fbase_key: key,
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
    req.onsuccess = () => console.log("[idb] seed put ok");
    tx.oncomplete = () => {
      const tx2 = db.transaction("firebaseLocalStorage", "readonly");
      const r2 = tx2.objectStore("firebaseLocalStorage").getAll();
      r2.onsuccess = () => console.log("[idb] after seed, records:", JSON.stringify(r2.result.map((o) => o.fbase_key)).slice(0, 200));
      db.close();
    };
  };
});

page.on("console", (m) => { if (String(m.text()).startsWith("[idb]")) console.log("[page]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" }).catch((e) => console.log("goto err", e.message));
await page.waitForTimeout(6000);

const dump = await page.evaluate(async () => {
  const out = { dbs: null, records: null };
  out.dbs = (await indexedDB.databases()).map((d) => d.name);
  const db = await new Promise((res, rej) => { const r = indexedDB.open("firebaseLocalStorageDb"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  out.records = [...db.objectStoreNames].map((sn) => {
    const req = db.transaction(sn, "readonly").objectStore(sn).getAll();
    return new Promise((res) => { req.onsuccess = () => res({ store: sn, items: req.result.map((o) => o.fbase_key) }); });
  });
  await Promise.all(out.records);
  db.close();
  return out;
});
console.log("final:", JSON.stringify(dump));
await browser.close();
