// sw.js - Service Worker untuk PWA

const CACHE_NAME = 'ourstory-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/chat.html',
  '/finance.html',
  '/memories.html',
  '/calendar.html',
  '/settings.html',
  '/ai.html',
  '/404.html',
  '/css/globals.css',
  '/css/theme.css',
  '/css/glass.css',
  '/css/components.css',
  '/css/responsive.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/supabase.js',
  '/js/chat.js',
  '/js/finance.js',
  '/js/memories.js',
  '/js/calendar.js',
  '/js/ai.js',
  '/js/notifications.js',
  '/js/ui.js',
  '/js/theme.js',
  '/js/utils.js',
  '/js/settings.js',
  '/manifest.json',
  '/favicon.ico'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Caching assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            return caches.match('/404.html');
          });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Ada notifikasi baru',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OurStory', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('✅ Service Worker loaded');
