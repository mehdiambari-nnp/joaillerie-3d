// Menu burger : navigation épurée vers les pages du backoffice (Tableau de bord, Projets, Liens clients, Joailliers), accès rapide à
// « Enregistrer la bague », sélecteur d'atelier (si l'on en a rejoint) et compte. Les pastilles de comptage se remplissent en arrière-plan.
import { t } from './i18n.js';
import { displayName } from '../cloud/name.js';
import { linkStatus } from '../cloud/linkStats.js';
import { ICONS, esc, fill } from './pages/util.js';
import { OWNER_RIGHTS } from '../cloud/rights.js';

let counts = null; // dernier comptage connu (affiché tout de suite à la réouverture)

export async function renderMenu(ui) {
  const dr = ui.root.querySelector('[data-r=drawer]'); if (!dr) return;
  const cloud = await ui.svc.cloud(), fb = !!cloud.links, user = cloud.auth.enabled ? cloud.auth.user : null;
  const w = cloud.workspaces;
  let wsBlock = '';
  if (w && user) {
    try {
      const list = await w.list(); await w.validate();
      if (list.length > 1) wsBlock = `<div class="menu-ws"><select data-r="ws" aria-label="${esc(t('workshop'))}">${list.map((o) => `<option value="${esc(o.owner)}"${o.owner === w.active ? ' selected' : ''}>${o.self ? esc(t('myWorkshop')) : esc(fill(t('workshopOf'), { name: o.name || '…' }))}</option>`).join('')}</select></div>`;
    } catch (e) { console.warn('Ateliers indisponibles', e); }
  }
  const rights = ui.rights = await (w?.rights?.() ?? Promise.resolve(OWNER_RIGHTS)).catch(() => OWNER_RIGHTS);
  const items = fb ? [['dashboard', 'pgDashboard'], ['projects', 'pgProjects'], ...(rights.createLinks || rights.viewLinks ? [['links', 'pgLinks']] : []), ['team', 'pgTeam']] : [['projects', 'pgProjects']];
  const badge = (k) => (counts && counts[k] != null ? `<i data-r="n-${k}">${counts[k]}</i>` : `<i data-r="n-${k}" hidden></i>`);
  dr.innerHTML = `<div class="dr-h"><h2>${esc(t('menu'))}</h2><button class="icon-btn" data-a="projects-close" aria-label="${esc(t('close'))}">✕</button></div>
    ${wsBlock}
    ${ui.app.model && rights.save ? `<button class="btn primary wide menu-save" data-a="menu-save">${ICONS.plus}${esc(t('pSaveCurrent'))}</button>` : ''}
    <nav class="menu-nav" aria-label="${esc(t('menu'))}">${items.map(([k, key]) => `<button type="button" data-a="menu-nav" data-tab="${k}">${ICONS[k]}<span>${esc(t(key))}</span>${badge(k)}</button>`).join('')}</nav>
    ${user ? `<footer class="dr-foot"><p class="dr-who"><span>${esc(displayName(user))}</span><small title="${esc(user.email || '')}">${esc(user.email || '')}</small></p>
      <button class="btn wide" data-a="signout">${ICONS.logout}${esc(t('signOut'))}</button></footer>` : ''}`;
  if (fb && user) refreshCounts(ui, cloud).then(() => { for (const [k, v] of Object.entries(counts || {})) { const n = dr.querySelector(`[data-r=n-${k}]`); if (n && v != null) { n.textContent = v; n.hidden = false; } } });
  else if (!fb) cloud.projects.list().then((l) => { const n = dr.querySelector('[data-r=n-projects]'); if (n) { n.textContent = l.filter((p) => !p.archived).length; n.hidden = false; } }).catch(() => {});
}

async function refreshCounts(ui, cloud) {
  const [projects, links, members] = await Promise.all([cloud.projects.list().catch(() => null), (ui.rights?.createLinks || ui.rights?.viewLinks) ? cloud.links.list().catch(() => null) : null, cloud.workspaces.members().catch(() => null)]);
  counts = {
    dashboard: null,
    projects: projects ? projects.filter((p) => !p.archived).length : null,
    links: links ? links.filter((l) => linkStatus(l) === 'active').length : null,
    team: members ? members.length + 1 : null,
  };
}

/** Dialogue « Enregistrer la bague » : nom du projet ; mise à jour du projet ouvert ou enregistrement en nouveau projet. */
export function openSaveDialog(ui, onDone) {
  const app = ui.app, s = ui.svc;
  if (!app.model || !s.last) return;
  const def = (app.model.meta.fileName || t('projectDefault')).replace(/\.[^.]+$/, '');
  const open = !!s.projectId;
  const d = ui.html(`<form class="auth" novalidate>
      <label class="fld"><span>${esc(t('projectName'))}</span><input type="text" name="name" maxlength="60" value="${esc(open ? s.projectName || def : '')}" placeholder="${esc(open ? '' : t('projectNameHint'))}" autocomplete="off"></label>
      <div class="col">${open ? `<button class="btn primary wide" type="submit" data-s="update">${esc(t('projectUpdate'))}</button><button class="btn wide" type="button" data-s="new">${esc(t('projectSaveNew'))}</button>` : `<button class="btn primary wide" type="submit" data-s="new">${esc(t('projectSave'))}</button>`}</div></form>`);
  const f = d.querySelector('form');
  const go = async (asNew) => { f.querySelectorAll('button').forEach((b) => { b.disabled = true; }); ui.dlg.close(); await ui.saveCurrentProject(asNew, f.name.value.trim() || def); onDone?.(); };
  f.addEventListener('submit', (e) => { e.preventDefault(); go(!open); });
  f.querySelector('[data-s=new]')?.addEventListener('click', (e) => { if (e.target.type === 'button') go(true); });
  ui.openDialog(t('currentRing'), d);
  setTimeout(() => f.name.focus(), 60);
}
