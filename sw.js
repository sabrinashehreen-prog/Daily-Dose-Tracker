// sw.js: the service worker. It keeps a copy of every file in the browser's
// cache, which is what makes the app open with no connection.
//
// THE TRAP THIS FILE AVOIDS:
// A service worker that only ever serves the cache will keep showing people
// the version they first visited - forever - no matter what you push to
// GitHub. The fix below is "serve the cache, then quietly refetch": the page
// still opens instantly offline, but every visit also pulls a fresh copy in
// the background, so the NEXT open shows your latest code.
//
// Bumping VERSION on a release makes the change land one visit sooner, and
// throws away the old cache. Forgetting to bump it is no longer fatal.
const VERSION = "v2";
const CACHE_NAME = `daily-dose-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./storage.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// On install: download and store the whole app.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// On activate: delete caches from older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GETs are cacheable, and only our own files are ours to cache.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        // Start the refetch whether or not we have a copy already.
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok) {
              // The body can only be read once, so cache a clone of it.
              cache.put(request, response.clone());
            }
            return response;
          })
          // Offline, and nothing cached: fall back to the app's own page
          // so a deep link still opens instead of showing a browser error.
          .catch(() => cached || cache.match("./index.html"));

        // Cached copy wins the race when there is one - that is the speed.
        return cached || fresh;
      })
    )
  );
});
