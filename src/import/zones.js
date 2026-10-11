// Détection automatique des zones d'une bague (logique pure, testable sans WebGL).
// Une « pièce » (piece) = un mesh du fichier. Une « zone » = un groupe de pièces nommé pour le client.

/** Retire accents/casse pour comparer des noms de CAO (« Métal », « Matériau_11 »…). */
export function norm(s = '') {
  return String(s).normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const GEM_KW = /(diamond|diamant|\bgem|stone|pierre|saphir|sapphire|ruby|rubis|emerald|emeraude|brill|zircon|\bcz\b|moissan|topaz|amethy)/;
const METAL_KW = /(metal|gold|\bor\b|silver|argent|platin|band|ring|anneau|prong|griffe|shank|bezel|chaton|corps)/;

/**
 * Classe une pièce : 'gem' (pierre) ou 'metal'.
 * Priorité : mots-clés dans les noms, puis géométrie (petite, sans UV, peu de triangles → pierre).
 */
export function classifyKind(piece) {
  const names = norm(piece.materialName) + ' ' + norm(piece.name);
  if (GEM_KW.test(names)) return 'gem';
  if (METAL_KW.test(names)) return 'metal';
  if (piece.tris < 1000 && !piece.hasUV) return 'gem';
  return 'metal';
}

/**
 * pieces : [{ id, name, materialName, tris, hasUV, size:[x,y,z], center:[x,y,z] }] (hors doublons)
 * Retourne { zones, kinds } ; zones = [{ id, name, type:'metal'|'gem', pieceIds, role }]
 */
export function detectZones(pieces) {
  if (!pieces.length) return { zones: [], roles: {} };
  const maxDimOf = (p) => Math.max(...p.size);
  const modelMax = Math.max(...pieces.map(maxDimOf)); // approximation de la plus grande dimension
  const roles = {}; // pieceId -> role
  const gems = [];
  const metals = [];
  for (const p of pieces) (classifyKind(p) === 'gem' ? gems : metals).push(p);

  // Pierres : centrale = la plus proche du barycentre des pierres (si >= 3)
  const gemRole = {};
  if (gems.length >= 3) {
    const c = gems.reduce((a, g) => a.map((v, i) => v + g.center[i] / gems.length), [0, 0, 0]);
    const d = (g) => Math.hypot(g.center[0] - c[0], g.center[1] - c[1], g.center[2] - c[2]);
    const centre = [...gems].sort((a, b) => d(a) - d(b))[0];
    for (const g of gems) gemRole[g.id] = g === centre ? 'gem-center' : 'gem-side';
  } else {
    for (const g of gems) gemRole[g.id] = 'gem';
  }
  for (const g of gems) roles[g.id] = gemRole[g.id];

  // Métaux : corps (grand), griffes (petites), sertissage (le reste, rattaché à la pierre la plus proche)
  for (const m of metals) {
    const md = maxDimOf(m);
    if (md > 0.5 * modelMax) roles[m.id] = 'body';
    else if (m.tris < 3000 && md < 0.25 * modelMax) roles[m.id] = 'claw';
    else {
      let best = null, bd = Infinity;
      for (const g of gems) {
        const dd = Math.hypot(g.center[0] - m.center[0], g.center[1] - m.center[1], g.center[2] - m.center[2]);
        if (dd < bd) { bd = dd; best = g; }
      }
      roles[m.id] = best && gemRole[best.id] === 'gem-center' ? 'setting-center'
        : best && gemRole[best.id] === 'gem-side' ? 'setting-side' : 'setting';
    }
  }

  const NAMES = {
    'gem-center': ['Pierre centrale', 'gem'],
    'gem-side': ['Pierres latérales', 'gem'],
    gem: [gems.length > 1 ? 'Pierres' : 'Pierre', 'gem'],
    'setting-center': ['Chaton central', 'metal'],
    'setting-side': ['Paniers latéraux', 'metal'],
    setting: ['Chaton', 'metal'],
    claw: ['Griffes', 'metal'],
    body: ['Corps', 'metal'],
  };
  const ORDER = ['gem-center', 'gem', 'gem-side', 'setting-center', 'setting', 'setting-side', 'claw', 'body'];
  const zones = [];
  for (const role of ORDER) {
    const ids = pieces.filter((p) => roles[p.id] === role).map((p) => p.id);
    if (ids.length) zones.push({ id: 'z-' + role, name: NAMES[role][0], type: NAMES[role][1], pieceIds: ids, role });
  }
  return { zones, roles };
}

/** Pièces « similaires » : même type et même nombre de triangles (griffes, fils symétriques…). */
export function similarPieceIds(pieces, pieceId) {
  const ref = pieces.find((p) => p.id === pieceId);
  if (!ref) return [];
  return pieces.filter((p) => p.kind === ref.kind && p.tris === ref.tris).map((p) => p.id);
}

/** Détecte les pièces strictement superposées (même empreinte). Retourne { keep, dupes:[{id, of}] }. */
export function findDuplicates(pieces) {
  const seen = new Map();
  const keep = [];
  const dupes = [];
  for (const p of pieces) {
    const r = (v) => Math.round(v * 100) / 100;
    const key = [p.verts, ...p.size.map(r), ...p.center.map(r), p.hash].join('|');
    if (seen.has(key)) dupes.push({ id: p.id, name: p.name, of: seen.get(key) });
    else { seen.set(key, p.name); keep.push(p); }
  }
  return { keep, dupes };
}

/** Taille française ≈ circonférence intérieure en mm (arrondie). */
export function frenchRingSize(innerDiameterMm) {
  return Math.round(Math.PI * innerDiameterMm);
}

/** Devine l'unité du fichier d'après la plus grande dimension (une bague fait 8–80 mm). */
export function guessUnitToMM(maxDim) {
  if (maxDim >= 8 && maxDim <= 90) return { factor: 1, unit: 'mm' };
  if (maxDim >= 0.8 && maxDim < 8) return { factor: 10, unit: 'cm' };
  if (maxDim >= 0.008 && maxDim < 0.09) return { factor: 1000, unit: 'm' };
  if (maxDim > 90 && maxDim < 900) return { factor: 0.1, unit: 'µ(0.1mm)' };
  return { factor: 1, unit: 'mm' };
}
export const UNIT_FACTORS = { mm: 1, cm: 10, m: 1000, inch: 25.4 };
