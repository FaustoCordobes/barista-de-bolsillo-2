/* Barista de Bolsillo — Service Worker
 *
 * Estrategia de caché:
 *  - Precarga (install): el "esqueleto" de la app (HTML, JS, manifest, íconos).
 *  - Navegación / HTML: network-first → si no hay red, sirve la copia en caché.
 *    Así cada vez que publicás en Vercel, los usuarios con conexión reciben la versión nueva.
 *  - JS/íconos/manifest propios: stale-while-revalidate (rápido y se actualiza en segundo plano).
 *  - Google Fonts: cache-first en un caché aparte (si no hay red, se usa la fuente del sistema).
 *
 * Para forzar una actualización completa: subí el número de VERSION.
 */
const VERSION = 'bdb-v2.2.2';
const APP_CACHE = `${VERSION}-app`;
const FONT_CACHE = 'bdb-fonts';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './js/data.js',
  './js/flavors.js',
  './js/config.js',
  './js/i18n-ext.js',
  './js/logic.js',
  './js/app.js',
  './js/wheel.js',
  './js/cloud.js',
  './js/vendor/supabase.js',
  './js/features.js',
  './img/logo.png',
  './img/prensa.png',
  './img/expreso.png',
  './img/moka.png',
  './img/filtro.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // Se agregan de a uno: si falta un archivo, no se rompe toda la instalación.
    await Promise.all(PRECACHE.map(url => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k !== APP_CACHE && k !== FONT_CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fuentes de Google: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegación (HTML): network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) ||
               (await cache.match('./index.html')) ||
               new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Resto de archivos propios: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
  })());
});

// Click en una notificación (aviso de cold brew): enfoca o abre la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./index.html');
  })());
});
