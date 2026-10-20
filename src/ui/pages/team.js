// Page « Joailliers » : l'équipe de l'atelier, ses invitations, et la visibilité de chaque projet pour les joailliers invités.
// Propriétaire : inviter, retirer, choisir quels projets sont visibles. Membre : voir l'équipe, quitter l'atelier.
import { t } from '../i18n.js';
import { displayName } from '../../cloud/name.js';
import { memberStats, initials } from '../../cloud/dashboardStats.js';
import { openInviteDialog } from '../atelier.js';
import { esc, fill, fmtDate, ago, chip, ICONS } from './util.js';
import { resolveRights, canSeeProject, RIGHT_KEYS } from '../../cloud/rights.js';

export async function mount(ctx) {
  const { ui, cloud, el } = ctx;
  const w = cloud.workspaces, me = cloud.auth.user, meName = displayName(me);
  const S = { loading: true, error: false, members: [], invites: [], projects: [], owner: null, sel: ctx.params?.uid || null };

  async function load() {
    const own = w.isOwn;
    try {
      const [members, projects, invites, list] = await Promise.all([w.members(), cloud.projects.list(), own ? w.invites.list() : [], own ? [] : w.list()]);
      S.members = memberStats(members, projects); S.projects = projects; S.invites = invites; S.error = false;
      S.owner = own ? { uid: me.uid, name: meName, email: me.email } : { uid: w.active, name: list.find((o) => o.owner === w.active)?.name || '…', email: '' };
    } catch (e) { console.warn('Équipe indisponible', e); S.error = true; }
    S.loading = false; render(); ctx.refreshMenu();
  }

  const avatar = (name) => `<span class="avatar" aria-hidden="true">${esc(initials(name))}</span>`;
  const memberRow = (m) => `<li data-uid="${esc(m.uid)}" ${w.isOwn ? 'class="clickable" data-a="manage"' : ''}>${avatar(m.name || m.email)}
      <span class="txt"><b>${esc(m.name || m.email)}</b><small>${esc(m.email)}${m.joined ? ' · ' + esc(fill(t('joinedOn'), { date: fmtDate(m.joined) })) : ''}</small>
        <small>${m.made ? esc(fill(t('tProjectsBy'), { n: m.made, when: ago(m.last) })) : esc(t('tNoProjectYet'))}</small></span>
      ${w.isOwn ? `<button class="icon-btn" data-a="manage" aria-label="${esc(fill(t('tManage'), { name: m.name || m.email }))}" title="${esc(t('tManageShort'))}">${ICONS.chevron}</button>` : ''}</li>`;
  const inviteRow = (i) => `<li class="pending" data-token="${esc(i.token)}">${avatar(i.email || '?')}
      <span class="txt"><b>${esc(i.email || t('invitePending'))}</b><small>${esc(t('invitePending'))} · ${esc(fill(t('inviteExpires'), { n: Math.max(1, Math.ceil((i.expires - Date.now()) / 86400000)) }))}</small></span>
      <button class="btn small" data-a="copyinvite">${esc(t('copyLink'))}</button><button class="icon-btn" data-a="revoke" aria-label="${esc(t('inviteRevoke'))}" title="${esc(t('inviteRevoke'))}">✕</button></li>`;

  // ---------------- fiche d'un joaillier : accès aux projets un par un + fonctionnalités ----------------
  const PERMS = [['save', 'rSave', 'rSaveSub'], ['delete', 'rDelete', 'rDeleteSub'], ['createLinks', 'rCreateLinks', 'rCreateLinksSub'], ['viewLinks', 'rViewLinks', 'rViewLinksSub']];
  const sw = (on, label, attrs = '') => `<button class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${attrs}><i></i></button>`;
  function renderMember(m) {
    const r = resolveRights(m), act = S.projects.filter((p) => !p.archived), n = act.filter((p) => canSeeProject(p, m.uid, r)).length;
    const seg = (k, label) => `<button type="button" data-a="mode" data-k="${k}" aria-pressed="${r.projects === k}">${esc(label)}</button>`;
    const pr = (p) => {
      const granted = (p.sharedWith || []).includes(m.uid), general = r.projects === 'all' && !p.private; // accès par la visibilité générale : non modifiable ici
      const state = general ? t('rViaGeneral') : granted ? t('rGranted') : p.private ? t('pPrivate') : t('rNotGranted');
      return `<li data-id="${esc(p.id)}">${p.thumb ? `<img src="${p.thumb}" alt="" width="44" height="44" loading="lazy">` : '<span class="ph"></span>'}
        <span class="txt"><b>${esc(p.name)}</b><small>${esc(state)}</small></span>
        ${sw(general || granted, fill(t('rAccessTo'), { project: p.name, name: m.name || m.email }), `data-a="grant"${general ? ' disabled' : ''}`)}</li>`;
    };
    return `<div class="bo-body bo-member">
      <div class="bo-backrow"><button class="btn small" data-a="back">← ${esc(t('pgTeam'))}</button></div>
      <header class="mem-head">${avatar(m.name || m.email)}<span class="txt"><b>${esc(m.name || m.email)}</b><small>${esc(m.email)}${m.joined ? ' · ' + esc(fill(t('joinedOn'), { date: fmtDate(m.joined) })) : ''}</small></span></header>
      <section class="bo-sec"><h3 class="dr-t">${esc(t('rProjects'))}<span class="dr-n">${n}/${act.length}</span></h3>
        <div class="seg-pair" role="group" aria-label="${esc(t('rProjects'))}">${seg('all', t('rModeAll'))}${seg('selected', t('rModeSelected'))}</div>
        ${act.length ? `<ul class="vis-list">${act.map(pr).join('')}</ul>` : `<p class="proj-empty">${esc(t('pEmpty'))}</p>`}</section>
      <section class="bo-sec"><h3 class="dr-t">${esc(t('rFeatures'))}</h3>
        <ul class="vis-list perm-list">${PERMS.map(([k, label, sub]) => `<li data-k="${k}"><span class="txt"><b>${esc(t(label))}</b><small>${esc(t(sub))}</small></span>${sw(r[k], t(label), 'data-a="perm"')}</li>`).join('')}</ul></section>
      <section class="bo-sec"><button class="btn wide danger" data-a="remove">${ICONS.trash}${esc(t('removeMember'))}</button></section></div>`;
  }

  function render() {
    if (S.sel && w.isOwn && !S.loading && !S.error) {
      const m = S.members.find((x) => x.uid === S.sel);
      if (m) { el.innerHTML = renderMember(m); return; }
      S.sel = null; ctx.setBack(null);
    }
    if (S.loading) { el.innerHTML = `<div class="bo-body"><p class="muted">${esc(t('loading'))}</p></div>`; return; }
    if (S.error) { el.innerHTML = `<div class="bo-body"><p class="proj-empty">${esc(t('linksError'))}</p></div>`; return; }
    const own = w.isOwn, act = S.projects.filter((p) => !p.archived), priv = act.filter((p) => p.private);
    const ownerRow = `<li class="me">${avatar(S.owner.name)}<span class="txt"><b>${esc(S.owner.name)}</b><small>${esc(own ? t('tYouOwner') : t('tOwner'))}</small></span>${chip('on', t('roleOwner'))}</li>`;
    if (!own) {
      el.innerHTML = `<div class="bo-body"><p class="bo-banner">${esc(fill(t('inWorkshopOf'), { name: S.owner.name }))}</p>
        <section class="bo-sec"><h3 class="dr-t">${t('pgTeam')}<span class="dr-n">${S.members.length + 1}</span></h3>
          <ul class="mem-list rich">${ownerRow}${S.members.map(memberRow).join('')}</ul></section>
        <section class="bo-sec"><button class="btn wide" data-a="leave">${esc(t('leaveWs'))}</button></section></div>`;
      return;
    }
    el.innerHTML = `<div class="bo-body">
      <div class="bo-tiles">${[[S.members.length, t('tMembers')], [S.invites.length, t('tPending')], [act.length - priv.length, t('tVisible')], [priv.length, t('tPrivate')]].map(([n, l]) => `<div class="tile"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <section class="bo-sec"><h3 class="dr-t">${t('pgTeam')}<span class="dr-n">${S.members.length + 1}</span></h3>
        <ul class="mem-list rich">${ownerRow}${S.members.map(memberRow).join('')}${S.invites.map(inviteRow).join('')}</ul>
        ${!S.members.length && !S.invites.length ? `<p class="proj-empty">${esc(t('noMembers'))}</p>` : ''}
        <button class="btn wide" data-a="invite">${ICONS.plus}${esc(t('inviteBtn'))}</button></section>
      <section class="bo-sec"><h3 class="dr-t">${t('tVisibilityTitle')}<span class="dr-n">${act.length - priv.length}/${act.length}</span></h3>
        ${act.length ? `<div class="bo-bulk"><button class="btn small" data-a="allvisible">${esc(t('tAllVisible'))}</button><button class="btn small" data-a="allprivate">${esc(t('tAllPrivate'))}</button></div>
        <ul class="vis-list">${act.map((p) => `<li data-id="${esc(p.id)}">${p.thumb ? `<img src="${p.thumb}" alt="" width="44" height="44" loading="lazy">` : '<span class="ph"></span>'}
          <span class="txt"><b>${esc(p.name)}</b><small>${esc(ago(p.updated))}</small></span>
          <button class="switch" role="switch" aria-checked="${!p.private}" data-a="toggle" aria-label="${esc(fill(t('tVisibleFor'), { name: p.name }))}"><i></i></button>
          <span class="vis-l">${esc(p.private ? t('pPrivate') : t('tShared'))}</span></li>`).join('')}</ul>` : `<p class="proj-empty">${esc(t('pEmpty'))}</p>`}
      </section></div>`;
  }

  async function act(fn, ok) { try { await fn(); if (ok) ui.toast(ok); await load(); } catch (e) { console.warn(e); ui.toast(t('errorGeneric')); await load(); } }
  const onClick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, row = b.closest('[data-uid],[data-token],[data-id],[data-k]');
    if (a === 'invite') openInviteDialog(ui, cloud, () => load());
    else if (a === 'manage') { S.sel = row.dataset.uid; ctx.setBack(() => { S.sel = null; ctx.setBack(null); render(); }); render(); el.closest('.bo-page')?.scrollTo?.(0, 0); }
    else if (a === 'back') { S.sel = null; ctx.setBack(null); render(); }
    else if (a === 'mode' || a === 'perm' || a === 'grant') {
      const m = S.members.find((x) => x.uid === S.sel); if (!m || b.disabled) return;
      try {
        if (a === 'mode') { m.projects = b.dataset.k; await w.setRights(m.uid, { projects: m.projects }); }
        else if (a === 'perm') { const r = resolveRights(m), k = row.dataset.k; m.perms = { ...r, [k]: !r[k] }; await w.setRights(m.uid, { perms: m.perms }); }
        else { const p = S.projects.find((x) => x.id === row.dataset.id), on = !(p.sharedWith || []).includes(m.uid); p.sharedWith = on ? [...(p.sharedWith || []), m.uid] : (p.sharedWith || []).filter((x) => x !== m.uid); await cloud.projects.access(p.id, m.uid, on); }
        render(); ui.toast(t('rSaved'), 1400);
      } catch (err) { console.warn(err); ui.toast(t('errorGeneric')); await load(); }
    }
    else if (a === 'remove') { const m = S.members.find((x) => x.uid === (S.sel || row.dataset.uid)); const uid = m?.uid; if (S.sel) { S.sel = null; ctx.setBack(null); } if (m) { S.members = S.members.filter((x) => x.uid !== uid); render(); ui.undoToast(t('tRemoved'), async () => { try { await w.removeMember(uid); } catch (err) { console.warn(err); ui.toast(t('errorGeneric')); } load(); }, load); } }
    else if (a === 'revoke') act(() => w.invites.revoke(row.dataset.token));
    else if (a === 'copyinvite') { const { inviteUrl } = await import('../../state/store.js'); try { await navigator.clipboard.writeText(inviteUrl(row.dataset.token)); ui.toast(t('linkCopied')); } catch { ui.toast(inviteUrl(row.dataset.token), 8000); } }
    else if (a === 'toggle') { const p = S.projects.find((x) => x.id === row.dataset.id); act(() => cloud.projects.update(p.id, { private: !p.private })); }
    else if (a === 'allvisible' || a === 'allprivate') { const want = a === 'allprivate'; act(async () => { for (const p of S.projects.filter((x) => !x.archived && x.private !== want)) await cloud.projects.update(p.id, { private: want }); }, want ? t('tNowAllPrivate') : t('tNowAllVisible')); }
    else if (a === 'leave') { if (confirm(fill(t('leaveWsAsk'), { name: S.owner.name }))) { await w.leave(w.active); ui.svc.projectId = null; ui.toast(t('tLeft')); ctx.go('team'); } }
  };
  el.addEventListener('click', onClick);
  ctx.setBack(null);
  render();
  await load();
  return { destroy() { el.removeEventListener('click', onClick); } };
}
