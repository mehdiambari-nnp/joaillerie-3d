// Pipeline d'image « qualité » de la visionneuse.
//  1. La scène (sans son fond) est rendue dans un tampon HDR à alpha (anti-crénelage matériel pendant le mouvement).
//  2. À l'arrêt, des images à décalage sous-pixel (suite de Halton) sont CUMULÉES : c'est du suréchantillonnage temporel.
//     Il lisse les arêtes fines (griffes) et stabilise la scintillation des pierres, dont le shader est très haute fréquence.
//     Chaque image est TONE-MAPPÉE AVANT le cumul (comme le rendu direct) : cumuler en HDR étalerait un éclat de pierre (plusieurs
//     centaines) sur les pixels voisins et gonflerait la luminosité de toute la bague.
//  3. Profondeur de champ en gros plan (ordinateur), mise au point progressive.
//  4. Sortie : le fond est dessiné tel quel (sans tone mapping, comme avant), puis l'image est encodée et posée dessus.
// Le tampon est prémultiplié (alpha = couverture de la scène) : la bague se détache toujours proprement du fond.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { QUALITY } from './quality.js';
import { gemFrame } from '../materials/gem.js';

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const COPY_FRAG = 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }';
// Copie (les valeurs sont déjà tone-mappées : 0..1).
const CLAMP_FRAG = 'uniform sampler2D t; varying vec2 vUv; void main(){ vec4 c = texture2D(t, vUv); gl_FragColor = vec4(min(c.rgb, vec3(10.0)), c.a); }';

// Cumul : tone mapping (Neutral, comme le renderer) de chaque image AVANT la moyenne. Rendu dans un tampon : three n'y injecte pas
// les fonctions de tone mapping, on les inclut donc ici (ce matériau ne sert jamais à l'écran).
const ACCUM_FRAG = /* glsl */`
uniform sampler2D t; varying vec2 vUv;
#include <tonemapping_pars_fragment>
void main(){
  vec4 c = texture2D(t, vUv);
  float a = max(c.a, 1e-4);
  gl_FragColor = vec4(NeutralToneMapping(c.rgb / a) * c.a, c.a);   // déprémultiplie → tone mapping → reprémultiplie
}`;

const BLIT_FRAG = /* glsl */`
uniform sampler2D tScene; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tScene, vUv);
  float a = max(c.a, 1e-4);
  gl_FragColor = vec4(c.rgb / a, 1.0);          // déprémultiplie : l'encodage sRGB porte sur la couleur réelle
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * c.a, c.a); // reprémultiplie pour se poser sur le fond
}`;

// Profondeur de champ : flou en disque dont le rayon dépend de l'écart à la mise au point. Un échantillon net ne « bave » jamais
// sur un pixel plus flou que lui (collecte pondérée par le rayon de confusion de l'échantillon) → pas de halo autour de la bague.
const DOF_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uTexel;
uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uRange; uniform float uMaxBlur;
varying vec2 vUv;
float distAt(vec2 uv){ float d = texture2D(tDepth, uv).x; return 2.0 * uNear * uFar / (uFar + uNear - (2.0 * d - 1.0) * (uFar - uNear)); }
float cocOf(float z){ return uMaxBlur * smoothstep(0.0, 1.0, (abs(z - uFocus) - uRange * 0.4) / (uRange * 1.3)); }
void main(){
  vec4 c0 = texture2D(tColor, vUv);
  float coc0 = cocOf(distAt(vUv));
  if (coc0 < 0.35) { gl_FragColor = c0; return; }
  vec4 acc = c0; float ws = 1.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i); float ang = fi * 2.39996323; float r = sqrt((fi + 0.5) / 24.0) * coc0;
    vec2 uv = vUv + vec2(cos(ang), sin(ang)) * r * uTexel;
    float w = clamp(cocOf(distAt(uv)) - r + 1.0, 0.0, 1.0);
    acc += texture2D(tColor, uv) * w; ws += w;
  }
  gl_FragColor = acc / ws;
}`;

export class Fx {
  constructor(viewer) {
    this.v = viewer;
    this.q = QUALITY;
    this.n = 0;                 // nombre d'images cumulées dans rtAccum
    this.dof = 0;               // intensité courante de la profondeur de champ (0..1), animée
    this.dofTarget = 0;
    this.w = 0; this.h = 0; this.scale = 1;
    this.rtScene = this.rtAccum = this.rtA = this.rtB = null;
    this.bgScene = new THREE.Scene();
    this.bgCam = new THREE.PerspectiveCamera();
    this.quad = new FullScreenQuad(null);
    const mk = (frag, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, ...extra });
    this.copyMat = mk(CLAMP_FRAG, { uniforms: { t: { value: null } }, blending: THREE.NoBlending });
    this.accumMat = mk(ACCUM_FRAG, {
      uniforms: { t: { value: null } }, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ConstantAlphaFactor, blendDst: THREE.OneMinusConstantAlphaFactor,
      blendSrcAlpha: THREE.ConstantAlphaFactor, blendDstAlpha: THREE.OneMinusConstantAlphaFactor,
    });
    this.blitMat = mk(BLIT_FRAG, {
      toneMapped: false, uniforms: { tScene: { value: null } }, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.dofMat = mk(DOF_FRAG, {
      blending: THREE.NoBlending,
      uniforms: { tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 100 }, uFocus: { value: 10 }, uRange: { value: 5 }, uMaxBlur: { value: 0 } },
    });
    this.dofOk = this.q.dof;
    this.msaa = viewer.renderer.extensions.has('EXT_color_buffer_float') ? this.q.msaa : 0; // l'anticrénelage matériel d'un tampon flottant exige cette extension
  }

  /** Le pipeline exige des tampons à virgule flottante (demi-précision au minimum) ; sinon on garde le rendu direct. */
  static supported(renderer) {
    const e = renderer.extensions;
    return e.has('EXT_color_buffer_float') || e.has('EXT_color_buffer_half_float');
  }

  get max() { return this.q.accumFrames; }
  /** Vrai tant qu'il reste des images à cumuler (la boucle continue de rendre à l'arrêt). */
  get pending() { return this.n < this.max || Math.abs(this.dof - this.dofTarget) > 0.01; }
  reset() { this.n = 0; }

  _ensure() {
    const r = this.v.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    const s = Math.min(1, Math.sqrt(this.q.maxRtPixels / Math.max(1, size.x * size.y)));
    const w = Math.max(2, Math.round(size.x * s)), h = Math.max(2, Math.round(size.y * s));
    if (w === this.w && h === this.h && this.rtScene) return;
    this.w = w; this.h = h; this.scale = s; this.n = 0;
    this._disposeTargets();
    const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true, stencilBuffer: true, samples: this.msaa });
    if (this.dofOk) {
      const dt = new THREE.DepthTexture(w, h);
      dt.format = THREE.DepthStencilFormat; dt.type = THREE.UnsignedInt248Type;
      this.rtScene.depthTexture = dt;
    }
    this.rtAccum = new THREE.WebGLRenderTarget(w, h, opt);
    this.rtA = this.dofOk ? new THREE.WebGLRenderTarget(w, h, opt) : null;
    this.rtB = this.dofOk ? new THREE.WebGLRenderTarget(w, h, opt) : null;
  }

  _disposeTargets() { for (const k of ['rtScene', 'rtAccum', 'rtA', 'rtB']) { this[k]?.dispose(); this[k] = null; } }

  _blit(mat, target) { this.quad.material = mat; const r = this.v.renderer; r.setRenderTarget(target); this.quad.render(r); }

  /**
   * Rend une image. `still` : image d'accumulation (décalage sous-pixel) ; sinon image de mouvement (remplace le cumul).
   * Le fond de scène est dessiné à part, sans tone mapping, puis l'image tone-mappée est posée dessus.
   */
  render(scene, camera, { still = false, effects = true } = {}) {
    const r = this.v.renderer;
    this._ensure();
    const first = this.n === 0 || !still;
    gemFrame.value = still ? this.n + 1 : 0; // dispersion des pierres tirée au hasard à chaque image cumulée
    const jitter = still && this.n > 0;
    if (jitter) camera.setViewOffset(this.w, this.h, halton(this.n + 1, 2) - 0.5, halton(this.n + 1, 3) - 0.5, this.w, this.h);

    const bg = scene.background;
    scene.background = null;
    const prev = { target: r.getRenderTarget(), auto: r.autoClear };
    try {
      r.setRenderTarget(this.rtScene);
      r.setClearColor(0x000000, 0); r.clear(true, true, true);
      r.autoClear = false;
      r.render(scene, camera);
    } catch (e) { // une erreur de rendu ne doit laisser ni tampon actif ni effacement automatique coupé
      r.autoClear = prev.auto; r.setRenderTarget(prev.target);
      throw e;
    } finally { // ... ni fond supprimé ni décalage de caméra (autoClear reste coupé pour les passes de cumul suivantes)
      scene.background = bg;
      if (jitter) camera.clearViewOffset();
    }

    // cumul : première image = remplacement ; ensuite moyenne glissante exacte (poids 1/(n+1))
    this.accumMat.blending = first ? THREE.NoBlending : THREE.CustomBlending;
    this.accumMat.blendAlpha = 1 / (this.n + 1);
    this.accumMat.uniforms.t.value = this.rtScene.texture;
    this._blit(this.accumMat, this.rtAccum);
    this.n = first ? 1 : this.n + 1;

    // effets sur une copie (le cumul reste intact)
    let out = this.rtAccum;
    if (effects && this.rtA && this.dofOk && this.dof > 0.01) {
      this.copyMat.uniforms.t.value = this.rtAccum.texture;
      this._blit(this.copyMat, this.rtA);
      out = this.rtA;
      if (this.rtScene.depthTexture) {
        const u = this.dofMat.uniforms, v = this.v;
        u.tColor.value = this.rtA.texture; u.tDepth.value = this.rtScene.depthTexture;
        u.uTexel.value.set(1 / this.w, 1 / this.h);
        u.uNear.value = camera.near; u.uFar.value = camera.far;
        u.uFocus.value = camera.position.distanceTo(v.controls.target); u.uRange.value = v.radius;
        u.uMaxBlur.value = 4.2 * this.dof * (this.h / 900);
        this._blit(this.dofMat, this.rtB);
        out = this.rtB;
      }
    }

    // sortie à l'écran : fond d'abord (comme le rendu direct), puis la scène tone-mappée par-dessus
    r.setRenderTarget(null);
    const bs = this.bgScene;
    bs.background = bg; bs.backgroundBlurriness = scene.backgroundBlurriness; bs.backgroundIntensity = scene.backgroundIntensity;
    bs.backgroundRotation.copy(scene.backgroundRotation);
    r.setClearColor(0x000000, 0); r.clear(true, true, true);
    if (bg) r.render(bs, this.bgCam);
    this.blitMat.uniforms.tScene.value = out.texture;
    this._blit(this.blitMat, null);
    r.autoClear = prev.auto;
    r.setRenderTarget(prev.target);
  }

  /** Cible de la profondeur de champ : gros plan uniquement ; l'intensité rejoint la cible en douceur (mise au point). */
  updateDof(camera, target, radius, still, snap = false) {
    if (!this.dofOk) return;
    const d = camera.position.distanceTo(target) / Math.max(radius, 1e-3);
    this.dofTarget = still ? THREE.MathUtils.smoothstep(3.6 - d, 0, 1.6) : 0; // net au-delà de ~3,6 rayons, plein effet vers ~2
    this.dof = snap || !still ? this.dofTarget : this.dof + (this.dofTarget - this.dof) * 0.18;
    if (Math.abs(this.dof - this.dofTarget) < 0.01) this.dof = this.dofTarget;
  }

  dispose() { this._disposeTargets(); this.quad.dispose(); for (const m of [this.copyMat, this.accumMat, this.blitMat, this.dofMat]) m.dispose(); }
}
