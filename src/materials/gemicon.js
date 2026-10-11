// Petites gemmes (taille brillant vue de dessus) en SVG, teintées d'une couleur : remplacent les pastilles rondes.
import { hexToHsl, hslToHex, validHex } from './library.js';

const cache = new Map();
const N = 8, C = 20;
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
const P = (p) => p.map((v) => v.toFixed(2)).join(',');

/** URL de données (image/svg+xml) d'une gemme de couleur `hex`. */
export function gemIconUrl(hex) {
  const h0 = validHex(hex) ? hex : '#cccccc';
  if (cache.has(h0)) return cache.get(h0);
  let [h, s, l] = hexToHsl(h0);
  const dark = l < 0.2;
  const L = (dl, ds = 0) => hslToHex(h, Math.max(0, Math.min(1, s + ds)), Math.max(0.04, Math.min(0.97, l + dl)));
  const T = Array.from({ length: N }, (_, k) => pt(8.6, k * 45));
  const S = Array.from({ length: N }, (_, k) => pt(13, k * 45 + 22.5));
  const K = Array.from({ length: N }, (_, k) => pt(21, k * 45));
  const light = -60; // lumière en haut à gauche
  const shade = (deg, bias = 0) => {
    const d = Math.cos(((deg - 90) - light) * Math.PI / 180);
    return (dark ? 0.16 : 0.34) * d + bias;
  };
  const poly = (pts, fill) => `<polygon points="${pts.map(P).join(' ')}" fill="${fill}"/>`;
  let f = '';
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N, km = (k + N - 1) % N;
    const ang = k * 45;
    f += poly([K[k], S[km], K[km]], L(shade(ang - 22.5, -0.02)));                  // facettes de ceinture
    f += poly([T[k], S[km], K[k], S[k]], L(shade(ang, 0.04)));  // cerf-volant
    f += poly([T[k], T[k1], S[k]], L(shade(ang + 22.5, 0.12), -0.04));                // étoile
  }
  const table = `<polygon points="${T.map(P).join(' ')}" fill="url(#t)"/>`;
  const edge = `<g fill="none" stroke="${L(dark ? 0.18 : -0.28)}" stroke-width=".35" stroke-opacity=".7">${T.map((t, k) => `<line x1="${t[0].toFixed(2)}" y1="${t[1].toFixed(2)}" x2="${S[k][0].toFixed(2)}" y2="${S[k][1].toFixed(2)}"/><line x1="${t[0].toFixed(2)}" y1="${t[1].toFixed(2)}" x2="${K[k][0].toFixed(2)}" y2="${K[k][1].toFixed(2)}"/>`).join('')}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs>
<radialGradient id="t" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${L(0.3, -0.05)}"/><stop offset="1" stop-color="${L(0.02)}"/></radialGradient>
<clipPath id="c"><circle cx="20" cy="20" r="19"/></clipPath>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<g clip-path="url(#c)"><rect width="40" height="40" fill="${L(0)}"/>${f}${table}${edge}<circle cx="20" cy="20" r="19" fill="url(#g)"/>
<path d="M12 10.5 15.5 8.5 17 11.5Z" fill="#fff" fill-opacity=".75"/><circle cx="26.5" cy="26" r="1.1" fill="#fff" fill-opacity=".5"/></g>
<circle cx="20" cy="20" r="19" fill="none" stroke="${L(-0.3)}" stroke-opacity=".55" stroke-width="1"/></svg>`;
  const url = `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
  cache.set(h0, url);
  return url;
}
