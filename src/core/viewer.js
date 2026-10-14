// Visionneuse 3D « façon Sketchfab » : rendu à la demande, orbite, vues, capture, environnements.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getEnvironment, disposeEnvironments } from './environments.js';
import { Fx } from './fx.js';
import { QUALITY } from './quality.js';
import { ContactShadow } from './contactShadow.js';


export class Viewer {
  constructor(container, { alpha = true } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha, stencil: true, powerPreference: 'high-performance' }) // stencil : contours de sélection;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.maxPixelRatio = 2; // iPhone = 3 : plafonné pour la batterie et la mémoire
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.canvas = this.renderer.domElement;
    this.canvas.style.touchAction = 'none'; // iOS : pas de zoom de page sur pinch
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 4000);
    this.camera.position.set(40, 30, 70);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 0.9;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.invalidate());

    this.envId = null;
    this.envTexture = null;
    this.envBackground = null;
    this._envToken = 0;
    this.bgMode = 'light'; // 'light' | 'dark' | 'transparent' | 'env'
    this.bgBlur = 0.35;
    this._hq = false;
    this._lastRender = 0;
    this.onEnvironment = [];
    this.autoRotateEnabled = false;
    this._autoRotateResume = 0;
    this.needsRender = true;
    this.paused = false;
    this.anim = null;
    this.onFrame = [];
    this.onResize = [];
    this.root = null;
    this.radius = 20;

    this.fx = QUALITY.post ? new Fx(this) : null; // accumulation d'images, profondeur de champ (voir fx.js)
    this._shadow = this._makeShadow();
    this.scene.add(this._shadow);
    this.contact = QUALITY.contactShadow ? new ContactShadow(this, this._shadow) : null; // ombre de contact calculée (voir contactShadow.js)

    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this._autoRotateResume = Infinity; this.anim = null; });
    this.controls.addEventListener('end', () => { this._autoRotateResume = performance.now() + 4000; });

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    // reflets de base : studio immédiat, puis HDRI « ville, plein soleil » dès qu'il est chargé
    this.setEnvironment('studio').then(() => this.setEnvironment('overpass')).catch(() => {});
    matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => this.bgMode === 'light' && this._applyBackground());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _makeShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(0,0,0,0.42)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = -2;
    return m;
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const f of this.onResize) f(w, h);
    this.invalidate();
  }

  /** Déplace le canvas dans un autre conteneur (ex. la scène d'essayage, superposée à la vidéo). */
  attachTo(container) {
    this._ro.disconnect();
    this.container = container;
    container.appendChild(this.canvas);
    this._ro.observe(container);
    this.resize();
  }

  invalidate() { this.needsRender = true; }

  /** Recalcule les éléments « cuits » (ombre de contact, sonde de reflets) peu après le dernier changement de la bague. */
  requestBake(delay = 300) {
    clearTimeout(this._bakeT);
    this._bakeT = setTimeout(() => {
      if (!this.root || this.paused) return;
      try { this.contact?.bake(); } catch (e) { console.warn('[fx] ombre de contact', e); }
      this.invalidate();
    }, delay);
  }

  /** Charge (si besoin) et applique un environnement ; renvoie une promesse (HDRI : téléchargement). */
  async setEnvironment(id) {
    if (this.envId === id) return;
    const token = ++this._envToken;
    const env = await getEnvironment(this.renderer, id);
    if (token !== this._envToken) return; // une sélection plus récente a pris le relais
    this.envId = id;
    this.envTexture = env.texture;
    this.envBackground = env.background;
    this.scene.environment = env.texture;
    this._applyBackground();
    for (const f of this.onEnvironment) f(id);
    this.invalidate();
  }

  setEnvironmentRotation(deg) {
    const r = (deg * Math.PI) / 180;
    this.scene.environmentRotation.y = r;
    this.scene.backgroundRotation.y = r;
    this.invalidate();
  }

  /**
   * Fond de la scène. Les pierres transparentes réfractent ce fond : il doit donc exister dans la scène 3D
   * (dégradé du studio, ou scène 360°), sinon les diamants paraissent pâles et grisâtres.
   */
  setBackground(mode, { blur } = {}) {
    this.bgMode = mode;
    if (blur != null) this.bgBlur = blur;
    this._applyBackground();
  }

  _stageTexture(dark) {
    const css = getComputedStyle(document.documentElement);
    const a = css.getPropertyValue('--stage-a').trim() || (dark ? '#2e2b27' : '#e7e4e5');
    const b = css.getPropertyValue('--stage-b').trim() || (dark ? '#0d0c0b' : '#b4b0b5');
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(256, 180, 16, 256, 220, 380);
    grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    // bruit léger : supprime les anneaux de dégradé (banding) après tone mapping
    const img = g.getImageData(0, 0, 512, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 3.2; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _applyBackground() {
    const sc = this.scene;
    if (this._bgTex) { this._bgTex.dispose(); this._bgTex = null; }
    sc.backgroundBlurriness = 0;
    if (this.bgMode === 'env' && this.envBackground) {
      sc.background = this.envBackground;
      sc.backgroundBlurriness = this.bgBlur;
      this._shadow.visible = false;
    } else if (this.bgMode === 'transparent') {
      sc.background = null;
      this._shadow.visible = true;
    } else {
      this._bgTex = this._stageTexture(this.bgMode === 'dark');
      sc.background = this._bgTex;
      this._shadow.visible = true;
    }
    this.invalidate();
  }

  setExposure(v) { this.renderer.toneMappingExposure = v; this.invalidate(); }

  /** Place la bague dans la scène et cadre la caméra. */
  setModel(root, { views } = {}) {
    if (this.root) this.scene.remove(this.root);
    this.root = root;
    this.scene.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    this.box = box;
    this.controls.target.copy(sphere.center);
    this.controls.minDistance = this.radius * 0.6;
    this.controls.maxDistance = this.radius * 9;
    this.camera.near = Math.max(0.1, this.radius * 0.02);
    this.camera.far = this.radius * 60;
    this.camera.updateProjectionMatrix();
    const s = this._shadow;
    s.position.set(sphere.center.x, box.min.y - 0.05, sphere.center.z);
    s.scale.setScalar(this.radius * 3.2);
    this.views = views || [];
    this.setView([0.62, 0.45, 0.64], false);
    this.requestBake();
  }

  /** Oriente la caméra selon une direction (depuis la cible) en gardant la distance de cadrage. */
  setView(dir, animate = true, distance = null) {
    const d = new THREE.Vector3(...dir).normalize();
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = distance ?? (this.radius / Math.sin(Math.min(fov, fov * this.camera.aspect) / 2)) * 1.12;
    const toPos = this.controls.target.clone().add(d.multiplyScalar(dist));
    if (!animate) { this.camera.position.copy(toPos); this.controls.update(); this.invalidate(); return; }
    this.anim = { from: this.camera.position.clone(), to: toPos, start: performance.now(), dur: 550 };
    this.invalidate();
  }

  /** Cadre une boîte (focus double-clic sur une zone). */
  focusOn(box, { minFrac = 0.18, margin = 1.3, lookFrom = null } = {}) {
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, this.radius * minFrac);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (lookFrom) dir.multiplyScalar(0.3).add(lookFrom.clone().normalize()).normalize(); // vue plus frontale sur la sélection
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (Math.max(r / Math.sin(fov / 2), r / Math.sin(Math.min(fov, fov * this.camera.aspect) / 2))) * margin;
    this.anim = { from: this.camera.position.clone(), to: c.clone().add(dir.multiplyScalar(dist)), fromT: this.controls.target.clone(), toT: c, start: performance.now(), dur: 600 };
    this.invalidate();
  }

  /** Revient au cadrage d'ensemble en gardant l'angle de vue courant. */
  frameAll() {
    const c = this.box.getCenter(new THREE.Vector3());
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (this.radius / Math.sin(Math.min(fov, fov * this.camera.aspect) / 2)) * 1.12;
    this.anim = { from: this.camera.position.clone(), to: c.clone().add(dir.multiplyScalar(dist)), fromT: this.controls.target.clone(), toT: c, start: performance.now(), dur: 600 };
    this.invalidate();
  }

  resetView() { this.controls.target.copy(this.box.getCenter(new THREE.Vector3())); this.setView([0.62, 0.45, 0.64]); }

  setAutoRotate(on) {
    this.autoRotateEnabled = on;
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 1.2;
    this._autoRotateResume = on ? performance.now() : Infinity;
    this.invalidate();
  }

  /**
   * Surbrillance d'une pièce par un CONTOUR (coque inversée agrandie le long des normales, d'épaisseur constante à l'écran).
   * On ne touche plus au matériau : la couleur de la pierre ou du métal reste exactement celle qui sera obtenue.
   * kind: 'select' (contour plein) | 'hover' (contour léger).
   */
  setHighlight(pieces, kind, on) {
    for (const p of pieces) {
      if (!p?.mesh) continue;
      const hl = (p._hl ||= {});
      if (!on) { for (const h of Object.values(hl)) h.visible = false; continue; }
      const k = kind === 'select' ? 'select' : 'hover';
      if (!hl[k]) {
        // masque (stencil) de la pièce + contour : le contour se dessine AUTOUR de la silhouette, par-dessus le reste (visible même
        // quand la pierre est sertie), sans jamais recouvrir la pièce elle-même → sa couleur reste intacte
        const mask = new THREE.Mesh(p.mesh.geometry, this._maskMaterial());
        mask.raycast = () => {}; mask.renderOrder = 1; mask.userData.highlight = true; mask.frustumCulled = false;
        const hull = new THREE.Mesh(this._hullGeometry(p), this._hullMaterial(k));
        hull.raycast = () => {}; hull.renderOrder = 2; hull.name = 'hl-' + k; hull.userData.highlight = true; hull.frustumCulled = false;
        const grp = new THREE.Group(); grp.userData.highlight = true; grp.add(mask, hull);
        p.mesh.add(grp); hl[k] = grp; grp.material = hull.material;
      }
      hl[k].material.color.set(this._highlightColor());
      hl[k].visible = true;
    }
    this.invalidate();
  }

  /** Couleur du contour : l'accent du thème (clair sur fond sombre, sombre sur fond clair). */
  _highlightColor() {
    try { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffe2a8'; } catch { return '#ffe2a8'; }
  }

  /** Géométrie de la coque : sommets soudés + normales lissées (les facettes plates des pierres ne se déchirent pas). */
  _hullGeometry(p) {
    if (p._hullGeo) return p._hullGeo;
    let g = p.mesh.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n);
    g.morphAttributes = {};
    g.clearGroups();
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();
    p._hullGeo = g;
    return g;
  }

  _maskMaterial() {
    return new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    });
  }

  _hullMaterial(kind) {
    const m = new THREE.MeshBasicMaterial({
      side: THREE.BackSide, toneMapped: false, fog: false, transparent: kind === 'hover', opacity: kind === 'hover' ? 0.55 : 1,
      depthTest: false, depthWrite: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    });
    const K = kind === 'hover' ? 0.0028 : 0.0055; // épaisseur ≈ fraction de la hauteur de vue (constante à l'écran)
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sc = length(modelViewMatrix[0].xyz);
          transformed += normalize(normal) * (-mv.z) * ${K.toFixed(4)} / max(sc, 1e-6); }`);
    };
    m.customProgramCacheKey = () => 'hull-' + kind;
    return m;
  }

  setPaused(p) { this.paused = p; if (!p) this.invalidate(); }

  _loop(now) {
    requestAnimationFrame(this._loop);
    if (this.paused) return;
    if (this.autoRotateEnabled && !this.controls.autoRotate && now > this._autoRotateResume) this.controls.autoRotate = true;
    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.anim.from, this.anim.to, e);
      if (this.anim.toT) this.controls.target.lerpVectors(this.anim.fromT, this.anim.toT, e);
      if (t >= 1) this.anim = null;
      this.needsRender = true;
    }
    const moved = this.controls.update();
    for (const f of this.onFrame) if (f(now)) this.needsRender = true;
    const fx = this.fx;
    if (this.needsRender || moved || this.controls.autoRotate) {
      this.needsRender = false;
      if (this._hq) this._setHQ(false); // pendant le mouvement : résolution normale (fluidité, batterie)
      this._lastRender = now;
      if (fx && QUALITY.motionPost) { fx.updateDof(this.camera, this.controls.target, this.radius, false); fx.render(this.scene, this.camera, { still: false }); }
      else { fx?.reset(); this.renderer.render(this.scene, this.camera); }
    } else if (fx && !this.anim && fx.pending && now - this._lastRender > 120) {
      // à l'arrêt : cumul d'images (anti-crénelage, pierres stables), mise au point progressive, pleine résolution de l'écran
      if (!this._hq && (window.devicePixelRatio || 1) > this.maxPixelRatio && now - this._lastRender > 400) this._setHQ(true);
      fx.updateDof(this.camera, this.controls.target, this.radius, true);
      fx.render(this.scene, this.camera, { still: true });
    } else if (!fx && !this._hq && !this.anim && now - this._lastRender > 400 && (window.devicePixelRatio || 1) > this.maxPixelRatio) {
      this._setHQ(true); // sans pipeline : une image fixe en pleine résolution de l'écran
      this.renderer.render(this.scene, this.camera);
    }
  }

  _setHQ(on) {
    this._hq = on;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 3 : this.maxPixelRatio));
    this.renderer.setSize(this.container.clientWidth || 1, this.container.clientHeight || 1, false);
  }

  /** Capture PNG (échelle ×k, fond transparent ou rempli). Avec le pipeline : images cumulées + mise au point, comme à l'arrêt. */
  async capture({ scale = 2, background = null } = {}) {
    const prevPR = this.renderer.getPixelRatio();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(scale, 3));
    this.renderer.setSize(w, h, false);
    if (this.fx) {
      this.fx.reset();
      this.fx.updateDof(this.camera, this.controls.target, this.radius, true, true);
      for (let i = 0; i < (QUALITY.mobile ? 6 : 14); i++) this.fx.render(this.scene, this.camera, { still: true });
    } else this.renderer.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = this.canvas.width; out.height = this.canvas.height;
    const ctx = out.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, out.width, out.height); }
    ctx.drawImage(this.canvas, 0, 0);
    this.renderer.setPixelRatio(prevPR);
    this.renderer.setSize(w, h, false);
    this.fx?.reset();
    this.invalidate();
    return new Promise((res) => out.toBlob(res, 'image/png'));
  }

  dispose() {
    this._ro.disconnect();
    this.fx?.dispose();
    this.contact?.dispose();
    disposeEnvironments();
    this.renderer.dispose();
  }
}
