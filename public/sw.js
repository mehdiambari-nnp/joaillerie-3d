// Service worker minimal : l'app se rouvre hors-ligne après une première visite (shell + modèle MediaPipe).
const CACHE = 'joaillerie3d-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isPage) { // pages : réseau d'abord (toujours à jour), cache en secours hors-ligne
      try { const r = await fetch(req); cache.put(req, r.clone()); return r; } catch { return (await cache.match(req)) || (await cache.match('./')) || Response.error(); }
    }
    const hit = await cache.match(req); // assets versionnés : cache d'abord
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok) cache.put(req, r.clone());
    return r;
  })());
});
