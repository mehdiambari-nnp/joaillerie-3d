// Service worker minimal : l'app se rouvre hors-ligne après une première visite (shell + modèle MediaPipe).
// Version du cache à incrémenter si la stratégie change ; les fichiers hashés de /assets/ sont immuables, le reste est revalidé.
const CACHE = 'joaillerie3d-v2';
const MAX_ENTRIES = 80;
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function put(cache, req, res) {
  await cache.put(req, res);
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/__/')) return; // gestionnaires d'authentification Firebase : jamais en cache
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') { // pages : réseau d'abord (toujours à jour), cache en secours hors-ligne
      try { const r = await fetch(req); if (r.ok) put(cache, req, r.clone()); return r; } catch { return (await cache.match(req)) || (await cache.match('./')) || Response.error(); }
    }
    const hit = await cache.match(req);
    if (hit && /\/assets\//.test(url.pathname)) return hit; // fichiers hashés : immuables, cache d'abord
    const fresh = fetch(req).then((r) => { if (r.ok) put(cache, req, r.clone()); return r; });
    if (hit) { fresh.catch(() => {}); return hit; } // autres (modèle, HDRI, manifest) : cache tout de suite, mis à jour en arrière-plan
    return fresh;
  })());
});
