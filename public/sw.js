const CACHE_NAME = 'magic-jump-__BUILD_VERSION__';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/animated/rock.png',
  '/assets/animated/stakes.png',
  '/assets/animated/log.png',
  '/assets/animated/ground-3-0.png',
  '/assets/animated/ground-3-1.png',
  '/assets/animated/ground-3-2.png',
  '/assets/animated/ground-4-0.png',
  '/assets/animated/ground-4-1.png',
  '/assets/animated/ground-4-2.png',
  '/assets/animated/overhead-0-0.png',
  '/assets/animated/overhead-0-1.png',
  '/assets/animated/overhead-0-2.png',
  '/assets/animated/overhead-0-3.png',
  '/assets/animated/overhead-1-0.png',
  '/assets/animated/overhead-1-1.png',
  '/assets/animated/overhead-1-2.png',
  '/assets/animated/overhead-1-3.png',
  '/assets/animated/overhead-2-0.png',
  '/assets/animated/overhead-2-1.png',
  '/assets/animated/overhead-2-2.png',
  '/assets/animated/overhead-2-3.png',
  '/assets/animated/overhead-3-0.png',
  '/assets/animated/overhead-3-1.png',
  '/assets/animated/overhead-4-0.png',
  '/assets/animated/overhead-4-1.png',
  '/assets/animated/enemy-ninja.png',
  '/assets/animated/enemy-archer.png',
  '/assets/animated/enemy-gingerbread.png',
  '/assets/animated/enemy-slime.png',
  '/assets/animated/enemy-robot.png',
  '/assets/animated/enemy-alien.png',
  '/assets/animated/enemy-kikimora.png',
  '/assets/animated/enemy-vodyanoy.png',
  '/assets/animated/enemy-sandworm.png',
  '/assets/animated/enemy-desert-guard.png',
  '/assets/enemies/ninja-v2.png',
  '/assets/enemies/archer-v2.png',
  '/assets/enemies/gingerbread-v2.png',
  '/assets/enemies/slime-v2.png',
  '/assets/enemies/robot-v2.png',
  '/assets/enemies/alien-v2.png',
  '/assets/enemies/kikimora-v2.png',
  '/assets/enemies/vodyanoy-v2.png',
  '/assets/enemies/sandworm-v2.png',
  '/assets/enemies/desert-guard-v2.png',
  '/assets/spells/sofia.png',
  '/assets/spells/stella.png',
  '/assets/spells/air.png',
  '/assets/spells/earth.png',
  '/assets/spells/kai.png',
  '/assets/spells/leya.png',

  '/manifest.webmanifest',
  '/app-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/art/menu-background.png',
  '/art/concept_persons.png',
  '/art/level-1-bg.png',
  '/art/level-1-floor.png',
  '/art/level-2-bg.png',
  '/art/level-3-bg.png',
  '/art/level-4-bg.png',
  '/art/level-5-bg.png',
  '/assets/enemies/kikimora.png',
  '/assets/enemies/vodyanoy.png',
  '/assets/enemies/sandworm.png',
  '/assets/enemies/desert-guard.png',
  '/assets/bonuses/world-3.png',
  '/assets/bonuses/world-4.png',
  '/assets/obstacles/world-3-0.png',
  '/assets/obstacles/world-3-1.png',
  '/assets/obstacles/world-3-2.png',
  '/assets/obstacles/world-4-0.png',
  '/assets/obstacles/world-4-1.png',
  '/assets/obstacles/world-4-2.png',
  '/assets/obstacles/overhead/level-3-variant-0.png',
  '/assets/obstacles/overhead/level-3-variant-1.png',
  '/assets/obstacles/overhead/level-3-variant-2.png',
  '/assets/obstacles/overhead/level-3-variant-3.png',
  '/assets/obstacles/overhead/level-4-variant-0.png',
  '/assets/obstacles/overhead/level-4-variant-1.png',
  '/assets/obstacles/overhead/level-4-variant-2.png',
  '/assets/obstacles/overhead/level-4-variant-3.png',

  '/art/victory.png',
  '/art/defeat.png',
  '/art/sprite.png',
  '/assets/enemies/ninja.png',
  '/assets/enemies/archer.png',
  '/assets/enemies/gingerbread.png',
  '/assets/enemies/slime.png',
  '/assets/enemies/robot.png',
  '/assets/enemies/alien.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );

});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).pathname.startsWith('/api/')) return;

  const url = new URL(req.url);

  // Navigation requests: Network-First with fallback to App Shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Same-origin assets or Google Fonts: Stale-While-Revalidate / Cache-First
  const isSameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  if (isSameOrigin || isFont) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});
