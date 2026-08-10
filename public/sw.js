const CACHE_NAME = "mamma-moves-v3";
const APP_SHELL = [
  "/",
  "/login",
  "/intro",
  "/exercises",
  "/workouts",
  "/workouts/archive",
  "/calendar",
  "/stats",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }

          return response;
        })
        .catch(() => caches.match(request).then((cachedResponse) => cachedResponse || caches.match("/offline.html")))
    );
    return;
  }

  if (new URL(request.url).origin !== self.location.origin) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return response;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener("push", (event) => {
  const fallbackPayload = {
    title: "Håll din streak levande",
    body: "Ett kort pass räcker för idag.",
    url: "/workouts",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "daily-streak"
  };
  const payload = event.data ? event.data.json() : fallbackPayload;

  event.waitUntil(
    self.registration.showNotification(payload.title || fallbackPayload.title, {
      body: payload.body || fallbackPayload.body,
      icon: payload.icon || fallbackPayload.icon,
      badge: payload.badge || fallbackPayload.badge,
      tag: payload.tag || fallbackPayload.tag,
      data: {
        url: payload.url || fallbackPayload.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/workouts";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }

      return self.clients.openWindow(url);
    })
  );
});
