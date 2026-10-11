// Marque blanche : charge themes/<THEME>/theme.json et l'injecte dans l'application.
//  - module virtuel `virtual:theme` (config + logos SVG en ligne + polices),
//  - <title>, description, theme-color du index.html,
//  - manifest.webmanifest et icônes de l'app générés depuis le thème.
// Choix du thème : variable d'environnement THEME (défaut « domuse »), ex. `THEME=autre-joaillerie npm run build`.
import fs from 'node:fs';
import path from 'node:path';

const VID = 'virtual:theme';
const RID = '\0' + VID;

export function loadTheme(id = process.env.THEME || 'domuse', root = process.cwd()) {
  const dir = path.resolve(root, 'themes', id);
  const file = path.join(dir, 'theme.json');
  if (!fs.existsSync(file)) throw new Error(`Thème introuvable : themes/${id}/theme.json`);
  const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
  const logos = {};
  for (const [k, f] of Object.entries(theme.logos || {})) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) logos[k] = fs.readFileSync(p, 'utf8').replace(/<\?xml[^>]*>/, '').trim();
  }
  return { dir, theme, logos };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function manifestOf(theme) {
  const light = theme.colors.light;
  return {
    name: theme.pwa?.name || theme.brand.name,
    short_name: theme.pwa?.shortName || theme.brand.name,
    description: theme.brand.description,
    start_url: './', scope: './', display: 'standalone', orientation: 'any',
    background_color: light.bg, theme_color: light.bg, lang: 'fr',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

export default function themePlugin() {
  const { dir, theme, logos } = loadTheme();
  const icons = ['icon-180.png', 'icon-192.png', 'icon-512.png'];
  const iconPath = (n) => path.join(dir, 'icons', n);
  return {
    name: 'white-label-theme',
    resolveId(id) { return id === VID ? RID : null; },
    load(id) {
      if (id !== RID) return null;
      const fonts = (theme.fonts?.packages || []).map((p) => `import ${JSON.stringify(p)};`).join('\n');
      return `${fonts}\nexport default ${JSON.stringify({ ...theme, logoSvg: logos })};`;
    },
    transformIndexHtml(html) {
      const b = theme.brand;
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(b.name)}</title>`)
        .replace(/(name="description" content=")[^"]*/, `$1${esc(b.description)}`)
        .replace(/(name="apple-mobile-web-app-title" content=")[^"]*/, `$1${esc(b.name)}`)
        .replace(/(name="theme-color" content=")[^"]*/, `$1${theme.colors.light.bg}`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const u = (req.url || '').split('?')[0];
        if (u.endsWith('/manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json');
          return res.end(JSON.stringify(manifestOf(theme)));
        }
        const n = icons.find((i) => u.endsWith('/icons/' + i));
        if (n && fs.existsSync(iconPath(n))) { res.setHeader('Content-Type', 'image/png'); return fs.createReadStream(iconPath(n)).pipe(res); }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifestOf(theme), null, 2) });
      for (const n of icons) if (fs.existsSync(iconPath(n))) this.emitFile({ type: 'asset', fileName: `icons/${n}`, source: fs.readFileSync(iconPath(n)) });
    },
  };
}
