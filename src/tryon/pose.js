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

// Segments rigides de la paume servant à estimer l'échelle (px par mètre).
const SCALE_PAIRS = [[0, 5], [0, 17], [5, 17], [0, 9], [0, 13], [9, 10], [13, 14], [5, 6]];

const toCam = (w) => new THREE.Vector3(w.x, -w.y, -w.z);

/** Distance focale en pixels pour un champ de vision donné sur le grand côté de l'image. */
export function focalPx(width, height, fovLongDeg) {
  return (Math.max(width, height) / 2) / Math.tan((fovLongDeg * Math.PI) / 360);
}

/**
 * @param lm  21 points {x,y,z} normalisés (image)
 * @param wl  21 points {x,y,z} en mètres (monde)
 * @param label 'Left' | 'Right' : étiquette MediaPipe (image NON retournée → étiquettes inversées)
 * @returns { position: Vector3 (m), quaternion, axis: Vector3, top: Vector3, depth, pxPerMeter } | null
 */
export function computeRingPose({
  lm, wl, label = 'Left', width, height, fovLongDeg = 66, finger = 'ring', along = 0.38, flip = false,
}) {
  if (!lm || !wl || lm.length < 21 || wl.length < 21) return null;
  const f = focalPx(width, height, fovLongDeg);

  // 1. Échelle (px/m) : somme des longueurs image / somme des longueurs monde (projection xy)
  let sumPx = 0, sumM = 0;
  const refZ = [];
  for (const [a, b] of SCALE_PAIRS) {
    const dpx = Math.hypot((lm[a].x - lm[b].x) * width, (lm[a].y - lm[b].y) * height);
    const dm = Math.hypot(wl[a].x - wl[b].x, wl[a].y - wl[b].y);
    if (dm < 0.004) continue;
    sumPx += dpx; sumM += dm;
    refZ.push(wl[a].z, wl[b].z);
  }
  if (sumM < 1e-6 || sumPx < 1) return null;
  const pxPerMeter = sumPx / sumM; // la correction de taille utilisateur s'applique à l'échelle de la bague, pas à la profondeur
  const depthCenter = f / pxPerMeter;
  const meanRefZ = refZ.reduce((s, v) => s + v, 0) / refZ.length;

  // 2. Position sur le doigt (entre MCP et PIP)
  const [ia, ib] = FINGERS[finger] ?? FINGERS.ring;
  const px = (lm[ia].x * (1 - along) + lm[ib].x * along) * width;
  const py = (lm[ia].y * (1 - along) + lm[ib].y * along) * height;
  const wz = wl[ia].z * (1 - along) + wl[ib].z * along;
  const depth = depthCenter + (wz - meanRefZ); // mètres
  const position = new THREE.Vector3(((px - width / 2) / f) * depth, (-(py - height / 2) / f) * depth, -depth);

  // 3. Axe du doigt (vers le bout) et dessus de la bague = dos de la main
  const axis = toCam(wl[ib]).sub(toCam(wl[ia])).normalize();
  const v0 = toCam(wl[0]);
  const n = new THREE.Vector3().crossVectors(toCam(wl[5]).sub(v0), toCam(wl[17]).sub(v0));
  const physicalRight = label === 'Left'; // image non retournée : étiquette inversée
  const palm = n.multiplyScalar(physicalRight ? 1 : -1).normalize();
  let top = palm.clone().negate(); // dos de la main
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
