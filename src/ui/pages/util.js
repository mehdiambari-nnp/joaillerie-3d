// Utilitaires communs aux pages du backoffice : échappement, dates relatives, icônes, pastilles.
import { t, LANG } from '../i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
export const loc = () => (LANG === 'en' ? 'en' : 'fr');
export const fmtDate = (ms) => new Date(ms).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (ms) => new Date(ms).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** « il y a 2 h », « hier »… (Intl.RelativeTimeFormat). */
export function ago(ms, now = Date.now()) {
  const s = Math.round((now - ms) / 1000), rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  if (s < 60) return rtf.format(0, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 30 * 86400) return rtf.format(-Math.round(s / 86400), 'day');
  return fmtDate(ms);
}
export const DEVICE = () => ({ mobile: t('devMobile'), tablet: t('devTablet'), desktop: t('devDesktop') });
export const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;

const ic = (p) => `<svg class="i" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICONS = {
  dashboard: ic('<rect x="3.5" y="3.5" width="7" height="8.5" rx="1"/><rect x="13.5" y="3.5" width="7" height="5" rx="1"/><rect x="13.5" y="11.5" width="7" height="9" rx="1"/><rect x="3.5" y="15" width="7" height="5.5" rx="1"/>'),
  projects: ic('<path d="M3.5 8.2 12 4l8.5 4.2L12 12.4 3.5 8.2Z"/><path d="m3.5 12.2 8.5 4.2 8.5-4.2"/><path d="m3.5 16.2 8.5 4.2 8.5-4.2"/>'),
  links: ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'),
  team: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.5 0 4.5 1.7 4.5 4.5"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  upload: ic('<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3.5h16V16"/>'),
  search: ic('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>'),
  more: ic('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
  eye: ic('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: ic('<path d="M3 3l18 18"/><path d="M10.6 5.7A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.4 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4-1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>'),
  archive: ic('<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>'),
  copy: ic('<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  trash: ic('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>'),
  pencil: ic('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/>'),
  logout: ic('<path d="M10 4.5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h4"/><path d="M15 8l4 4-4 4M19 12H9"/>'),
  chevron: ic('<path d="m9 6 6 6-6 6"/>'),
  spark: ic('<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
};
