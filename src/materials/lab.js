// Atelier d'or : matériaux de métal « sur mesure » (tous les réglages PBR) + bibliothèque de textures nommées du joaillier.
// Une texture du joaillier voyage dans l'affectation de la pièce ({ m: 'lab', l: {...} }) : liens de partage et projets l'emportent
// avec eux, sans serveur. La bibliothèque personnelle (noms) est conservée sur l'appareil (localStorage).

export const LAB = 'lab';

/** Réglages par défaut = l'or jaune de l'application (mesuré sur une vidéo de bagues réelles, voir DECISIONS.md, itération 25). */
export const LAB_DEFAULT = Object.freeze({
  color: '#ffcb62',      // couleur des reflets (réflectance à incidence normale, F0), sRGB
  gain: 2,               // luminosité propre du métal (×) : l'éclairage seul sous-éclaire l'or
  metalness: 1, roughness: 0.18,
  ior: 1.5, specular: 1, specularColor: '#ffffff',
  clearcoat: 0, clearcoatRoughness: 0.05,
  anisotropy: 0, anisotropyRot: 0,
  iridescence: 0, iridescenceIOR: 1.3, iridescenceThickness: 400,
  sheen: 0, sheenRoughness: 0.5, sheenColor: '#ffd9a0',
  emissive: '#ff9a2e', emissiveIntensity: 0,
  tex: 'none', texI: 0.5, relief: 0.6,
});

export const LAB_LIGHT_DEFAULT = Object.freeze({ env: null, envRot: null, n: 1, x: 1 });

/** Description des réglages : groupes, bornes, libellés [FR, EN]. Source unique pour l'interface et la validation. */
export const LAB_GROUPS = [
  { id: 'base', title: ['Couleur et métal', 'Colour and metal'], fields: [
    { k: 'color', type: 'color', label: ['Couleur des reflets', 'Reflection colour'] },
    { k: 'gain', min: 0.4, max: 4, step: 0.05, label: ['Luminosité du métal', 'Metal brightness'] },
    { k: 'metalness', min: 0, max: 1, step: 0.01, label: ['Métallicité', 'Metalness'] },
    { k: 'roughness', min: 0, max: 1, step: 0.01, label: ['Rugosité (reflets nets → diffus)', 'Roughness (sharp → diffuse)'] },
  ] },
  { id: 'spec', title: ['Reflets', 'Specular'], fields: [
    { k: 'specular', min: 0, max: 1, step: 0.01, label: ['Intensité des reflets', 'Specular intensity'] },
    { k: 'specularColor', type: 'color', label: ['Couleur des reflets secondaires', 'Specular colour'] },
    { k: 'ior', min: 1, max: 2.5, step: 0.01, label: ['Indice de réfraction (IOR)', 'Index of refraction (IOR)'] },
  ] },
  { id: 'coat', title: ['Vernis (clearcoat)', 'Clearcoat'], fields: [
    { k: 'clearcoat', min: 0, max: 1, step: 0.01, label: ['Épaisseur du vernis', 'Clearcoat'] },
    { k: 'clearcoatRoughness', min: 0, max: 1, step: 0.01, label: ['Rugosité du vernis', 'Clearcoat roughness'] },
  ] },
  { id: 'aniso', title: ['Anisotropie (brossage)', 'Anisotropy'], fields: [
    { k: 'anisotropy', min: 0, max: 1, step: 0.01, label: ['Force', 'Strength'] },
    { k: 'anisotropyRot', min: 0, max: 360, step: 1, label: ['Direction (°)', 'Direction (°)'] },
  ] },
  { id: 'iri', title: ['Irisation', 'Iridescence'], fields: [
    { k: 'iridescence', min: 0, max: 1, step: 0.01, label: ['Intensité', 'Intensity'] },
    { k: 'iridescenceIOR', min: 1, max: 2.5, step: 0.01, label: ['Indice du film', 'Film IOR'] },
    { k: 'iridescenceThickness', min: 100, max: 800, step: 5, label: ['Épaisseur du film (nm)', 'Film thickness (nm)'] },
  ] },
  { id: 'sheen', title: ['Voile (sheen)', 'Sheen'], fields: [
    { k: 'sheen', min: 0, max: 1, step: 0.01, label: ['Intensité', 'Intensity'] },
    { k: 'sheenRoughness', min: 0, max: 1, step: 0.01, label: ['Rugosité', 'Roughness'] },
    { k: 'sheenColor', type: 'color', label: ['Couleur du voile', 'Sheen colour'] },
  ] },
  { id: 'glow', title: ['Lueur propre', 'Emission'], fields: [
    { k: 'emissive', type: 'color', label: ['Couleur', 'Colour'] },
    { k: 'emissiveIntensity', min: 0, max: 1, step: 0.01, label: ['Intensité', 'Intensity'] },
  ] },
  { id: 'tex', title: ['Surface', 'Surface'], fields: [
    { k: 'tex', type: 'select', options: [['none', ['Lisse', 'Smooth']], ['satin', ['Satiné', 'Satin']], ['brushed', ['Brossé', 'Brushed']], ['hammered', ['Martelé', 'Hammered']]], label: ['Texture', 'Texture'] },
    { k: 'texI', min: 0, max: 1, step: 0.01, label: ['Intensité de la texture', 'Texture intensity'] },
    { k: 'relief', min: 0, max: 2, step: 0.05, label: ['Relief', 'Relief'] },
  ] },
];
export const LAB_LIGHT_GROUP = { id: 'light', title: ['Éclairage ambiant', 'Ambient light'], fields: [
  { k: 'n', min: 0, max: 4, step: 0.05, label: ['Intensité de l’environnement', 'Environment intensity'] },
  { k: 'x', min: 0.3, max: 2.5, step: 0.05, label: ['Exposition', 'Exposure'] },
  { k: 'envRot', min: 0, max: 360, step: 1, label: ['Rotation des reflets (°)', 'Reflection rotation (°)'] },
] };

const FIELD = new Map(LAB_GROUPS.flatMap((g) => g.fields).map((f) => [f.k, f]));
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const num = (v, f, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(f.max, Math.max(f.min, +v)) : d);

/** Remet un objet (venu d'un lien, d'un projet ou de l'interface) à sa forme valide : bornes, couleurs, texture connue. */
export function sanitizeLab(l) {
  const src = l && typeof l === 'object' ? l : {};
  const out = {};
  for (const [k, d] of Object.entries(LAB_DEFAULT)) {
    const f = FIELD.get(k);
    if (f?.type === 'color') out[k] = hex(src[k], d);
    else if (f?.type === 'select') out[k] = f.options.some(([v]) => v === src[k]) ? src[k] : d;
    else out[k] = Math.round(num(src[k], f, d) * 1000) / 1000;
  }
  const n = typeof src.n === 'string' ? src.n.replace(/[|\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
  if (n) out.n = n;
  return out;
}

/** Forme compacte (seules les valeurs qui diffèrent du défaut) : chaîne JSON, sans « | ». */
export function labPack(l) {
  const s = sanitizeLab(l), o = {};
  for (const [k, v] of Object.entries(s)) if (k === 'n' || v !== LAB_DEFAULT[k]) o[k] = v;
  return JSON.stringify(o);
}
export function labUnpack(str) {
  try { return sanitizeLab(JSON.parse(str)); } catch { return sanitizeLab({}); }
}

/** Éclairage ambiant enregistré avec une texture (facultatif) : valeurs bornées. */
export function sanitizeLight(x) {
  if (!x || typeof x !== 'object') return null;
  const out = {};
  if (typeof x.env === 'string' && /^[a-z0-9-]{1,40}$/.test(x.env)) out.env = x.env;
  for (const g of LAB_LIGHT_GROUP.fields) if (Number.isFinite(+x[g.k]) && x[g.k] !== null) out[g.k] = Math.min(g.max, Math.max(g.min, +x[g.k]));
  return Object.keys(out).length ? out : null;
}

// ---------- Bibliothèque de textures ----------
// Avec un compte (Firebase) : stockée dans l'atelier actif (users/{propriétaire}/labs) → partagée par tous les joailliers de l'atelier.
// Sans compte (mode local) ou si le serveur est injoignable : appareil (localStorage). `cloud.labs` = { list, save, remove }.
const KEY = 'rc:labs';
let backend = null;
let cache = null;

const norm = (x) => ({ id: String(x.id), name: String(x.name || '').slice(0, 40) || 'Sans nom', l: sanitizeLab(typeof x.l === 'string' ? safeParse(x.l) : x.l), light: sanitizeLight(typeof x.light === 'string' ? safeParse(x.light) : x.light), by: typeof x.by === 'string' ? x.by : '' });
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
function readLocal() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return (Array.isArray(a) ? a : []).filter((x) => x && typeof x.id === 'string').map(norm);
  } catch { return []; }
}
function writeLocal(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }

/** Relit la bibliothèque (à l'ouverture et à chaque changement d'atelier). Hors ligne ou refusé : copie de l'appareil. */
export async function refreshLabs() {
  if (backend) {
    try {
      cache = (await backend.list()).map(norm).sort((a, b) => a.name.localeCompare(b.name));
      writeLocal(cache); // copie hors ligne
      return cache;
    } catch (e) { console.warn('Textures de l’atelier indisponibles', e); }
  }
  cache = readLocal();
  return cache;
}
export async function initLabs(cloud) { backend = cloud?.labs ?? null; return refreshLabs(); }
export function listLabs() { return cache ?? readLocal(); }

/** Enregistre (ou remplace, à nom identique) une texture. Renvoie la liste à jour, ou null si l'enregistrement est impossible. */
export async function saveLab(name, l, light = null) {
  const nm = String(name || '').trim().slice(0, 40);
  if (!nm) return null;
  const list = listLabs();
  const i = list.findIndex((x) => x.name.toLowerCase() === nm.toLowerCase());
  const item = { id: i >= 0 ? list[i].id : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nm, l: sanitizeLab({ ...l, n: nm }), light: sanitizeLight(light) };
  if (backend) {
    try { await backend.save({ ...item, l: labPack(item.l), light: item.light ? JSON.stringify(item.light) : null }); return await refreshLabs(); } catch (e) { console.warn(e); return null; }
  }
  const next = list.slice(); if (i >= 0) next[i] = item; else next.push(item);
  if (!writeLocal(next)) return null;
  cache = next; return next;
}
export async function deleteLab(id) {
  if (backend) { try { await backend.remove(id); } catch (e) { console.warn(e); return null; } return refreshLabs(); }
  cache = listLabs().filter((x) => x.id !== id); writeLocal(cache); return cache;
}
