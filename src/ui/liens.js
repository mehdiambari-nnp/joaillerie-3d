// Backoffice « Liens clients » : le joaillier suit les liens qu'il a envoyés (consultations, temps passé, essayages, appareil),
// les désactive / réactive, les modifie (nom, note, expiration, configuration) ou les supprime.
// Panneau plein écran au-dessus de l'outil ; reçoit l'instance `ui` (dialogues, notifications) et le service cloud.
import { t, LANG } from './i18n.js';
import { summarize, perDay, linkStatus, fmtDuration } from '../cloud/linkStats.js';
import { linkUrl } from '../cloud/links.js';
import { qrDataUrl } from '../ar/ar.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const loc = () => (LANG === 'en' ? 'en' : 'fr');
const fmtDate = (ms) => new Date(ms).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (ms) => new Date(ms).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ago = (ms) => {
  const s = Math.round((Date.now() - ms) / 1000), rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  if (s < 60) return rtf.format(0, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
};
const dayInput = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '');
const DEVICE = () => ({ mobile: t('devMobile'), tablet: t('devTablet'), desktop: t('devDesktop') });

export async function openLinks(ui, cloud, { onChange } = {}) {
  if (!cloud.links) return;
  const prevFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = 'bo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('linksTitle'));
  ui.root.append(el);
  document.documentElement.classList.add('has-bo');
  const S = { links: [], views: {}, filter: 'all', open: null, loading: true, error: false };

  const close = () => { document.removeEventListener('keydown', onKey); el.remove(); document.documentElement.classList.remove('has-bo'); prevFocus?.focus?.(); onChange?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { if (S.open) { S.open = null; render(); } else close(); } };
  document.addEventListener('keydown', onKey);

  const stat = (l) => summarize(S.views[l.id] || []);
  const statusChip = (l) => { const s = linkStatus(l); return `<span class="chip ${s}">${t('link_' + s)}</span>`; };
  const interestChip = (sm) => (sm.interest === 'none' ? '' : `<span class="chip int-${sm.interest}">${t('interest_' + sm.interest)}</span>`);
  const name = (l) => l.label || l.modelName || t('linkUnnamed');

  async function load() {
    S.loading = true; S.error = false; render();
    try { const [links, views] = await Promise.all([cloud.links.list(), cloud.links.views()]); S.links = links; S.views = views; }
    catch (e) { console.warn('Liens indisponibles', e); S.error = true; }
    S.loading = false; render();
  }

  // ---------------- liste ----------------
  function renderList() {
    const all = S.links, now = Date.now(), d30 = now - 30 * 86400000;
    const act = all.filter((l) => linkStatus(l) === 'active'), off = all.filter((l) => linkStatus(l) !== 'active');
    const v30 = Object.values(S.views).flat().filter((v) => v.at >= d30);
    const sec = v30.reduce((a, v) => a + (v.seconds || 0), 0), tryon = v30.reduce((a, v) => a + (v.tryon || 0), 0);
    const shown = S.filter === 'active' ? act : S.filter === 'off' ? off : all;
    const tiles = [[act.length, t('tileActive')], [v30.length, t('tileViews30')], [v30.length ? fmtDuration(sec / v30.length) : '—', t('tileAvgTime')], [tryon, t('tileTryon30')]];
    const card = (l) => {
      const sm = stat(l);
      return `<li class="card" data-id="${esc(l.id)}"><button type="button" data-a="open">
        ${l.thumb ? `<img src="${l.thumb}" alt="" width="64" height="64">` : '<span class="ph"></span>'}
        <span class="txt"><b>${esc(name(l))}</b>
          <small>${esc(fill(t('createdOn'), { date: fmtDate(l.created) }))}</small>
          <small class="line">${sm.views ? `${esc(fill(t('nViews'), { n: sm.views }))} · ${esc(fmtDuration(sm.seconds))} · ${esc(fill(t('lastSeen'), { when: ago(sm.last) }))}` : esc(t('neverOpened'))}</small></span>
        <span class="chips">${statusChip(l)}${interestChip(sm)}</span></button></li>`;
    };
    return `<header class="bo-h"><h2>${t('linksTitle')}</h2><button class="icon-btn" data-a="close" aria-label="${esc(t('close'))}">✕</button></header>
      <div class="bo-body">
        <div class="bo-tiles">${tiles.map(([n, l]) => `<div class="tile"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
        <div class="bo-tabs" role="tablist">${[['all', t('tabAll'), all.length], ['active', t('tabActive'), act.length], ['off', t('tabOff'), off.length]].map(([k, l, n]) => `<button type="button" role="tab" data-a="filter" data-k="${k}" aria-selected="${S.filter === k}">${esc(l)} <i>${n}</i></button>`).join('')}</div>
        ${S.error ? `<p class="proj-empty">${t('linksError')}</p>` : shown.length ? `<ul class="bo-list">${shown.map(card).join('')}</ul>` : `<p class="proj-empty">${all.length ? t('linksNoneHere') : t('linksEmpty')}</p>`}
        <p class="bo-note">${t('linksPrivacy')}</p>
      </div>`;
  }

  // ---------------- détail ----------------
  function renderDetail(l) {
    const views = S.views[l.id] || [], sm = summarize(views), st = linkStatus(l), url = linkUrl(l.id);
    const days = perDay(views, 14), max = Math.max(1, ...days.map((d) => d.n));
    const kv = [
      [sm.views, t('kViews')], [sm.visitors, t('kVisitors')], [fmtDuration(sm.seconds), t('kTotalTime')], [sm.views ? fmtDuration(sm.avgSeconds) : '—', t('kAvgTime')],
      [sm.views ? `${sm.opened}/${sm.views}` : '—', t('kOpened')], [sm.tryon, t('kTryon')], [sm.photo, t('kPhoto')], [sm.views ? (DEVICE()[sm.device] || '—') : '—', t('kDevice') + (sm.views && sm.browser ? ' · ' + sm.browser : '')],
    ];
    const rows = views.slice(0, 100).map((v) => `<tr><td>${esc(fmtDateTime(v.at))}</td><td>${esc(fmtDuration(v.seconds))}</td><td>${esc(DEVICE()[v.device] || '')} · ${esc(v.browser || '')}${v.os ? ' · ' + esc(v.os) : ''}</td>
      <td>${[v.opened ? t('actOpened') : '', v.tryon ? fill(t('actTryon'), { n: v.tryon }) : '', v.photo ? fill(t('actPhoto'), { n: v.photo }) : ''].filter(Boolean).map(esc).join(' · ') || '—'}</td></tr>`).join('');
    return `<header class="bo-h"><button class="icon-btn" data-a="back" aria-label="${esc(t('boBack'))}">←</button><h2>${esc(name(l))}</h2>${statusChip(l)}</header>
      <div class="bo-body" data-id="${esc(l.id)}">
        <section class="bo-sec bo-top">
          ${l.thumb ? `<img src="${l.thumb}" alt="" width="88" height="88">` : ''}
          <div><p class="muted">${esc(fill(t('createdOn'), { date: fmtDate(l.created) }))}${l.expires ? ` · ${esc(fill(t('expiresOn'), { date: fmtDate(l.expires) }))}` : ''}</p>
            ${interestChip(sm) ? `<p>${interestChip(sm)}</p>` : ''}
            ${l.note ? `<p class="bo-notetxt">${esc(l.note)}</p>` : ''}</div>
        </section>
        <section class="bo-sec"><h3 class="dr-t">${t('linkUrl')}</h3>
          <input type="url" readonly value="${esc(url)}" data-r="url" aria-label="${esc(t('linkUrl'))}">
          <div class="row"><button class="btn primary" data-a="copy">${t('copyLink')}</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${t('openLink')}</a><button class="btn" data-a="qr">QR</button></div>
          <img class="qr" alt="QR" width="160" height="160" hidden></section>
        <section class="bo-sec"><h3 class="dr-t">${t('statsTitle')}</h3>
          <div class="bo-kv">${kv.map(([v, k]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
          ${sm.first ? `<p class="muted tiny">${esc(fill(t('firstLast'), { first: fmtDateTime(sm.first), last: fmtDateTime(sm.last) }))}</p>` : ''}
          <div class="bo-chart" aria-label="${esc(t('chart14'))}">${days.map((d) => `<i style="height:${Math.round((d.n / max) * 100)}%" title="${esc(fmtDate(d.t))} : ${d.n}"></i>`).join('')}</div>
          <p class="muted tiny">${t('chart14')}</p></section>
        <section class="bo-sec"><h3 class="dr-t">${t('actionsTitle')}</h3>
          <div class="col">
            <button class="btn wide" data-a="toggle">${st === 'active' ? t('linkDisable') : t('linkEnable')}</button>
            <button class="btn wide" data-a="refresh">${t('linkRefresh')}</button>
            <button class="btn wide danger" data-a="delete">${t('linkDelete')}</button></div>
          <p class="muted tiny">${t('linkRefreshNote')}</p></section>
        <section class="bo-sec"><h3 class="dr-t">${t('editTitle')}</h3>
          <form class="auth bo-edit" novalidate>
            <label class="fld"><span>${t('linkLabel')}</span><input type="text" name="label" maxlength="120" value="${esc(l.label || '')}"></label>
            <label class="fld"><span>${t('linkNote')}</span><textarea name="note" maxlength="1000" rows="3">${esc(l.note || '')}</textarea></label>
            <label class="fld"><span>${t('linkExpiry')}</span><input type="date" name="expires" value="${esc(dayInput(l.expires))}"></label>
            <button class="btn primary wide" type="submit">${t('boSave')}</button></form></section>
        <section class="bo-sec"><h3 class="dr-t">${t('historyTitle')}<span class="dr-n">${views.length}</span></h3>
          ${views.length ? `<div class="bo-table"><table><thead><tr><th>${t('hDate')}</th><th>${t('hDuration')}</th><th>${t('hDevice')}</th><th>${t('hActions')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="proj-empty">${t('neverOpened')}</p>`}</section>
      </div>`;
  }

  function render() {
    const cur = S.open && S.links.find((l) => l.id === S.open);
    if (S.open && !cur && !S.loading) S.open = null;
    el.innerHTML = S.loading && !S.links.length ? `<header class="bo-h"><h2>${t('linksTitle')}</h2><button class="icon-btn" data-a="close" aria-label="${esc(t('close'))}">✕</button></header><div class="bo-body"><p class="muted">${t('loading')}</p></div>` : (cur ? renderDetail(cur) : renderList());
    el.querySelector('.bo-body')?.scrollTo?.(0, 0);
  }

  // ---------------- actions ----------------
  const idOf = (n) => n.closest('[data-id]')?.dataset.id;
  async function act(fn, ok) { try { await fn(); if (ok) ui.toast(ok); await load(); } catch (e) { console.warn(e); ui.toast(t('errorGeneric')); } }
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, id = S.open || idOf(b), l = S.links.find((x) => x.id === id);
    if (a === 'close') close();
    else if (a === 'back') { S.open = null; render(); }
    else if (a === 'open') { S.open = idOf(b); render(); }
    else if (a === 'filter') { S.filter = b.dataset.k; render(); }
    else if (a === 'copy') { try { await navigator.clipboard.writeText(linkUrl(id)); ui.toast(t('linkCopied')); } catch { el.querySelector('[data-r=url]')?.select(); } }
    else if (a === 'qr') { const img = el.querySelector('img.qr'); if (img.hidden) { img.hidden = false; qrDataUrl(linkUrl(id)).then((u) => { img.src = u; }).catch(() => {}); } else img.hidden = true; }
    else if (a === 'toggle' && l) act(() => cloud.links.update(id, { enabled: linkStatus(l) !== 'active' ? true : false }), linkStatus(l) === 'active' ? t('linkDisabledOk') : t('linkEnabledOk'));
    else if (a === 'delete' && l) { if (confirm(fill(t('linkDeleteAsk'), { name: name(l) }))) { S.open = null; act(() => cloud.links.remove(id), t('linkDeletedOk')); } }
    else if (a === 'refresh' && l) { if (confirm(t('linkRefreshAsk'))) act(async () => { await cloud.links.update(id, { json: await ui.clientPayloadJson() }); }, t('linkRefreshedOk')); }
  });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, id = S.open, d = f.expires.value ? new Date(f.expires.value + 'T23:59:59').getTime() : null;
    act(() => cloud.links.update(id, { label: f.label.value, note: f.note.value, expires: d }), t('boSaved'));
  });

  render();
  await load();
  return { close, reload: load };
}
