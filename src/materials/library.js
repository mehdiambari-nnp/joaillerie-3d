// Bibliothèque de matériaux (valeurs PBR physiquement plausibles). Scène en millimètres.
// Principe « joaillier » : on choisit une COULEUR (et une finition pour les métaux), pas une espèce minérale ni un titrage.
// Une affectation est { m: <id de préréglage> | 'custom', c?: '#rrggbb' (si custom), f?: finition (métaux) }.

export const CUSTOM = 'custom';

// Couleurs de métaux = réflectance F0 en RGB LINÉAIRE (metalness = 1).
export const METALS = [
  { id: 'yellow', name: 'Or jaune', rgb: [1.0, 0.766, 0.336], swatch: '#e8c36a' },
  { id: 'rose', name: 'Or rose', rgb: [0.96, 0.67, 0.58], swatch: '#eaaa97' },
  { id: 'red', name: 'Or rouge', rgb: [0.93, 0.5, 0.4], swatch: '#dc8a73' },
  { id: 'grey', name: 'Or gris', rgb: [0.74, 0.73, 0.71], swatch: '#c2bfb8' },
  { id: 'platinum', name: 'Platine', rgb: [0.93, 0.93, 0.94], swatch: '#e9e9ea' }, // plus blanc que l'or gris
];

export const FINISHES = [
  { id: 'polish', name: 'Poli', roughness: 0.05, anisotropy: 0 },
  { id: 'satin', name: 'Satiné', roughness: 0.17, anisotropy: 0 },
  { id: 'brushed', name: 'Brossé', roughness: 0.2, anisotropy: 0, brushed: true },
  { id: 'hammered', name: 'Martelé', roughness: 0.1, anisotropy: 0, hammered: true },
];

// Pierres : « hex » = couleur apparente voulue (la teinte de transmission est déduite, voir gemOptics).
// Groupes = familles de couleur ; aucun nom d'espèce n'est affiché dans l'interface.
export const GEM_GROUPS = [
  { id: 'white', name: 'Incolore' },
  { id: 'red', name: 'Rouges' },
  { id: 'pink', name: 'Roses' },
  { id: 'orange', name: 'Orange et jaune' },
  { id: 'green', name: 'Verts' },
  { id: 'teal', name: 'Bleu-vert' },
  { id: 'blue', name: 'Bleus' },
  { id: 'violet', name: 'Violets' },
  { id: 'dark', name: 'Noir et nacre' },
];

export const GEMS = [
  { id: 'diamond', group: 'white', name: 'Diamant', sparkle: true, hex: '#f4f8ff', swatch: '#f4f8ff' },
  { id: 'red-dark', group: 'red', name: 'Rouge sombre', hex: '#8a0f24' },
  { id: 'red-vivid', group: 'red', name: 'Rouge vif', hex: '#e0102c' },
  { id: 'pink-pale', group: 'pink', name: 'Rose pâle', hex: '#f6b3cb' },
  { id: 'pink-vivid', group: 'pink', name: 'Rose vif', hex: '#e8337f' },
  { id: 'orange', group: 'orange', name: 'Orange', hex: '#f28a1a' },
  { id: 'yellow', group: 'orange', name: 'Jaune', hex: '#f5c518' },
  { id: 'cognac', group: 'orange', name: 'Cognac', hex: '#b9631a' },
  { id: 'green-light', group: 'green', name: 'Vert clair', hex: '#b6dd3a' },
  { id: 'green-emerald', group: 'green', name: 'Vert émeraude', hex: '#0fa152' },
  { id: 'green-tourmaline', group: 'green', name: 'Vert tourmaline', hex: '#2a8f76' },
  { id: 'green-deep', group: 'green', name: 'Vert profond', hex: '#0b5a3a' },
  { id: 'teal-light', group: 'teal', name: 'Teal clair', hex: '#6fd3cd' },
  { id: 'teal', group: 'teal', name: 'Teal', hex: '#0f9a9c' },
  { id: 'blue-aqua', group: 'blue', name: 'Bleu aigue-marine', hex: '#8fd6ea' },
  { id: 'blue-medium', group: 'blue', name: 'Bleu médium', hex: '#2f6fe0' },
  { id: 'blue-royal', group: 'blue', name: 'Bleu roi', hex: '#1b3fc4' },
  { id: 'blue-night', group: 'blue', name: 'Bleu très foncé', hex: '#0b1f6b' },
  { id: 'violet-light', group: 'violet', name: 'Lilas', hex: '#c9a4f0' },
  { id: 'violet', group: 'violet', name: 'Violet', hex: '#8a3fd0' },
  { id: 'violet-deep', group: 'violet', name: 'Violet profond', hex: '#4a1a8a' },
  { id: 'black', group: 'dark', name: 'Noir', opaque: true, hex: '#0b0b0d', roughness: 0.06 },
  { id: 'pearl', group: 'dark', name: 'Nacre', opaque: true, hex: '#f4efe6', roughness: 0.25, iridescence: 1 },
];
for (const g of GEMS) g.swatch ??= g.hex;

export const DEFAULT_METAL = { m: 'yellow', f: 'polish' };
export const DEFAULT_GEM = { m: 'diamond' };

export const byId = (list, id) => list.find((x) => x.id === id);

// ---------- Compatibilité : anciens identifiants (liens de partage / projets déjà créés) ----------
const LEGACY_METAL = {
  gold18: 'yellow', gold24: 'yellow', rose18: 'rose', white18: 'grey', silver: 'grey', palladium: 'grey', titanium: 'grey',
};
const LEGACY_GEM = {
  moissanite: 'diamond', cz: 'diamond', sapphire: 'blue-medium', 'sapphire-pink': 'pink-vivid', 'sapphire-yellow': 'yellow',
  ruby: 'red-vivid', emerald: 'green-emerald', amethyst: 'violet', topaz: 'blue-aqua', aquamarine: 'blue-aqua', citrine: 'orange',
  tsavorite: 'green-emerald', peridot: 'green-light', onyx: 'black', turquoise: 'teal', lapis: 'blue-royal',
};
const LEGACY_FINISH = { matte: 'satin' };

/** Remet une affectation (éventuellement ancienne) au format courant. kind: 'metal' | 'gem'. */
export function normalizeAssignment(kind, a) {
  if (!a) return null;
  let { m, c, f } = a;
  if (kind === 'gem') {
    if (m !== CUSTOM && !byId(GEMS, m)) m = LEGACY_GEM[m] ?? DEFAULT_GEM.m;
    return m === CUSTOM ? { m, c: validHex(c) ?? '#4a7de0' } : { m };
  }
  if (m === 'black') return { m: CUSTOM, c: '#2b2b2e', f: LEGACY_FINISH[f] ?? f ?? DEFAULT_METAL.f };
  if (m !== CUSTOM && !byId(METALS, m)) m = LEGACY_METAL[m] ?? DEFAULT_METAL.m;
  f = LEGACY_FINISH[f] ?? f;
  if (!byId(FINISHES, f)) f = DEFAULT_METAL.f;
  return m === CUSTOM ? { m, c: validHex(c) ?? '#d8b45a', f } : { m, f };
}

/** L'identifiant m convient-il à ce type de pièce ? */
export function isMaterialFor(kind, m) {
  return m === CUSTOM || !!byId(kind === 'gem' ? GEMS : METALS, m);
}

// ---------- Couleurs ----------
export function validHex(h) {
  if (typeof h !== 'string') return null;
  let s = h.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((x) => x + x).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null;
}
export function hexToRgb(hex) {
  const v = parseInt(validHex(hex).slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}
export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
}
export function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
const srgbToLinear = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

// ---------- Résolution d'une affectation en paramètres de rendu ----------
export function resolveMetal(a) {
  const n = normalizeAssignment('metal', a) ?? DEFAULT_METAL;
  const fin = byId(FINISHES, n.f) ?? FINISHES[0];
  if (n.m === CUSTOM) {
    const rgb = hexToRgb(n.c).map((x) => srgbToLinear(x / 255));
    return { id: CUSTOM, name: `Teinte ${n.c.toUpperCase()}`, rgb, swatch: n.c, fin };
  }
  const metal = byId(METALS, n.m);
  return { ...metal, fin };
}

/**
 * Optique d'une pierre de couleur : la couleur apparente voulue (hex) devient la couleur d'atténuation
 * (loi de Beer-Lambert sur l'épaisseur) ; la surface reste claire pour ne pas assombrir deux fois.
 * Les pierres foncées gardent un peu de lumière (distance d'atténuation plus longue) pour rester lisibles.
 */
export function gemOptics(hex) {
  const [h, s, l] = hexToHsl(hex);
  const dark = Math.max(0, 0.38 - l) / 0.38; // 0 = clair, 1 = très foncé
  return {
    color: hslToHex(h, s * 0.3, 0.9),
    att: hex,
    attDist: 4.2 + dark * 2.4,
    ior: 1.77,
    dispersion: 0.06,
  };
}

export function resolveGem(a) {
  const n = normalizeAssignment('gem', a) ?? DEFAULT_GEM;
  if (n.m === CUSTOM) return { id: CUSTOM, name: `Teinte ${n.c.toUpperCase()}`, hex: n.c, swatch: n.c, ...gemOptics(n.c) };
  const g = byId(GEMS, n.m);
  if (g.id === 'diamond') return { ...g, color: '#f2f6ff', ior: 2.42, dispersion: 0.4, att: '#ffffff', attDist: 1e3 };
  if (g.opaque) return { ...g, color: g.hex };
  return { ...g, ...gemOptics(g.hex) };
}

/** Nom lisible d'une affectation {m, f, c}. */
export function describeAssignment(a, kind) {
  if (!a) return '';
  const k = kind ?? (byId(GEMS, a.m) && !byId(METALS, a.m) ? 'gem' : (byId(METALS, a.m) ? 'metal' : null));
  if (a.m === CUSTOM) return `Teinte ${String(a.c ?? '').toUpperCase()}${a.f ? ' · ' + (byId(FINISHES, a.f)?.name ?? '') : ''}`;
  const metal = byId(METALS, a.m);
  if (metal && k !== 'gem') return `${metal.name}${a.f ? ' · ' + (byId(FINISHES, a.f)?.name ?? '') : ''}`;
  return byId(GEMS, a.m)?.name ?? '';
}

/** Couleur d'échantillon (pastille) d'une affectation. */
export function swatchOf(kind, a) {
  if (!a) return '#ccc';
  if (a.m === CUSTOM) return a.c ?? '#ccc';
  return (byId(kind === 'gem' ? GEMS : METALS, a.m) ?? {}).swatch ?? '#ccc';
}

/** Matériaux (réglage pour l'AR Quick Look : pas de transmission → teinte opaque brillante). */
export function gemSubstitute(gem) {
  const c = gem.opaque ? gem.color : gem.id === 'diamond' ? '#eef3ff' : gem.hex ?? '#eef3ff';
  return { color: c, roughness: 0.04, metalness: gem.opaque ? 0 : 0.35 };
}
