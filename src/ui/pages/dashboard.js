// Tableau de bord : l'essentiel d'un coup d'œil pour le joaillier : actions rapides, indicateurs de la semaine, clients à relancer,
// activité récente (consultations, projets de l'équipe) et projets récents.
import { t } from '../i18n.js';
import { displayName } from '../../cloud/name.js';
import { linkStatus, fmtDuration, perDay } from '../../cloud/linkStats.js';
import { compareWeeks, hotLeads, activityFeed } from '../../cloud/dashboardStats.js';
import { esc, fill, loc, ago, chip, ICONS } from './util.js';

export async function mount(ctx) {
  const { ui, cloud, el } = ctx;
  const w = cloud.workspaces, me = cloud.auth.user, name = displayName(me), first = name.split(' ')[0];
  let data = null, loading = true, error = false;

  async function load() {
    try {
      const own = w.isOwn;
      const [projects, links, views, members] = await Promise.all([cloud.projects.list(), cloud.links.list(), cloud.links.views(), w.members().catch(() => [])]);
      data = { projects, links, views, members, own };
    } catch (e) { console.warn('Tableau de bord indisponible', e); error = true; }
    loading = false; render(); ctx.refreshMenu();
  }

  const delta = (d) => (d === null ? chip('up', t('dNew')) : d === 0 ? '' : chip(d > 0 ? 'up' : 'down', `${d > 0 ? '▲ +' : '▼ '}${d} %`));
  const thumbOf = (l) => (l?.thumb ? `<img src="${l.thumb}" alt="" width="44" height="44" loading="lazy">` : '<span class="ph"></span>');

  function leadText(h) {
    const sm = h.sm;
    if (h.reason === 'tryon') return fill(t('dReasonTryon'), { n: sm.tryon || sm.photo, when: ago(sm.last) });
    if (h.reason === 'returns') return fill(t('dReasonReturns'), { n: sm.views });
    if (h.reason === 'time') return fill(t('dReasonTime'), { dur: fmtDuration(sm.seconds) });
    return fill(t('dReasonUnopened'), { n: Math.floor((Date.now() - h.link.created) / 86400000) });
  }

  function eventLine(e) {
    const q = (s) => `« ${esc(s)} »`;
    if (e.type === 'view') {
      const bits = [fmtDuration(e.seconds), e.tryon ? fill(t('actTryon'), { n: e.tryon }) : '', e.photo ? fill(t('actPhoto'), { n: e.photo }) : ''].filter(Boolean).join(' · ');
      return { icon: ICONS.eye, html: `${fill(esc(t('dEvView')), { name: `<b>${esc(e.name || t('linkUnnamed'))}</b>` })}<small>${esc(bits)}</small>` };
    }
    if (e.type === 'project') return { icon: ICONS.projects, html: `${fill(esc(e.isNew ? t('dEvProjectNew') : t('dEvProjectEdit')), { who: `<b>${esc(e.byOther ? e.by : t('dYou'))}</b>`, name: `<b>${q(e.name)}</b>` })}` };
    if (e.type === 'member') return { icon: ICONS.team, html: fill(esc(t('dEvMember')), { name: `<b>${esc(e.name)}</b>` }) };
    return { icon: ICONS.links, html: fill(esc(t('dEvLink')), { name: `<b>${q(e.name || t('linkUnnamed'))}</b>` }) };
  }

  function render() {
    if (loading) { el.innerHTML = `<div class="bo-body"><p class="muted">${esc(t('loading'))}</p></div>`; return; }
    if (error) { el.innerHTML = `<div class="bo-body"><p class="proj-empty">${esc(t('linksError'))}</p></div>`; return; }
    const { projects, links, views, members, own } = data, now = Date.now();
    const act = projects.filter((p) => !p.archived), priv = act.filter((p) => p.private);
    const cw = compareWeeks(views, now), leads = hotLeads(links, views, now).slice(0, 4);
    const feed = activityFeed({ links, viewsByLink: views, projects, members, me: me.uid, now, limit: 10 });
    const activeLinks = links.filter((l) => linkStatus(l, now) === 'active');
    const days = perDay(Object.values(views).flat(), 14, now), max = Math.max(1, ...days.map((d) => d.n));
    const lead = (h) => `<li data-id="${esc(h.link.id)}"><button data-a="lead">${thumbOf(h.link)}<span class="txt"><b>${esc(h.link.label || h.link.modelName || t('linkUnnamed'))}</b><small>${esc(leadText(h))}</small></span>${ICONS.chevron}</button></li>`;
    el.innerHTML = `<div class="bo-body bo-dash">
      <section class="bo-hero"><div><h1>${esc(fill(t('dHello'), { name: first }))}</h1><p class="muted">${esc((s => s.charAt(0).toUpperCase() + s.slice(1))(new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' })))}</p></div>
        <div class="bo-quick">${ui.app.model ? `<button class="btn primary" data-a="save">${ICONS.plus}${esc(t('pSaveCurrent'))}</button>` : ''}<button class="btn" data-a="import">${ICONS.upload}${esc(t('dImport'))}</button>${ui.app.model ? `<button class="btn" data-a="share">${ICONS.links}${esc(t('dShare'))}</button>` : ''}</div></section>
      <div class="bo-tiles five">
        <button class="tile" data-a="go-projects"><b>${act.length}</b><span>${esc(t('pgProjects'))}${own && priv.length ? ' · ' + esc(fill(t('dPrivateN'), { n: priv.length })) : ''}</span></button>
        <button class="tile" data-a="go-links"><b>${activeLinks.length}</b><span>${esc(t('tileActive'))}</span></button>
        <div class="tile"><b>${cw.views}</b><span>${esc(t('dViews7'))}</span>${delta(cw.viewsDelta)}</div>
        <div class="tile"><b>${cw.tryon}</b><span>${esc(t('dTryon7'))}</span></div>
        <div class="tile"><b>${cw.views ? fmtDuration(cw.avgSeconds) : '—'}</b><span>${esc(t('tileAvgTime'))}</span></div></div>
      <section class="bo-sec"><h3 class="dr-t">${esc(t('dFollowUp'))}</h3>
        ${leads.length ? `<ul class="lead-list">${leads.map(lead).join('')}</ul>` : `<p class="proj-empty">${esc(t('dNothingToFollow'))}</p>`}</section>
      <div class="bo-cols">
        <section class="bo-sec"><h3 class="dr-t">${esc(t('dActivity'))}</h3>
          ${feed.length ? `<ul class="feed">${feed.map((e) => { const l = eventLine(e); return `<li><span class="ficon">${l.icon}</span><span class="ftxt">${l.html}</span><time>${esc(ago(e.at, now))}</time></li>`; }).join('')}</ul>` : `<p class="proj-empty">${esc(t('dNoActivity'))}</p>`}</section>
        <section class="bo-sec"><h3 class="dr-t">${esc(t('dRecentProjects'))}</h3>
          ${act.length ? `<ul class="recent">${act.slice(0, 4).map((p) => `<li data-id="${esc(p.id)}"><button data-a="open">${p.thumb ? `<img src="${p.thumb}" alt="" loading="lazy">` : '<span class="ph"></span>'}<b>${esc(p.name)}</b><small>${esc(ago(p.updated, now))}</small></button></li>`).join('')}</ul><button class="btn wide" data-a="go-projects">${esc(t('dAllProjects'))}</button>` : `<p class="proj-empty">${esc(t('pEmpty'))}</p>`}
          ${activeLinks.length || Object.keys(views).length ? `<h3 class="dr-t" style="margin-top:26px">${esc(t('chart14'))}</h3><div class="bo-chart">${days.map((d) => `<i style="height:${Math.round((d.n / max) * 100)}%" title="${d.n}"></i>`).join('')}</div>` : ''}</section>
      </div></div>`;
  }

  const onClick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, id = b.closest('[data-id]')?.dataset.id;
    if (a === 'save') ui.openSaveDialog(() => load());
    else if (a === 'import') { ctx.close(); ui.root.querySelector('#file')?.click(); }
    else if (a === 'share') { ctx.close(); ui.openShare(); }
    else if (a === 'go-projects') ctx.go('projects');
    else if (a === 'go-links') ctx.go('links');
    else if (a === 'lead') ctx.go('links', { id });
    else if (a === 'open') { const ok = await ui.svc.openProject?.(id); if (ok) ctx.close(); }
  };
  el.addEventListener('click', onClick);
  ctx.setBack(null);
  render();
  await load();
  return { destroy() { el.removeEventListener('click', onClick); } };
}
