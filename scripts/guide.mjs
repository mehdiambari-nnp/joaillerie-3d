// Génère les captures du guide (docs/images/) : l'application tourne contre les émulateurs Firebase, avec des données fictives
// (une joaillerie, un invité, des projets, des liens clients consultés). Rejouable à chaque évolution de l'interface : le guide ne se périme pas.
// Usage : npm run emulators (dans un autre terminal), puis  npm run guide
import fs from 'node:fs';
import { createServer } from 'vite';
import { launch, collect } from '../tests/e2e/helpers.mjs';

const OUT = 'docs/images/', PORT = 5197, PROJECT = 'demo-jewel3d';
const A = `http://localhost:${PORT}/`, B = `http://127.0.0.1:${PORT}/`; // deux origines = deux sessions séparées
const PW = 'guide-secret-123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('tests/e2e/.tmp', { recursive: true });

// ---------- émulateurs : présents, et remis à zéro ----------
for (const [n, u] of [['Auth', 'http://127.0.0.1:9099/'], ['Firestore', 'http://127.0.0.1:8080/']]) {
  try { await fetch(u); } catch { console.error(`Émulateur ${n} injoignable : lancer d'abord « npm run emulators ».`); process.exit(1); }
}
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
const signUp = (email, displayName) => fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW, displayName }) });
await signUp('claire@atelier-demo.fr', 'Claire Moreau');
await signUp('hugo@atelier-demo.fr', 'Hugo Bernard');

process.env.E2E = '1'; // HTTP (pas de certificat) ; mode « development » : Firebase + ?emulator
const server = await createServer({ server: { port: PORT, host: true, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launch();
const init = () => { localStorage.setItem('rc:onboarded', 'true'); localStorage.setItem('rc:seenVersion', JSON.stringify('99.0.0')); };

const shots = [];
const shot = async (page, name, { wait = 800, clip, full } = {}) => {
  await page.waitForTimeout(wait);
  for (let i = 1; ; i++) { // le rendu 3D logiciel est lent quand plusieurs pages tournent : on réessaie
    try { await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 82, clip, fullPage: full, timeout: 90000 }); break; }
    catch (e) { if (i >= 3) throw e; console.warn('  … nouvelle tentative', name); await page.bringToFront().catch(() => {}); await page.waitForTimeout(2000); }
  }
  shots.push(name); console.log('  ✓', name);
};
const newPage = async (url, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR', ...opts });
  await ctx.addInitScript(init);
  const page = await ctx.newPage(); collect(page);
  await page.goto(url); return { ctx, page };
};
const waitReady = (page) => page.waitForFunction(() => window.__rc?.app?.model && !document.querySelector('.progress:not([hidden])'), null, { timeout: 120000 }).then(() => page.waitForTimeout(1200));
const login = async (page, email) => {
  await page.waitForSelector('.login form');
  await page.fill('.login form [name=email]', email); await page.fill('.login form [name=pw]', PW);
  await page.click('.login form button[type=submit], .login form .primary');
  await waitReady(page);
};
const ev = (page, fn, arg) => page.evaluate(fn, arg);

// =============== 1. Joaillière : connexion et configurateur ===============
console.log('Joaillière (Claire)');
const { ctx: ctxA, page: pa } = await newPage(`${A}?emulator`);
await pa.waitForSelector('.login form');
await shot(pa, '01-connexion', { wait: 1500 });
await login(pa, 'claire@atelier-demo.fr');
await ev(pa, () => { __rc.app.viewer.setAutoRotate(false); });
await shot(pa, '02-configurateur', { wait: 2500 });

// matières : pierre centrale en émeraude, chaton en or rose
await ev(pa, () => {
  const a = __rc.app, gem = a.zones.find((z) => z.type === 'gem'); a.selectZone(gem.id); a.applyToSelection({ m: 'green-emerald' });
});
await shot(pa, '03-matieres', { wait: 3000 });

await ev(pa, () => { __rc.app.selectZone?.(null); });

// =============== 2. Projets : quatre bagues différentes ===============
const looks = [
  ['Solitaire émeraude', { gem: 'green-emerald', metal: 'rose' }],
  ['Alliance saphir', { gem: 'blue-royal', metal: 'platinum' }],
  ['Chevalière rubis', { gem: 'red-vivid', metal: 'yellow' }],
  ['Solitaire diamant', { gem: 'diamond', metal: 'champagne' }],
];
for (const [name, l] of looks) {
  await ev(pa, (l) => {
    const a = __rc.app;
    for (const z of a.zones) { a.selectZone(z.id); a.applyToSelection(z.type === 'gem' ? { m: l.gem } : { m: l.metal, f: 'polish' }); }
  }, l);
  await pa.waitForTimeout(1500);
  await ev(pa, async (n) => { await __rc.ui.saveCurrentProject(true, n); }, name);
  await pa.waitForTimeout(900);
}
await ev(pa, () => __rc.ui.openNewProject(() => {})); await shot(pa, '05-nouveau-projet', { wait: 600 });
await ev(pa, () => __rc.ui.dlg.close());
await ev(pa, () => __rc.ui.openProjects()); await shot(pa, '06-menu', { wait: 900 });
await ev(pa, () => __rc.ui.closeProjects());

// =============== 3. Partage : trois liens clients ===============
const links = [];
const makeLink = async (label) => {
  await ev(pa, () => __rc.ui.openShare());
  await pa.waitForSelector('[data-r=linklabel]', { timeout: 60000 });
  await pa.fill('[data-r=linklabel]', label);
  if (!links.length) await shot(pa, '07-partage', { wait: 700 });
  await pa.click('[data-s=mklink]');
  await pa.waitForFunction(() => document.querySelector('[data-r=shareurl-client]')?.value.includes('#l='), null, { timeout: 60000 });
  const url = await pa.inputValue('[data-r=shareurl-client]');
  links.push(url); if (links.length === 1) await shot(pa, '08-lien-cree', { wait: 900 });
  await ev(pa, () => __rc.ui.dlg.close());
};
await makeLink('Mme Dupont – alliance');
await makeLink('M. Martin – solitaire');
await makeLink('Boutique Opéra – chevalière');

// =============== 4. Clients : l'écrin, la bague, la mesure anonyme ===============
console.log('Clients (anonymes)');
const clients = [];
for (let i = 0; i < links.length; i++) {
  const c = await newPage(links[i].replace('/#l=', '/?emulator#l='));
  clients.push(c); await sleep(2500);
}
await clients[0].page.waitForSelector('.intro-hint, .privacy-bar, canvas', { timeout: 60000 });
await shot(clients[0].page, '09-ecrin-client', { wait: 2500 });
for (const [i, c] of clients.entries()) {
  await c.page.waitForFunction(() => window.__rc?.app?.model, null, { timeout: 60000 }).catch(() => {});
  await c.page.mouse.click(640, 400).catch(() => {});
}
await sleep(6000);
await shot(clients[0].page, '10-vue-client', { wait: 2500 });
// actions mesurées : écrin ouvert, essayages, photos
await ev(clients[0].page, () => { for (const k of ['open', 'tryon', 'tryon', 'photo']) window.dispatchEvent(new CustomEvent('rc:track', { detail: k })); });
await ev(clients[1].page, () => { for (const k of ['open', 'tryon']) window.dispatchEvent(new CustomEvent('rc:track', { detail: k })); });
await ev(clients[2].page, () => window.dispatchEvent(new CustomEvent('rc:track', { detail: 'open' })));
await clients[0].page.click('.privacy-bar a, .privacy-bar button').catch(() => {});
await shot(clients[0].page, '11-mesure-anonyme', { wait: 1200 });
await sleep(16000); // la consultation est envoyée toutes les 10 s, avec le temps réellement passé
for (const c of clients) await c.ctx.close();

// =============== 5. Hugo, invité dans l'atelier ===============
console.log('Invité (Hugo)');
const inv = await ev(pa, async () => { const c = await __rc.ui.svc.cloud(); return (await c.workspaces.invites.create('hugo@atelier-demo.fr')).url; });
const { ctx: ctxB, page: pb } = await newPage(inv.replace(A, B).replace('#i=', '?emulator#i='));
await pb.waitForSelector('.login form'); await login(pb, 'hugo@atelier-demo.fr');
await pb.waitForSelector('dialog[open]');
await shot(pb, '13-invitation', { wait: 600 });
await pb.click('dialog[open] .primary');
await pb.waitForTimeout(3500);
await ev(pb, async () => {
  const a = __rc.app; for (const z of a.zones) { a.selectZone(z.id); a.applyToSelection(z.type === 'gem' ? { m: 'violet' } : { m: 'champagne' }); }
  await __rc.ui.saveCurrentProject(true, 'Bague améthyste');
});
await pb.waitForTimeout(1500);

// =============== 6. Le backoffice vu par Claire ===============
console.log('Backoffice');
await ev(pa, () => __rc.ui.openBackoffice('dashboard'));
await pa.waitForTimeout(4000);
await shot(pa, '14-tableau-de-bord', { wait: 600 });
await ev(pa, () => __rc.ui.backoffice.go('projects')); await pa.waitForTimeout(2500); await shot(pa, '15-projets', { wait: 600 });
await ev(pa, () => document.querySelector('.pcard [data-a=menu]')?.click()); await shot(pa, '16-projets-menu', { wait: 500 });
await ev(pa, () => __rc.ui.backoffice.go('links')); await pa.waitForTimeout(2500); await shot(pa, '17-liens-clients', { wait: 600 });
await ev(pa, () => document.querySelector('.bo-list .card [data-a=open]')?.click()); await pa.waitForTimeout(1200); await shot(pa, '18-lien-detail', { wait: 600 });
await ev(pa, () => __rc.ui.backoffice.go('team')); await pa.waitForTimeout(2500); await shot(pa, '19-joailliers', { wait: 600 });
// droits de Hugo : sélection de projets + créer des liens
await ev(pa, async () => {
  const c = await __rc.ui.svc.cloud(), m = (await c.workspaces.members())[0], ps = await c.projects.list();
  await c.workspaces.setRights(m.uid, { projects: 'selected', perms: { save: true, delete: false, createLinks: true, viewLinks: false } });
  await c.projects.access(ps.find((p) => p.name === 'Solitaire émeraude').id, m.uid, true);
  await c.projects.access(ps.find((p) => p.name === 'Alliance saphir').id, m.uid, true);
});
await ev(pa, () => __rc.ui.backoffice.go('team')); await pa.waitForTimeout(2500);
await ev(pa, () => document.querySelector('.mem-list li.clickable')?.click()); await pa.waitForTimeout(800);
await shot(pa, '20-droits-invite', { wait: 600 });
await ev(pa, () => document.querySelector('.bo-page')?.scrollTo(0, 9999)); await shot(pa, '21-droits-fonctionnalites', { wait: 500 });
await ev(pa, () => __rc.ui.backoffice.close());

// =============== 7. Hugo : ce qu'il voit ===============
await ev(pb, () => __rc.ui.openBackoffice('projects')); await pb.waitForTimeout(3000);
await shot(pb, '22-vue-invite', { wait: 600 });
await ctxB.close();

// =============== 8. Mobile ===============
console.log('Mobile');
const { ctx: ctxM, page: pm } = await newPage(`${A}?emulator`, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await login(pm, 'claire@atelier-demo.fr');
await ev(pm, () => __rc.app.viewer.setAutoRotate(false));
await shot(pm, '23-mobile-configurateur', { wait: 3000 });
await ev(pm, () => __rc.ui.openBackoffice('dashboard')); await pm.waitForTimeout(4000); await shot(pm, '24-mobile-tableau-de-bord', { wait: 600 });
await ev(pm, () => __rc.ui.backoffice.go('projects')); await pm.waitForTimeout(2500); await shot(pm, '25-mobile-projets', { wait: 600 });
await ctxM.close();

await browser.close(); await server.close();
console.log(`\n${shots.length} captures dans ${OUT}`);
