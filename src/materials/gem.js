// Pierres taillées : réfraction + réflexions internes multiples + dispersion, calculées dans le shader.
// Principe (ray-tracing léger dans la pierre) :
//  1. Une carte cubique « intérieure » est rendue UNE fois par pierre depuis son centre : normale de la facette (repère objet)
//     + distance du centre à la surface, dans chaque direction.
//  2. Au fragment : le rayon de vue se réfracte à l'entrée (facette PLATE → facettes nettes), puis rebondit dans la pierre
//     (Fresnel, réflexion totale interne) en retrouvant sa facette d'impact dans la carte cubique, et sort en échantillonnant
//     l'environnement (HDRI). La dispersion = 3 indices (R, V, B) à la sortie ; la teinte = loi de Beer-Lambert sur le trajet.
import * as THREE from 'three';

const CUBE = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent) ? 384 : 512; // plus fin = arêtes de facettes sans escalier aux forts zooms
// iPhone / iPad : moins de rebonds et d'itérations (même rendu à l'œil, GPU mobile ménagé)
const MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
// Lumière « chaude » (0 = jour, 1 = ampoule / coucher de soleil), partagée par toutes les pierres : l'alexandrite y change de couleur.
export const gemLight = { value: 0 };
// Numéro de l'image cumulée à l'arrêt (0 = image de mouvement) : sert à tirer la longueur d'onde de la dispersion au hasard, image après image.
export const gemFrame = { value: 0 };
export const setGemLight = (w) => { gemLight.value = w; };
export const GEM_PATTERNS = { lapis: 1, turquoise: 2, jade: 3, malachite: 4, tigereye: 5, carnelian: 6, charoite: 7, mottled: 8, banded: 9, opal: 10, labrador: 11, moonstone: 12 };
export const GEM_MAX_BOUNCES = MOBILE ? 4 : 6;
const GEM_NEWTON = MOBILE ? 9 : 12;

/** Construit (une fois) la carte cubique intérieure d'une pierre. Retourne null si le rendu est impossible. */
export function buildGemData(renderer, mesh) {
  try {
    const geo = mesh.geometry;
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    const radius = geo.boundingSphere.radius * 1.02;
    const rt = new THREE.WebGLCubeRenderTarget(CUBE, {
      type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    const depthMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uC: { value: center } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 uC;
        void main(){ vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); if (dot(n, vP - uC) < 0.0) n = -n; gl_FragColor = vec4(n, length(vP - uC)); }`,
    });
    const tmp = new THREE.Scene();
    const m = new THREE.Mesh(geo, depthMat);
    tmp.add(m);
    const cam = new THREE.CubeCamera(radius * 0.002, radius * 6, rt);
    cam.position.copy(center);
    tmp.add(cam);
    const prevTarget = renderer.getRenderTarget(), prevTM = renderer.toneMapping, prevXR = renderer.xr.enabled;
    renderer.toneMapping = THREE.NoToneMapping; renderer.xr.enabled = false;
    cam.update(renderer, tmp);
    renderer.setRenderTarget(prevTarget); renderer.toneMapping = prevTM; renderer.xr.enabled = prevXR;
    depthMat.dispose();
    mesh.updateWorldMatrix(true, false);
    const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
    return { cube: rt.texture, rt, center, radius, scale };
  } catch (e) {
    console.warn('[gem] carte intérieure impossible, repli sur la transmission standard', e);
    return null;
  }
}

/** Branche le shader de pierre sur un MeshPhysicalMaterial. `uniforms` reste modifiable via material.userData.gemU. */
export function installGemShader(material, data) {
  const U = {
    uGemOn: { value: 1 },
    uGemCube: { value: data.cube },
    uGemCenter: { value: data.center.clone() },
    uGemSigma: { value: new THREE.Vector3(0, 0, 0) },
    uGemIor: { value: 2.42 },
    uGemDisp: { value: 0 },       // Δn entre rouge et bleu (physique : diamant ≈ 0,044)
    uGemScale: { value: data.scale },
    uGemGain: { value: 1.0 },
    uGemLock: { value: 0 },        // « verrou de couleur » : ramène la pierre vers sa teinte propre (lumineuse, translucide) en gardant le jeu de lumière
    uGemBody: { value: new THREE.Vector3(1, 1, 1) }, // teinte du corps de la pierre, normalisée en luminance
    uGemLift: { value: 0 },        // lueur interne : plancher de luminosité (les facettes ne tombent jamais dans le noir)
    uGemZone: { value: 0 },        // zonation de croissance / inclusions : variation locale de l'absorption (pierres de couleur)
    uGemBase: { value: data.radius }, // trajet minimal : la lumière traverse déjà ~ un rayon avant la 1re facette de sortie
    uGemSigma2: { value: new THREE.Vector3(0, 0, 0) }, // 2e teinte (alexandrite à la lumière chaude, 2e moitié de l'ametrine)
    uGemMix: { value: 0 },        // 0 = une teinte, 1 = selon l'éclairage, 2 = bicolore
    uGemWarm: gemLight,
    uGemFrame: gemFrame,
    uGemPat: { value: 0 },        // motif procédural des pierres opaques (GEM_PATTERNS)
    uGemDome: { value: 0 },       // pierres opaques = cabochons : normale bombée (0 = facettes plates, 1 = dôme)
    uGemBump: { value: 0.2 },    // relief fin déduit du motif
    uGemAO: { value: 0.5 },       // force de l'occlusion ambiante au bord des pierres serties
    uGemSSS: { value: 0 },        // translucidité : lumière diffusée dans la masse (éclaire les ombres, adoucit)
    uPC1: { value: new THREE.Color('#888888') }, uPC2: { value: new THREE.Color('#888888') }, uPC3: { value: new THREE.Color('#888888') },
  };
  material.userData.gemU = U;
  material.userData.gemData = data;
  material.flatShading = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vGemPos; varying vec3 vGemCam; varying mat3 vGemM;\nvoid main() {')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGemPos = position; vGemCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; vGemM = mat3(modelMatrix);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${GEM_GLSL}\nvoid main() {`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if (uGemPat > 0.5) { gemPatEval(); diffuseColor.rgb = gPC; }')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (uGemDome > 0.0) normal = gemDome(normal);\n  if (uGemPat > 0.5) normal = gemBump(normal, gPH, uGemBump);')
      // « cartes » procédurales : brillance (rugosité) et spéculaire propres à chaque minéral, calculées dans l'espace de la pierre (pas d'UV nécessaires)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  if (uGemPat > 0.5) roughnessFactor = clamp(roughnessFactor * gPR, 0.025, 1.0);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  if (uGemPat > 0.5) material.specularColor *= gPS;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  if (uGemDome > 0.0) { float gao = gemAO(); reflectedLight.indirectDiffuse *= gao; reflectedLight.indirectSpecular *= mix(1.0, gao, 0.85); }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  if (uGemPat > 0.5) totalEmissiveRadiance += gemPatGlow(normal);\n  totalEmissiveRadiance += uGemSSS * diffuseColor.rgb * (0.7 + 0.6 * (1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0)));')
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `if (uGemOn > 0.5) totalDiffuse = gemRadiance();
         vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;`);
  };
  material.customProgramCacheKey = () => 'gemrt7';
  return U;
}

const GEM_GLSL = /* glsl */`
uniform float uGemOn; uniform samplerCube uGemCube; uniform vec3 uGemCenter; uniform vec3 uGemSigma;
uniform vec3 uGemSigma2; uniform float uGemMix; uniform float uGemWarm; uniform float uGemFrame; uniform float uGemPat; uniform float uGemDome; uniform float uGemSSS; uniform float uGemAO; uniform float uGemBump; uniform vec3 uPC1; uniform vec3 uPC2; uniform vec3 uPC3;
uniform float uGemIor; uniform float uGemDisp; uniform float uGemScale; uniform float uGemGain; uniform float uGemBase; uniform float uGemZone; uniform float uGemLock; uniform vec3 uGemBody; uniform float uGemLift;
float gzH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gzN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gzH(i), gzH(i + vec3(1, 0, 0)), f.x), mix(gzH(i + vec3(0, 1, 0)), gzH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gzH(i + vec3(0, 0, 1)), gzH(i + vec3(1, 0, 1)), f.x), mix(gzH(i + vec3(0, 1, 1)), gzH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
varying vec3 vGemPos; varying vec3 vGemCam; varying mat3 vGemM;
float gzF(vec3 x) { return (0.5 * gzN(x) + 0.25 * gzN(x * 2.07 + 3.1) + 0.125 * gzN(x * 4.13 + 7.7) + 0.0625 * gzN(x * 8.3 + 11.3)) / 0.9375; }
vec3 gzW(vec3 q, float s) { return vec3(gzN(q * s), gzN(q * s + 7.0), gzN(q * s + 13.0)) - 0.5; }

// Cabochon : la pierre taillée en facettes est ombrée comme un dôme poli (normale = direction depuis le centre de la pierre), pour des reflets
// doux et continus comme sur une vraie pierre polie, au lieu d'un plan à facettes. La silhouette reste celle du modèle.
vec3 gemDome(vec3 nView) {
  vec3 nObj = normalize(vGemPos - uGemCenter);
  vec3 nD = normalize((viewMatrix * vec4(vGemM * nObj, 0.0)).xyz);
  return normalize(mix(nView, nD, uGemDome));
}

// Œil de tigre : larges bandes irrégulières (largeur variable, déformées) + fibres très fines. band ∈ [0,1], fib ∈ [0,1].
const vec3 TIG_B = vec3(0.75, 0.1, 0.65), TIG_F = vec3(-0.62, 0.3, 0.73);
void gemTiger(vec3 q, out float band, out float fib) {
  float w = gzF(q * 1.25 + 5.0);
  float s = dot(q, TIG_B) * 9.0 + w * 3.6;
  band = clamp(0.5 + 0.5 * sin(s) + 0.38 * (gzN(vec3(s * 0.8, 3.0, 1.0)) - 0.5), 0.0, 1.0);
  vec3 t3 = cross(TIG_B, TIG_F);
  fib = gzN(vec3(dot(q, TIG_B) * 64.0, dot(q, t3) * 64.0, dot(q, TIG_F) * 5.0)) * 0.6 + gzN(vec3(dot(q, TIG_B) * 150.0, dot(q, t3) * 150.0, dot(q, TIG_F) * 9.0)) * 0.4;
}

// ---- Motif des pierres opaques / translucides : UNE SEULE source de vérité ----
// Le motif est calculé une fois par pixel (gemPatEval) dans l'espace objet de la pierre (rayon ≈ 1) : couleur, brillance, spéculaire, relief
// et masques d'effets en sortent ensemble, donc les reflets suivent toujours la texture de couleur (veine mate là où il y a une veine,
// paillette brillante là où il y a une paillette). Pas d'UV : le motif est positionné par le programme lui-même.
vec3 gPC = vec3(0.5);          // couleur de surface
float gPR = 1.0, gPS = 1.0;    // facteurs de rugosité (« glossiness map ») et de spéculaire (« specular map »)
float gPH = 0.0;               // hauteur (relief fin, pour la normale)
float gPA = 0.0, gPB = 0.0, gPF = 0.0; // masques d'effets : accent (veine, paillette, plaque), bande, fibre / phase

void gemPatEval() {
  vec3 q = (vGemPos - uGemCenter) / uGemBase;
  float t = uGemPat, n = gzF(q * 2.5);
  vec3 c = uPC1;
  if (t < 1.5) {                       // lapis-lazuli : fond bleu nuageux, veines de calcite (mates, en creux), paillettes de pyrite (brillantes, en relief)
    float vein = smoothstep(0.03, 0.0, abs(gzN(q * 4.4 + 4.0) - 0.5));
    float fl = smoothstep(0.84, 0.92, gzN(q * 30.0));
    c = uPC1 * (0.4 + 0.7 * n); c = mix(c, uPC3, vein * 0.6); c = mix(c, uPC2, fl * (0.4 + n));
    gPR = mix(1.0, 2.4, vein) * mix(1.0, 0.35, fl); gPS = mix(1.0, 0.7, vein) * mix(1.0, 2.0, fl);
    gPH = -vein * 0.3; gPA = fl;
  } else if (t < 2.5) {                // turquoise : fond crayeux et mat, matrice brune plus dure donc plus brillante et en relief
    float mx = smoothstep(0.045, 0.0, abs(gzN(q * 6.0 + 9.0) - 0.5)) * smoothstep(0.35, 0.6, n);
    c = mix(uPC1, uPC3, smoothstep(0.35, 0.8, gzF(q * 5.0)) * 0.6); c = mix(c, uPC2, mx * 0.9);
    gPR = mix(2.6, 1.0, mx); gPS = mix(0.75, 1.0, mx); gPH = mx * 0.3;
  } else if (t < 3.5) {                // jade : nuages doux, éclat gras, très léger grain « peau d'orange »
    float cl = gzF(q * 3.0);
    c = mix(uPC3, uPC2, smoothstep(0.25, 0.8, cl)); c = mix(c, uPC1, 0.5); c *= 0.9 + 0.2 * gzN(q * 14.0);
    gPR = 1.5 + 0.9 * cl; gPS = 0.9;
  } else if (t < 4.5) {                // malachite : bandes concentriques ; les bandes claires, plus dures, se polissent mieux et affleurent
    float d = length(q * vec3(1.0, 1.25, 1.0) + 0.55 * gzW(q, 1.7));
    float b = 0.5 + 0.5 * sin(d * 26.0 + gzF(q * 4.0) * 5.0);
    c = mix(uPC2, uPC1, smoothstep(0.2, 0.8, b)); c = mix(c, uPC3, smoothstep(0.88, 1.0, b) * 0.35);
    gPR = mix(1.7, 0.8, b); gPH = b * 0.08; gPB = b;
  } else if (t < 5.5) {                // œil de tigre : bandes brun sombre / ambre / or, fibres soyeuses, zones olive-noir
    float band, fib; gemTiger(q, band, fib);
    c = mix(uPC2, uPC1, smoothstep(0.15, 0.7, band));
    c = mix(c, uPC3, smoothstep(0.6, 1.0, band) * (0.25 + 0.5 * fib));
    c = mix(c, vec3(0.05, 0.045, 0.02), smoothstep(0.62, 0.8, gzF(q * 1.1 + 9.0)) * 0.7);
    c *= 0.78 + 0.4 * fib;
    gPR = (0.65 + 1.0 * fib) * mix(1.25, 0.8, band); gPS = 0.9 + 0.4 * band; gPH = band * 0.15; gPB = band; gPF = fib;
  } else if (t < 6.5) {                // cornaline : calcédoine nuageuse, vitreuse
    float cl = gzF(q * 2.6);
    c = mix(uPC3, uPC2, smoothstep(0.25, 0.85, cl)); c = mix(c, uPC1, 0.35);
    gPR = 0.9 + 0.5 * cl;
  } else if (t < 7.5) {                // charoïte : tourbillons soyeux
    float sw = sin((q.x + 0.9 * gzF(q * 2.2)) * 11.0 + gzN(q * 5.0) * 4.0);
    c = mix(uPC3, uPC1, smoothstep(-0.7, 0.4, sw)); c = mix(c, uPC2, smoothstep(0.55, 1.0, sw) * 0.8);
    gPR = 1.2 + 0.9 * gzN(q * 20.0); gPS = 0.9; gPH = sw * 0.1;
  } else if (t < 8.5) {                // sugilite : marbrures
    c = mix(uPC3, uPC1, smoothstep(0.2, 0.7, gzF(q * 3.4))); c = mix(c, uPC2, smoothstep(0.6, 0.9, gzF(q * 6.0 + 3.0)) * 0.6);
    gPR = 1.1 + 0.6 * n;
  } else if (t < 9.5) {                // rhodochrosite : chair rose-corail, nuages profonds, voiles laiteux (plus mats) et fines inclusions claires
    float cl = gzF(q * 2.0 + gzW(q, 1.3) * 1.4);
    float vl = gzF(vec3(q.x * 1.1, q.y * 4.2, q.z * 1.1) + gzW(q, 2.0) * 1.2 + 3.0);
    float v = smoothstep(0.42, 0.75, vl);
    c = mix(uPC3, uPC1, smoothstep(0.28, 0.62, cl)); c = mix(c, uPC2, v * 0.95);
    c = mix(c, vec3(1.0, 0.88, 0.9), smoothstep(0.87, 0.93, gzN(q * 24.0)) * 0.3);
    gPR = mix(1.0, 2.0, v); gPS = mix(1.0, 0.75, v); gPH = v * 0.2;
  } else if (t < 10.5) {               // opale noble : fond sombre vitreux ; plaques de feux (masque gPA, teinte gPB)
    c = uPC1 * (0.7 + 0.6 * n);
    gPR = 0.6; gPS = 1.2; gPA = smoothstep(0.5, 0.7, gzF(q * 2.6)); gPB = gzF(q * 3.0);
  } else if (t < 11.5) {               // labradorite : gris sombre moiré ; plaques d'éclairs (gPA), phase (gPB), teinte bleu/or (gPF)
    c = uPC1 * (0.55 + 0.9 * gzF(q * 3.0)); c = mix(c, vec3(0.03), smoothstep(0.7, 0.9, gzN(q * 9.0)) * 0.5);
    gPR = 0.9 + 0.5 * gzN(q * 8.0); gPA = smoothstep(0.38, 0.58, gzF(q * 2.4 + 3.0)); gPB = gzF(q * 2.0); gPF = smoothstep(0.35, 0.7, gzN(q * 3.0));
  } else {                             // pierre de lune : laiteuse ; lueur bleutée plus ou moins forte (gPA)
    c = mix(uPC1, vec3(0.9), 0.15 * n) * (0.9 + 0.2 * gzN(q * 6.0));
    gPR = 1.4 + 0.7 * n; gPS = 0.9; gPA = 0.6 + 0.4 * gzN(q * 3.0);
  }
  gPC = c;
}

// Relief fin déduit du motif (hauteur gPH), sans UV : dérivées d'écran de la hauteur (bump mapping). Réservé aux motifs LISSES (veines, bandes) :
// sur un grain fin, les dérivées d'écran (par blocs de 2×2 pixels) donnent des artefacts.
vec3 gemBump(vec3 n, float h, float k) {
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - k * g);
}

// Occlusion ambiante d'une pierre sertie : la lumière d'ambiance atteint mal le bord, caché sous le serti (sertissure).
float gemAO() {
  float r = length((vGemPos - uGemCenter) / uGemBase);
  return 1.0 - uGemAO * smoothstep(0.62, 0.98, r);
}

// Reflets qui dépendent de l'angle de vue, pilotés par les masques du MÊME motif : feux de l'opale, éclairs de la labradorite,
// lueur de la pierre de lune, chatoyance de l'œil de tigre, éclats de pyrite du lapis.
vec3 gemPatGlow(vec3 n) {
  float ndv = clamp(dot(n, normalize(vViewPosition)), 0.0, 1.0), t = uGemPat;
  vec3 g = vec3(0.0);
  if (t > 9.5 && t < 10.5) {
    float h = fract(gPB * 1.2 + ndv * 1.1);
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    g = rgb * gPA * (0.12 + 0.28 * ndv);
  } else if (t > 10.5 && t < 11.5) {
    float flash = pow(max(0.0, sin(ndv * 6.0 + gPB * 8.0)), 3.0);
    g = mix(uPC2, uPC3, gPF) * flash * gPA * 0.9;
  } else if (t > 11.5) {
    g = uPC2 * pow(1.0 - ndv, 2.0) * 0.5 * gPA;
  } else if (t > 4.5 && t < 5.5) {
    // chatoyance : ligne lumineuse perpendiculaire aux fibres, là où la surface leur est tangente ; elle glisse quand on tourne la pierre
    vec3 fV = normalize((viewMatrix * vec4(vGemM * TIG_F, 0.0)).xyz);
    float dn = dot(n, fV);
    g = uPC3 * exp(-dn * dn / 0.03) * (0.25 + 0.75 * gPB) * (0.35 + 0.65 * gPF) * 1.7;
  } else if (t > 0.5 && t < 1.5) {
    g = uPC2 * gPA * 0.25;             // éclats de pyrite : exactement là où la couleur en place
  }
  return g;
}

vec3 gemEnv(vec3 dirObj) {
  vec3 w = normalize(vGemM * dirObj);
  return textureCubeUV(envMap, envMapRotation * w, 0.14).rgb * envMapIntensity;
}

// Un rayon (un indice de réfraction) : retourne la lumière sortante
vec3 gemTrace(vec3 nObj, float ior, vec3 sigma) {
  vec3 I = normalize(vGemPos - vGemCam);
  vec3 r = refract(I, nObj, 1.0 / ior);
  if (dot(r, r) < 1e-4) r = reflect(I, nObj);
  vec3 p = vGemPos - uGemCenter;
  float F0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  vec3 acc = vec3(0.0); float weight = 1.0; vec3 od = sigma * uGemBase * uGemScale; // épaisseur optique cumulée
  for (int b = 0; b < ${GEM_MAX_BOUNCES}; b++) {
    float t = 0.5 * length(p) + 0.1;
    for (int k = 0; k < ${GEM_NEWTON}; k++) {
      vec3 q = p + r * t; float R = max(length(q), 1e-5);
      float D = textureCube(uGemCube, q / R).a;
      t += clamp((D - R) / max(0.25, dot(q / R, r)), -0.5 * R, 0.5 * R); // pas borné : évite les sauts sur les rayons rasants
    }
    t = max(t, 0.0);
    vec3 q = p + r * t; vec3 hd = q / max(length(q), 1e-5);
    vec4 cs = textureCube(uGemCube, hd); vec3 n = cs.xyz;
    // le plan exact de la facette (normale + point) corrige l'escalier des texels de la carte cubique, visible aux forts zooms
    float dnr = dot(n, r);
    if (abs(dnr) > 0.02) { float tp = dot(n, hd * cs.a - p) / dnr; if (tp > 0.0 && abs(tp - t) < 0.2 * max(cs.a, 1e-3)) { t = tp; q = p + r * t; } }
    // zonation : bandes de croissance + petits nuages d'inclusions, en espace objet (varie d'une facette à l'autre)
    float zf = 1.0 + uGemZone * ((gzN((p + r * t * 0.5) / uGemBase * 2.3) - 0.5) * 1.6 + (gzN((p + r * t * 0.5) / uGemBase * 7.0) - 0.5) * 0.6);
    od += sigma * zf * t * uGemScale;
    vec3 nin = -n;
    float cosi = clamp(dot(r, n), 0.0, 1.0);
    vec3 rr = refract(r, nin, ior);
    float Fr = (dot(rr, rr) < 1e-4) ? 1.0 : F0 + (1.0 - F0) * pow(1.0 - cosi, 5.0);
    if (Fr < 1.0) acc += weight * (1.0 - Fr) * gemEnv(rr) * exp(-od);
    weight *= Fr;
    r = reflect(r, nin); p = q;
    if (weight < 0.015) break;
  }
  acc += weight * gemEnv(r) * exp(-od) * 0.5; // reliquat
  return acc;
}

// Gros plan : pseudo-réflexions internes lisses (sans carte cubique) — quelques sorties de lumière dont la direction dépend de la facette,
// moyennées : la pierre reste transparente et vivante, sans escaliers de texels.
vec3 gemNear(vec3 nObj, vec3 sg) {
  vec3 Iv = normalize(vGemPos - vGemCam);
  vec3 rv = refract(Iv, nObj, 1.0 / uGemIor); if (dot(rv, rv) < 1e-4) rv = reflect(Iv, nObj);
  vec3 t1 = normalize(cross(nObj, Iv) + 1e-4), t2 = cross(nObj, t1);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float a = 0.6 + 0.9 * float(i), k = 0.35 + 0.22 * float(i);
    vec3 nb = normalize(-nObj + k * (cos(a) * t1 + sin(a) * t2));   // facette interne « virtuelle »
    vec3 rb = reflect(rv, nb);
    vec3 ro = refract(rb, normalize(-nb + 0.25 * t2), uGemIor); if (dot(ro, ro) < 1e-4) ro = rb;
    ro = normalize(ro + (0.55 + 0.25 * float(i)) * (vGemPos - uGemCenter) / uGemBase); // parallaxe : le point de sortie change d'un pixel à l'autre
    acc += gemEnv(ro) * exp(-sg * uGemBase * uGemScale * (1.6 + 0.9 * float(i)));
  }
  return mix(acc * 0.25, gemEnv(rv) * exp(-sg * uGemBase * uGemScale * 1.6), 0.25);
}

vec3 gemRadiance() {
  vec3 nObj = normalize(cross(dFdx(vGemPos), dFdy(vGemPos)));
  if (dot(nObj, vGemPos - uGemCenter) < 0.0) nObj = -nObj;
  vec3 sg = uGemSigma;
  if (uGemMix > 1.5) sg = mix(uGemSigma, uGemSigma2, smoothstep(-0.15, 0.15, dot((vGemPos - uGemCenter) / uGemBase, normalize(vec3(0.62, 0.31, 0.72))))); // ametrine : deux moitiés
  else if (uGemMix > 0.5) sg = mix(uGemSigma, uGemSigma2, uGemWarm); // alexandrite : la lumière change la couleur
  vec3 c;
  // Très gros plan : la carte cubique intérieure est agrandie jusqu'à ses texels (escaliers, bandes) → on coupe le tracé interne et on affiche
  // une réfraction simple, lisse, facette par facette (normales exactes de l'écran). Fondu entre 7 et 3 rayons de pierre de distance.
  float nearF = 1.0 - smoothstep(3.0, 7.0, length(vGemCam - uGemCenter) / uGemBase);
  if (nearF > 0.999) {
    c = gemNear(nObj, sg);
  } else {
  if (uGemDisp > 1e-4) {
    // dispersion « spectrale » stochastique : chaque canal tire sa longueur d'onde dans sa bande (R : rouge, V : milieu, B : bleu), au hasard par pixel et
    // par image cumulée. Moyennées à l'arrêt, les franges deviennent des dégradés continus (plus de points colorés), sans rayon supplémentaire.
    vec3 hs = fract(sin(vec3(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uGemFrame * 4.1, dot(gl_FragCoord.xy, vec2(39.346, 11.135)) + uGemFrame * 7.3, dot(gl_FragCoord.xy, vec2(73.156, 52.235)) + uGemFrame * 2.9)) * 43758.5453);
    float wR = uGemFrame > 0.5 ? -0.5 + 0.34 * hs.x : -0.33, wG = uGemFrame > 0.5 ? -0.17 + 0.34 * hs.y : 0.0, wB = uGemFrame > 0.5 ? 0.17 + 0.33 * hs.z : 0.33;
    float h = uGemDisp;
    c = vec3(gemTrace(nObj, uGemIor + h * wR, sg).r, gemTrace(nObj, uGemIor + h * wG, sg).g, gemTrace(nObj, uGemIor + h * wB, sg).b);
  } else c = gemTrace(nObj, uGemIor, sg);
  if (nearF > 0.0) {
    c = mix(c, gemNear(nObj, sg), nearF);
  }
  }
  // pierre de couleur réelle : la teinte du corps est stable d'une facette à l'autre (la lumière y est piégée sur plusieurs trajets) et les facettes
  // restent lumineuses. On garde la structure de lumière (luminance) et on la teinte, plutôt que de laisser l'absorption seule la saturer en olive sombre.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  lum = lum / (1.0 + 0.45 * lum * uGemLock); // épaule douce : les reflets vifs restent colorés au lieu de blanchir
  c = mix(c, uGemBody * (lum + uGemLift), uGemLock);
  return c * uGemGain;
}
`;

/** Met à jour les uniformes d'une pierre à partir des paramètres résolus (resolveGem). */
export function updateGemUniforms(material, g) {
  const U = material.userData.gemU; if (!U) return;
  U.uGemOn.value = g.opaque ? 0 : 1;
  U.uGemIor.value = Math.min(2.6, g.ior ?? 1.76);
  U.uGemDisp.value = (g.dispersion ?? 0) * 0.11 * 1.3; // 0,4 → Δn ≈ 0,066 (diamant réel 0,044, légèrement amplifié pour le « feu »)
  const att = new THREE.Color(g.att ?? '#ffffff');
  const d = Math.max(1e-3, g.attDist ?? 1e3);
  const s = (c) => -Math.log(Math.max(0.002, Math.min(1, c))) / d;
  U.uGemSigma.value.set(s(att.r), s(att.g), s(att.b));
  U.uGemGain.value = g.sparkle ? 1.25 : 1.2;
  const lock = g.sparkle || g.change || g.bicolor || g.opaque ? 0 : 0.95;
  U.uGemLock.value = lock;
  if (lock) {
    const hsl = {}; new THREE.Color(g.hex ?? g.att ?? '#ffffff').getHSL(hsl);
    const body = new THREE.Color(g.hex ?? g.att ?? '#ffffff').lerp(new THREE.Color("#ffffff"), 0.22);
    const y = body.r * 0.2126 + body.g * 0.7152 + body.b * 0.0722;
    U.uGemBody.value.set(body.r / y, body.g / y, body.b / y);
    U.uGemLift.value = 0.14 * Math.min(1, Math.max(0, (hsl.l - 0.18) / 0.3)); // pierres sombres (grenat, noir) : pas de lueur ajoutée
  }
  U.uGemZone.value = g.sparkle ? 0 : 0.12; // pierres de couleur : zonation / inclusions discrètes
  // 2e teinte (alexandrite, ametrine) et motif des pierres opaques
  U.uGemMix.value = g.change ? 1 : g.bicolor ? 2 : 0;
  const att2 = new THREE.Color(g.att2 ?? g.att ?? '#ffffff');
  U.uGemSigma2.value.set(s(att2.r), s(att2.g), s(att2.b));
  U.uGemPat.value = g.opaque && g.pattern ? GEM_PATTERNS[g.pattern] ?? 0 : 0;
  U.uGemDome.value = g.opaque ? 0.85 : 0; // opaques = cabochons
  U.uGemSSS.value = g.opaque ? g.sss ?? 0 : 0;
  U.uPC1.value.set(g.hex ?? '#888888'); U.uPC2.value.set(g.hex2 ?? g.hex ?? '#888888'); U.uPC3.value.set(g.hex3 ?? g.hex ?? '#888888');
}

export function disposeGemData(data) { data?.rt?.dispose(); }
