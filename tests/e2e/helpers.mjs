// Utilitaires E2E : serveur Vite (HTTP) + Chromium headless (WebGL logiciel SwiftShader).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

// Chromium à utiliser : PW_CHROMIUM si fourni, sinon le premier navigateur préinstallé trouvé (environnements cloud), sinon celui de Playwright.
// Le lien /opt/pw-browsers/chromium suit la version installée ; l'ancien chemin versionné reste en repli.
const CANDIDATES = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];
export const CHROMIUM = CANDIDATES.find((p) => p && fs.existsSync(p));

export async function startServer(port = 5199) {
  process.env.E2E = '1';
  const server = await createServer({ mode: 'offline', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
  return { server, url: `http://127.0.0.1:${port}/` };
}

// Le rendu WebGL logiciel (SwiftShader) est bien plus lent sur un runner CI à 2 cœurs : délais d'actions (captures, attentes) relevés.
const ACTION_TIMEOUT = process.env.CI ? 180000 : 30000;

export async function launch(extraArgs = []) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', ...extraArgs],
  });
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => { const ctx = await newContext(options); ctx.setDefaultTimeout(ACTION_TIMEOUT); return ctx; };
  return browser;
}

export function collect(page) {
  const logs = { errors: [], warnings: [] };
  page.on('pageerror', (e) => logs.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const txt = m.text();
    if (m.type() === 'error' && !/Failed to load resource|GPU stall|favicon/.test(txt)) logs.errors.push(txt);
    if (m.type() === 'warning' && !/GPU stall|Orthographic|THREE\.FBXLoader|swiftshader/i.test(txt)) logs.warnings.push(txt);
  });
  return logs;
}

export async function waitModel(page, timeout = 120000) {
  await page.waitForFunction(() => window.__rc?.app?.model && !document.querySelector('.progress:not([hidden])'), null, { timeout });
  await page.waitForTimeout(600);
}
