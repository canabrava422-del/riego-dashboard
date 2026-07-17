// ── Agronomir Service Worker ──
const VERSION = 'v66';
const CACHE   = 'riego-' + VERSION;

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

async function limpiarRedireccion(resp) {
  if (!resp || !resp.redirected) return resp;
  const body = await resp.clone().blob();
  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        ASSETS.map(async url => {
          try {
            const resp = await fetch(url, { redirect: 'follow' });
            const limpio = await limpiarRedireccion(resp);
            await cache.put(url, limpio);
          } catch(e) {}
        })
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
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // NUNCA cachear el propio SW ni el manifest — deben ir siempre a red
  if (url.pathname.endsWith('sw.js') ||
      url.pathname.endsWith('manifest.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Ignorar tiles de mapas
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
