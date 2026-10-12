// Introduction : l'écrin de la marque est fermé au centre de la vue 3D ; au toucher, le couvercle se soulève, la bague
// sort de son écrin, puis la boîte disparaît et le configurateur apparaît.
import * as THREE from 'three';
import { buildBox } from './box.js';
import { t } from '../ui/i18n.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (time, a, b) => clamp01((time - a) / (b - a));

export function shouldPlayIntro(theme, params, dev) {
  if (!theme.intro?.enabled) return false;
  if (params.has('nointro')) return false;
  if (dev && params.get('model') === 'gemv' && !params.has('intro')) return false; // tests E2E / captures
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

/** Joue l'introduction. Résout quand le configurateur est de nouveau libre. */
export async function playIntro(app, ui, theme) {
  const viewer = app.viewer, model = app.model;
  if (!model) return;
  const root = model.root;
  const ringBox = new THREE.Box3().setFromObject(root);
  const ringSize = ringBox.getSize(new THREE.Vector3()), c = ringBox.getCenter(new THREE.Vector3());
  const d = Math.max(ringSize.x, ringSize.y, ringSize.z);
  const S = d * 2.6, L = d * 0.95; // côté de l'écrin ; hauteur dont la bague sort
  const logoKey = theme.intro.logo === 'lockup' ? 'lockup' : 'wordmark';
  const ratio = logoKey === 'lockup' ? 3.1 : 911 / 216;
  const box = await buildBox(S, { logoSvg: theme.logoSvg?.[logoKey], logoRatio: ratio, env: viewer.scene.environment });

  // La bague est posée au fond de l'écrin : on la descend de L ; l'écrin est placé autour d'elle.
  const startY = root.position.y;
  root.position.y = startY - L;
  const ringStartMinY = ringBox.min.y - L;
  box.group.position.set(c.x, ringStartMinY - box.floorY, c.z);
  viewer.scene.add(box.group);
  const key = new THREE.DirectionalLight(0xf6f0ff, 2.6); key.position.set(-1, 1.6, 1.2).multiplyScalar(S).add(c); key.target.position.copy(c); viewer.scene.add(key, key.target); // faces de l'écrin bien distinctes
  if (window.__rc) window.__rc.introBox = box;
  const sh = viewer._shadow, shSave = sh ? { p: sh.position.clone(), s: sh.scale.clone(), v: sh.visible } : null;
  if (sh) { sh.position.set(c.x, box.group.position.y - 0.05, c.z); sh.scale.setScalar(S * 1.6); }
  const ctlSave = { enabled: viewer.controls.enabled, max: viewer.controls.maxDistance, min: viewer.controls.minDistance, auto: viewer.controls.autoRotate };
  viewer.controls.enabled = false; viewer.controls.maxDistance = Infinity; viewer.controls.minDistance = 0; viewer.controls.autoRotate = false;
  const autoSave = viewer.autoRotateEnabled; viewer.autoRotateEnabled = false;

  const bounds = (liftLid) => {
    const w = S / 2; // couvercle relevé et reculé : on garde tout dans le cadre
    return new THREE.Box3(new THREE.Vector3(c.x - w, box.group.position.y, c.z - w), new THREE.Vector3(c.x + w, box.group.position.y + box.totalH + (liftLid ? box.lidH * 1.7 : 0), c.z + w));
  };
  const frame = (b, instant) => {
    viewer.focusOn(b, { minFrac: 0, margin: 1.3 });
    if (instant && viewer.anim) { viewer.camera.position.copy(viewer.anim.to); viewer.controls.target.copy(viewer.anim.toT); viewer.anim = null; }
    viewer.invalidate();
  };
  // vue de départ : légèrement plongeante, de face
  viewer.camera.position.copy(viewer.controls.target).add(new THREE.Vector3(0.5, 0.62, 0.75).normalize().multiplyScalar(S * 4));
  frame(bounds(false), true);

  // ----- Interface : masquée, indice + « Passer » -----
  ui.el.dataset.intro = '1';
  const vp = ui.el.querySelector('.viewport') || ui.el;
  const hint = document.createElement('div');
  hint.className = 'intro-hint';
  hint.innerHTML = `<button class="intro-open" type="button">${t('introHint')}</button><button class="intro-skip link" type="button">${t('introSkip')}</button>`;
  vp.appendChild(hint);

  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  let state = 'idle', t0 = 0, skipped = false, camBack = false;
  const idleStart = performance.now();

  const open = () => { if (state !== 'idle') return; state = 'anim'; t0 = performance.now(); hint.classList.add('gone'); frame(bounds(true), false); };
  const skip = () => { skipped = true; if (state === 'idle') state = 'anim'; t0 = performance.now() - 99999; hint.classList.add('gone'); };
  // toucher la boîte (clic net, pas un glissé)
  let down = null;
  const pd = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const pu = (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) open(); down = null; };
  viewer.canvas.addEventListener('pointerdown', pd); viewer.canvas.addEventListener('pointerup', pu);
  hint.querySelector('.intro-open').addEventListener('click', open);
  hint.querySelector('.intro-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });

  const slow = Math.max(1, Number(new URLSearchParams(location.search).get('introSlow')) || 1); // captures de test : ralentit l'animation
  const T = { lid: 1.5, ring0: 0.9, ring1: 2.6, fade0: 2.3, fade1: 3.3, end: 3.5 };
  const frameFn = (now) => {
    if (state === 'idle') { // l'écrin respire doucement, la lumière joue sur la suédine
      box.group.rotation.y = Math.sin((now - idleStart) / 2600) * 0.22;
      return true;
    }
    if (state !== 'anim') return false;
    const time = ((now - t0) / 1000) / slow;
    const kLid = ease(seg(time, 0, T.lid));
    // couvercle : se soulève à la verticale (comme sur la charte : « ouvert »), sans pivot ni charnière
    box.lid.position.y = box.hb + kLid * box.lidH * 1.6;
    box.group.rotation.y *= 0.9; // la boîte se recale de face
    // bague : sort de l'écrin en tournant légèrement
    const kRing = ease(seg(time, T.ring0, T.ring1));
    root.position.y = startY - L * (1 - kRing);
    root.rotation.y = (1 - kRing) * -1.6;
    // boîte : s'efface
    const f = ease(seg(time, T.fade0, T.fade1));
    if (f > 0) { box.setOpacity(1 - f); box.group.scale.setScalar(1 - 0.05 * f); }
    if (time > 2.4 && !camBack) { camBack = true; viewer.frameAll(); }
    if (time >= T.end) finish();
    return true;
  };
  viewer.onFrame.push(frameFn);

  function finish() {
    if (state === 'finished') return;
    state = 'finished';
    viewer.onFrame.splice(viewer.onFrame.indexOf(frameFn), 1);
    viewer.canvas.removeEventListener('pointerdown', pd); viewer.canvas.removeEventListener('pointerup', pu);
    viewer.scene.remove(box.group, key, key.target); box.dispose();
    root.position.y = startY; root.rotation.y = 0;
    if (sh && shSave) { sh.position.copy(shSave.p); sh.scale.copy(shSave.s); sh.visible = shSave.v; }
    Object.assign(viewer.controls, { enabled: ctlSave.enabled, maxDistance: ctlSave.max, minDistance: ctlSave.min });
    viewer.autoRotateEnabled = autoSave;
    viewer.frameAll();
    hint.remove();
    delete ui.el.dataset.intro;
    viewer.invalidate();
    resolveDone();
  }
  // « Passer » : on termine tout de suite
  const skipWatcher = setInterval(() => { if (skipped) { clearInterval(skipWatcher); finish(); } }, 50);
  await done;
  clearInterval(skipWatcher);
}
