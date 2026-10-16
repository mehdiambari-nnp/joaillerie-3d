// Pierres taillées : réfraction + réflexions internes multiples + dispersion, calculées dans le shader.
// Principe (ray-tracing léger dans la pierre) :
//  1. Une carte cubique « intérieure » est rendue UNE fois par pierre depuis son centre : normale de la facette (repère objet)
//     + distance du centre à la surface, dans chaque direction.
//  2. Au fragment : le rayon de vue se réfracte à l'entrée (facette PLATE → facettes nettes), puis rebondit dans la pierre
//     (Fresnel, réflexion totale interne) en retrouvant sa facette d'impact dans la carte cubique, et sort en échantillonnant
//     l'environnement (HDRI). La dispersion = 3 indices (R, V, B) à la sortie ; la teinte = loi de Beer-Lambert sur le trajet.
import * as THREE from 'three';

const CUBE = 256;
// iPhone / iPad : moins de rebonds et d'itérations (même rendu à l'œil, GPU mobile ménagé)
const MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
// Lumière « chaude » (0 = jour, 1 = ampoule / coucher de soleil), partagée par toutes les pierres : l'alexandrite y change de couleur.
export const gemLight = { value: 0 };
export const setGemLight = (w) => { gemLight.value = w; };
export const GEM_PATTERNS = { lapis: 1, turquoise: 2, jade: 3, malachite: 4, tigereye: 5, carnelian: 6, charoite: 7, mottled: 8, banded: 9, opal: 10, labrador: 11, moonstone: 12 };
export const GEM_MAX_BOUNCES = MOBILE ? 4 : 6;
const GEM_NEWTON = MOBILE ? 6 : 8;

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
    uGemZone: { value: 0 },        // zonation de croissance / inclusions : variation locale de l'absorption (pierres de couleur)
    uGemBase: { value: data.radius }, // trajet minimal : la lumière traverse déjà ~ un rayon avant la 1re facette de sortie
    uGemSigma2: { value: new THREE.Vector3(0, 0, 0) }, // 2e teinte (alexandrite à la lumière chaude, 2e moitié de l'ametrine)
    uGemMix: { value: 0 },        // 0 = une teinte, 1 = selon l'éclairage, 2 = bicolore
    uGemWarm: gemLight,
    uGemPat: { value: 0 },        // motif procédural des pierres opaques (GEM_PATTERNS)
    uGemDome: { value: 0 },       // pierres opaques = cabochons : normale bombée (0 = facettes plates, 1 = dôme)
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
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if (uGemPat > 0.5) diffuseColor.rgb = gemPatColor();')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (uGemDome > 0.0) normal = gemDome(normal);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  if (uGemPat > 0.5) totalEmissiveRadiance += gemPatGlow(normal);\n  totalEmissiveRadiance += uGemSSS * diffuseColor.rgb * (0.7 + 0.6 * (1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0)));')
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `if (uGemOn > 0.5) totalDiffuse = gemRadiance();
         vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;`);
  };
  material.customProgramCacheKey = () => 'gemrt5';
  return U;
}

const GEM_GLSL = /* glsl */`
uniform float uGemOn; uniform samplerCube uGemCube; uniform vec3 uGemCenter; uniform vec3 uGemSigma;
uniform vec3 uGemSigma2; uniform float uGemMix; uniform float uGemWarm; uniform float uGemPat; uniform float uGemDome; uniform float uGemSSS; uniform vec3 uPC1; uniform vec3 uPC2; uniform vec3 uPC3;
uniform float uGemIor; uniform float uGemDisp; uniform float uGemScale; uniform float uGemGain; uniform float uGemBase; uniform float uGemZone;
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

// Pierres opaques ou translucides : couleur de surface procédurale (espace objet de la pierre, rayon ≈ 1), motif propre à chaque espèce.
vec3 gemPatColor() {
  vec3 q = (vGemPos - uGemCenter) / uGemBase;
  float t = uGemPat, n = gzF(q * 2.5);
  vec3 c = uPC1;
  if (t < 1.5) {                       // lapis-lazuli : fond bleu nuageux, veines de calcite, paillettes de pyrite
    c = uPC1 * (0.4 + 0.7 * n);
    float w = abs(gzN(q * 4.4 + 4.0) - 0.5);
    c = mix(c, uPC3, smoothstep(0.03, 0.0, w) * 0.6);
    c = mix(c, uPC2, smoothstep(0.84, 0.92, gzN(q * 30.0)) * (0.4 + n));
  } else if (t < 2.5) {                // turquoise : fond crayeux, réseau de matrice brune
    c = mix(uPC1, uPC3, smoothstep(0.35, 0.8, gzF(q * 5.0)) * 0.6);
    float w = abs(gzN(q * 6.0 + 9.0) - 0.5);
    c = mix(c, uPC2, smoothstep(0.045, 0.0, w) * 0.9 * smoothstep(0.35, 0.6, n));
  } else if (t < 3.5) {                // jade : nuages doux
    c = mix(uPC3, uPC2, smoothstep(0.25, 0.8, gzF(q * 3.0))); c = mix(c, uPC1, 0.5); c *= 0.9 + 0.2 * gzN(q * 14.0);
  } else if (t < 4.5) {                // malachite : bandes concentriques déformées
    float d = length(q * vec3(1.0, 1.25, 1.0) + 0.55 * gzW(q, 1.7));
    float b = 0.5 + 0.5 * sin(d * 26.0 + gzF(q * 4.0) * 5.0);
    c = mix(uPC2, uPC1, smoothstep(0.2, 0.8, b)); c = mix(c, uPC3, smoothstep(0.88, 1.0, b) * 0.35);
  } else if (t < 5.5) {                // œil de tigre : bandes brun sombre / ambre / or, fibres soyeuses, zones olive-noir
    float band, fib; gemTiger(q, band, fib);
    c = mix(uPC2, uPC1, smoothstep(0.15, 0.7, band));
    c = mix(c, uPC3, smoothstep(0.6, 1.0, band) * (0.25 + 0.5 * fib));
    c = mix(c, vec3(0.05, 0.045, 0.02), smoothstep(0.62, 0.8, gzF(q * 1.1 + 9.0)) * 0.7);
    c *= 0.78 + 0.4 * fib;
  } else if (t < 6.5) {                // cornaline : calcédoine nuageuse
    c = mix(uPC3, uPC2, smoothstep(0.25, 0.85, gzF(q * 2.6))); c = mix(c, uPC1, 0.35);
  } else if (t < 7.5) {                // charoïte : tourbillons soyeux
    float sw = sin((q.x + 0.9 * gzF(q * 2.2)) * 11.0 + gzN(q * 5.0) * 4.0);
    c = mix(uPC3, uPC1, smoothstep(-0.7, 0.4, sw)); c = mix(c, uPC2, smoothstep(0.55, 1.0, sw) * 0.8);
  } else if (t < 8.5) {                // sugilite : marbrures
    c = mix(uPC3, uPC1, smoothstep(0.2, 0.7, gzF(q * 3.4))); c = mix(c, uPC2, smoothstep(0.6, 0.9, gzF(q * 6.0 + 3.0)) * 0.6);
  } else if (t < 9.5) {                // rhodochrosite : chair rose-corail, nuages profonds et voiles laiteux étirés, petites inclusions claires
    float cl = gzF(q * 2.0 + gzW(q, 1.3) * 1.4);
    float vl = gzF(vec3(q.x * 1.1, q.y * 4.2, q.z * 1.1) + gzW(q, 2.0) * 1.2 + 3.0);
    c = mix(uPC3, uPC1, smoothstep(0.28, 0.62, cl));
    c = mix(c, uPC2, smoothstep(0.42, 0.75, vl) * 0.95);
    c = mix(c, vec3(1.0, 0.88, 0.9), smoothstep(0.87, 0.93, gzN(q * 24.0)) * 0.3);
  } else if (t < 10.5) {               // opale noble : fond sombre (les feux sont dans gemPatGlow)
    c = uPC1 * (0.7 + 0.6 * n);
  } else if (t < 11.5) {               // labradorite : gris sombre moiré (les éclairs sont dans gemPatGlow)
    c = uPC1 * (0.55 + 0.9 * gzF(q * 3.0)); c = mix(c, vec3(0.03), smoothstep(0.7, 0.9, gzN(q * 9.0)) * 0.5);
  } else {                             // pierre de lune : laiteuse
    c = mix(uPC1, vec3(0.9), 0.15 * n) * (0.9 + 0.2 * gzN(q * 6.0));
  }
  return c;
}

// Reflets qui dépendent de l'angle de vue : feux de l'opale, éclairs de la labradorite, lueur de la pierre de lune, chatoyance de l'œil de tigre.
vec3 gemPatGlow(vec3 n) {
  vec3 q = (vGemPos - uGemCenter) / uGemBase;
  float ndv = clamp(dot(n, normalize(vViewPosition)), 0.0, 1.0), t = uGemPat;
  vec3 g = vec3(0.0);
  if (t > 9.5 && t < 10.5) {
    float pm = smoothstep(0.5, 0.7, gzF(q * 2.6));
    float h = fract(gzF(q * 3.0) * 1.2 + ndv * 1.1);
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    g = rgb * pm * (0.12 + 0.28 * ndv);
  } else if (t > 10.5 && t < 11.5) {
    float pm = smoothstep(0.38, 0.58, gzF(q * 2.4 + 3.0));
    float flash = pow(max(0.0, sin(ndv * 6.0 + gzF(q * 2.0) * 8.0)), 3.0);
    g = mix(uPC2, uPC3, smoothstep(0.35, 0.7, gzN(q * 3.0))) * flash * pm * 0.9;
  } else if (t > 11.5) {
    g = uPC2 * pow(1.0 - ndv, 2.0) * 0.5 * (0.6 + 0.4 * gzN(q * 3.0));
  } else if (t > 4.5 && t < 5.5) {
    // chatoyance : ligne lumineuse perpendiculaire aux fibres, là où la surface leur est tangente ; elle glisse quand on tourne la pierre
    float band, fib; gemTiger(q, band, fib);
    vec3 fV = normalize((viewMatrix * vec4(vGemM * TIG_F, 0.0)).xyz);
    float dn = dot(n, fV);
    float line = exp(-dn * dn / 0.03);
    g = uPC3 * line * (0.25 + 0.75 * band) * (0.35 + 0.65 * fib) * 1.7;
  } else if (t > 0.5 && t < 1.5) {
    g = uPC2 * smoothstep(0.82, 0.9, gzN(q * 22.0)) * 0.25;   // éclats de pyrite
  }
  return g;
}

vec3 gemEnv(vec3 dirObj) {
  vec3 w = normalize(vGemM * dirObj);
  return textureCubeUV(envMap, envMapRotation * w, 0.02).rgb * envMapIntensity;
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
      t += (D - R) / max(0.25, dot(q / R, r));
    }
    t = max(t, 0.0);
    vec3 q = p + r * t; vec3 hd = q / max(length(q), 1e-5);
    vec3 n = textureCube(uGemCube, hd).xyz;
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

vec3 gemRadiance() {
  vec3 nObj = normalize(cross(dFdx(vGemPos), dFdy(vGemPos)));
  if (dot(nObj, vGemPos - uGemCenter) < 0.0) nObj = -nObj;
  vec3 sg = uGemSigma;
  if (uGemMix > 1.5) sg = mix(uGemSigma, uGemSigma2, smoothstep(-0.15, 0.15, dot((vGemPos - uGemCenter) / uGemBase, normalize(vec3(0.62, 0.31, 0.72))))); // ametrine : deux moitiés
  else if (uGemMix > 0.5) sg = mix(uGemSigma, uGemSigma2, uGemWarm); // alexandrite : la lumière change la couleur
  vec3 c;
  if (uGemDisp > 1e-4) {
    float h = 0.5 * uGemDisp;
    c = vec3(gemTrace(nObj, uGemIor - h, sg).r, gemTrace(nObj, uGemIor, sg).g, gemTrace(nObj, uGemIor + h, sg).b);
  } else c = gemTrace(nObj, uGemIor, sg);
  return c * uGemGain;
}
`;

/** Met à jour les uniformes d'une pierre à partir des paramètres résolus (resolveGem). */
export function updateGemUniforms(material, g) {
  const U = material.userData.gemU; if (!U) return;
  U.uGemOn.value = g.opaque ? 0 : 1;
  U.uGemIor.value = Math.min(2.6, g.ior ?? 1.76);
  U.uGemDisp.value = (g.dispersion ?? 0) * 0.11 * 1.5; // 0,4 → Δn ≈ 0,066 (diamant réel 0,044, légèrement amplifié pour le « feu »)
  const att = new THREE.Color(g.att ?? '#ffffff');
  const d = Math.max(1e-3, g.attDist ?? 1e3);
  const s = (c) => -Math.log(Math.max(0.002, Math.min(1, c))) / d;
  U.uGemSigma.value.set(s(att.r), s(att.g), s(att.b));
  U.uGemGain.value = g.sparkle ? 1.5 : 1.35;
  U.uGemZone.value = g.sparkle ? 0 : 0.3; // pierres de couleur : zonation / inclusions discrètes
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
