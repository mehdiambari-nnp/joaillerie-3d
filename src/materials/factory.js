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

// ---- Brossé : grain circulaire dans le sens de la bague (autour de l'axe du doigt), indépendant des UV du modèle ----
const grainShared = { uGrainCenter: { value: new THREE.Vector3() }, uGrainAxis: { value: new THREE.Vector3(0, 0, 1) } };
/** Axe du doigt (Z après normalisation à l'import) et centre de la bague, pour orienter le grain. */
export function setGrainFrame(center, axis = new THREE.Vector3(0, 0, 1)) {
  grainShared.uGrainCenter.value.copy(center);
  grainShared.uGrainAxis.value.copy(axis).normalize();
}
function installGrain(m) {
  if (m.userData.grainU) return;
  m.userData.grainU = { value: 0 }; m.userData.hamU = { value: 0 }; m.userData.hamSizeU = { value: 1.1 }; m.userData.grainAngU = { value: 0 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grainShared, { uGrainAmt: m.userData.grainU, uHamAmt: m.userData.hamU, uHamSize: m.userData.hamSizeU, uGrainAng: m.userData.grainAngU });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainWP; varying vec3 vGrainOP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGrainWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vGrainOP = transformed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrainWP; varying vec3 vGrainOP;
uniform vec3 uGrainCenter; uniform vec3 uGrainAxis; uniform float uGrainAmt; uniform float uHamAmt; uniform float uHamSize; uniform float uGrainAng;
vec3 gH3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453) * 2.0 - 1.0; }
float gH(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float gD(float s) { float i = floor(s), f = fract(s); return (gH(i + 1.0) - gH(i)) * 6.0 * f * (1.0 - f); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uGrainAmt > 0.0) {
        vec3 rel = vGrainWP - uGrainCenter;
        float ax = dot(rel, uGrainAxis);
        vec3 rad = rel - uGrainAxis * ax;
        float r = length(rad);
        vec3 rd = rad / max(r, 1e-4);
        // angle 0 : stries le long de la circonférence ; 90° : le long de l'axe du doigt. Coupure du repère angulaire en bas de la bague.
        float ca = cos(uGrainAng), sa = sin(uGrainAng);
        vec3 e2 = normalize(vec3(0.0, 1.0, 0.0) - uGrainAxis * uGrainAxis.y);
        vec3 e1 = cross(e2, uGrainAxis);
        float arc = r * atan(dot(rad, e1), dot(rad, e2));
        vec3 tg = cross(rd, uGrainAxis);
        float s = ax * ca + arc * sa + r * 0.6 * ca;
        float dh = gD(s * 14.0) + 0.7 * gD(s * 37.0 + 3.1) + 0.5 * gD(s * 91.0 + 7.7);
        vec3 g = dh * (ca * uGrainAxis + sa * tg + 0.6 * ca * rd);
        vec3 nW = inverseTransformDirection(normal, viewMatrix);
        nW = normalize(nW - g * uGrainAmt);
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
      }
      if (uHamAmt > 0.0) {
        // Martelé : coups de marteau peu profonds = cellules de Voronoï 3D ; chaque cellule est une facette légèrement inclinée
        vec3 q = vGrainOP / uHamSize;
        vec3 ip = floor(q), fp = fract(q);
        float d1 = 9.0, d2 = 9.0; vec3 tilt = vec3(0.0), toC = vec3(0.0);
        for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec3 cell = vec3(float(i), float(j), float(k));
          vec3 pt = cell + 0.5 + 0.42 * gH3(ip + cell);
          float d = length(pt - fp);
          if (d < d1) { d2 = d1; d1 = d; tilt = gH3(ip + cell + 17.0); toC = pt - fp; } else if (d < d2) d2 = d;
        }
        float edge = smoothstep(0.0, 0.3, d2 - d1);            // arête adoucie entre deux facettes
        vec3 nW2 = inverseTransformDirection(normal, viewMatrix);
        // cuvette concave : la normale s'incline vers le centre du coup de marteau, d'autant plus qu'on s'approche du bord ;
        // + un léger biais aléatoire par cellule pour que chaque coup ait sa propre profondeur / orientation
        vec3 dimple = (toC * (1.0 + 0.5 * tilt.x) + tilt * 0.25) * edge;
        dimple -= nW2 * dot(dimple, nW2);                         // composante dans le plan de la surface
        nW2 = normalize(nW2 + dimple * uHamAmt);
        normal = normalize((viewMatrix * vec4(nW2, 0.0)).xyz);
      }`);
  };
  m.customProgramCacheKey = () => 'grain1';
}

/** Paramètres cibles (sans créer de matériau) pour une affectation de métal. */
const METAL_GAIN = 2.0;

export function metalParams(a) {
  const r = resolveMetal(a);
  const L = r.lab ?? null; // texture sur mesure du joaillier (src/materials/lab.js) : tous les réglages PBR
  const gain = L ? L.gain : METAL_GAIN;
  return {
    // gain : l'environnement seul sous-éclaire l'or (mesuré sur une vidéo de bagues réelles) ; gain > 1 autorisé en linéaire
    color: new THREE.Color().setRGB(r.rgb[0] * gain, r.rgb[1] * gain, r.rgb[2] * gain, THREE.LinearSRGBColorSpace),
    roughness: r.fin.roughness,
    anisotropy: L ? L.anisotropy : r.fin.anisotropy,
    hammered: !!r.fin.hammered,
    brushed: !!r.fin.brushed,
    satin: !!r.fin.satin,
    grain: r.fin.grain ?? 0,
    ham: r.fin.ham ?? 0,
    hamSize: r.fin.hamSize ?? 1.1,
    grainAngle: r.fin.grainAngle ?? 0,
    normalScale: r.fin.normalScale ?? 0.6,
    lab: L,
  };
}

/** Réglages PBR avancés d'une texture sur mesure (valeurs neutres pour un métal ordinaire). */
function applyLab(m, p) {
  const L = p.lab;
  m.metalness = L ? L.metalness : 1;
  m.ior = L ? L.ior : 1.5;
  m.specularIntensity = L ? L.specular : 1;
  m.specularColor.set(L ? L.specularColor : '#ffffff');
  m.clearcoat = L ? L.clearcoat : 0;
  m.clearcoatRoughness = L ? L.clearcoatRoughness : 0;
  m.anisotropyRotation = L ? (L.anisotropyRot * Math.PI) / 180 : 0;
  m.iridescence = L ? L.iridescence : 0;
  m.iridescenceIOR = L ? L.iridescenceIOR : 1.3;
  m.iridescenceThicknessRange = [100, L ? L.iridescenceThickness : 400];
  m.sheen = L ? L.sheen : 0;
  m.sheenRoughness = L ? L.sheenRoughness : 0.5;
  m.sheenColor.set(L ? L.sheenColor : '#000000');
  m.emissive.set(L ? L.emissive : '#000000');
  m.emissiveIntensity = L ? L.emissiveIntensity : 0;
  // three ne recompile le programme que si une fonction s'active ou se désactive : on évite de le faire à chaque cran d'un curseur
  const key = [m.clearcoat > 0, m.anisotropy > 0, m.iridescence > 0, m.sheen > 0, m.emissiveIntensity > 0, !!m.normalMap].join();
  if (m.userData.labKey !== key) { m.userData.labKey = key; m.needsUpdate = true; }
}

export const gemParams = resolveGem;

function metalNormal(p) {
  return p.satin ? getBrushedNormalMap('satin') : null;
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
  installGrain(m);
  m.userData.grainU.value = p.grain; m.userData.hamU.value = p.ham; m.userData.hamSizeU.value = p.hamSize; m.userData.grainAngU.value = p.grainAngle;
  m.anisotropy = p.anisotropy;
  m.normalMap = metalNormal(p);
  m.normalScale.set(p.normalScale, p.normalScale);
  applyLab(m, p);
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
    if (g.metal) m.metalness = 0.92;   // hématite : éclat métallique
    m.transmission = 0; m.thickness = 0; m.ior = 1.5; m.dispersion = 0;
    m.iridescence = g.iridescence ?? 0; m.iridescenceIOR = 1.4;
    // la table plane d'une pierre opaque miroite l'éclairage : vernis doux pour que le motif et la couleur restent lisibles
    m.clearcoat = g.pattern ? 0.5 : 0.6; m.clearcoatRoughness = 0.07; // cabochon poli : reflet doux et brillant
    m.envMapIntensity = g.pattern ? 0.85 : 1.1;
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
    installGrain(material);
    material.userData.grainU.value = p.grain; material.userData.hamU.value = p.ham; material.userData.hamSizeU.value = p.hamSize; material.userData.grainAngU.value = p.grainAngle;
    material.anisotropy = p.anisotropy;
    material.normalMap = metalNormal(p);
    material.normalScale.set(p.normalScale, p.normalScale);
    applyLab(material, p);
    if (!p.lab && !material.userData.wasLab) material.needsUpdate = true;
    material.userData.wasLab = !!p.lab;
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
