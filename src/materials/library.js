// Bibliothèque de matériaux (valeurs PBR physiquement plausibles). Scène en millimètres.
// Principe « joaillier » : on choisit une COULEUR (et une finition pour les métaux), pas une espèce minérale ni un titrage.
// Une affectation est { m: <id de préréglage> | 'custom', c?: '#rrggbb' (si custom), f?: finition (métaux) }.

import { LAB, sanitizeLab } from './lab.js';
export const CUSTOM = 'custom';

// Couleurs de métaux = réflectance F0 en RGB LINÉAIRE (metalness = 1).
export const METALS = [
  // Nuances d'or jaune : plus l'alliage est riche en or pur, plus la teinte est intense et saturée ; plus il contient d'argent, plus elle pâlit.
  { id: 'yellow-deep', name: 'Or jaune intense', rgb: [1.0, 0.64, 0.18], swatch: '#e8ae38' },
  { id: 'yellow', name: 'Or jaune', rgb: [1.0, 0.77, 0.32], swatch: '#e8c36a' },
  { id: 'yellow-light', name: 'Or jaune clair', rgb: [0.98, 0.80, 0.46], swatch: '#e9cb85' },
  { id: 'champagne', name: 'Or champagne', rgb: [0.95, 0.82, 0.59], swatch: '#e6d6ae' },
  { id: 'rose', name: 'Or rose', rgb: [0.96, 0.67, 0.58], swatch: '#eaaa97' },
  { id: 'red', name: 'Or rouge', rgb: [0.93, 0.5, 0.4], swatch: '#dc8a73' },
  { id: 'grey', name: 'Or gris', rgb: [0.74, 0.73, 0.71], swatch: '#c2bfb8' },
  { id: 'platinum', name: 'Platine', rgb: [0.93, 0.93, 0.94], swatch: '#e9e9ea' }, // plus blanc que l'or gris
];

export const FINISHES = [
  { id: 'polish', name: 'Poli', roughness: 0.12, anisotropy: 0 },
  // Réglées d'après des pièces réelles : satiné = reflet doux + stries fines ; brossé = mat uniforme à grain très fin ; martelé = facettes brillantes.
  // `i0` = intensité par défaut (0..1) ; le curseur du bouton la règle : satiné = degré de satinage, brossé = orientation (0–90°), martelé = taille des coups.
  { id: 'satin', name: 'Satiné', roughness: 0.4, anisotropy: 0, i0: 0.62, gauge: 'satin' },
  { id: 'brushed', name: 'Brossé', roughness: 0.4, anisotropy: 0, brushed: true, grain: 0.07, i0: 0, gauge: 'angle' },
  { id: 'hammered', name: 'Martelé', roughness: 0.3, anisotropy: 0, hammered: true, ham: 0.5, i0: 0.35, gauge: 'size' },
];

// Pierres : classées comme l'« Atlas chromatique des gemmes » (7 familles de couleur). Chaque pierre porte ses vraies propriétés :
//   ior = indice de réfraction, disp = dispersion B–G (écart d'indice entre 687 et 431 nm), mineral = espèce (les variétés d'une même espèce
//   se retrouvent d'un clic), mohs = dureté (une bague s'use : en dessous de 7, la pierre craint les rayures), note = repère visuel.
// « hex » = couleur apparente voulue (la teinte de transmission est déduite, voir gemOptics).
// Pierres opaques ou translucides (`opaque`) : pas de réfraction ; `pattern` = motif procédural (voir gem.js), `hex2` / `hex3` = ses autres teintes.
// Effets : `change` = couleur selon la lumière (alexandrite), `bicolor` = deux teintes dans la même pierre (améthyste + citrine).
export const GEM_GROUPS = [
  { id: 'red', name: 'Rouge, pourpre & rose' },
  { id: 'blue', name: 'Bleu nuit, cyan & aigue-marine' },
  { id: 'green', name: 'Vert émeraude, olive & jade' },
  { id: 'yellow', name: 'Jaune, doré & orange feu' },
  { id: 'violet', name: 'Violet, mauve & indigo' },
  { id: 'neutral', name: 'Incolore, brun, bronze & noir' },
  { id: 'poly', name: 'Polychromes & iridescences' },
];

export const GEMS = [
  // ----- Rouge, pourpre & rose
  { id: 'red-vivid', group: 'red', name: 'Rubis', mineral: 'Corindon', mohs: '9', hex: '#e0102c', ior: 1.77, disp: 0.018, note: 'Rouge « sang de pigeon », le plus dur après le diamant.' },
  { id: 'red-dark', group: 'red', name: 'Grenat pyrope', mineral: 'Grenat', mohs: '7–7,5', hex: '#8a0f24', ior: 1.78, disp: 0.024, note: 'Rouge profond, presque noir en lumière faible.' },
  { id: 'spinel-red', group: 'red', name: 'Spinelle rouge', mineral: 'Spinelle', mohs: '8', hex: '#d11f3a', ior: 1.72, disp: 0.02, note: 'Rouge vif et limpide, souvent confondu avec le rubis.' },
  { id: 'rubellite', group: 'red', name: 'Rubellite', mineral: 'Tourmaline', mohs: '7–7,5', hex: '#d42a6a', ior: 1.64, disp: 0.017, note: 'Tourmaline rouge-rose à pourpre.' },
  { id: 'pink-vivid', group: 'red', name: 'Saphir rose', mineral: 'Corindon', mohs: '9', hex: '#e8337f', ior: 1.77, disp: 0.018, note: 'Rose vif, de la même espèce que le rubis.' },
  { id: 'pink-pale', group: 'red', name: 'Morganite', mineral: 'Béryl', mohs: '7,5–8', hex: '#f6b3cb', ior: 1.58, disp: 0.014, note: 'Rose pêche tendre.' },
  { id: 'violet-light', group: 'red', name: 'Kunzite', mineral: 'Spodumène', mohs: '6,5–7', hex: '#c9a4f0', ior: 1.66, disp: 0.017, note: 'Rose lilas ; clivage facile, à protéger des chocs.' },
  { id: 'rhodochrosite', group: 'red', name: 'Rhodochrosite', mineral: 'Rhodochrosite', mohs: '3,5–4', opaque: true, pattern: 'banded', hex: '#e0697b', hex2: '#f4b8c0', hex3: '#c9485f', roughness: 0.1, sss: 0.16, note: 'Rose-corail translucide, voiles laiteux ; très tendre.' },
  // ----- Bleu nuit, cyan & aigue-marine
  { id: 'blue-medium', group: 'blue', name: 'Saphir bleu', mineral: 'Corindon', mohs: '9', hex: '#2f6fe0', ior: 1.77, disp: 0.018, note: 'Bleu intense, le plus classique.' },
  { id: 'blue-royal', group: 'blue', name: 'Saphir royal', mineral: 'Corindon', mohs: '9', hex: '#1b3fc4', ior: 1.77, disp: 0.018, note: 'Bleu profond et velouté.' },
  { id: 'violet-deep', group: 'blue', name: 'Tanzanite', mineral: 'Zoïsite', mohs: '6,5–7', hex: '#4a1a8a', ior: 1.69, disp: 0.021, note: 'Bleu-violet ; fragile, plutôt pour pendentifs et boucles.' },
  { id: 'lapis', group: 'blue', name: 'Lapis-lazuli', mineral: 'Lazurite', mohs: '5–5,5', opaque: true, pattern: 'lapis', hex: '#1d3f9e', hex2: '#dcb24a', hex3: '#e9edf6', roughness: 0.16, note: 'Bleu roi, paillettes de pyrite dorées et veines blanches.' },
  { id: 'blue-aqua', group: 'blue', name: 'Aigue-marine', mineral: 'Béryl', mohs: '7,5–8', hex: '#8fd6ea', ior: 1.58, disp: 0.014, note: 'Bleu clair de l’eau, très limpide.' },
  { id: 'turquoise', group: 'blue', name: 'Turquoise', mineral: 'Turquoise', mohs: '5–6', opaque: true, pattern: 'turquoise', hex: '#3da6ad', hex2: '#5b4636', hex3: '#79c9c6', roughness: 0.22, sss: 0.05, note: 'Bleu-vert opaque, souvent veinée d’une matrice brune.' },
  { id: 'teal-light', group: 'blue', name: 'Tourmaline Paraïba', mineral: 'Tourmaline', mohs: '7–7,5', hex: '#6fd3cd', ior: 1.64, disp: 0.017, note: 'Bleu néon électrique, très rare.' },
  { id: 'topaz-blue', group: 'blue', name: 'Topaze bleue', mineral: 'Topaze', mohs: '8', hex: '#6fb4e8', ior: 1.62, disp: 0.014, note: 'Bleu ciel limpide, bon rapport qualité-prix.' },
  { id: 'teal', group: 'blue', name: 'Zircon bleu', mineral: 'Zircon', mohs: '7,5', hex: '#0f9a9c', ior: 1.93, disp: 0.039, note: 'Dispersion très forte : beaucoup de feu.' },
  { id: 'blue-night', group: 'blue', name: 'Spinelle cobalt', mineral: 'Spinelle', mohs: '8', hex: '#0b1f6b', ior: 1.72, disp: 0.02, note: 'Bleu nuit profond.' },
  // ----- Vert émeraude, olive & jade
  { id: 'green-emerald', group: 'green', name: 'Émeraude', mineral: 'Béryl', mohs: '7,5–8', hex: '#0fa152', ior: 1.58, disp: 0.014, note: 'Vert pur ; ses inclusions (« jardin ») sont normales.' },
  { id: 'green-deep', group: 'green', name: 'Tsavorite', mineral: 'Grenat', mohs: '7–7,5', hex: '#0b5a3a', ior: 1.74, disp: 0.028, note: 'Grenat vert profond, plus brillant que l’émeraude.' },
  { id: 'chrome-tourmaline', group: 'green', name: 'Tourmaline chrome', mineral: 'Tourmaline', mohs: '7–7,5', hex: '#1c8a4a', ior: 1.64, disp: 0.017, note: 'Vert forêt intense.' },
  { id: 'green-tourmaline', group: 'green', name: 'Tourmaline verte', mineral: 'Tourmaline', mohs: '7–7,5', hex: '#2a8f76', ior: 1.64, disp: 0.017, note: 'Vert bleuté.' },
  { id: 'green-light', group: 'green', name: 'Péridot', mineral: 'Olivine', mohs: '6,5–7', hex: '#b6dd3a', ior: 1.66, disp: 0.02, note: 'Vert olive lumineux.' },
  { id: 'jade', group: 'green', name: 'Jade (jadéite)', mineral: 'Jadéite', mohs: '6,5–7', opaque: true, pattern: 'jade', hex: '#4f9a66', hex2: '#79b98a', hex3: '#2f7048', roughness: 0.1, sss: 0.14, note: 'Vert translucide, aspect gras et doux.' },
  { id: 'malachite', group: 'green', name: 'Malachite', mineral: 'Malachite', mohs: '3,5–4', opaque: true, pattern: 'malachite', hex: '#16a064', hex2: '#0a5a38', hex3: '#7fd6a4', roughness: 0.14, note: 'Bandes concentriques vert vif et sombre ; très tendre.' },
  { id: 'prasiolite', group: 'green', name: 'Prasiolite', mineral: 'Quartz', mohs: '7', hex: '#bfe0a0', ior: 1.55, disp: 0.013, note: 'Vert pâle, quartz.' },
  { id: 'diopside', group: 'green', name: 'Diopside chromé', mineral: 'Diopside', mohs: '5,5–6,5', hex: '#1a7a3a', ior: 1.7, disp: 0.013, note: 'Vert profond ; assez tendre.' },
  // ----- Jaune, doré & orange feu
  { id: 'citrine', group: 'yellow', name: 'Citrine', mineral: 'Quartz', mohs: '7', hex: '#f2b832', ior: 1.55, disp: 0.013, note: 'Jaune doré, quartz.' },
  { id: 'yellow', group: 'yellow', name: 'Saphir jaune', mineral: 'Corindon', mohs: '9', hex: '#f5c518', ior: 1.77, disp: 0.018, note: 'Jaune pur et dur.' },
  { id: 'heliodor', group: 'yellow', name: 'Héliodore', mineral: 'Béryl', mohs: '7,5–8', hex: '#e8d447', ior: 1.58, disp: 0.014, note: 'Béryl d’or, jaune verdâtre lumineux.' },
  { id: 'orange', group: 'yellow', name: 'Spessartite', mineral: 'Grenat', mohs: '7–7,5', hex: '#f28a1a', ior: 1.8, disp: 0.027, note: 'Grenat orange mandarine.' },
  { id: 'fire-opal', group: 'yellow', name: 'Opale de feu', mineral: 'Opale', mohs: '5,5–6,5', hex: '#f26b1d', ior: 1.45, disp: 0.01, note: 'Orange feu translucide ; tendre, à protéger.' },
  { id: 'padparadscha', group: 'yellow', name: 'Padparadscha', mineral: 'Corindon', mohs: '9', hex: '#f28a6e', ior: 1.77, disp: 0.018, note: 'Saphir rose-orangé « fleur de lotus », très recherché.' },
  { id: 'carnelian', group: 'yellow', name: 'Cornaline', mineral: 'Calcédoine', mohs: '6,5–7', opaque: true, pattern: 'carnelian', hex: '#cf501c', hex2: '#e8803a', hex3: '#9a3410', roughness: 0.08, sss: 0.14, note: 'Orange rougeâtre translucide, nuageux.' },
  { id: 'cognac', group: 'yellow', name: 'Citrine madère', mineral: 'Quartz', mohs: '7', hex: '#b9631a', ior: 1.55, disp: 0.013, note: 'Brun-orangé, quartz.' },
  // ----- Violet, mauve & indigo
  { id: 'violet', group: 'violet', name: 'Améthyste', mineral: 'Quartz', mohs: '7', hex: '#8a3fd0', ior: 1.55, disp: 0.013, note: 'Violet classique.' },
  { id: 'charoite', group: 'violet', name: 'Charoïte', mineral: 'Charoïte', mohs: '5–6', opaque: true, pattern: 'charoite', hex: '#7a3fa6', hex2: '#c8a0e0', hex3: '#3a1c52', roughness: 0.12, sss: 0.05, note: 'Violet en tourbillons soyeux, unique au monde (Sibérie).' },
  { id: 'sugilite', group: 'violet', name: 'Sugilite', mineral: 'Sugilite', mohs: '5,5–6,5', opaque: true, pattern: 'mottled', hex: '#8b2a8c', hex2: '#b565b3', hex3: '#4a1450', roughness: 0.14, sss: 0.06, note: 'Violet-pourpre dense, nuageux.' },
  { id: 'sapphire-violet', group: 'violet', name: 'Saphir violet', mineral: 'Corindon', mohs: '9', hex: '#6d3fd0', ior: 1.77, disp: 0.018, note: 'Violet-bleu très dur.' },
  { id: 'spinel-violet', group: 'violet', name: 'Spinelle violet', mineral: 'Spinelle', mohs: '8', hex: '#8a60d8', ior: 1.72, disp: 0.02, note: 'Violet doux et brillant.' },
  // ----- Incolore, brun, bronze & noir
  { id: 'diamond', group: 'neutral', name: 'Diamant', mineral: 'Diamant', mohs: '10', sparkle: true, hex: '#f4f8ff', swatch: '#f4f8ff', note: 'Le plus dur ; indice 2,42 et feu inégalés.' },
  { id: 'quartz-clear', group: 'neutral', name: 'Cristal de roche', mineral: 'Quartz', mohs: '7', hex: '#f1f7fa', ior: 1.54, disp: 0.013, note: 'Quartz incolore.' },
  { id: 'quartz-smoky', group: 'neutral', name: 'Quartz fumé', mineral: 'Quartz', mohs: '7', hex: '#7a6552', ior: 1.55, disp: 0.013, note: 'Brun fumée.' },
  { id: 'tiger-eye', group: 'neutral', name: 'Œil de tigre', mineral: 'Quartz', mohs: '6,5–7', opaque: true, pattern: 'tigereye', hex: '#9c6518', hex2: '#2e1b09', hex3: '#f0be4a', roughness: 0.12, note: 'Bandes brunes et dorées, fibres soyeuses : un reflet lumineux glisse sur la pierre quand on la tourne (chatoyance).' },
  { id: 'black', group: 'neutral', name: 'Onyx', mineral: 'Calcédoine', mohs: '6,5–7', opaque: true, hex: '#0b0b0d', roughness: 0.08, note: 'Noir profond et uni.' },
  { id: 'obsidian', group: 'neutral', name: 'Obsidienne', mineral: 'Verre volcanique', mohs: '5–5,5', opaque: true, hex: '#0c0c10', roughness: 0.05, sheen: true, note: 'Noir vitreux ; verre naturel, fragile.' },
  { id: 'black-tourmaline', group: 'neutral', name: 'Tourmaline noire', mineral: 'Tourmaline', mohs: '7–7,5', opaque: true, hex: '#121216', roughness: 0.1, note: 'Noir opaque, tourmaline (schorl).' },
  { id: 'hematite', group: 'neutral', name: 'Hématite', mineral: 'Hématite', mohs: '5–6', opaque: true, metal: true, hex: '#555a64', roughness: 0.12, note: 'Gris acier métallique, très brillant.' },
  // ----- Polychromes & iridescences
  { id: 'opal-noble', group: 'poly', name: 'Opale noble', mineral: 'Opale', mohs: '5,5–6,5', opaque: true, pattern: 'opal', hex: '#1c2a3a', hex2: '#3ad0b0', hex3: '#e0508c', roughness: 0.08, note: 'Feux spectraux changeant avec l’angle ; tendre.' },
  { id: 'alexandrite', group: 'poly', name: 'Alexandrite', mineral: 'Chrysobéryl', mohs: '8,5', hex: '#2f9e86', hex2: '#a82250', ior: 1.75, disp: 0.015, change: true, note: 'Change de couleur : verte à la lumière du jour, rouge-violet à la lumière chaude. Changez l’éclairage.' },
  { id: 'labradorite', group: 'poly', name: 'Labradorite', mineral: 'Feldspath', mohs: '6–6,5', opaque: true, pattern: 'labrador', hex: '#4a5560', hex2: '#2f7fe0', hex3: '#e6b84a', roughness: 0.12, note: 'Gris sombre avec éclairs bleus et dorés selon l’angle (labradorescence).' },
  { id: 'ametrine', group: 'poly', name: 'Ametrine', mineral: 'Quartz', mohs: '7', hex: '#8a3fd0', hex2: '#f2b832', ior: 1.55, disp: 0.013, bicolor: true, note: 'Bicolore naturel : améthyste et citrine dans la même pierre.' },
  { id: 'moonstone', group: 'poly', name: 'Pierre de lune', mineral: 'Feldspath', mohs: '6–6,5', opaque: true, pattern: 'moonstone', hex: '#aeb9cc', hex2: '#a9c4ff', hex3: '#ffffff', roughness: 0.1, sss: 0.12, note: 'Lueur bleutée laiteuse (adularescence) ; fragile.' },
  { id: 'pearl', group: 'poly', name: 'Perle', mineral: 'Nacre', mohs: '2,5–4,5', opaque: true, hex: '#f4efe6', roughness: 0.25, iridescence: 1, note: 'Lustre nacré ; très tendre, à éviter en bague.' },
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
  ruby: 'red-vivid', emerald: 'green-emerald', amethyst: 'violet', topaz: 'topaz-blue', aquamarine: 'blue-aqua',
  tsavorite: 'green-deep', peridot: 'green-light',
};
const LEGACY_FINISH = { matte: 'satin' };

/** Applique l'intensité (0..1) d'une finition : satiné → rugosité, brossé → angle du grain, martelé → taille des coups (mm). */
export function withIntensity(fin, i) {
  if (!fin.gauge) return fin;
  const v = i ?? fin.i0;
  const out = { ...fin, intensity: v };
  if (fin.gauge === 'satin') out.roughness = 0.14 + 0.42 * v;
  if (fin.gauge === 'angle') out.grainAngle = v * Math.PI / 2;
  if (fin.gauge === 'size') out.hamSize = 0.5 + 1.7 * v;
  return out;
}

/** Remet une affectation (éventuellement ancienne) au format courant. kind: 'metal' | 'gem'. */
export function normalizeAssignment(kind, a) {
  if (!a) return null;
  let { m, c, f, i } = a;
  i = Number.isFinite(i) ? Math.round(Math.min(1, Math.max(0, i)) * 100) / 100 : undefined;
  if (kind === 'gem') {
    if (m !== CUSTOM && !byId(GEMS, m)) m = LEGACY_GEM[m] ?? DEFAULT_GEM.m;
    return m === CUSTOM ? { m, c: validHex(c) ?? '#4a7de0' } : { m };
  }
  if (m === LAB) return { m, l: sanitizeLab(a.l) };
  if (m === 'black') return { m: CUSTOM, c: '#2b2b2e', f: LEGACY_FINISH[f] ?? f ?? DEFAULT_METAL.f };
  if (m !== CUSTOM && !byId(METALS, m)) m = LEGACY_METAL[m] ?? DEFAULT_METAL.m;
  f = LEGACY_FINISH[f] ?? f;
  if (!byId(FINISHES, f)) f = DEFAULT_METAL.f;
  const out = m === CUSTOM ? { m, c: validHex(c) ?? '#d8b45a', f } : { m, f };
  if (i !== undefined && byId(FINISHES, f)?.gauge) out.i = i;
  return out;
}

/** L'identifiant m convient-il à ce type de pièce ? */
export function isMaterialFor(kind, m) {
  if (m === LAB) return kind !== 'gem';
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
/** Finition d'une texture du joaillier : la texture choisie (lisse / satiné / brossé / martelé) avec la rugosité réglée à la main. */
function labFinish(l) {
  const base = byId(FINISHES, { satin: 'satin', brushed: 'brushed', hammered: 'hammered' }[l.tex]) ?? FINISHES[0];
  const fin = withIntensity(base, l.texI);
  return { ...fin, roughness: l.roughness, normalScale: l.relief };
}

export function resolveMetal(a) {
  const n = normalizeAssignment('metal', a) ?? DEFAULT_METAL;
  if (n.m === LAB) {
    const rgb = hexToRgb(n.l.color).map((x) => srgbToLinear(x / 255));
    return { id: LAB, name: n.l.n || 'Texture sur mesure', rgb, swatch: n.l.color, fin: labFinish(n.l), lab: n.l };
  }
  const fin = withIntensity(byId(FINISHES, n.f) ?? FINISHES[0], n.i);
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
// Échelle du moteur de rendu : dispersion 0,4 ↔ diamant (0,044 réel) ; les autres pierres sont mises à la même échelle.
const DISP_SCALE = 0.4 / 0.044;

export function gemOptics(hex) {
  const [h, s, l] = hexToHsl(hex);
  const dark = Math.max(0, 0.38 - l) / 0.38; // 0 = clair, 1 = très foncé
  return {
    color: hslToHex(h, s * 0.3, 0.9),
    att: hex,
    attDist: 4.2 + dark * 2.4,
    ior: 1.77,
    dispersion: 0.16, // corindon (rubis / saphir)
  };
}

export function resolveGem(a) {
  const n = normalizeAssignment('gem', a) ?? DEFAULT_GEM;
  if (n.m === CUSTOM) return { id: CUSTOM, name: `Teinte ${n.c.toUpperCase()}`, hex: n.c, swatch: n.c, ...gemOptics(n.c) };
  const g = byId(GEMS, n.m);
  if (g.id === 'diamond') return { ...g, color: '#f2f6ff', ior: 2.42, dispersion: 0.4, att: '#ffffff', attDist: 1e3 };
  if (g.opaque) return { ...g, color: g.hex };
  const o = gemOptics(g.hex);
  // pierres à deux teintes : la seconde (lumière chaude pour l'alexandrite, moitié de la pierre pour l'ametrine) a sa propre atténuation
  const o2 = (g.change || g.bicolor) && g.hex2 ? { att2: g.hex2 } : {};
  return { ...g, ...o, ...o2, ior: g.ior ?? o.ior, dispersion: g.disp != null ? g.disp * DISP_SCALE : o.dispersion };
}

/** Nom lisible d'une affectation {m, f, c}. */
export function describeAssignment(a, kind) {
  if (!a) return '';
  const k = kind ?? (byId(GEMS, a.m) && !byId(METALS, a.m) ? 'gem' : (byId(METALS, a.m) ? 'metal' : null));
  if (a.m === LAB) return sanitizeLab(a.l).n || 'Texture sur mesure';
  if (a.m === CUSTOM) return `Teinte ${String(a.c ?? '').toUpperCase()}${a.f ? ' · ' + (byId(FINISHES, a.f)?.name ?? '') : ''}`;
  const metal = byId(METALS, a.m);
  if (metal && k !== 'gem') return `${metal.name}${a.f ? ' · ' + (byId(FINISHES, a.f)?.name ?? '') : ''}`;
  return byId(GEMS, a.m)?.name ?? '';
}

/** Couleur d'échantillon (pastille) d'une affectation. */
export function swatchOf(kind, a) {
  if (!a) return '#ccc';
  if (a.m === LAB) return sanitizeLab(a.l).color;
  if (a.m === CUSTOM) return a.c ?? '#ccc';
  return (byId(kind === 'gem' ? GEMS : METALS, a.m) ?? {}).swatch ?? '#ccc';
}

/** Matériaux (réglage pour l'AR Quick Look : pas de transmission → teinte opaque brillante). */
export function gemSubstitute(gem) {
  const c = gem.opaque ? gem.color : gem.id === 'diamond' ? '#eef3ff' : gem.hex ?? '#eef3ff';
  return { color: c, roughness: 0.04, metalness: gem.opaque ? 0 : 0.35 };
}
