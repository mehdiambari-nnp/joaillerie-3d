// Backoffice du joaillier : panneau plein écran à onglets (Tableau de bord, Projets, Liens clients, Joailliers).
// Les pages sont chargées à la demande (src/ui/pages/*.js) et reçoivent un contexte { ui, cloud, el, params, go, close, reload, setBack }.
// Hors Firebase (mode local) : un seul onglet, Projets.
import { t } from './i18n.js';
import { ICONS, esc } from './pages/util.js';

const PAGES = {
  dashboard: () => import('./pages/dashboard.js'),
  projects: () => import('./pages/projects.js'),
  links: () => import('./pages/links.js'),
  team: () => import('./pages/team.js'),
};
const TITLES = { dashboard: 'pgDashboard', projects: 'pgProjects', links: 'pgLinks', team: 'pgTeam' };

export async function openBackoffice(ui, tab = 'dashboard', params = {}) {
  if (ui.backoffice) { ui.backoffice.go(tab, params); return ui.backoffice; }
  const cloud = await ui.svc.cloud();
  const tabs = cloud.links ? ['dashboard', 'projects', 'links', 'team'] : ['projects'];
  if (!tabs.includes(tab)) tab = tabs[0];
  const prevFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = 'bo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<header class="bo-h"><h2 data-r="title"></h2><button class="icon-btn" data-a="close" aria-label="${esc(t('close'))}">✕</button></header>
    <div class="bo-page" data-r="page"></div>
    ${tabs.length > 1 ? `<nav class="bo-nav" aria-label="${esc(t('menu'))}">${tabs.map((k) => `<button type="button" data-tab="${k}">${ICONS[k === 'links' ? 'links' : k]}<span>${esc(t(TITLES[k]))}</span></button>`).join('')}</nav>` : ''}`;
  ui.root.append(el);
  document.documentElement.classList.add('has-bo');

  let cur = null, back = null, page = null, token = 0;
  const pageEl = el.querySelector('[data-r=page]');
  const api = {
    get current() { return cur; },
    async go(id, p = {}) {
      if (!tabs.includes(id)) id = tabs[0];
      const my = ++token;
      page?.destroy?.(); page = null; back = null; cur = id;
      el.querySelector('[data-r=title]').textContent = t(TITLES[id]);
      el.querySelectorAll('[data-tab]').forEach((b) => b.dataset.tab === id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
      pageEl.innerHTML = `<div class="bo-body"><p class="muted">${esc(t('loading'))}</p></div>`;
      try {
        const mod = await PAGES[id]();
        if (my !== token) return;
        pageEl.innerHTML = '';
        const ctx = { ui, cloud, el: pageEl, params: p, go: api.go, close: api.close, reload: () => api.go(id, p), setBack: (fn) => { back = fn; }, refreshMenu: () => ui.renderMenu?.() };
        page = await mod.mount(ctx) || null;
      } catch (e) { console.warn('Page indisponible', e); if (my === token) pageEl.innerHTML = `<div class="bo-body"><p class="proj-empty">${esc(t('linksError'))}</p></div>`; }
    },
    reload() { return api.go(cur, {}); },
    close() { page?.destroy?.(); document.removeEventListener('keydown', onKey); el.remove(); document.documentElement.classList.remove('has-bo'); ui.backoffice = null; prevFocus?.focus?.(); ui.renderMenu?.(); },
  };
  const onKey = (e) => { if (e.key === 'Escape' && !ui.dlg.open) { if (back) back(); else api.close(); } };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab],[data-a=close]'); if (!b) return;
    if (b.dataset.a === 'close') api.close(); else api.go(b.dataset.tab);
  });
  ui.backoffice = api;
  await api.go(tab, params);
  return api;
}
