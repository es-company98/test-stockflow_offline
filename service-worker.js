const CACHE_NAME = "stockflow-v1";

// ⚡ assets core (offline shell)
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/products.html",
  "/purchases.html",
  "/stats.html",
  "/expensess.html",
  "/pages.html",
  "/login.html",
  "/help.html",
  "/settings.html",

  "/js/index.js",
  "/js/ui.js",
  "/js/nav.js",
  "/js/pwa.js",
  "/js/receipt.js.js",
  "/js/products.js",
  "/js/purchases.js",
  "/js/stats.js",
  "/js/expensess.js",
  "/js/pages.js",
  "/js/login.js",
  "/js/settings.js",
  

  "/js/firebase.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );

  self.skipWaiting(); // active direct
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // API Firebase → jamais cache (important)
  if (request.url.includes("firebase") || request.url.includes("googleapis")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          // update cache dynamique
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
      );
    })
  );
});


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then((reg) => {
        console.log("SW OK:", reg.scope);
      })
      .catch((err) => {
        console.error("SW FAIL:", err);
      });
  });
}

