// Suite E2E (Chromium headless, WebGL logiciel). Charge la vraie maquette MAQUETTE_GEMV.fbx si présente.
// Usage : npm run test:e2e   (captures dans docs/screenshots/)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { startServer, launch, collect, waitModel } from './helpers.mjs';

const OUT = 'docs/screenshots/';
const HAS_GEMV = fs.existsSync('assets/test/MAQUETTE_GEMV.fbx');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('tests/e2e/.tmp', { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log(`${c ? '  ✓' : '  ✗'} ${msg}`); if (!c) failed++; };
const step = (s) => console.log(`\n▶ ${s}`);

const { server, url } = await startServer();
const q = HAS_GEMV ? '?model=gemv' : '';
const init = () => { try { localStorage.setItem('rc:onboarded', 'true'); localStorage.setItem('rc:seenVersion', '"9.9.9"'); } catch {} };

// ---------- 0. Introduction (écrin) ----------
step('Introduction : écrin fermé → ouverture → bague libre');
{
  const b0 = await launch();
  const c0 = await b0.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await c0.addInitScript(init);
  const p0 = await c0.newPage(); const l0 = collect(p0);
  await p0.goto(url + q + (q ? '&' : '?') + 'intro=1');
  await p0.waitForSelector('.intro-open', { timeout: 60000 });
  ok(await p0.evaluate(() => document.querySelector('.app').dataset.intro === '1' && !!__rc.introBox), 'écrin affiché, interface masquée');
  ok(await p0.evaluate(() => __rc.app.model.root.position.y < 0), 'la bague est descendue dans l’écrin');
  await p0.locator('.intro-open').click();
  await p0.waitForFunction(() => !document.querySelector('.app').dataset.intro, null, { timeout: 30000 });
  ok(await p0.evaluate(() => __rc.app.model.root.position.y === 0 && __rc.app.model.root.rotation.y === 0 && !document.querySelector('.intro-hint')), 'bague remise en place, indice retiré');
  ok(await p0.evaluate(() => __rc.app.viewer.controls.enabled), 'contrôles de la vue 3D de nouveau actifs');
  ok(await p0.evaluate(() => !__rc.app.viewer.fx || __rc.app.viewer.fx.n >= 1), 'pipeline d’image : au moins une image rendue (ou rendu direct si le GPU ne le gère pas)');
  ok(l0.errors.length === 0, 'aucune erreur console (intro) ' + JSON.stringify(l0.errors));
  await b0.close();
}

// ---------- 1. Bureau : import, sélection, matériaux ----------
step('Bureau : import + sélection + matériaux');
let browser = await launch();
let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
await ctx.addInitScript(init);
let page = await ctx.newPage();
let logs = collect(page);
await page.goto(url + q);
await waitModel(page);
const info = await page.evaluate(() => {
  const a = __rc.app; return { pieces: a.pieces.length, zones: a.zones.map((z) => [z.id, z.type, z.pieceIds.length]), d: a.model.meta.innerDiameter, fr: a.model.meta.frSize };
});
console.log('  ', JSON.stringify(info));
if (HAS_GEMV) {
  ok(info.pieces === 24, '24 pièces après suppression des doublons');
  ok(info.zones.length === 6, '6 zones détectées');
  ok(Math.abs(info.d - 19.5) < 0.6, `diamètre intérieur ≈ 19,5 mm (${info.d?.toFixed(2)})`);
} else ok(info.pieces > 0, 'bague de démo chargée');

// clic réel sur le canvas (picking BVH)
await page.evaluate(() => { __rc.app.viewer.setAutoRotate(false); __rc.app.viewer.setView([0.0, 0.35, 1], false); });
await page.waitForTimeout(900);
const box = await page.locator('canvas').first().boundingBox();
// point écran d'un sommet réel de la pièce du corps le plus proche de la caméra (déterministe)
await page.evaluate(() => { __rc.app.viewer.setAutoRotate(false); });
await page.waitForTimeout(300);
let picked = false;
for (let k = 0; k < 3 && !picked; k++) {
const target = await page.evaluate(() => {
  const T = __rc.THREE, v = __rc.app.viewer, cam = v.camera;
  const p = __rc.app.pieces.find((x) => x.role === 'body') || __rc.app.pieces[0];
  const pos = p.mesh.geometry.attributes.position; let best = null, bd = 1e9;
  const w = new T.Vector3();
  for (let i = 0; i < pos.count; i += 7) { w.fromBufferAttribute(pos, i).applyMatrix4(p.mesh.matrixWorld); const q = w.clone().project(cam); const d = Math.hypot(q.x, q.y) + (q.z > 1 ? 9 : 0); if (d < bd) { bd = d; best = w.clone(); } }
  const n = best.project(cam); const r = v.renderer.domElement.getBoundingClientRect();
  return { x: r.left + (n.x + 1) / 2 * r.width, y: r.top + (1 - n.y) / 2 * r.height };
});
await page.mouse.move(target.x, target.y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(500);
picked = await page.evaluate(() => __rc.app.selection.size > 0);
}
ok(picked, 'clic sur la bague → sélection d\'une zone');
await page.screenshot({ path: OUT + 'e2e-selected.png' });

// application via l'UI (boule du panneau) puis via l'API par zone
const zones = info.zones;
const gemZone = zones.find((z) => z[1] === 'gem')?.[0];
const metalZones = zones.filter((z) => z[1] === 'metal').map((z) => z[0]);
await page.evaluate(([gz, mz]) => {
  const a = __rc.app;
  a.selectZone(gz); a.applyToSelection({ m: 'green-emerald' });
  a.selectZone(mz[0]); a.applyToSelection({ m: 'rose', f: 'polish' });
  if (mz[1]) { a.selectZone(mz[1]); a.applyToSelection({ m: 'platinum', f: 'satin' }); }
  a.clearSelection();
}, [gemZone, metalZones]);
await page.click('button[data-mat="blue-medium"]').catch(() => {}); // sans sélection : sans effet attendu
await page.waitForTimeout(500);
const applied = await page.evaluate(() => Object.values(__rc.app.assign).map((a) => a.m));
ok(applied.includes('green-emerald') && applied.includes('rose'), `matériaux appliqués par zone (${[...new Set(applied)].join(', ')})`);
// règle : une pierre ne reçoit pas un métal
const guard = await page.evaluate((gz) => {
  const a = __rc.app; const id = a.zoneById(gz).pieceIds[0]; a.applyMaterial([id], { m: 'rose' }); return a.assign[id].m;
}, gemZone);
ok(guard === 'green-emerald', 'une pierre refuse un métal');
await page.evaluate(() => __rc.app.viewer.setView([0.62, 0.45, 0.64], false));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'e2e-materials.png' });

// undo / redo
const before = await page.evaluate(() => JSON.stringify(__rc.app.assign));
await page.evaluate(() => { __rc.app.undo(); });
const afterUndo = await page.evaluate(() => JSON.stringify(__rc.app.assign));
await page.evaluate(() => { __rc.app.redo(); });
const afterRedo = await page.evaluate(() => JSON.stringify(__rc.app.assign));
ok(before !== afterUndo && before === afterRedo, 'annuler / rétablir');

// ---------- 2. Modes : plus d'Atelier ----------
ok(await page.locator('button[data-mode=atelier]').count() === 0, 'mode Atelier retiré');

// ---------- 3. Partage + projet GLB + AR ----------
step('Partage / projet / AR');
const rt = await page.evaluate(async () => {
  const st = await import('/src/state/store.js');
  const ex = await import('/src/export/exporters.js');
  const imp = await import('/src/import/fbxImport.js');
  const app = __rc.app;
  const link = st.buildShareUrl('http://x/', { modelId: app.modelId, assign: app.assign, env: 'studio', envRot: 0, hidden: [...app.hidden] });
  const parsed = st.parseShareHash(link.slice(link.indexOf('#')));
  const srt = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k].m, o[k].f ?? null]));
  const shareOk = srt(parsed.assign) === srt(app.assign);
  const glb = await ex.exportProjectGLB(app);
  const buf = await glb.arrayBuffer();
  const m2 = await imp.importModel(buf, 'projet.glb');
  const cfg = m2.project;
  const projOk = !!cfg && JSON.stringify(cfg.assign) === JSON.stringify(app.assign);
  const arGlb = await ex.exportARGLB(app, 'real');
  let usdz = null, usdzErr = null;
  try { usdz = await ex.exportARUSDZ(app, 'real'); } catch (e) { usdzErr = e.message; }
  const scene = ex.buildARScene(app, 'real');
  const T = __rc.THREE; const bb = new T.Box3().setFromObject(scene); const s = bb.getSize(new T.Vector3());
  return { shareOk, linkLen: link.length, glb: glb.size, projOk, pieces2: m2.pieces.length, arGlb: arGlb.size, usdz: usdz?.size ?? null, usdzErr, arSize: s.toArray() };
});
console.log('  ', JSON.stringify(rt));
ok(rt.shareOk, `lien de partage aller-retour (${rt.linkLen} car.)`);
ok(rt.projOk && rt.pieces2 === info.pieces, 'projet GLB : réimport avec la configuration');
ok(rt.arGlb > 1000, `export AR GLB (${rt.arGlb} o)`);
ok(rt.usdz > 1000, `export AR USDZ (${rt.usdz} o) ${rt.usdzErr ?? ''}`);
ok(rt.arSize[0] < 0.06 && rt.arSize[0] > 0.01, `échelle réelle de la scène AR en mètres (${rt.arSize.map((x) => (x * 1000).toFixed(1)).join('×')} mm)`);
ok(logs.errors.length === 0, 'aucune erreur console (bureau) ' + JSON.stringify(logs.errors));
await browser.close();

// ---------- 4. iPhone (viewport + tactile) ----------
step('iPhone 17 Pro Max (émulation)');
browser = await launch();
ctx = await browser.newContext({
  viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript(init);
page = await ctx.newPage();
logs = collect(page);
await page.goto(url + q);
await waitModel(page);
await page.evaluate(() => __rc.app.viewer.setAutoRotate(false));
await page.screenshot({ path: OUT + 'e2e-iphone.png' });
const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
ok(noHScroll, 'pas de défilement horizontal');
ok(await page.evaluate(() => innerWidth === visualViewport.width), 'mise en page = largeur du viewport (pas de zoom/élargissement iOS)');
// plein écran (iPhone) : la vue 3D occupe tout l'écran et le bouton de sortie est visible
const vpH = await page.evaluate(() => document.querySelector('.viewport').getBoundingClientRect().height);
await page.evaluate(() => document.querySelector('[data-a=present]').click());
await page.waitForTimeout(500);
const fsr = await page.evaluate(() => { const v = document.querySelector('.viewport').getBoundingClientRect(); const b = document.querySelector('[data-a=present]').getBoundingClientRect(); return { h: v.height, ih: innerHeight, exitVisible: b.width > 0 && b.top >= 0 }; });
ok(fsr.h > vpH * 1.1 && fsr.h >= fsr.ih - 2, `plein écran : vue 3D agrandie (${Math.round(vpH)} → ${Math.round(fsr.h)} px)`);
ok(fsr.exitVisible, 'plein écran : bouton de sortie visible');
await page.evaluate(() => document.querySelector('[data-a=present]').click());
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.querySelector('.app').dataset.present === '0' && document.querySelector('.topbar').offsetHeight > 0), 'plein écran : retour à l’interface');
// teinte libre
const cust = await page.evaluate(async () => {
  const a = __rc.app; a.selectZone(a.zones.find((z) => z.type === 'gem').id);
  __rc.ui.renderAll();
  document.querySelector('.custom-dot').click();
  const e = document.querySelector('[data-r=chex]'); e.value = '#17b2a8'; e.dispatchEvent(new Event('change', { bubbles: true }));
  const id = [...a.selection][0];
  return { assign: a.assign[id], att: '#' + a.pieceById(id).mesh.material.attenuationColor.getHexString() };
});
ok(cust.assign.m === 'custom' && cust.assign.c === '#17b2a8', `teinte libre appliquée (${JSON.stringify(cust.assign)})`);
// mode client : aucun réglage visible, pas de sélection
const cl = await page.evaluate(() => {
  __rc.ui.setMode('client');
  const vis = (sel) => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; };
  document.querySelector('.app').dataset.mode;
  return { zones: vis('.zones'), mats: vis('.mats'), seg: vis('.seg'), tryon: vis('[data-a=tryon]'), ar: vis('[data-a=ar]'), sel: __rc.app.selection.size, interactive: __rc.app.interactive };
});
ok(!cl.zones && !cl.mats && !cl.seg && cl.tryon && !cl.ar && cl.sel === 0 && !cl.interactive, 'mode client : épuré (essayage + photo ; AR désactivé par flag)');
await page.evaluate(() => __rc.ui.setMode('vitrine'));
// aperçu client : le bouton Client rejoue l'écrin comme pour le client réel ; « Quitter l'aperçu » l'interrompt proprement
await page.click('button[data-mode=client]');
await page.waitForSelector('.intro-open', { timeout: 60000 });
ok(await page.evaluate(() => document.querySelector('.app').dataset.intro === '1' && document.querySelector('.app').dataset.mode === 'client'), 'aperçu client : écrin affiché en mode client');
await page.click('[data-a=exit-client]');
await page.waitForFunction(() => !document.querySelector('.app').dataset.intro && document.querySelector('.app').dataset.mode === 'vitrine', null, { timeout: 15000 });
ok(await page.evaluate(() => __rc.app.model.root.position.y === 0 && __rc.app.model.root.visible && !document.querySelector('.intro-hint')), 'aperçu client : retour joaillier, intro interrompue proprement');
ok(await page.evaluate(() => !document.querySelector('[data-a=ar]:not([hidden])')), 'bouton AR masqué (flag ar désactivé)');
await page.evaluate(() => __rc.ui.openAR()); // le code AR reste fonctionnel même flag off
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'e2e-iphone-ar.png' });
ok(await page.evaluate(() => !!document.querySelector('dialog[open]')), 'dialogue AR affiché (parcours Quick Look)');
ok(logs.errors.length === 0, 'aucune erreur console (iPhone) ' + JSON.stringify(logs.errors));
await browser.close();

// ---------- 5. Essayage sur la main (fausse caméra) ----------
step('Essayage : fausse caméra + MediaPipe');
const photo = fs.existsSync('tests/fixtures/main_ouverte_test.jpg') ? 'tests/fixtures/main_ouverte_test.jpg' : null;
if (photo) {
  const y4m = 'tests/e2e/.tmp/hand.y4m';
  execSync(`ffmpeg -y -loglevel error -loop 1 -i ${photo} -t 2 -r 10 -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,format=yuv420p" ${y4m}`);
  browser = await launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`]);
  ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', permissions: ['camera'] });
  await ctx.addInitScript(init);
  page = await ctx.newPage();
  logs = collect(page);
  await page.goto(url + q);
  await waitModel(page);
  await page.evaluate(() => document.querySelector('button[data-a=tryon]').click());
  await page.waitForSelector('.tryon-intro [data-a=start], [data-a=start]', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('[data-a=start]').click());
  let found = false;
  try {
    await page.waitForFunction(() => window.__rc.ui.tryon.anchor?.visible === true, null, { timeout: 90000 });
    found = true;
  } catch {}
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + 'e2e-tryon.png' });
  const st = await page.evaluate(() => { const t = __rc.ui.tryon; return t.anchor ? { vis: t.anchor.visible, pos: t.anchor.position.toArray(), fov: t.fov } : null; });
  console.log('  ', JSON.stringify(st));
  ok(found, 'main détectée → bague positionnée');
  if (found) ok(st.pos[2] < 0 && st.pos[2] > -2, 'bague devant la caméra (z négatif, < 2 m)');
  ok(logs.errors.length === 0, 'aucune erreur console (essayage) ' + JSON.stringify(logs.errors));
  await browser.close();
} else console.log('  (photo de test absente : ignoré)');

await server.close();
console.log(failed ? `\n${failed} échec(s)` : '\nTous les tests E2E sont passés');
process.exit(failed ? 1 : 0);
