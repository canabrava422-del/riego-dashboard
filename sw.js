// ── Agronomir Service Worker ──
const VERSION = 'v54';
const CACHE   = 'riego-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-agronomir-v2-192.png',
  './icon-agronomir-v2-512.png',
  './icon-agronomir-v2.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => {
        console.log('[SW] ' + VERSION + ' installed');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        console.log('[SW] ' + VERSION + ' activo');
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: VERSION })
        );
      })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (url.hostname.includes('google.com') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('openstreetmap.org') ||
      url.hostname.includes('tile.')) return;

  const isHTML = url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request, { cache: 'no-cache' })
            .then(resp => {
              if (resp && resp.status === 200) {
                cache.put(e.request, resp.clone());
              }
              return resp;
            })
            .catch(() => null);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp?.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => null);
      })
    );
  }
});
