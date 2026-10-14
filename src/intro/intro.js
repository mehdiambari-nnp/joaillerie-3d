// Introduction : l'écrin de la marque est fermé au centre de la vue 3D ; au toucher, le couvercle se soulève, la bague
// sort de son écrin, puis la boîte disparaît et le configurateur apparaît.
import * as THREE from 'three';
import { buildBox } from './box.js';
import { t } from '../ui/i18n.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (time, a, b) => clamp01((time - a) / (b - a));

/** L'ouverture de l'écrin est réservée à la vision client : elle ne se joue que sur un lien de partage (`hasShare`), jamais pour le joaillier. `?intro` la force (tests, captures). */
export function shouldPlayIntro(theme, params, dev, hasShare = false) {
  if (!theme.intro?.enabled) return false;
  if (!hasShare && !params.has('intro')) return false;
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
  // Vue finale = vue d'accueil habituelle du configurateur : l'intro s'y termine exactement, sans raccord.
  const finalPos = viewer.camera.position.clone(), finalTarget = viewer.controls.target.clone();
  const logoKey = theme.intro.logo === 'lockup' ? 'lockup' : 'wordmark';
  const ratio = logoKey === 'lockup' ? 3.1 : 911 / 216;
  const box = await buildBox(S, { logoSvg: theme.logoSvg?.[logoKey], logoRatio: ratio, env: viewer.scene.environment });

  // La bague est posée au fond de l'écrin : on la descend de L ; l'écrin est placé autour d'elle.
  const startY = root.position.y;
  root.position.y = startY - L;
  const ringStartMinY = ringBox.min.y - L;
  box.group.position.set(c.x, ringStartMinY - box.floorY, c.z);
  viewer.scene.add(box.group);
  root.visible = true; // la bague (masquée dès le chargement) n'apparaît que dans l'écrin fermé
  const KEY = 2.6; const key = new THREE.DirectionalLight(0xf6f0ff, KEY); key.position.set(-1, 1.6, 1.2).multiplyScalar(S).add(c); key.target.position.copy(c); viewer.scene.add(key, key.target); // faces de l'écrin bien distinctes
  if (window.__rc) window.__rc.introBox = box;
  const sh = viewer._shadow, shSave = sh ? { p: sh.position.clone(), s: sh.scale.clone(), v: sh.visible } : null;
  const boxY0 = box.group.position.y;
  if (sh) { sh.position.set(c.x, box.group.position.y - 0.05, c.z); sh.scale.setScalar(S * 1.6); }
  const shBox = sh ? { p: sh.position.clone(), s: sh.scale.clone() } : null;
  const ctlSave = { enabled: viewer.controls.enabled, max: viewer.controls.maxDistance, min: viewer.controls.minDistance, auto: viewer.controls.autoRotate };
  viewer.controls.enabled = false; viewer.controls.maxDistance = Infinity; viewer.controls.minDistance = 0; viewer.controls.autoRotate = false;
  const autoSave = viewer.autoRotateEnabled; viewer.autoRotateEnabled = false;

  const bounds = (liftLid) => {
    const w = S / 2; // couvercle relevé et reculé : on garde tout dans le cadre
    return new THREE.Box3(new THREE.Vector3(c.x - w, box.group.position.y, c.z - w), new THREE.Vector3(c.x + w, box.group.position.y + box.totalH + 0, c.z + w));
  };
  const frame = (b, instant) => {
    viewer.focusOn(b, { minFrac: 0, margin: 1.1 });
    if (instant && viewer.anim) { viewer.camera.position.copy(viewer.anim.to); viewer.controls.target.copy(viewer.anim.toT); viewer.anim = null; }
    viewer.invalidate();
  };
  // vue de départ : de face, en plongée légère (≈ 17°)
  viewer.controls.target.copy(c);
  viewer.camera.position.copy(c).add(new THREE.Vector3(0, 0.3, 1).normalize().multiplyScalar(S * 4));
  frame(bounds(false), true);

  // ----- Interface : masquée, indice + « Passer » -----
  ui.el.dataset.intro = '1';
  const vp = ui.el.querySelector('.viewport') || ui.el;
  const hint = document.createElement('div');
  hint.className = 'intro-hint';
  hint.innerHTML = `<button class="intro-open" type="button">${t('introHint')}</button><button class="intro-skip link" type="button">${t('introSkip')}</button>`;
  vp.appendChild(hint);

  let resolveDone; const done = new Promise((r) => { resolveDone = r; });
  let state = 'idle', t0 = 0, skipped = false;

  const open = () => { if (state !== 'idle') return; state = 'anim'; t0 = performance.now(); hint.classList.add('gone'); startCam(); };
  const skip = () => { skipped = true; if (state === 'idle') state = 'anim'; t0 = performance.now() - 99999; hint.classList.add('gone'); };
  // toucher la boîte (clic net, pas un glissé)
  let down = null;
  const pd = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const pu = (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) open(); down = null; };
  viewer.canvas.addEventListener('pointerdown', pd); viewer.canvas.addEventListener('pointerup', pu);
  hint.querySelector('.intro-open').addEventListener('click', open);
  hint.querySelector('.intro-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });

  const slow = Math.max(1, Number(new URLSearchParams(location.search).get('introSlow')) || 1); // captures de test : ralentit l'animation
  const T = { lid1: 1.7, ring0: 1.1, ring1: 3.0, cam0: 1.3, cam1: 3.6, fade0: 2.6, fade1: 3.7, end: 3.9 };
  // Trajectoire de caméra : direction (slerp) + distance + cible interpolées, de la vue de face vers la vue finale.
  let cam = null, lidLift = 0;
  function startCam() {
    const p0 = viewer.camera.position.clone(), t0v = viewer.controls.target.clone();
    const o0 = p0.clone().sub(t0v), o1 = finalPos.clone().sub(finalTarget);
    const q = new THREE.Quaternion().setFromUnitVectors(o0.clone().normalize(), o1.clone().normalize());
    cam = { t0: t0v, o0, d0: o0.length(), d1: o1.length(), q, finalTarget };
    // hauteur dont le couvercle doit monter pour sortir complètement du champ (haut de l'écran, à la profondeur de la boîte)
    const fov = viewer.camera.fov * Math.PI / 180, visH = 2 * Math.tan(fov / 2) * o0.length();
    lidLift = visH * 0.9 + box.lidH * 1.2;
  }
  const idQ = new THREE.Quaternion();
  const frameFn = (now) => {
    if (state === 'idle') return false; // l'écrin attend, immobile
    if (state !== 'anim') return false;
    const time = ((now - t0) / 1000) / slow;
    // couvercle : se soulève à la verticale (comme sur la charte, « ouvert ») et quitte l'écran par le haut
    const kLid = seg(time, 0, T.lid1), eLid = kLid * kLid * (3 - 2 * kLid);
    box.lid.position.y = box.hb + eLid * lidLift;
    // bague : sort de l'écrin et rejoint sa pose d'origine (position + orientation)
    const kRing = ease(seg(time, T.ring0, T.ring1));
    root.position.y = startY - L * (1 - kRing);
    root.rotation.y = (1 - kRing) * -1.6;
    // caméra : rejoint la vue d'accueil (aucune coupure à la fin)
    const kc = ease(seg(time, T.cam0, T.cam1));
    if (cam) {
      const tgt = cam.t0.clone().lerp(cam.finalTarget, kc);
      const off = cam.o0.clone().applyQuaternion(idQ.clone().slerp(cam.q, kc)).setLength(cam.d0 + (cam.d1 - cam.d0) * kc);
      viewer.controls.target.copy(tgt); viewer.camera.position.copy(tgt).add(off);
      if (sh && shSave) { sh.position.lerpVectors(shBox.p, shSave.p, kc); sh.scale.lerpVectors(shBox.s, shSave.s, kc); }
    }
    // écrin et lumière d'ambiance : s'effacent doucement (la lumière touche aussi la bague, elle ne doit pas « sauter »)
    const f = ease(seg(time, T.fade0, T.fade1));
    key.intensity = KEY * (1 - f);
    if (f > 0) { box.setOpacity(1 - f); box.group.position.y = boxY0 - S * 0.12 * f; }
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
    viewer.controls.target.copy(finalTarget); viewer.camera.position.copy(finalPos); viewer.controls.update();
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
