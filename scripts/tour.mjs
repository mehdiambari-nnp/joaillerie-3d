// Visite guidée : une capture par fonctionnalité (docs/tour/). Usage : node scripts/tour.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { startServer, launch, collect, waitModel } from '../tests/e2e/helpers.mjs';
const OUT = 'docs/tour/'; fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer(5196);
const b = await launch();
const log = [];
const shot = async (page, name, o = {}) => { await page.waitForTimeout(o.wait ?? 700); await page.screenshot({ path: `${OUT}${name}.png`, ...o.shot }); log.push(name); };
const V = (page, d) => page.evaluate((d) => __rc.app.viewer.setView(d, false), d);
const close = (page) => page.evaluate(() => { const d = document.querySelector('dialog[open]'); d?.close(); });

// ----- Bureau -----
let ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
let page = await ctx.newPage(); const logs = collect(page);
await page.goto(url + '?model=gemv'); await waitModel(page);
await page.evaluate(() => __rc.app.viewer.setAutoRotate(false));
await V(page, [0.62, 0.45, 0.64]);
await shot(page, '01-accueil-onboarding');
await page.evaluate(() => { localStorage.setItem('rc:onboarded', 'true'); document.querySelector('dialog[open]')?.close(); });
await shot(page, '02-vitrine-maquette');
// sélection d'une zone
await page.evaluate(() => __rc.app.selectZone('z-gem-center')); await shot(page, '03-selection-pierre-centrale');
await shot(page, '04-palette-pierres');
await page.evaluate(() => __rc.app.applyToSelection({ m: 'green-emerald' })); await shot(page, '05-emeraude-centrale');
await page.evaluate(() => { __rc.app.selectZone('z-gem-side'); __rc.app.applyToSelection({ m: 'blue-medium' }); });
await shot(page, '06-saphir-lateraux');
await page.evaluate(() => { __rc.app.selectZone('z-setting-center'); __rc.app.applyToSelection({ m: 'rose' }); });
await shot(page, '07-chaton-or-rose-metaux');
await page.evaluate(() => { __rc.app.selectZone('z-body'); __rc.app.applyToSelection({ m: 'platinum', f: 'satin' }); });
await shot(page, '08-corps-platine-satine');
await page.evaluate(() => { __rc.app.selectZone('z-claw'); __rc.app.applyToSelection({ m: 'grey', f: 'hammered' }); });
await page.evaluate(() => __rc.app.clearSelection());
await shot(page, '09-bague-composee');
// multi-sélection + sélection fine
await page.click('button[data-a=multi]');
await page.evaluate(() => { __rc.app.selectZone('z-claw'); __rc.app.selectZone('z-setting-side', true); });
await shot(page, '10-multi-selection');
await page.click('button[data-a=multi]'); await page.click('button[data-a=fine]');
await page.evaluate(() => { const p = __rc.app.pieces.find((x) => x.role === 'claw'); __rc.app.select([p.id]); });
await shot(page, '11-selection-fine-une-griffe');
await page.click('button[data-a=fine]'); await page.evaluate(() => __rc.app.clearSelection());
// vues, environnements
await page.click('[data-pop-btn=views]'); await shot(page, '12-menu-vues');
await page.evaluate(() => document.querySelector('.pop[data-pop=views] button')?.click()); await shot(page, '13-vue-predefinie');
await page.click('[data-pop-btn=env]'); await shot(page, '14-menu-environnement');
await page.evaluate(() => { __rc.app.viewer.setEnvironment('softbox'); }); await shot(page, '15-environnement-softbox');
await page.evaluate(() => { __rc.app.viewer.setEnvironment('daylight'); }); await shot(page, '16-environnement-jour');
await page.evaluate(() => { __rc.app.viewer.setEnvironment('studio'); document.querySelectorAll('.pop').forEach((p) => (p.hidden = true)); });
await V(page, [0, 1, 0.0001]); await shot(page, '17-vue-dessus');
await V(page, [0, 0, 1]); await shot(page, '18-vue-face-doigt');
await V(page, [0.62, 0.45, 0.64]);
// annuler / rétablir
await page.click('button[data-a=undo]'); await shot(page, '19-annuler');
await page.click('button[data-a=redo]');
// dialogues
await page.evaluate(() => __rc.ui.openShare()); await shot(page, '20-partage-lien-qr', { wait: 1200 }); await close(page);
await page.evaluate(() => __rc.ui.openRecap()); await shot(page, '21-fiche-recap'); await close(page);
await page.evaluate(() => __rc.ui.openVariants()); await shot(page, '22-variantes'); await close(page);
await page.click('button[data-a=ar]'); await shot(page, '23-ar-desktop', { wait: 2500 }); await close(page);

await page.click('button[data-mode=vitrine]');
// mode présentation + sombre
await page.evaluate(() => __rc.ui.setPresent(true)); await shot(page, '27-mode-presentation'); await page.evaluate(() => __rc.ui.setPresent(false));
await page.evaluate(() => __rc.ui.setBg('dark')); await shot(page, '28-fond-sombre'); await page.evaluate(() => __rc.ui.setBg('light'));
await ctx.close();
await ctx.close?.().catch?.(() => {});

// mode sombre système
ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR', colorScheme: 'dark' });
await ctx.addInitScript(() => localStorage.setItem('rc:onboarded', 'true'));
page = await ctx.newPage(); await page.goto(url + '?model=gemv'); await waitModel(page);
await page.evaluate(() => __rc.app.viewer.setAutoRotate(false)); await V(page, [0.62, 0.45, 0.64]);
await shot(page, '29-theme-sombre'); await ctx.close();

// ----- Démo (bague procédurale, sans fichier) -----
ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
await ctx.addInitScript(() => localStorage.setItem('rc:onboarded', 'true'));
page = await ctx.newPage(); await page.goto(url); await waitModel(page);
await shot(page, '30-bague-demo'); await ctx.close();

// ----- iPhone -----
const ios = { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1' };
ctx = await b.newContext(ios); await ctx.addInitScript(() => localStorage.setItem('rc:onboarded', 'true'));
page = await ctx.newPage(); await page.goto(url + '?model=gemv'); await waitModel(page);
await page.evaluate(() => __rc.app.viewer.setAutoRotate(false)); await V(page, [0.62, 0.45, 0.64]);
await shot(page, '31-iphone-vitrine');
await page.evaluate(() => __rc.app.selectZone('z-gem-center')); await page.evaluate(() => __rc.app.applyToSelection({ m: 'ruby' }));
await shot(page, '32-iphone-rubis-selection');
await page.evaluate(() => __rc.app.clearSelection());
await page.tap('button[data-a=ar]'); await shot(page, '33-iphone-ar-quicklook', { wait: 2500 }); await close(page);
await page.evaluate(() => __rc.ui.openShare()); await shot(page, '34-iphone-partage', { wait: 1200 }); await close(page);
await ctx.close();

// ----- Essayage (fausse caméra) -----
const y4m = 'tests/e2e/.tmp/hand.y4m';
for (const [file, tag] of [['main_ouverte_test', 'a'], ['dos_main_index_leve_test', 'b']]) {
  if (!fs.existsSync(`tests/fixtures/${file}.jpg`)) continue;
  execSync(`ffmpeg -y -loglevel error -loop 1 -i tests/fixtures/${file}.jpg -t 2 -r 10 -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,format=yuv420p" ${y4m}`);
  const bb = await (await import('../tests/e2e/helpers.mjs')).launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`]);
  ctx = await bb.newContext({ ...ios, deviceScaleFactor: 2, permissions: ['camera'] });
  await ctx.addInitScript(() => localStorage.setItem('rc:onboarded', 'true'));
  page = await ctx.newPage(); await page.goto(url + '?model=gemv'); await waitModel(page);
  await page.tap('button[data-a=tryon]'); await shot(page, `35${tag}-essayage-intro`);
  await page.tap('[data-a=start]');
  try { await page.waitForFunction(() => __rc.ui.tryon.anchor?.visible === true, null, { timeout: 90000 }); } catch {}
  await shot(page, `36${tag}-essayage-main-detectee`, { wait: 1000 });
  await bb.close();
}
console.log(JSON.stringify({ shots: log.length, errors: logs.errors }));
await b.close(); await server.close();
