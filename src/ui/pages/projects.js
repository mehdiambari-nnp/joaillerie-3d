// Page « Projets » : tous les projets de l'atelier en cartes (vignette 3/4), recherche, tri, filtres (actifs / privés / archivés),
// et pour chacun : ouvrir, renommer, dupliquer, rendre privé (invisible des joailliers invités), archiver, supprimer.
import { t } from '../i18n.js';
import { displayName } from '../../cloud/name.js';
import { esc, fill, fmtDate, ago, chip, ICONS } from './util.js';

export async function mount(ctx) {
  const { ui, cloud, el } = ctx;
  const w = cloud.workspaces, team = !!w;                         // Firebase : atelier, visibilité
  const R = ctx.rights;
  const own = !w || w.isOwn;                                      // seul le propriétaire gère la visibilité
  const me = cloud.auth.user, myName = me ? displayName(me) : '';
  const S = { list: [], q: '', filter: 'active', sort: 'recent', menu: null, edit: null, loading: true, error: false, wsName: '' };

  async function load() {
    try {
      S.list = await cloud.projects.list();
      if (team && !own) S.wsName = (await w.list()).find((o) => o.owner === w.active)?.name || '';
    } catch (e) { console.warn('Projets indisponibles', e); S.error = true; }
    S.loading = false; render(); ctx.refreshMenu();
  }

  const isActive = (p) => !p.archived;
  const filtered = () => {
    const q = S.q.trim().toLowerCase();
    let l = S.list.filter((p) => (S.filter === 'archived' ? p.archived : S.filter === 'private' ? p.private && !p.archived : isActive(p)));
    if (q) l = l.filter((p) => `${p.name} ${p.modelName || ''} ${p.by || ''}`.toLowerCase().includes(q));
    return l.sort((a, b) => (S.sort === 'name' ? a.name.localeCompare(b.name) : (b.updated || 0) - (a.updated || 0)));
  };

  const card = (p) => {
    const open = ui.svc.projectId === p.id, mine = !p.by || p.by === myName;
    const chips = [p.private ? chip('priv', t('pPrivate')) : '', p.archived ? chip('arch', t('pArchived')) : '', open ? chip('on', t('pOpen')) : ''].join('');
    const menu = `<ul class="pmenu" role="menu" ${S.menu === p.id ? '' : 'hidden'}>
        ${R.save ? `<li><button data-a="rename">${ICONS.pencil}${t('pRename')}</button></li>
        <li><button data-a="duplicate">${ICONS.copy}${t('pDuplicate')}</button></li>` : ''}
        ${team && own ? `<li><button data-a="visibility">${p.private ? ICONS.eye + t('pMakeVisible') : ICONS.eyeOff + t('pMakePrivate')}</button></li>` : ''}
        ${R.save ? `<li><button data-a="archive">${ICONS.archive}${p.archived ? t('pUnarchive') : t('pArchive')}</button></li>` : ''}
        ${R.delete ? `<li><button data-a="delete" class="danger">${ICONS.trash}${t('delete')}</button></li>` : ''}</ul>`;
    return `<li class="pcard${p.archived ? ' is-archived' : ''}" data-id="${esc(p.id)}">
      <button class="pthumb" data-a="open" aria-label="${esc(fill(t('pOpenNamed'), { name: p.name }))}">${p.thumb ? `<img src="${p.thumb}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span class="pchips">${chips}</span></button>
      <div class="pmeta">
        ${S.edit === p.id ? `<input class="prename" type="text" maxlength="120" value="${esc(p.name)}" aria-label="${esc(t('projectName'))}">` : `<b title="${esc(p.name)}">${esc(p.name)}</b>`}
        <small>${esc(ago(p.updated))}${p.modelName ? ' · ' + esc(p.modelName) : ''}${!mine ? ' · ' + esc(p.by) : ''}</small></div>
      <div class="pbar"><button class="btn small primary" data-a="open">${t('pOpenBtn')}</button><button class="icon-btn" data-a="menu" aria-label="${esc(t('pMore'))}" aria-haspopup="menu" aria-expanded="${S.menu === p.id}">${ICONS.more}</button></div>${menu}</li>`;
  };

  function render() {
    if (S.loading) { el.innerHTML = `<div class="bo-body"><p class="muted">${esc(t('loading'))}</p></div>`; return; }
    const active = S.list.filter(isActive), priv = S.list.filter((p) => p.private && !p.archived), arch = S.list.filter((p) => p.archived);
    const shown = filtered();
    const tabs = [['active', t('pfActive'), active.length], ...(team && own ? [['private', t('pfPrivate'), priv.length]] : []), ['archived', t('pfArchived'), arch.length]];
    const empty = S.q ? t('pNoMatch') : S.filter === 'archived' ? t('pEmptyArchived') : S.filter === 'private' ? t('pEmptyPrivate') : t('pEmpty');
    el.innerHTML = `<div class="bo-body">
      ${team && !own ? `<p class="bo-banner">${esc(fill(t('inWorkshopOf'), { name: S.wsName || '…' }))}</p>` : ''}
      <div class="bo-toolbar">
        <label class="bo-search">${ICONS.search}<input type="search" data-r="q" value="${esc(S.q)}" placeholder="${esc(t('pSearch'))}" aria-label="${esc(t('pSearch'))}"></label>
        <select data-r="sort" aria-label="${esc(t('pSort'))}"><option value="recent"${S.sort === 'recent' ? ' selected' : ''}>${t('pSortRecent')}</option><option value="name"${S.sort === 'name' ? ' selected' : ''}>${t('pSortName')}</option></select>
        ${R.save ? `<button class="btn primary" data-a="new">${ICONS.plus}${t('pNew')}</button>` : ''}${ui.app.model && R.save ? `<button class="btn" data-a="save">${t('pSaveCurrent')}</button>` : ''}
      </div>
      <div class="bo-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-a="filter" data-k="${k}" aria-selected="${S.filter === k}">${esc(l)} <i>${n}</i></button>`).join('')}</div>
      ${S.error ? `<p class="proj-empty">${esc(t('projectsUnavailable'))}</p>` : shown.length ? `<ul class="pgrid">${shown.map(card).join('')}</ul>` : `<p class="proj-empty">${esc(empty)}</p>`}
    </div>`;
    if (S.edit) { const i = el.querySelector('.prename'); i?.focus(); i?.select(); }
  }

  const idOf = (n) => n.closest('[data-id]')?.dataset.id;
  async function act(fn, ok) { try { await fn(); if (ok) ui.toast(ok); await load(); } catch (e) { console.warn(e); ui.toast(t('errorGeneric')); S.menu = null; render(); } }

  const onClick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) { if (S.menu && !e.target.closest('.pmenu')) { S.menu = null; render(); } return; }
    const a = b.dataset.a, id = idOf(b), p = S.list.find((x) => x.id === id);
    if (a === 'filter') { S.filter = b.dataset.k; S.menu = null; render(); }
    else if (a === 'save') ui.openSaveDialog(() => load());
    else if (a === 'new') ui.openNewProject(() => ctx.go('projects'))
    else if (a === 'menu') { S.menu = S.menu === id ? null : id; render(); }
    else if (a === 'open') { const ok = await ui.svc.openProject?.(id); if (ok) ctx.close(); }
    else if (a === 'rename') { S.edit = id; S.menu = null; render(); }
    else if (a === 'duplicate' && p) { S.menu = null; act(() => cloud.projects.duplicate(id, fill(t('pCopyName'), { name: p.name })), t('pDuplicated')); }
    else if (a === 'visibility' && p) { S.menu = null; act(() => cloud.projects.update(id, { private: !p.private }), p.private ? t('pNowVisible') : t('pNowPrivate')); }
    else if (a === 'archive' && p) { S.menu = null; act(() => cloud.projects.update(id, { archived: !p.archived }), p.archived ? t('pUnarchived') : t('pArchivedOk')); }
    else if (a === 'delete' && p) { S.menu = null; S.list = S.list.filter((x) => x.id !== id); render(); ui.undoToast(t('pDeleted'), async () => { try { await cloud.projects.remove(id); if (ui.svc.projectId === id) ui.svc.projectId = null; } catch (err) { console.warn(err); ui.toast(t('errorGeneric')); } load(); }, load); }
  };
  const onInput = (e) => {
    if (e.target.matches('[data-r=q]')) { S.q = e.target.value; const pos = e.target.selectionStart; render(); const i = el.querySelector('[data-r=q]'); i.focus(); i.setSelectionRange(pos, pos); }
  };
  const onChange = (e) => { if (e.target.matches('[data-r=sort]')) { S.sort = e.target.value; render(); } };
  const onKey = (e) => {
    if (!e.target.matches('.prename')) return;
    const id = idOf(e.target);
    if (e.key === 'Escape') { e.stopPropagation(); S.edit = null; render(); }
    else if (e.key === 'Enter') { const name = e.target.value.trim(); S.edit = null; if (name && name !== S.list.find((x) => x.id === id)?.name) act(() => cloud.projects.update(id, { name }), t('pRenamed')); else render(); }
  };
  el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onChange); el.addEventListener('keydown', onKey);
  ctx.setBack(null);
  render();
  await load();
  return { destroy() { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onChange); el.removeEventListener('keydown', onKey); } };
}
