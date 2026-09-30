const CACHE_NAME = "Dydlye-v1";
const ASSETS_TO_CACHE = ["/", "/Dydlye.png", "/icon.png", "/manifest.json"];

// Map servers to cache
const MAP_HOSTS = [
  "basemaps.cartocdn.com",
  "server.arcgisonline.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache GET requests
  if (event.request.method !== "GET") return;

  // Don't cache internal/virtual paths (like ~oauth, ~functions), supabase auth, or Vite dev server
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.pathname.startsWith("/~") ||
    url.pathname.includes("/auth/v1/") ||
    url.host.includes("supabase.co") ||
    url.pathname.includes("@vite") ||
    url.pathname.includes("node_modules") ||
    url.port === "8080" ||
    url.port === "8081"
  )
    return;

  // Cache map tiles and fonts
  if (MAP_HOSTS.some((host) => url.host.includes(host)) || event.request.destination === "image") {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => {
          return cache.match(event.request).then((response) => {
            if (response) return response;

            return fetch(event.request)
              .then((networkResponse) => {
                if (
                  !networkResponse ||
                  networkResponse.status !== 200 ||
                  (networkResponse.type !== "basic" &&
                    !MAP_HOSTS.some((host) => url.host.includes(host)))
                ) {
                  return networkResponse;
                }
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              })
              .catch(() => {
                // Return a dummy response instead of rejecting
                return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
              });
          });
        })
        .catch(() => {
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        }),
    );
    return;
  }

  // Default strategy: Stale-while-revalidate for local assets
  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback to cached response or a dummy offline response
            return (
              cachedResponse ||
              new Response("Offline", { status: 503, statusText: "Service Unavailable" })
            );
          });
        return cachedResponse || fetchPromise;
      })
      .catch(() => {
        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      }),
  );
});
