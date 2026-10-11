// Bibliothèque de matériaux (valeurs PBR physiquement plausibles). Scène en millimètres.
// Couleurs de métaux = réflectance F0 en RGB LINÉAIRE (metalness = 1).

export const METALS = [
  { id: 'gold18', name: 'Or jaune 18 k', rgb: [1.0, 0.766, 0.336], swatch: '#e8c36a' },
  { id: 'gold24', name: 'Or jaune 24 k', rgb: [1.0, 0.71, 0.29], swatch: '#f2b84a' },
  { id: 'rose18', name: 'Or rose 18 k', rgb: [0.95, 0.64, 0.54], swatch: '#e8a592' },
  { id: 'white18', name: 'Or blanc', rgb: [0.9, 0.89, 0.87], swatch: '#e4e2dc' },
  { id: 'platinum', name: 'Platine', rgb: [0.672, 0.637, 0.585], swatch: '#b9b4a6' },
  { id: 'silver', name: 'Argent 925', rgb: [0.972, 0.96, 0.915], swatch: '#f1efe8' },
  { id: 'palladium', name: 'Palladium', rgb: [0.733, 0.697, 0.652], swatch: '#c4bdb0' },
  { id: 'titanium', name: 'Titane', rgb: [0.542, 0.497, 0.449], swatch: '#8d8577' },
  { id: 'black', name: 'Noir (PVD)', rgb: [0.05, 0.05, 0.05], swatch: '#2a2a2a', roughnessAdd: 0.2 },
];

export const FINISHES = [
  { id: 'polish', name: 'Poli miroir', roughness: 0.05, anisotropy: 0 },
  { id: 'satin', name: 'Satiné', roughness: 0.3, anisotropy: 0.6 },
  { id: 'matte', name: 'Sablé', roughness: 0.55, anisotropy: 0 },
  { id: 'hammered', name: 'Martelé', roughness: 0.1, anisotropy: 0, hammered: true },
];

// ior est plafonné à 2,333 par three.js (diamant 2,42 et moissanite 2,65 sont donc approchés).
export const GEMS = [
  { id: 'diamond', name: 'Diamant', sparkle: true, color: '#f2f6ff', ior: 2.42, dispersion: 0.4, att: '#ffffff', attDist: 1e3, swatch: '#f4f8ff' },
  { id: 'moissanite', name: 'Moissanite', sparkle: true, color: '#f8f8f0', ior: 2.65, dispersion: 0.6, att: '#fffbe8', attDist: 60, swatch: '#f6f3e6' },
  { id: 'cz', name: 'Oxyde de zirconium', sparkle: true, color: '#f2f6ff', ior: 2.15, dispersion: 0.5, att: '#ffffff', attDist: 1e3, swatch: '#eef3ff' },
  { id: 'sapphire', name: 'Saphir bleu', color: '#7da2ff', ior: 1.77, dispersion: 0.05, att: '#0c2a9a', attDist: 3, swatch: '#1f3fae' },
  { id: 'sapphire-pink', name: 'Saphir rose', color: '#ffb6d2', ior: 1.77, dispersion: 0.05, att: '#e0407e', attDist: 5, swatch: '#e86a9c' },
  { id: 'sapphire-yellow', name: 'Saphir jaune', color: '#fff0a0', ior: 1.77, dispersion: 0.05, att: '#f0b800', attDist: 5, swatch: '#f2c91e' },
  { id: 'ruby', name: 'Rubis', color: '#ff8c8c', ior: 1.77, dispersion: 0.05, att: '#b00014', attDist: 2.5, swatch: '#b3122a' },
  { id: 'emerald', name: 'Émeraude', color: '#8fe0a8', ior: 1.58, dispersion: 0.05, att: '#0a7a3a', attDist: 3, swatch: '#13813f', roughness: 0.04 },
  { id: 'amethyst', name: 'Améthyste', color: '#d3a8ff', ior: 1.54, dispersion: 0.05, att: '#6a1fb8', attDist: 4, swatch: '#8a46c8' },
  { id: 'topaz', name: 'Topaze bleue', color: '#a8dcff', ior: 1.62, dispersion: 0.05, att: '#2f8fd0', attDist: 8, swatch: '#5fb5ea' },
  { id: 'aquamarine', name: 'Aigue-marine', color: '#c8f0f2', ior: 1.58, dispersion: 0.05, att: '#68c2cc', attDist: 10, swatch: '#9adbe0' },
  { id: 'citrine', name: 'Citrine', color: '#ffe0a0', ior: 1.54, dispersion: 0.05, att: '#e8860a', attDist: 6, swatch: '#f0a62a' },
  { id: 'tsavorite', name: 'Tsavorite', color: '#a8ff9a', ior: 1.74, dispersion: 0.1, att: '#10a82a', attDist: 3, swatch: '#25b53f' },
  { id: 'peridot', name: 'Péridot', color: '#ecff9a', ior: 1.67, dispersion: 0.05, att: '#8cc400', attDist: 4, swatch: '#a6cf2a' },
  // pierres opaques
  { id: 'onyx', name: 'Onyx', opaque: true, color: '#0b0b0d', roughness: 0.06, swatch: '#111114' },
  { id: 'pearl', name: 'Nacre', opaque: true, color: '#f4efe6', roughness: 0.25, iridescence: 1, swatch: '#f0e8dc' },
  { id: 'turquoise', name: 'Turquoise', opaque: true, color: '#2fb8b0', roughness: 0.3, swatch: '#2fb8b0' },
  { id: 'lapis', name: 'Lapis-lazuli', opaque: true, color: '#1c2f8a', roughness: 0.2, swatch: '#1c2f8a' },
];

export const DEFAULT_METAL = { m: 'gold18', f: 'polish' };
export const DEFAULT_GEM = { m: 'diamond' };

export const byId = (list, id) => list.find((x) => x.id === id);

/** Nom lisible d'une affectation {m, f}. */
export function describeAssignment(a) {
  if (!a) return '';
  const metal = byId(METALS, a.m);
  if (metal) return `${metal.name}${a.f ? ' · ' + (byId(FINISHES, a.f)?.name ?? '') : ''}`;
  return byId(GEMS, a.m)?.name ?? '';
}

/** Matériaux (réglage pour l'AR Quick Look : pas de transmission → teinte opaque brillante). */
export function gemSubstitute(gem) {
  const c = gem.opaque ? gem.color : gem.att && gem.attDist < 100 ? gem.att : '#eef3ff';
  return { color: c, roughness: 0.04, metalness: gem.opaque ? 0 : 0.35 };
}
