// État de configuration, historique undo/redo (50 actions) et lien de partage compressé.
import LZString from 'lz-string';

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
  for (const [id, a] of Object.entries(assign)) {
    const k = `${a.m}|${a.f ?? ''}|${a.c ?? ''}|${a.i != null ? Math.round(a.i * 100) : ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(id);
  }
  return [...groups.entries()].map(([k, ids]) => {
    const [m, f, c, i] = k.split('|');
    return i !== '' ? [ids, m, f || 0, c || 0, Number(i)] : c ? [ids, m, f || 0, c] : f ? [ids, m, f] : [ids, m];
  });
}
export function unpackAssign(packed) {
  const out = {};
  for (const [ids, m, f, c, i] of packed) for (const id of ids) out[id] = { m, ...(f ? { f } : {}), ...(c ? { c } : {}), ...(Number.isFinite(i) ? { i: i / 100 } : {}) };
  return out;
}

export function encodeShare(payload) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}
export function decodeShare(str) {
  try { return JSON.parse(LZString.decompressFromEncodedURIComponent(str)); } catch { return null; }
}

/** Construit l'URL de partage de la configuration courante. */
export function buildShareUrl(base, { modelId, assign, env, envRot, hidden, client = false }) {
  const payload = { v: 1, model: modelId, a: packAssign(assign), e: env, r: envRot, h: hidden, ...(client ? { k: 1 } : {}) };
  return `${base}#c=${encodeShare(payload)}`;
}

export function parseShareHash(hash) {
  const m = /[#&]c=([^&]+)/.exec(hash || '');
  if (!m) return null;
  const p = decodeShare(m[1]);
  if (!p || p.v !== 1) return null;
  return { modelId: p.model, assign: unpackAssign(p.a || []), env: p.e, envRot: p.r, hidden: p.h || [], client: !!p.k };
}

/** Préférences par viewer (jamais bloquant si le stockage est indisponible : mode privé iOS, etc.). */
export const prefs = {
  get(k, d = null) { try { const v = localStorage.getItem('rc:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rc:' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};
