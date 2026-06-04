// ── Auto-versioned cache ──
// IMPORTANTE: Cambia VERSION cada vez que actualices archivos
// v1 → v2 → v3 → etc.
const VERSION = 'v12';
const CACHE = 'riego-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ── INSTALL: pre-cache assets ──
self.addEventListener('install', e => {
  // NO skipWaiting aquí — esperamos a que el usuario confirme
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => null)))
    )
  );
  console.log('[SW] Installed version:', VERSION);
});

// ── ACTIVATE: limpiar caches viejos y tomar control ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notificar a TODOS los clientes (pestañas/apps abiertas)
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
          console.log('[SW] Notified client:', client.url);
        });
      })
  );
});

// ── Escuchar mensaje SKIP_WAITING del botón "Actualizar" ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting, activating now...');
    self.skipWaiting();
  }
});

// ── FETCH: network-first para HTML, cache-first para librerías ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  const isLib  = url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isHTML) {
    // Network-first: siempre intenta traer el HTML más reciente
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
  } else if (isLib) {
    // Cache-first: las librerías CDN no cambian
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        });
      })
    );
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
