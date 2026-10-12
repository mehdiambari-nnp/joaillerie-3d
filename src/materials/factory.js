// Fabrique de matériaux three.js + transitions douces (~200 ms) pour un rendu « temps réel ».
import * as THREE from 'three';
import { installGemShader, updateGemUniforms } from './gem.js';
import { resolveMetal, resolveGem } from './library.js';

let hammeredNormal = null;
let brushedNormal = null;

/** Normal map procédurale de brossage : fines rayures parallèles (512 px, répétable). Navigateur uniquement. */
const grainMaps = {};
/** Grain linéaire fin. brossé = stries très fines et denses (mat uniforme) ; satiné = stries plus longues et douces (reflet doux). */
export function getBrushedNormalMap(kind = 'brushed') {
  if (grainMaps[kind] || typeof document === 'undefined') return grainMaps[kind];
  const N = 1024;
  const fine = kind === 'brushed';
  let seed = fine ? 4242 : 777;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = Float32Array.from({ length: N }, () => rnd() - 0.5);
  // brossé : bruit blanc quasi brut (grain fin) ; satiné : lissé sur ~4 lignes (stries plus larges, plus douces)
  const k = fine ? 1 : 4;
  const smooth = rows.map((_, y) => { let a = 0; for (let j = -k; j <= k; j++) a += rows[(y + j + N) % N]; return a / (2 * k + 1); });
  const gain = fine ? 3.2 : 9;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    const dy = (smooth[(y + 1) % N] - smooth[(y + N - 1) % N]) * gain;
    for (let x = 0; x < N; x++) {
      // légère modulation le long de la strie pour casser la régularité
      const wob = 0.75 + 0.25 * Math.sin((x / N) * Math.PI * 2 * (fine ? 7 : 3) + y * 0.37);
      const ny = dy * wob, len = Math.hypot(ny, 1);
      const i = (y * N + x) * 4;
      img.data[i] = 128;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  grainMaps[kind] = tex;
  return tex;
}

export function getHammeredNormalMap() {
  if (hammeredNormal || typeof document === 'undefined') return hammeredNormal;
  const N = 1024;
  const h = new Float32Array(N * N);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Martelage : chaque coup de marteau laisse une facette plane inclinée, au contour polygonal, qui capte la lumière
  for (let n = 0; n < 380; n++) {
    const cx = rnd() * N, cy = rnd() * N, r = 26 + rnd() * 26;
    const tx = (rnd() - 0.5) * 0.5, ty = (rnd() - 0.5) * 0.5, rot = rnd() * Math.PI, sides = 5 + Math.floor(rnd() * 3);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const ang = Math.atan2(y, x) - rot, seg = Math.PI * 2 / sides;
      const edge = r * Math.cos(seg / 2) / Math.cos(((ang % seg) + seg) % seg - seg / 2);
      const d = Math.hypot(x, y);
      if (d > edge) continue;
      const px = (Math.round(cx + x) + N) % N, py = (Math.round(cy + y) + N) % N;
      // plan incliné + cuvette légère ; la dernière facette posée l'emporte (comme un coup de marteau)
      h[py * N + px] = tx * x + ty * y - 0.012 * (r * r - d * d) / r;
    }
  }
  // léger flou : adoucit l'arête entre facettes (évite les traits durs)
  const hb = new Float32Array(N * N);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let a = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) a += h[((y + j + N) % N) * N + ((x + i + N) % N)];
      hb[y * N + x] = a / 9;
    }
    h.set(hb);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.2, dy = (at(x, y + 1) - at(x, y - 1)) * 1.2;
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
    satin: !!r.fin.satin,
    normalScale: r.fin.normalScale ?? 0.6,
  };
}

export const gemParams = resolveGem;

function metalNormal(p) {
  return p.hammered ? getHammeredNormalMap() : p.brushed ? getBrushedNormalMap('brushed') : p.satin ? getBrushedNormalMap('satin') : null;
}

/** Crée un matériau neuf pour une affectation. */
export function createMaterial(kind, a, gemData = null) {
  if (kind === 'gem') {
    const g = gemParams(a);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(g.color),
      metalness: 0,
      roughness: g.roughness ?? 0.02,
      envMapIntensity: 1.6,
    });
    if (gemData) installGemShader(m, gemData);
    configureGem(m, g);
    return m;
  }
  const p = metalParams(a);
  const m = new THREE.MeshPhysicalMaterial({ color: p.color, metalness: 1, roughness: p.roughness, envMapIntensity: 1.2 });
  m.anisotropy = p.anisotropy;
  m.normalMap = metalNormal(p);
  m.normalScale.set(p.normalScale, p.normalScale);
  return m;
}

function configureGem(m, g) {
  if (m.userData.gemU) {
    const flat = !g.opaque;
    if (m.flatShading !== flat) { m.flatShading = flat; m.needsUpdate = true; }
    updateGemUniforms(m, g);
  }
  // pierres incolores : léger caractère « chrome » (reflets nets des facettes) en plus de la réfraction
  m.metalness = g.sparkle ? 0.15 : 0;
  m.envMapIntensity = g.sparkle ? 2.2 : 1.6;
  if (g.opaque) {
    m.transmission = 0; m.thickness = 0; m.ior = 1.5; m.dispersion = 0;
    m.iridescence = g.iridescence ?? 0; m.iridescenceIOR = 1.4;
    m.clearcoat = 1; m.clearcoatRoughness = 0.03;
  } else if (m.userData.gemU) {
    // ray-tracing interne (src/materials/gem.js) : plus de transmission écran, la pierre calcule sa réfraction
    m.transmission = 0; m.thickness = 0; m.ior = Math.min(2.333, g.ior);
    m.specularIntensity = 1; m.iridescence = 0; m.clearcoat = 0;
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
    const wasOpaque = material.userData.gemU ? material.userData.gemU.uGemOn.value === 0 : material.transmission === 0;
    configureGem(material, g);
    if (wasOpaque !== !!g.opaque) material.needsUpdate = true;
    toColor = new THREE.Color(g.color); toRough = g.roughness ?? 0.02;
    if (!g.opaque) toAtt = new THREE.Color(g.att);
    // attenuationColor : cible interpolée, valeur initiale = valeur courante avant configureGem → on la restaure
  } else {
    const p = metalParams(a);
    material.anisotropy = p.anisotropy;
    material.normalMap = metalNormal(p);
    material.normalScale.set(p.normalScale, p.normalScale);
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
