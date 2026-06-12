// ── Riego Dashboard Service Worker ──
const VERSION = 'v51';
const CACHE   = 'riego-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ── INSTALL: cachear assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => {
        console.log('[SW] v' + VERSION + ' installed');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        console.log('[SW] v' + VERSION + ' activo');
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: VERSION })
        );
      })
  );
});

// ── SKIP_WAITING ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── FETCH: cache-first para todo — funciona offline ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignorar tiles de mapas — no se pueden cachear offline
  if (url.hostname.includes('google.com') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('openstreetmap.org') ||
      url.hostname.includes('tile.')) return;

  const isHTML = url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // HTML: cache-first con actualización en background (stale-while-revalidate)
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
          // Devolver caché inmediatamente si existe, actualizar en background
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // Todo lo demás: cache-first, fallback a red
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
