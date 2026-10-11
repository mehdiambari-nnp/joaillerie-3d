// Génère les icônes PWA (PNG) à partir d'un SVG : node scripts/make-icons.mjs
import { launch } from '../tests/e2e/helpers.mjs';
import fs from 'node:fs';
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#8a6a22"/></linearGradient>
<linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bcd7f5"/></linearGradient></defs>
<rect width="512" height="512" fill="#1d1a16"/>
<circle cx="256" cy="316" r="112" fill="none" stroke="url(#g)" stroke-width="40"/>
<polygon points="256,60 322,128 256,196 190,128" fill="url(#d)"/>
<polygon points="190,128 256,128 256,196" fill="#9cc2ec" opacity=".7"/>
<polygon points="322,128 256,128 256,60" fill="#fff" opacity=".6"/></svg>`;
fs.mkdirSync('public/icons', { recursive: true });
const b = await launch(); const p = await b.newPage();
for (const s of [192, 512, 180]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<body style="margin:0">${svg(s)}</body>`);
  await p.screenshot({ path: `public/icons/icon-${s}.png` });
}
fs.writeFileSync('public/icons/icon.svg', svg(512));
await b.close();
