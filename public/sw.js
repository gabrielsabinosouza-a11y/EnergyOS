/* energyOS service worker — offline shell + local reminders channel.
 * Kept intentionally dependency-free (plain ES5-ish JS) because it is served
 * as a static file from /public. */
const VERSION = "energyos-v1";
const CORE_ASSETS = [
  "/",
  "/icons_8bits/logo.png",
  "/icons_pwa/icon-192.png",
  "/icons_pwa/icon-512.png",
  "/icons_pwa/apple-touch-icon.png",
  "/icons_pwa/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Never cache API responses — the app is live-data by design. */
function shouldBypass(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return true;
  if (url.origin !== self.location.origin) return false; // allow-cors fonts/images to cache
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (shouldBypass(request)) return;

  // Navigations: network-first with an offline fallback to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(VERSION).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* Local-reminder channel: the app posts {type:"REMINDER", ...} and the SW
 * renders it as an OS notification. This also makes the notification appear
 * when the app is open but its tab is hidden. */
self.addEventListener("message", (event) => {
  if (!event || !event.data || event.data.type !== "REMINDER") return;
  const { title, body, tag, icon } = event.data;
  try {
    self.registration.showNotification(title || "energyOS", {
      body: body || "",
      tag: tag || "reminder",
      icon: icon || "/icons_pwa/icon-192.png",
      badge: "/icons_pwa/icon-192.png",
      data: { url: event.data.url || "/dashboard" },
    });
  } catch { /* notifications unavailable */ }
});

self.addEventListener("notificationclick", (event) => {
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});