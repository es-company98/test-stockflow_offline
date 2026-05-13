const CACHE_NAME = "stockflow-v01";

/* =========================
   CORE OFFLINE FILES
========================= */

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
  "/manifest.json",
  "/logo.png",
  "/home.png",
  "/settings.html",
  "/ranging.html",

  "/js/index.js",
  "/js/ui.js",
  "/js/nav.js",
  "/js/pwa.js",
  "/js/receipt.js",
   "/js/offline.js",
  "/js/products.js",
  "/js/purchases.js",
  "/js/stats.js",
  "/js/expensess.js",
  "/js/pages.js",
  "/js/login.js",
  "/js/settings.js",
  "/js/ranging.js",
  "/js/firebase.js"

];

/* =========================
   INSTALL
========================= */

self.addEventListener(
  "install",
  (event) => {

    event.waitUntil(

      caches.open(CACHE_NAME)
        .then(async (cache) => {

          for (const asset of CORE_ASSETS) {

            try {

              await cache.add(asset);

              console.log(
                "✅ Cached:",
                asset
              );

            } catch (err) {

              console.error(
                "❌ Cache failed:",
                asset,
                err
              );

            }

          }

        })

    );

    self.skipWaiting();

  }
);

/* =========================
   ACTIVATE
========================= */

self.addEventListener(
  "activate",
  (event) => {

    event.waitUntil(

      caches.keys()
        .then((keys) => {

          return Promise.all(

            keys
              .filter(
                (key) =>
                  key !== CACHE_NAME
              )
              .map(
                (key) =>
                  caches.delete(key)
              )

          );

        })

    );

    self.clients.claim();

  }
);

/* =========================
   FETCH
========================= */

self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;

    /* ---------- Ignore non-GET ---------- */

    if (
      request.method !== "GET"
    ) {
      return;
    }

    /* ---------- Firebase ---------- */

    if (

      request.url.includes(
        "firebase"
      ) ||

      request.url.includes(
        "googleapis"
      )

    ) {

      event.respondWith(

        fetch(request)
          .catch(() => {

            return new Response(
              null,
              {
                status: 503,
                statusText:
                  "Offline"
              }
            );

          })

      );

      return;

    }

    /* ---------- Cache First ---------- */

    event.respondWith(

      caches.match(request)
        .then((cached) => {

          if (cached) {
            return cached;
          }

          return fetch(request)

            .then((response) => {

              if (
                !response ||
                !response.ok
              ) {
                return response;
              }

              const clone =
                response.clone();

              caches.open(
                CACHE_NAME
              )
              .then((cache) => {

                cache.put(
                  request,
                  clone
                );

              });

              return response;

            })

            .catch(async () => {

              const offlinePage =
                await caches.match(
                  "/index.html"
                );

              return (
                offlinePage ||

                new Response(
                  "Offline",
                  {
                    status: 503,
                    headers: {
                      "Content-Type":
                        "text/plain"
                    }
                  }
                )

              );

            });

        })

    );

  }
);

