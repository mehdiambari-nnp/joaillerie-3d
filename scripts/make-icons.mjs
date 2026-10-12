// Génère les icônes de l'app (180/192/512) d'un thème : monogramme sur fond de la couleur d'accent.
// usage : node scripts/make-icons.mjs [theme]   (nécessite Chromium de Playwright)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadTheme } from '../config/vite-theme.js';

const id = process.argv[2] || 'domuse';
const { dir, theme, logos } = loadTheme(id);
const svg = logos.monogram || logos.wordmark;
if (!svg) throw new Error('Le thème doit fournir un logo « monogram ».');
const bg = theme.colors.dark.surface, fg = theme.colors.dark.ink;
fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
const exe = ['/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;background:${bg};color:${fg};display:grid;place-items:center">
    <div style="height:${Math.round(size * 0.6)}px;display:flex">${svg.replace('<svg', '<svg style="height:100%;width:auto"')}</div></body>`);
  await page.screenshot({ path: path.join(dir, 'icons', `icon-${size}.png`) });
  await page.close();
}
await browser.close();
console.log('icônes générées dans', path.join(dir, 'icons'));
