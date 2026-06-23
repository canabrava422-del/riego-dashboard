// ── Agronomir Service Worker ──
const VERSION = 'v56';
const CACHE   = 'riego-' + VERSION;

// Nota: quitamos './' de ASSETS — './index.html' ya cubre la página principal
// y evita que GitHub Pages devuelva una respuesta "redirected" que Safari rechaza.
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-agronomir-v2-192.png',
  './icon-agronomir-v2-512.png',
  './icon-agronomir-v2.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

// Helper: clona una Response quitando la bandera "redirected",
// que es la causa del error "response served by serviceworker has redirections" en Safari.
async function limpiarRedireccion(resp) {
  if (!resp) return resp;
  if (!resp.redirected) return resp;
  const body = await resp.clone().blob();
  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}

// ── INSTALL: cachear assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        ASSETS.map(async url => {
          try {
            const resp = await fetch(url, { redirect: 'follow' });
            const limpio = await limpiarRedireccion(resp);
            await cache.put(url, limpio);
          } catch (e) { /* ignorar fallos individuales */ }
        })
      ))
      .then(() => {
        console.log('[SW] ' + VERSION + ' installed');
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
        console.log('[SW] ' + VERSION + ' activo');
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
    // HTML: cache-first con actualización en background
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request, { cache: 'no-cache', redirect: 'follow' })
            .then(async resp => {
              if (resp && resp.status === 200) {
                const limpio = await limpiarRedireccion(resp.clone());
                cache.put(e.request, limpio);
              }
              return resp;
            })
            .catch(() => null);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // Todo lo demás: cache-first, fallback a red
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request, { redirect: 'follow' }).then(async resp => {
          if (resp?.status === 200) {
            const limpio = await limpiarRedireccion(resp.clone());
            caches.open(CACHE).then(c => c.put(e.request, limpio));
          }
          return resp;
        }).catch(() => null);
      })
    );
  }
});
