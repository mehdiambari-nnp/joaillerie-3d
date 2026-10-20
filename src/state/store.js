// État de configuration, historique undo/redo (50 actions) et lien de partage compressé.
import LZString from 'lz-string';
import { LAB, labPack, labUnpack, sanitizeLight } from '../materials/lab.js';

/** Mini store pub/sub. */
export class Store {
  constructor(initial) { this.state = initial; this.subs = new Set(); }
  get() { return this.state; }
  set(patch) { this.state = { ...this.state, ...patch }; this.subs.forEach((f) => f(this.state)); }
  subscribe(f) { this.subs.add(f); return () => this.subs.delete(f); }
}

/** Historique par instantanés JSON. */
export class History {
  constructor(limit = 50) { this.limit = limit; this.past = []; this.future = []; this.current = null; }
  reset(snapshot) { this.past = []; this.future = []; this.current = JSON.stringify(snapshot); }
  push(snapshot) {
    const s = JSON.stringify(snapshot);
    if (s === this.current) return false;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = s; this.future = [];
    return true;
  }
  undo() {
    if (!this.past.length) return null;
    this.future.push(this.current);
    this.current = this.past.pop();
    return JSON.parse(this.current);
  }
  redo() {
    if (!this.future.length) return null;
    this.past.push(this.current);
    this.current = this.future.pop();
    return JSON.parse(this.current);
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

/**
 * Compacte les affectations : regroupe les pièces qui partagent la même affectation.
 * { assign: {p01:{m,f}, ...} } -> [[ [ids], m, f ], ...]
 */
export function packAssign(assign) {
  const groups = new Map();
  const labs = new Map(); // textures sur mesure : regroupées par contenu, forme compacte dans la 4e case
  for (const [id, a] of Object.entries(assign)) {
    if (a.m === LAB) { const p = labPack(a.l); labs.has(p) ? labs.get(p).push(id) : labs.set(p, [id]); continue; }
    const k = `${a.m}|${a.f ?? ''}|${a.c ?? ''}|${a.i != null ? Math.round(a.i * 100) : ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(id);
  }
  return [...groups.entries()].map(([k, ids]) => {
    const [m, f, c, i] = k.split('|');
    return i !== '' ? [ids, m, f || 0, c || 0, Number(i)] : c ? [ids, m, f || 0, c] : f ? [ids, m, f] : [ids, m];
  }).concat([...labs.entries()].map(([p, ids]) => [ids, LAB, 0, p]));
}
export function unpackAssign(packed) {
  const out = {};
  for (const [ids, m, f, c, i] of packed) for (const id of ids) out[id] = m === LAB ? { m, l: labUnpack(c) } : { m, ...(f ? { f } : {}), ...(c ? { c } : {}), ...(Number.isFinite(i) ? { i: i / 100 } : {}) };
  return out;
}

export function encodeShare(payload) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}
export function decodeShare(str) {
  try { return JSON.parse(LZString.decompressFromEncodedURIComponent(str)); } catch { return null; }
}

/** Contenu d'un partage (ce qu'encode le lien). */
export function sharePayload({ modelId, assign, env, envRot, hidden, light = null, client = false, remote = null }) {
  const lt = light && (light.n !== 1 || light.x !== 1) ? [light.n, light.x] : null; // éclairage ambiant : seulement s'il a été modifié
  return { v: 1, model: modelId, a: packAssign(assign), e: env, r: envRot, h: hidden, ...(lt ? { i: lt } : {}), ...(client ? { k: 1 } : {}), ...(remote ? { u: remote } : {}) };
}

/** Lien long : toute la configuration est dans l'adresse (#c=). Sert de repli quand le lien court est impossible. */
export function buildShareUrl(base, opts) {
  return `${base}#c=${encodeShare(sharePayload(opts))}`;
}

/** Identifiant court d'un partage : 12 premiers caractères hexadécimaux du SHA-256 de son contenu. */
export async function shareId(json) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json)));
  return [...h.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromPayload(p) {
  if (!p || p.v !== 1) return null;
  return { modelId: p.model, assign: unpackAssign(p.a || []), env: p.e, envRot: p.r, hidden: p.h || [], light: Array.isArray(p.i) ? sanitizeLight({ n: p.i[0], x: p.i[1] }) : null, client: !!p.k, remote: typeof p.u === 'string' && /^[a-f0-9]{32}$/.test(p.u) ? p.u : null };
}

/** Lien long (#c=) : lecture immédiate. */
export function parseShareHash(hash) {
  const m = /[#&]c=([^&]+)/.exec(hash || '');
  return m ? fromPayload(decodeShare(m[1])) : null;
}

/** Identifiant d'un lien court (#s=), ou null. */
export const shortShareRef = (hash) => /[#&]s=([a-f0-9]{12})(?:&|$)/.exec(hash || '')?.[1] ?? null;

/** Configuration d'un lien court une fois récupérée sur le serveur (chaîne JSON). */
export function parseShareJson(json) {
  try { return fromPayload(JSON.parse(json)); } catch { return null; }
}

/** Invitation dans un atelier : lien `#i=<jeton de 32 caractères hexadécimaux>` (le jeton est secret et à usage unique). */
export const parseInviteHash = (hash) => /[#&]i=([a-f0-9]{32})/.exec(hash || '')?.[1] ?? null;
export const inviteUrl = (token, base = location.origin + location.pathname) => `${base}#i=${token}`;

/** Lien client SUIVI : `#l=<20 caractères hexadécimaux>` (identifiant secret, désactivable par le joaillier). */
export const trackedLinkRef = (hash) => /[#&]l=([a-f0-9]{20})(?:&|$)/.exec(hash || '')?.[1] ?? null;

/** Variantes issues d'un fichier ou d'un projet (donnée non fiable) : forme vérifiée, identifiant réduit à [\w-]. */
export function cleanVariants(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string' && x.snap && typeof x.snap === 'object')
    .map((x) => ({ id: x.id.replace(/[^\w-]/g, '').slice(0, 40), name: x.name.slice(0, 40), snap: x.snap }))
    .filter((x) => x.id);
}

/** Porte d'entrée : seul un lien CLIENT valide s'ouvre sans compte ; adresse nue, lien joaillier ou lien illisible exigent la connexion. */
export const needsLogin = (pending, authEnabled) => !!authEnabled && !pending?.client;

/** Préférences par viewer (jamais bloquant si le stockage est indisponible : mode privé iOS, etc.). */
export const prefs = {
  get(k, d = null) { try { const v = localStorage.getItem('rc:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rc:' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};
