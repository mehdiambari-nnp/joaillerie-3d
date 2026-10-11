// Marque blanche : applique le thème du client (themes/<client>/theme.json, choisi au build avec THEME=…).
// Injecte les palettes clair/sombre et les polices comme variables CSS. À importer avant style.css.
import theme from 'virtual:theme';

export default theme;

const V = { bg: 'bg', surface: 'surface', surface2: 'surface-2', ink: 'ink', muted: 'muted', line: 'line', accent: 'accent',
  accentInk: 'accent-ink', focus: 'focus', danger: 'danger', stageA: 'stage-a', stageB: 'stage-b', shadow: 'shadow' };
const decl = (c) => Object.entries(V).filter(([k]) => c[k] != null).map(([k, n]) => `--${n}: ${c[k]};`).join(' ');

export function themeCSS(th = theme) {
  const f = th.fonts || {};
  const { light, dark } = th.colors;
  return `:root { ${decl(light)} --serif: ${f.display || f.sans}; --sans: ${f.sans}; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${decl(dark)} color-scheme: dark; } }
:root[data-theme='dark'] { ${decl(dark)} color-scheme: dark; }`;
}

if (typeof document !== 'undefined') {
  const st = document.createElement('style');
  st.id = 'theme-vars';
  const h = theme.header || {};
  st.textContent = themeCSS() + `\n:root { --logo-h: ${h.logoHeightPx || 22}px; --logo-h-client: ${h.logoHeightClientPx || 28}px; }`;
  document.head.appendChild(st);
}

/** Balise du logo d'en-tête (SVG en ligne, prend la couleur du texte) ; repli : nom de la marque en texte. */
export function brandHTML(fallbackMark = '') {
  const h = theme.header || {};
  const svg = theme.logoSvg?.[h.logo];
  const tag = h.showTagline && theme.brand.tagline ? `<span class="sub">${theme.brand.tagline}</span>` : '';
  if (svg) return `<span class="logo" role="img" aria-label="${theme.brand.name}">${svg}</span>${tag}`;
  return `${fallbackMark}<span class="name">${theme.brand.name}</span>${tag}`;
}
