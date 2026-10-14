// Utilitaires E2E : serveur Vite (HTTP) + Chromium headless (WebGL logiciel SwiftShader).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

export const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

export async function startServer(port = 5199) {
  process.env.E2E = '1';
  const server = await createServer({ mode: 'local', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
  return { server, url: `http://127.0.0.1:${port}/` };
}

export async function launch(extraArgs = []) {
  return chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', ...extraArgs],
  });
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
