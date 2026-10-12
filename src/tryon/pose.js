// Calcul de la pose d'une bague sur un doigt à partir des points de la main MediaPipe (logique pure).
//
// Repère « caméra » : x → droite, y → haut, la scène est devant la caméra (z négatif), comme three.js.
// MediaPipe : landmarks 2D normalisés (x → droite, y → bas), landmarks « monde » en mètres (x → droite, y → bas, z → s'éloigne).
import * as THREE from 'three';

/** Indices MediaPipe : base (MCP) et articulation suivante (PIP) de chaque doigt. */
export const FINGERS = {
  index: [5, 6],
  middle: [9, 10],
  ring: [13, 14],
  pinky: [17, 18],
};

// Longueurs réelles moyennes (adulte, mètres) de segments rigides de la paume. Les « world landmarks » de MediaPipe
// ne sont pas à l'échelle réelle (mains ~30 % trop petites, doigts compressés) : on s'en sert uniquement pour les
// directions (relief), et l'échelle vient de la taille de la paume dans l'image, comparée à ces moyennes.
const PALM_REF = [[0, 5, 0.098], [0, 9, 0.095], [0, 13, 0.09], [0, 17, 0.083], [5, 17, 0.078]];

/** Poids du relief mesuré dans l'orientation du dessus de la bague (le reste regarde la caméra). */
export const TOP_RELIEF = 0.35;

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Distance focale en pixels pour un champ de vision donné sur le grand côté de l'image. */
export function focalPx(width, height, fovLongDeg) {
  return (Math.max(width, height) / 2) / Math.tan((fovLongDeg * Math.PI) / 360);
}

/**
 * @param lm  21 points {x,y,z} normalisés (image)
 * @param wl  21 points {x,y,z} « monde » MediaPipe (utilisés pour le relief uniquement)
 * @param label 'Left' | 'Right' : conservé pour compatibilité, non utilisé (voir ci-dessous)
 * @returns { position: Vector3 (m), quaternion, axis: Vector3, top: Vector3, depth, pxPerMeter } | null
 *
 * Le dessus de la bague est toujours orienté vers la caméra : on présente la bague avec le dos de la main visible.
 * L'étiquette gauche/droite de MediaPipe ne distingue pas le dos de la paume (un dos de main gauche ressemble à
 * une paume de main droite dans l'image), elle ne peut donc pas servir à choisir le côté.
 */
export function computeRingPose({
  lm, wl, width, height, fovLongDeg = 66, finger = 'ring', along = 0.36, flip = false, sizeRef = 1,
}) {
  if (!lm || !wl || lm.length < 21 || wl.length < 21) return null;
  const f = focalPx(width, height, fovLongDeg);
  const px = (a, b) => Math.hypot((lm[a].x - lm[b].x) * width, (lm[a].y - lm[b].y) * height);

  // 1. Échelle : pixels par mètre (médiane des segments de paume, robuste à une mesure aberrante)
  const ratios = PALM_REF.map(([a, b, ref]) => px(a, b) / (ref * sizeRef));
  const pxPerMeter = median(ratios);
  if (!(pxPerMeter > 50)) return null;
  const depth = f / pxPerMeter; // mètres

  // 2. Relief : le monde MediaPipe est ramené à l'échelle de l'image via la paume (rapport de pixels, sans unité)
  let palmPx = 0, palmWorldXY = 0;
  for (const [a, b] of PALM_REF) {
    palmPx += px(a, b);
    palmWorldXY += Math.hypot(wl[a].x - wl[b].x, wl[a].y - wl[b].y);
  }
  const kw = palmWorldXY > 1e-6 ? palmPx / palmWorldXY : 0;
  // vecteur a→b en « pixels caméra » : x droite, y haut, z vers la caméra
  const vec = (a, b) => new THREE.Vector3(
    (lm[b].x - lm[a].x) * width,
    -(lm[b].y - lm[a].y) * height,
    -(wl[b].z - wl[a].z) * kw,
  );

  // 3. Position sur le doigt (entre MCP et PIP), perspective inverse
  const [ia, ib] = FINGERS[finger] ?? FINGERS.ring;
  const cx = (lm[ia].x * (1 - along) + lm[ib].x * along) * width;
  const cy = (lm[ia].y * (1 - along) + lm[ib].y * along) * height;
  const position = new THREE.Vector3(((cx - width / 2) / f) * depth, (-(cy - height / 2) / f) * depth, -depth);

  // 4. Axe du doigt (vers le bout) et dessus de la bague = dos de la main, tourné vers la caméra
  // direction du doigt : base → articulation suivante (ib + 1 = DIP), plus longue donc moins sensible au bruit que MCP → PIP
  const axis = vec(ia, ib).add(vec(ib, ib + 1)).normalize();
  const n = new THREE.Vector3().crossVectors(vec(0, 5), vec(0, 17)).normalize();
  if (n.z < 0) n.negate();
  // Le relief (normale du dos de la main) est fiable une fois les points lissés : on lui laisse l'essentiel du poids,
  // un léger rappel vers « face à la caméra » (+z) évite seulement les retournements quand la main est vue de chant.
  const top = n.multiplyScalar(TOP_RELIEF).add(new THREE.Vector3(0, 0, 1 - TOP_RELIEF));
  top.addScaledVector(axis, -top.dot(axis));
  if (top.lengthSq() < 1e-6) top.set(0, 0, 1).addScaledVector(axis, -axis.z);
  top.normalize();
  if (flip) top.negate();

  const x = new THREE.Vector3().crossVectors(top, axis).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, top, axis));
  return { position, quaternion, axis, top, depth, pxPerMeter };
}

/** Rayon (m) du cylindre d'occultation : légèrement sous le diamètre intérieur pour garder l'intérieur visible. */
export function occluderRadius(innerDiameterMm) {
  return ((innerDiameterMm ?? 18) / 2) * 0.001 * 0.9;
}
