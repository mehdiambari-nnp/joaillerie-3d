// Fabrique de matériaux three.js + transitions douces (~200 ms) pour un rendu « temps réel ».
import * as THREE from 'three';
import { resolveMetal, resolveGem } from './library.js';

let hammeredNormal = null;
let brushedNormal = null;

/** Normal map procédurale de brossage : fines rayures parallèles (512 px, répétable). Navigateur uniquement. */
export function getBrushedNormalMap() {
  if (brushedNormal || typeof document === 'undefined') return brushedNormal;
  const N = 512;
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // hauteur par ligne (rayures), légèrement modulée le long de la ligne
  const rows = Float32Array.from({ length: N }, () => rnd() - 0.5);
  const smooth = rows.map((_, y) => (rows[y] * 2 + rows[(y + 1) % N] + rows[(y + N - 1) % N]) / 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    const dy = (smooth[(y + 1) % N] - smooth[(y + N - 1) % N]) * 5;
    for (let x = 0; x < N; x++) {
      const wob = 1 + 0.15 * Math.sin((x / N) * Math.PI * 2 * 2);
      const ny = dy * wob, len = Math.hypot(ny, 1);
      const i = (y * N + x) * 4;
      img.data[i] = 128;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  brushedNormal = new THREE.CanvasTexture(canvas);
  brushedNormal.wrapS = brushedNormal.wrapT = THREE.RepeatWrapping;
  brushedNormal.colorSpace = THREE.NoColorSpace;
  return brushedNormal;
}

/** Normal map procédurale de martelage (512 px, dimples aléatoires). Navigateur uniquement. */
export function getHammeredNormalMap() {
  if (hammeredNormal || typeof document === 'undefined') return hammeredNormal;
  const N = 512;
  const h = new Float32Array(N * N);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 520; k++) {
    const cx = rnd() * N, cy = rnd() * N, r = 14 + rnd() * 20, depth = 0.6 + rnd() * 0.4;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const px = (Math.round(cx + x) + N) % N, py = (Math.round(cy + y) + N) % N;
      h[py * N + px] = Math.min(h[py * N + px], -depth * (1 - d * d) * 0.5);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6, dy = (at(x, y + 1) - at(x, y - 1)) * 6;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * N + x) * 4;
    img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  hammeredNormal = new THREE.CanvasTexture(canvas);
  hammeredNormal.wrapS = hammeredNormal.wrapT = THREE.RepeatWrapping;
  hammeredNormal.colorSpace = THREE.NoColorSpace;
  return hammeredNormal;
}

/** Paramètres cibles (sans créer de matériau) pour une affectation de métal. */
export function metalParams(a) {
  const r = resolveMetal(a);
  return {
    color: new THREE.Color().setRGB(...r.rgb, THREE.LinearSRGBColorSpace),
    roughness: r.fin.roughness,
    anisotropy: r.fin.anisotropy,
    hammered: !!r.fin.hammered,
    brushed: !!r.fin.brushed,
  };
}

export const gemParams = resolveGem;

function metalNormal(p) {
  return p.hammered ? getHammeredNormalMap() : p.brushed ? getBrushedNormalMap() : null;
}

/** Crée un matériau neuf pour une affectation. */
export function createMaterial(kind, a) {
  if (kind === 'gem') {
    const g = gemParams(a);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(g.color),
      metalness: 0,
      roughness: g.roughness ?? 0.02,
      envMapIntensity: 1.6,
    });
    configureGem(m, g);
    return m;
  }
  const p = metalParams(a);
  const m = new THREE.MeshPhysicalMaterial({ color: p.color, metalness: 1, roughness: p.roughness, envMapIntensity: 1.2 });
  m.anisotropy = p.anisotropy;
  m.normalMap = metalNormal(p);
  m.normalScale.set(p.brushed ? 0.1 : 0.6, p.brushed ? 0.1 : 0.6);
  return m;
}

function configureGem(m, g) {
  // pierres incolores : léger caractère « chrome » (reflets nets des facettes) en plus de la réfraction
  m.metalness = g.sparkle ? 0.15 : 0;
  m.envMapIntensity = g.sparkle ? 2.2 : 1.6;
  if (g.opaque) {
    m.transmission = 0; m.thickness = 0; m.ior = 1.5; m.dispersion = 0;
    m.iridescence = g.iridescence ?? 0; m.iridescenceIOR = 1.4;
    m.clearcoat = 1; m.clearcoatRoughness = 0.03;
  } else {
    m.transmission = 1;
    m.thickness = 6; // mm (scène en millimètres) : décale la réfraction, donne de la profondeur
    m.ior = Math.min(2.333, g.ior);
    m.dispersion = g.dispersion ?? 0;
    m.attenuationColor = new THREE.Color(g.att);
    m.attenuationDistance = g.attDist;
    m.specularIntensity = 1;
    m.iridescence = 0; m.clearcoat = 0;
  }
}

const tweens = new Set();

/** Applique une affectation à un matériau existant avec une transition douce couleur/rugosité. */
export function transitionMaterial(material, kind, a, { duration = 200, onTick, onDone } = {}) {
  let toColor, toRough, toAtt = null;
  if (kind === 'gem') {
    const g = gemParams(a);
    const wasOpaque = material.transmission === 0;
    configureGem(material, g);
    if (wasOpaque !== !!g.opaque) material.needsUpdate = true;
    toColor = new THREE.Color(g.color); toRough = g.roughness ?? 0.02;
    if (!g.opaque) toAtt = new THREE.Color(g.att);
    // attenuationColor : cible interpolée, valeur initiale = valeur courante avant configureGem → on la restaure
  } else {
    const p = metalParams(a);
    material.anisotropy = p.anisotropy;
    material.normalMap = metalNormal(p);
    material.normalScale.set(p.brushed ? 0.1 : 0.6, p.brushed ? 0.1 : 0.6);
    material.needsUpdate = true;
    toColor = p.color; toRough = p.roughness;
  }
  if (material.userData.tw) { cancelAnimationFrame(material.userData.tw.raf); tweens.delete(material.userData.tw); }
  if (duration <= 0) { material.color.copy(toColor); material.roughness = toRough; onTick?.(); onDone?.(); return null; }
  const fromColor = material.color.clone();
  const fromRough = material.roughness;
  const start = performance.now();
  const tw = { done: false };
  material.userData.tw = tw;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const e = t * t * (3 - 2 * t);
    material.color.copy(fromColor).lerp(toColor, e);
    material.roughness = fromRough + (toRough - fromRough) * e;
    onTick?.();
    if (t < 1) tw.raf = requestAnimationFrame(step);
    else { tweens.delete(tw); onDone?.(); }
  };
  tw.raf = requestAnimationFrame(step);
  tweens.add(tw);
  return tw;
}

export function disposeMaterial(m) { m.dispose(); }
