// Sightline Service Worker — sightline-v3
// Cache strategy: network-first for HTML pages, cache-first for static assets and images

const CACHE_VERSION = "sightline-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const PAGES_CACHE   = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE  = `${CACHE_VERSION}-images`;

const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];

// Static assets to precache on install
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { cache: "reload" })))
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Chrome extension URLs
  if (url.protocol === "chrome-extension:") return;

  // Skip Supabase REST / Auth / Functions (auth complexity — network only)
  if (
    url.hostname.includes("supabase.co") &&
    (url.pathname.startsWith("/rest/") ||
      url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/functions/"))
  ) {
    return;
  }

  // Supabase Storage images — cache-first, max 200 entries
  if (
    url.hostname.includes("supabase.co") &&
    url.pathname.startsWith("/storage/v1/object/public/")
  ) {
    event.respondWith(cacheFirstWithLimit(request, IMAGES_CACHE, 200));
    return;
  }

  // Next.js static assets — cache-first (hashed filenames, safe to cache forever)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Next.js image optimization
  if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(cacheFirstWithLimit(request, IMAGES_CACHE, 200));
    return;
  }

  // HTML navigation requests — network-first, fallback to cache
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(networkWithCacheFallback(request));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineFallback();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (_) {
    return new Response("", { status: 503 });
  }
}

async function cacheFirstWithLimit(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      const keys = await cache.keys();
      if (keys.length > maxEntries) {
        await cache.delete(keys[0]);
      }
    }
    return networkResponse;
  } catch (_) {
    return new Response("", { status: 503 });
  }
}

async function networkWithCacheFallback(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("", { status: 503 });
  }
}

function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sightline — Offline</title>
<style>
  body{margin:0;background:#0F0F0F;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;box-sizing:border-box;}
  .c{text-align:center;max-width:320px;}
  .icon{width:64px;height:64px;border-radius:50%;background:#1A1A1A;border:1px solid #2a2a2a;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;}
  h1{font-size:1.25rem;font-weight:800;margin:0 0 .5rem;}
  p{color:#6B7280;font-size:.875rem;margin:0;}
</style>
</head>
<body>
<div class="c">
  <div class="icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  </div>
  <h1>You're Offline</h1>
  <p>This page isn't cached yet. Go back to a page you've visited before, or reconnect to continue.</p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}
