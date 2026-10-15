// Interface des ateliers partagés : sélecteur d'atelier, joailliers invités, invitation, acceptation d'un lien.
// Fonctions séparées de ui.js (qui les appelle) : elles reçoivent l'instance `ui` pour ses dialogues et notifications.
import { t } from './i18n.js';
import { displayName } from '../cloud/name.js';
import { INVITE_TTL } from '../cloud/workspaces.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const days = (ms) => Math.max(1, Math.ceil((ms - Date.now()) / 86400000));

/** Blocs du tiroir « Mes projets » : sélecteur d'atelier (en haut) et joailliers / atelier partagé (en bas). Vide hors Firebase. */
export async function workspaceBlocks(cloud) {
  const w = cloud.workspaces;
  if (!w || !cloud.auth.user) return { top: '', bottom: '' };
  let list = [], members = [], invites = [];
  try { await w.validate(); list = await w.list(); } catch (e) { console.warn('Ateliers indisponibles', e); }
  const own = w.isOwn, cur = list.find((o) => o.owner === w.active);
  let top = '';
  if (list.length > 1) {
    top = `<section class="dr-sec dr-ws"><h3 class="dr-t">${t('workshop')}</h3>
      <select data-r="ws" aria-label="${esc(t('workshop'))}">${list.map((o) => `<option value="${esc(o.owner)}"${o.owner === w.active ? ' selected' : ''}>${o.self ? esc(t('myWorkshop')) : esc(fill(t('workshopOf'), { name: o.name || '…' }))}</option>`).join('')}</select></section>`;
  }
  let bottom = '';
  if (own) {
    try { [members, invites] = await Promise.all([w.members(), w.invites.list()]); } catch (e) { console.warn('Joailliers indisponibles', e); }
    const memberRows = members.map((m) => `<li data-uid="${esc(m.uid)}"><span><b>${esc(m.name || m.email)}</b><small>${esc(m.email)}</small></span>
        <button class="icon-btn" data-a="ws-remove" aria-label="${esc(t('removeMember'))}" title="${esc(t('removeMember'))}">✕</button></li>`).join('');
    const inviteRows = invites.map((i) => `<li class="pending" data-token="${esc(i.token)}"><span><b>${esc(i.email || t('invitePending'))}</b><small>${esc(t('invitePending'))} · ${esc(fill(t('inviteExpires'), { n: days(i.expires) }))}</small></span>
        <button class="btn small" data-a="ws-copy">${t('copyLink')}</button>
        <button class="icon-btn" data-a="ws-revoke" aria-label="${esc(t('inviteRevoke'))}" title="${esc(t('inviteRevoke'))}">✕</button></li>`).join('');
    bottom = `<section class="dr-sec"><h3 class="dr-t">${t('jewelers')}<span class="dr-n">${members.length}</span></h3>
      ${!members.length && !invites.length ? `<p class="proj-empty">${t('noMembers')}</p>` : ''}
      <ul class="mem-list">${memberRows}${inviteRows}</ul>
      <button class="btn wide" data-a="ws-invite">${t('inviteBtn')}</button></section>`;
  } else {
    bottom = `<section class="dr-sec"><h3 class="dr-t">${t('sharedWorkshop')}</h3>
      <p class="dr-note">${esc(fill(t('inWorkshopOf'), { name: cur?.name || '…' }))}</p>
      <button class="btn wide" data-a="ws-leave">${t('leaveWs')}</button></section>`;
  }
  return { top, bottom };
}

/** Dialogue d'invitation : e-mail facultatif (repère) → lien à usage unique à copier ou à envoyer par e-mail. */
export function openInviteDialog(ui, cloud, onDone) {
  const form = ui.html(`<p class="muted">${t('inviteLead')}</p>
    <form class="auth" novalidate><label class="fld"><span>${t('inviteEmail')}</span><input type="email" name="email" autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false"></label>
    <p class="auth-err" role="alert" hidden></p>
    <button class="btn primary wide" type="submit">${t('inviteCreate')}</button></form>`);
  const f = form.querySelector('form'), err = form.querySelector('.auth-err');
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      const { url } = await cloud.workspaces.invites.create(f.email.value);
      const me = displayName({ name: cloud.auth.user.name, email: cloud.auth.user.email });
      const mail = `mailto:${encodeURIComponent(f.email.value.trim())}?subject=${encodeURIComponent(fill(t('inviteMailSubject'), { app: t('app') }))}&body=${encodeURIComponent(fill(t('inviteMailBody'), { owner: me, app: t('app'), url }))}`;
      const done = ui.html(`<p class="muted">${t('inviteLinkNote')}</p>
        <input type="url" readonly value="${esc(url)}" data-r="inviteurl" aria-label="${esc(t('inviteBtn'))}">
        <div class="row"><button class="btn primary" data-s="copy">${t('copyLink')}</button><a class="btn" href="${esc(mail)}">${t('inviteMail')}</a>${navigator.share ? `<button class="btn" data-s="native">${t('share')}…</button>` : ''}</div>`);
      done.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-s]'); if (!b) return;
        if (b.dataset.s === 'copy') { try { await navigator.clipboard.writeText(url); ui.toast(t('linkCopied')); } catch { done.querySelector('[data-r=inviteurl]').select(); } }
        if (b.dataset.s === 'native') { try { await navigator.share({ url, title: t('app') }); } catch { /* annulé */ } }
      });
      ui.openDialog(t('inviteTitle'), done);
      onDone?.();
    } catch (ex) { console.warn(ex); err.textContent = t('inviteError'); err.hidden = false; btn.disabled = false; }
  });
  ui.openDialog(t('inviteTitle'), form);
  setTimeout(() => f.email.focus(), 50);
}

/** Lien d'invitation ouvert : après connexion, propose de rejoindre l'atelier. `onJoined` rafraîchit l'interface. */
export async function joinFlow(ui, cloud, token, onJoined) {
  const clear = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignoré */ } };
  const w = cloud.workspaces;
  if (!w || !cloud.auth.user) return;
  let info = null;
  try { info = await w.invites.info(token); } catch (e) { console.warn(e); }
  if (!info || !info.valid) { clear(); ui.toast(t('joinInvalid'), 6000); return; }
  if (info.mine) { clear(); ui.toast(t('joinOwn'), 6000); return; }
  const d = ui.html(`<p>${esc(fill(t('joinLead'), { name: info.ownerName || info.ownerEmail || '…' }))}</p>
    <div class="row"><button class="btn primary" data-s="join">${t('joinBtn')}</button><button class="btn" data-s="later">${t('joinLater')}</button></div>
    <p class="auth-err" role="alert" hidden></p>`);
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'later') { ui.dlg.close(); return; }
    b.disabled = true;
    try {
      const r = await w.invites.accept(token);
      clear(); ui.dlg.close();
      ui.toast(fill(t('joinDone'), { name: r.ownerName || '…' }), 5000);
      onJoined?.();
    } catch (ex) { console.warn(ex); const er = d.querySelector('.auth-err'); er.textContent = t('joinInvalid'); er.hidden = false; b.disabled = false; }
  });
  ui.openDialog(t('joinTitle'), d);
}

export { INVITE_TTL };
