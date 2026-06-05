// ── Riego Dashboard Service Worker ──
// Cambia VERSION con cada deploy para forzar actualización en todos los dispositivos
const VERSION = 'v21';
const CACHE   = 'riego-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ── INSTALL: cachear assets y activar inmediatamente ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => {
        console.log('[SW] v' + VERSION + ' installed');
        // Activar de inmediato sin esperar a que cierren las pestañas
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: limpiar caches viejos y tomar control de todos los clientes ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Eliminando cache antiguo:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())  // tomar control de todas las pestañas/apps abiertas
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        console.log('[SW] v' + VERSION + ' activo, notificando ' + clients.length + ' cliente(s)');
        // Notificar a cada cliente que hay una nueva versión
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: VERSION })
        );
      })
  );
});

// ── SKIP_WAITING message (botón "Actualizar" en el banner) ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH: HTML network-first, assets cache-first ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  const isLib  = url.hostname.includes('cdnjs.cloudflare.com') ||
                 url.hostname.includes('fonts.googleapis.com') ||
                 url.hostname.includes('fonts.gstatic.com');

  if (isHTML) {
    // Network-first para HTML: siempre intentar traer el más reciente
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
  } else if (isLib) {
    // Cache-first para CDN libs (no cambian)
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
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
