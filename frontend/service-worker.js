const CACHE_NAME = 'fridge-chef-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard',
  '/admin',
  '/static/css/style.css',
  '/static/js/auth.js',
  '/static/js/inventory.js',
  '/static/js/meal_planner.js',
  '/static/js/cookbook.js',
  '/static/js/profile.js',
  '/static/js/quicklist.js',
  '/static/js/admin.js',
  '/static/icon-192.png',
  '/static/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  // Skip API calls from caching
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found, otherwise fetch from network
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            // Optional: dynamically cache new successful GET requests
            if (fetchRes.ok && event.request.url.startsWith(self.location.origin)) {
              cache.put(event.request, fetchRes.clone());
            }
            return fetchRes;
          });
        });
      }).catch(() => {
        // Fallback for offline if not in cache (e.g., return root index)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});