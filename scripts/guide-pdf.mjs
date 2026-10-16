// Génère docs/Guide-Domuse.pdf (A4, avec les captures) à partir de docs/GUIDE.md : à remettre à quelqu'un qui n'a pas accès au dépôt.
// Les passages destinés aux développeurs (note sur la régénération des captures, section 10) sont retirés.
// Usage : npm run guide:pdf
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { launch } from '../tests/e2e/helpers.mjs';

const DOCS = path.resolve('docs');
const OUT = path.join(DOCS, 'Guide-Domuse.pdf');
let md = fs.readFileSync(path.join(DOCS, 'GUIDE.md'), 'utf8');

// version « lecteur » : sans la note de génération, sans la section développeurs
md = md.replace(/^> Les captures de ce guide[^\n]*\n\n/m, '');
md = md.replace(/^\d+\. \[Pour les développeurs\][^\n]*\n/m, '');
const dev = md.indexOf('## 10. Pour les développeurs');
if (dev >= 0) md = md.slice(0, dev).replace(/\n---\s*$/, '\n');

// ancres de style GitHub (« 4. Envoyer… » → #4-envoyer…), pour que le sommaire fonctionne dans le PDF
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N} \-]/gu, '').trim().replace(/ /g, '-');
marked.use({ renderer: { heading(text, level) { return `<h${level} id="${slug(text)}">${text}</h${level}>\n`; } } });
const body = marked.parse(md, { gfm: true });
const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="${pathToFileURL(DOCS + '/').href}">
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root { --ink: #2a1a20; --muted: #6b5a60; --accent: #6e1f3a; --line: #e6dde0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.5pt/1.55 -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: var(--ink); }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border-left: 4px solid var(--accent); padding-left: 14mm; }
  .cover h1 { font: 300 40pt/1.1 Georgia, 'Times New Roman', serif; margin: 0 0 6mm; color: var(--accent); letter-spacing: .01em; }
  .cover p { margin: 0 0 3mm; font-size: 13pt; color: var(--muted); max-width: 130mm; }
  .cover small { margin-top: 18mm; color: var(--muted); font-size: 9.5pt; }
  h1 { font: 400 22pt/1.2 Georgia, serif; color: var(--accent); margin: 0 0 4mm; }
  h2 { font: 400 17pt/1.25 Georgia, serif; color: var(--accent); margin: 9mm 0 3mm; padding-top: 3mm; border-top: 1px solid var(--line); break-after: avoid; }
  h3 { font: 600 12pt/1.3 -apple-system, Helvetica, sans-serif; margin: 6mm 0 2mm; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: var(--accent); text-decoration: none; }
  blockquote { margin: 3mm 0; padding: 2mm 4mm; border-left: 3px solid var(--accent); background: #faf5f6; color: var(--muted); }
  hr { display: none; }
  img { display: block; max-width: 100%; height: auto; margin: 3mm auto; border: 1px solid var(--line); border-radius: 3px; break-inside: avoid; }
  p:has(> img:only-child) { break-inside: avoid; text-align: center; margin: 3mm 0; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0; break-inside: avoid; }
  th, td { border: 1px solid var(--line); padding: 2mm; vertical-align: top; text-align: center; }
  th { background: #faf5f6; font-weight: 600; }
  td img { margin: 0 auto; }
  code { font: 9.5pt ui-monospace, Menlo, monospace; background: #f4eef0; padding: 0 1.5mm; border-radius: 2px; }
  ul, ol { padding-left: 6mm; } li { margin: 1mm 0; }
  .toc-title { font: 400 17pt Georgia, serif; color: var(--accent); margin: 0 0 3mm; }
</style></head><body>
<section class="cover"><h1>Guide Domuse</h1>
<p>Configurer une bague en 3D, l'envoyer à un client, suivre ses consultations et travailler à plusieurs dans un même atelier.</p>
<small>Version du ${date}</small></section>
${body}
</body></html>`;

const browser = await launch();
const page = await browser.newPage();
const TMP = path.join(DOCS, '.guide-pdf.tmp.html');
fs.writeFileSync(TMP, html); // fichier réel : une page about:blank ne peut pas charger les images locales
await page.goto(pathToFileURL(TMP).href, { waitUntil: 'load' });
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
await page.pdf({
  path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font:8pt Helvetica,Arial,sans-serif;color:#8a7a80;text-align:center">Guide Domuse · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
});
await browser.close();
if (!process.env.KEEP) fs.rmSync(TMP, { force: true });
console.log(`${OUT} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} Mo)`);
