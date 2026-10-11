// Essayage de la bague sur la main : caméra + MediaPipe + three.js dans la page (aucun WebXR requis → iOS OK).
import * as THREE from 'three';
import { t } from '../ui/i18n.js';
import { prefs } from '../state/store.js';
import { startCamera, stopCamera, CameraError } from './camera.js';
import { HandTracker } from './handTracker.js';
import { OneEuroVec } from './oneEuro.js';
import { computeRingPose, focalPx, occluderRadius, FINGERS } from './pose.js';
import { applyTryOnLOD } from './lod.js';
import { withoutHighlight, shareOrDownload } from '../export/exporters.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class TryOn {
  constructor(app, host, { toast = () => {}, onState = () => {} } = {}) {
    this.app = app;
    this.viewer = app.viewer;
    this.host = host; // élément .viewport
    this.toast = toast;
    this.onState = onState;
    this.active = false;
    this.tracker = null;
    this.facing = prefs.get('tryon.facing', 'environment');
    this.finger = prefs.get('tryon.finger', 'ring');
    this.fov = prefs.get('tryon.fov', 66);       // champ de vision sur le grand côté (calibration)
    this.userScale = prefs.get('tryon.scale', 1); // correction de taille ±15 %
    this.flip = false;
    this.filters = { pos: new OneEuroVec(3, 1.2, 0.02, 1), axis: new OneEuroVec(3, 1.5, 0.02, 1), top: new OneEuroVec(3, 1.5, 0.02, 1) };
    this.lastSeen = 0;
    this.inferMs = [];
    this.skip = 1;
  }

  // ---------- Interface ----------
  _buildIntro() {
    const card = h('div', 'tryon-intro');
    card.innerHTML = `
      <h2>${t('tryonTitle')}</h2>
      <p>${t('tryonIntro')}</p>
      <p class="muted">${t('tryonPrivacy')}</p>
      <div class="row"><button class="btn primary big" data-a="start">${t('tryonStart')}</button><button class="btn" data-a="close">${t('cancel')}</button></div>
      <p class="err" hidden></p>`;
    return card;
  }

  _buildHud() {
    const hud = h('div', 'tryon-hud');
    hud.innerHTML = `
      <div class="chip tryon-status" data-r="status">${t('tryonLooking')}</div>
      <div class="tryon-top">
        <button class="icon-btn" data-a="switch" aria-label="${t('tryonSwitch')}" title="${t('tryonSwitch')}">⟲</button>
        <button class="icon-btn" data-a="close" aria-label="${t('tryonClose')}" title="${t('tryonClose')}">✕</button>
      </div>
      <div class="tryon-side">
        <label class="vslider"><span>${t('tryonSizeShort')}</span><div class="vtrack"><input type="range" min="85" max="115" value="${Math.round(this.userScale * 100)}" data-r="scale" aria-label="${t('tryonSize')}" title="${t('tryonSize')}"></div></label>
        <label class="vslider"><span>${t('tryonFovShort')}</span><div class="vtrack"><input type="range" min="50" max="90" value="${this.fov}" data-r="fov" aria-label="${t('tryonFov')}" title="${t('tryonFov')}"></div></label>
      </div>
      <div class="tryon-bottom">
        <div class="tryon-row">
          <select data-r="finger" aria-label="${t('tryonFinger')}">
            <option value="ring">${t('ring')}</option><option value="middle">${t('middle')}</option>
            <option value="index">${t('index')}</option><option value="pinky">${t('pinky')}</option>
          </select>
          <button class="shutter" data-a="shot" aria-label="${t('tryonShot')}"></button>
          <button class="btn small" data-a="flip">${t('tryonFlip')}</button>
        </div>
        <p class="muted tiny">${t('tryonNote')}</p>
      </div>`;
    hud.querySelector('[data-r=finger]').value = this.finger;
    return hud;
  }

  async open() {
    if (this.active) return;
    this.active = true;
    this.viewer.setPaused(true);
    this.host.classList.add('tryon-on');
    this.stage = h('div', 'tryon-stage');
    this.video = h('video', 'tryon-video');
    this.video.setAttribute('playsinline', ''); this.video.muted = true; this.video.autoplay = true;
    this.stage.append(this.video);
    this.host.append(this.stage);
    this.intro = this._buildIntro();
    this.host.append(this.intro);
    this.intro.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'start') this._start();
      if (a === 'close') this.close();
    });
    this.onState(true);
  }

  async _start() {
    const err = this.intro.querySelector('.err');
    err.hidden = true;
    const btn = this.intro.querySelector('[data-a=start]');
    btn.disabled = true; btn.textContent = t('loading');
    try {
      // Le tracker se charge en parallèle de la permission caméra.
      this.tracker ||= new HandTracker();
      const trackerReady = this.tracker.landmarker ? Promise.resolve() : this.tracker.init('GPU');
      const info = await startCamera(this.video, this.facing);
      await trackerReady;
      this.camInfo = info;
      this.intro.remove();
      await this._enter();
    } catch (e) {
      btn.disabled = false; btn.textContent = t('tryonStart');
      err.hidden = false;
      err.textContent = e instanceof CameraError ? (e.code === 'denied' ? t('tryonDenied') : t('tryonNoCam')) : `${t('errorGeneric')} (${e.message})`;
    }
  }

  async _enter() {
    const app = this.app, v = this.viewer;
    // Scène d'essayage : caméra à l'origine, bague en mètres.
    this.scene = new THREE.Scene();
    this.scene.environment = v.envTexture;
    // Même HDRI que la vue 3D, incliné : la bague est vue de dessus par la caméra, ses facettes reflètent donc l'horizon
    // derrière l'utilisateur ; on remonte le ciel lumineux vers cet horizon et on renforce l'intensité pour retrouver l'éclat de la présentation.
    this.scene.environmentRotation.copy(v.scene.environmentRotation);
    this.scene.environmentRotation.x = -0.85;
    this.scene.environmentIntensity = 1.9;
    // L'image caméra est le fond de la scène 3D : les pierres (transmission) réfractent ainsi le vrai décor.
    this.videoTex = new THREE.VideoTexture(this.video);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.videoTex;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5);
    this.anchor = new THREE.Group();
    this.ringRoot = v.root;
    this.savedExposure = v.renderer.toneMappingExposure;
    this.ringRoot.scale.setScalar(0.001);
    this.anchor.add(this.ringRoot);
    const r = occluderRadius(app.model.meta.innerDiameter);
    const occ = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 32, 1, true), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.geometry.rotateX(Math.PI / 2);
    occ.scale.set(1, 0.92, 1);
    occ.renderOrder = -1;
    this.occluder = occ;
    this.anchor.add(occ);
    this.anchor.visible = false;
    this.scene.add(this.anchor);

    // LOD allégé (une seule fois par session d'essayage)
    try {
      this.lod = await applyTryOnLOD(app.pieces, 0.5);
    } catch { this.lod = null; }
    app.viewer.root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

    this.hud = this._buildHud();
    this.host.append(this.hud);
    this.statusEl = this.hud.querySelector('[data-r=status]');
    this.hud.addEventListener('click', (e) => this._onHud(e));
    this.hud.addEventListener('input', (e) => this._onInput(e));
    this._applyVideoSize();
    v.attachTo(this.stage);
    this._onResize = () => this._applyVideoSize();
    window.addEventListener('resize', this._onResize);
    this._resizeCb = () => this._applyCameraAspect();
    v.onResize.push(this._resizeCb);
    this._applyCameraAspect();
    this.lastT = -1;
    this._raf = requestAnimationFrame((t0) => this._loop(t0));
    this._lumaTimer = setInterval(() => this._estimateLight(), 500);
    this._lumaCanvas = document.createElement('canvas'); this._lumaCanvas.width = this._lumaCanvas.height = 16;
  }

  /** Stage = rectangle de même rapport que la vidéo, contenu dans le viewport (pas de recadrage « cover »). */
  _applyVideoSize() {
    if (!this.video?.videoWidth) return;
    const W = this.video.videoWidth, H = this.video.videoHeight;
    const cw = this.host.clientWidth, ch = this.host.clientHeight;
    const k = Math.min(cw / W, ch / H);
    this.stage.style.width = `${Math.floor(W * k)}px`;
    this.stage.style.height = `${Math.floor(H * k)}px`;
    this.stage.classList.toggle('mirror', this.camInfo?.facing === 'user');
    this.vw = W; this.vh = H;
  }

  _applyCameraAspect() {
    if (!this.vw) return;
    const f = focalPx(this.vw, this.vh, this.fov);
    this.camera.fov = (2 * Math.atan(this.vh / 2 / f) * 180) / Math.PI;
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
    this.viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPerf ? 1.5 : 2));
  }

  _onHud(e) {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') this.close();
    else if (a === 'flip') { this.flip = !this.flip; }
    else if (a === 'shot') this.capture();
    else if (a === 'switch') this._switchCamera();
  }

  _onInput(e) {
    const r = e.target.dataset.r;
    if (r === 'finger') { this.finger = e.target.value; prefs.set('tryon.finger', this.finger); this._resetFilters(); }
    if (r === 'scale') { this.userScale = e.target.value / 100; prefs.set('tryon.scale', this.userScale); }
    if (r === 'fov') { this.fov = +e.target.value; prefs.set('tryon.fov', this.fov); this._applyCameraAspect(); }
  }

  _resetFilters() { Object.values(this.filters).forEach((f) => f.reset()); }

  async _switchCamera() {
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    prefs.set('tryon.facing', this.facing);
    try { this.camInfo = await startCamera(this.video, this.facing); this.camInfo.facing = this.facing; this._applyVideoSize(); this._applyCameraAspect(); this._resetFilters(); }
    catch { this.toast(t('tryonNoCam')); }
  }

  _estimateLight() {
    if (!this.video || this.video.readyState < 2) return;
    const c = this._lumaCanvas.getContext('2d', { willReadFrequently: true });
    c.drawImage(this.video, 0, 0, 16, 16);
    const d = c.getImageData(0, 0, 16, 16).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const L = s / (256 * 255);
    this.viewer.renderer.toneMappingExposure = Math.min(1.3, Math.max(0.95, 0.7 + L * 0.9));
  }

  // ---------- Boucle ----------
  _loop(now) {
    if (!this.active) return;
    this._raf = requestAnimationFrame((n) => this._loop(n));
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastT) {
      this.lastT = v.currentTime;
      this._frame = (this._frame || 0) + 1;
      if (this._frame % this.skip === 0) this._detect(now);
    }
    // bague perdue depuis > 0,6 s → masquée
    if (this.anchor.visible && now - this.lastSeen > 600) { this.anchor.visible = false; this._setStatus(false); }
    this.viewer.renderer.render(this.scene, this.camera);
  }

  _detect(now) {
    let res;
    const t0 = performance.now();
    try { res = this.tracker.detect(this.video, t0); }
    catch { this._gpuFailed(); return; }
    this._trackPerf(performance.now() - t0);
    if (!res) return;
    const pose = computeRingPose({ lm: res.lm, wl: res.wl, label: res.label, width: this.vw, height: this.vh, fovLongDeg: this.fov, finger: this.finger, flip: this.flip });
    if (!pose) return;
    this.lastDetect = { lm: res.lm, wl: res.wl, label: res.label, score: res.score, pose };
    const ts = now / 1000;
    const p = this.filters.pos.filter(pose.position.toArray(), ts);
    const a = new THREE.Vector3(...this.filters.axis.filter(pose.axis.toArray(), ts)).normalize();
    const tp = new THREE.Vector3(...this.filters.top.filter(pose.top.toArray(), ts));
    tp.addScaledVector(a, -tp.dot(a)).normalize();
    const x = new THREE.Vector3().crossVectors(tp, a).normalize();
    this.anchor.position.fromArray(p);
    this.anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, tp, a));
    this.anchor.scale.setScalar(this.userScale);
    this.anchor.visible = true;
    this.lastSeen = now;
    this._setStatus(true);
  }

  _setStatus(found) {
    if (this._found === found) return;
    this._found = found;
    this.statusEl.textContent = found ? t('tryonFound') : t('tryonLooking');
    this.statusEl.classList.toggle('ok', found);
  }

  _trackPerf(ms) {
    this.inferMs.push(ms);
    if (this.inferMs.length < 30) return;
    const avg = this.inferMs.reduce((s, x) => s + x, 0) / this.inferMs.length;
    this.inferMs = [];
    if (avg > 45 && this.skip === 1) { this.skip = 2; this.lowPerf = true; this._applyCameraAspect(); this.toast(t('tryonLowPerf')); }
  }

  async _gpuFailed() {
    if (this._recovering || this.tracker.delegate === 'CPU') return;
    this._recovering = true;
    try { await this.tracker.fallbackToCPU(); } catch { this.toast(t('errorGeneric')); }
    this._recovering = false;
  }

  /** Photo : image caméra + rendu 3D composés, partagée via la feuille de partage iOS ou téléchargée. */
  async capture() {
    const r = this.viewer.renderer;
    await withoutHighlight(this.app, async () => {
      r.render(this.scene, this.camera);
      const gl = r.domElement;
      const out = document.createElement('canvas');
      out.width = gl.width; out.height = gl.height;
      const ctx = out.getContext('2d');
      const mirror = this.stage.classList.contains('mirror');
      if (mirror) { ctx.translate(out.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(gl, 0, 0); // le fond de la scène contient déjà l'image caméra
      const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92));
      const how = await shareOrDownload(blob, 'essayage-bague.jpg', t('app'));
      if (how !== 'cancelled') this.toast(t('photoSaved'));
    });
  }

  close() {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this._raf);
    clearInterval(this._lumaTimer);
    window.removeEventListener('resize', this._onResize);
    stopCamera(this.video);
    this.tracker?.close(); this.tracker = null;
    if (this.ringRoot) {
      this.anchor?.remove(this.ringRoot);
      this.ringRoot.scale.setScalar(1);
      this.ringRoot.position.set(0, 0, 0); this.ringRoot.quaternion.identity();
      this.viewer.scene.add(this.ringRoot);
      this.ringRoot.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
    }
    this.lod?.restore();
    this.videoTex?.dispose(); this.scene && (this.scene.background = null);
    this.occluder?.geometry.dispose();
    const i = this.viewer.onResize.indexOf(this._resizeCb); if (i >= 0) this.viewer.onResize.splice(i, 1);
    this.viewer.renderer.toneMappingExposure = this.savedExposure ?? 1;
    this.viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.viewer.maxPixelRatio));
    this.viewer.attachTo(this.host.querySelector('.viewer-mount'));
    this.stage?.remove(); this.hud?.remove(); this.intro?.remove();
    this.host.classList.remove('tryon-on');
    this.viewer.setPaused(false);
    this.onState(false);
  }
}

export { FINGERS };
