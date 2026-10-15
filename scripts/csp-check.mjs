// Vérifie que la CSP de firebase.json (Content-Security-Policy-Report-Only) ne bloquerait rien dans l'application.
// Sert dist/ avec la politique EN MODE BLOQUANT, ouvre l'application et liste les violations.
// Usage : npm run build && node scripts/csp-check.mjs   (ou `npm run build:offline` pour exercer aussi l'outil sans connexion)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { launch, collect } from '../tests/e2e/helpers.mjs';

const csp = process.env.CSP || JSON.parse(fs.readFileSync('firebase.json', 'utf8')).hosting.headers[0].headers.find((h) => h.key === 'Content-Security-Policy-Report-Only')?.value;
if (!csp) { console.error('Aucune politique Content-Security-Policy-Report-Only dans firebase.json'); process.exit(2); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.hdr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith('dist') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
  res.setHeader('Content-Security-Policy', csp);
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(5198, '127.0.0.1', r));
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const logs = collect(page);
const violations = [];
await page.exposeFunction('__csp', (v) => violations.push(v));
await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.__csp(`${e.violatedDirective} ← ${e.blockedURI} (${e.sourceFile || 'page'}:${e.lineNumber || 0})`)));
await page.goto('http://127.0.0.1:5198/');
await page.waitForTimeout(8000);
console.log('Violations :', violations.length ? '\n  ' + violations.join('\n  ') : 'aucune');
await browser.close(); server.close();
process.exit(violations.length ? 1 : 0);
