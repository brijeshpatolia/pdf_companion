/*
 * A deliberately small service worker.
 *
 * Its job is twofold: make the app installable (Chrome requires a fetch
 * handler before it will offer "add to home screen"), and make an offline tab
 * say something useful instead of showing the browser's dinosaur.
 *
 * It is *not* an offline reading mode. Books live in Supabase behind auth, and
 * pretending a cached shell means a cached library would be a lie the first
 * time someone opened it on the underground.
 *
 * The caching rules are chosen so a stale cache can never serve stale app
 * code, which is the usual way a service worker ruins a deploy:
 *
 *   - Next's build output under /_next/static/ is content-hashed. A given URL
 *     there is immutable, so it is safe to serve from cache forever; a new
 *     build simply asks for different URLs.
 *   - Everything else — HTML, API calls, book files — goes to the network
 *     first. HTML falls back to a cached shell only when the network fails.
 *
 * Bump CACHE when this file changes so old entries are dropped on activate.
 */

const CACHE = "companion-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      // An install must not fail because one page 404s during a deploy.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that depends on who is signed in.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Content-hashed and immutable: cache first, and keep it.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pages: always the network, so a deploy is live immediately. The cache is
  // only ever a fallback for having no connection at all.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())),
    );
  }
});
