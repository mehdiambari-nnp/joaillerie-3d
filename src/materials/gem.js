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
    uGemBase: { value: data.radius }, // trajet minimal : la lumière traverse déjà ~ un rayon avant la 1re facette de sortie
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
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `if (uGemOn > 0.5) totalDiffuse = gemRadiance();
         vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;`);
  };
  material.customProgramCacheKey = () => 'gemrt1';
  return U;
}

const GEM_GLSL = /* glsl */`
uniform float uGemOn; uniform samplerCube uGemCube; uniform vec3 uGemCenter; uniform vec3 uGemSigma;
uniform float uGemIor; uniform float uGemDisp; uniform float uGemScale; uniform float uGemGain; uniform float uGemBase;
varying vec3 vGemPos; varying vec3 vGemCam; varying mat3 vGemM;

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
  vec3 acc = vec3(0.0); float weight = 1.0; float path = uGemBase;
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
    path += t;
    vec3 nin = -n;
    float cosi = clamp(dot(r, n), 0.0, 1.0);
    vec3 rr = refract(r, nin, ior);
    float Fr = (dot(rr, rr) < 1e-4) ? 1.0 : F0 + (1.0 - F0) * pow(1.0 - cosi, 5.0);
    if (Fr < 1.0) acc += weight * (1.0 - Fr) * gemEnv(rr) * exp(-sigma * path * uGemScale);
    weight *= Fr;
    r = reflect(r, nin); p = q;
    if (weight < 0.015) break;
  }
  acc += weight * gemEnv(r) * exp(-sigma * path * uGemScale) * 0.5; // reliquat
  return acc;
}

vec3 gemRadiance() {
  vec3 nObj = normalize(cross(dFdx(vGemPos), dFdy(vGemPos)));
  if (dot(nObj, vGemPos - uGemCenter) < 0.0) nObj = -nObj;
  vec3 c;
  if (uGemDisp > 1e-4) {
    float h = 0.5 * uGemDisp;
    c = vec3(gemTrace(nObj, uGemIor - h, uGemSigma).r, gemTrace(nObj, uGemIor, uGemSigma).g, gemTrace(nObj, uGemIor + h, uGemSigma).b);
  } else c = gemTrace(nObj, uGemIor, uGemSigma);
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
}

export function disposeGemData(data) { data?.rt?.dispose(); }
