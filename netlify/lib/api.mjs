// API d'hébergement des modèles partagés (liens client). Logique pure, indépendante de Netlify : le « store » est injecté
// (Netlify Blobs en production, mémoire en dev/tests). Les modèles sont adressés par leur empreinte (SHA-256 tronquée) :
// un même fichier n'est stocké qu'une fois. Un modèle est découpé en morceaux (la limite d'une fonction Netlify est ~6 Mo).
//
//   GET  /api/models/:id        → méta JSON { name, opts, gz, parts, size }
//   GET  /api/models/:id/:n     → morceau n (binaire)
//   PUT  /api/models/:id/:n     → dépose le morceau n
//   PUT  /api/models/:id        → valide : écrit la méta (tous les morceaux doivent exister)
//
// Liens courts : la configuration d'un partage est stockée côté serveur, adressée par son empreinte (12 hex).
//   GET  /api/shares/:id        → { p } (configuration sérialisée)
//   PUT  /api/shares/:id        → dépose { p } (sans écrasement)

export const LIMITS = { chunk: 5 * 1024 * 1024, parts: 12, name: 200, share: 16 * 1024 };
const ID = /^[a-f0-9]{32}$/;

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const err = (status, message) => json({ error: message }, status);

/** @param {Request} req  @param {{get:Function,set:Function}} store  @param {string} base préfixe de l'API (ex. /api/models) */
export async function handleModels(req, store, base = '/api/models') {
  const url = new URL(req.url);
  const rest = url.pathname.startsWith(base) ? url.pathname.slice(base.length).split('/').filter(Boolean) : [];
  const [id, n] = rest;
  if (!id || !ID.test(id) || rest.length > 2) return err(400, 'identifiant invalide');
  let part = null;
  if (n !== undefined) { if (!/^\d{1,2}$/.test(n) || Number(n) >= LIMITS.parts) return err(400, 'morceau invalide'); part = Number(n); }

  if (req.method === 'GET') {
    if (part === null) {
      const meta = await store.get(`${id}/meta`, { type: 'json' });
      return meta ? json(meta) : err(404, 'introuvable');
    }
    const data = await store.get(`${id}/${part}`, { type: 'arrayBuffer' });
    return data ? new Response(data, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } }) : err(404, 'introuvable');
  }

  if (req.method === 'PUT') {
    if (part !== null) {
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > LIMITS.chunk) return err(413, 'morceau trop gros ou vide');
      await store.set(`${id}/${part}`, buf);
      return json({ ok: true });
    }
    let body; try { body = await req.json(); } catch { return err(400, 'JSON invalide'); }
    const parts = Number(body?.parts);
    if (!Number.isInteger(parts) || parts < 1 || parts > LIMITS.parts) return err(400, 'nombre de morceaux invalide');
    for (let i = 0; i < parts; i++) if (!(await store.get(`${id}/${i}`, { type: 'arrayBuffer' }))) return err(409, `morceau ${i} manquant`);
    const meta = { name: String(body.name || 'modele.glb').slice(0, LIMITS.name), opts: body.opts && typeof body.opts === 'object' ? body.opts : {}, gz: !!body.gz, parts, size: Number(body.size) || 0 };
    await store.set(`${id}/meta`, JSON.stringify(meta));
    return json({ ok: true });
  }
  return err(405, 'méthode non permise');
}

const SHARE_ID = /^[a-f0-9]{12}$/;
export async function handleShares(req, store, base = '/api/shares') {
  const url = new URL(req.url);
  const rest = url.pathname.startsWith(base) ? url.pathname.slice(base.length).split('/').filter(Boolean) : [];
  const id = rest[0];
  if (!id || rest.length !== 1 || !SHARE_ID.test(id)) return err(400, 'identifiant invalide');
  const key = `shares/${id}`;
  if (req.method === 'GET') {
    const v = await store.get(key, { type: 'json' });
    return v ? json(v, 200, { 'cache-control': 'public, max-age=31536000, immutable' }) : err(404, 'introuvable');
  }
  if (req.method === 'PUT') {
    const text = await req.text();
    if (!text || text.length > LIMITS.share) return err(413, 'configuration trop grosse ou vide');
    let body; try { body = JSON.parse(text); } catch { return err(400, 'JSON invalide'); }
    if (typeof body?.p !== 'string') return err(400, 'champ p manquant');
    if (!(await store.get(key, { type: 'json' }))) await store.set(key, JSON.stringify({ p: body.p }));
    return json({ ok: true });
  }
  return err(405, 'méthode non permise');
}

/** Point d'entrée unique : /api/models/* et /api/shares/*. */
export const handleApi = (req, store) => (new URL(req.url).pathname.startsWith('/api/shares') ? handleShares(req, store) : handleModels(req, store));

/** Store en mémoire (dev, tests) : même interface minimale que Netlify Blobs. */
export function memoryStore() {
  const m = new Map();
  return {
    async get(k, { type } = {}) { const v = m.get(k); if (v == null) return null; return type === 'json' ? JSON.parse(v) : type === 'arrayBuffer' ? v.slice(0) : v; },
    async set(k, v) { m.set(k, typeof v === 'string' ? v : v.slice(0)); },
  };
}
