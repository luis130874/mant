const SW_BUILD_ID = '__PRODEXUS_BUILD_ID__';
const CACHE_PREFIX = 'prodexus-cmms-';
const CACHE_NAME = CACHE_PREFIX + SW_BUILD_ID;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (event.data.type === 'PURGE_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      })()
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never intercept Firebase auth handlers, Vite dev internals, or version manifest
  if (
    url.pathname.startsWith('/__') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.endsWith('/version.json') ||
    url.pathname === '/version.json' ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  const isNavigation = req.mode === 'navigate';
  const isStaticAsset =
    url.pathname.includes('/assets/') ||
    /\.(html|js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);

  if (!isNavigation && !isStaticAsset) return;

  // Network-First with cache: 'no-cache' so online users always receive fresh bundles and manual assets
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(req, { cache: 'no-cache' });
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
