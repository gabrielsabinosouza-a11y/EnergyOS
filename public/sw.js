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

/* ============================================================
   CACHE STRATEGY: Network-first for everything, with versioning.
   Never cache /api/* routes (auth/session state). Always clone the
   network response before reading/caching it, so the original can
   be safely consumed by the caller.
   ============================================================ */

function shouldBypass(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return true;
  if (url.origin !== self.location.origin) return true; // skip cross-origin (Google APIs, CDNs, etc.)
  return false;
}

// Cache versioning: each deployment bumps VERSION, old caches auto-cleaned on activate.
function cacheNameFor(request) {
  // All requests get the same VERSION cache; we only store non-API stuff.
  return VERSION;
}

/* Network-first fetch: fetch from network, clone for cache, return response.
   This eliminates the "Response body is already used" clone error because
   we always clone the network response immediately after receiving it,
   before any code reads the body. The returned Response has its body still
   fresh for the caller. */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Bypass all API requests, cross-origin, and non-GET methods.
  if (shouldBypass(request)) return;

  // Navigations: network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Clone immediately for cache; the caller still gets a fresh body.
          const copy = res.clone();
          if (res.ok) caches.open(VERSION).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((r) => r || new Response("Offline", { status: 503, headers: { "Content-Type": "text/html" } }))
        )
    );
    return;
  }

  // Same-origin static assets: network-first (so updates are immediate),
  // but we cache the clone so future offline works. This also avoids the
  // clone-race because we never call .clone() on a cached response whose
  // body may already be consumed.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (!res.ok) return res; // don't cache errors
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || new Response("Offline", { status: 503 })))
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