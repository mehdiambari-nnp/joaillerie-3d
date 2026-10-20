// Calculs du tableau de bord joaillier : comparaison hebdomadaire, clients à relancer, fil d'activité, activité des membres.
// Fonctions pures (testées) ; les données viennent de links.js, projects et workspaces.
import { summarize, linkStatus } from './linkStats.js';

const DAY = 86400000;

/** Consultations des 7 derniers jours comparées aux 7 précédents (toutes pages confondues). */
export function compareWeeks(viewsByLink = {}, now = Date.now()) {
  const all = Object.values(viewsByLink).flat();
  const cur = all.filter((v) => v.at > now - 7 * DAY), prev = all.filter((v) => v.at <= now - 7 * DAY && v.at > now - 14 * DAY);
  const sum = (a, k) => a.reduce((s, v) => s + (Number(v[k]) || 0), 0);
  const delta = (c, p) => (p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)); // null : pas de base de comparaison
  return {
    views: cur.length, viewsPrev: prev.length, viewsDelta: delta(cur.length, prev.length),
    tryon: sum(cur, 'tryon'), tryonPrev: sum(prev, 'tryon'),
    seconds: sum(cur, 'seconds'), avgSeconds: cur.length ? Math.round(sum(cur, 'seconds') / cur.length) : 0,
    visitors: new Set(cur.map((v) => v.uid)).size,
  };
}

/**
 * Liens à relancer : le client s'est montré intéressé (essayage, photo, retours, temps passé) récemment, ou le lien n'a jamais été
 * ouvert plusieurs jours après son envoi. Triés par priorité.
 */
export function hotLeads(links = [], viewsByLink = {}, now = Date.now()) {
  const out = [];
  for (const l of links) {
    if (linkStatus(l, now) !== 'active') continue;
    const views = viewsByLink[l.id] || [], sm = summarize(views);
    if (!sm.views) {
      if (now - (l.created || now) >= 3 * DAY) out.push({ link: l, sm, reason: 'unopened', score: 1 + Math.min(5, (now - l.created) / DAY) / 10 });
      continue;
    }
    const recent = now - (sm.last || 0) <= 10 * DAY;
    if (!recent) continue;
    if (sm.tryon > 0 || sm.photo > 0) out.push({ link: l, sm, reason: 'tryon', score: 100 + sm.tryon * 5 + sm.photo * 3 + sm.views });
    else if (sm.views >= 3) out.push({ link: l, sm, reason: 'returns', score: 50 + sm.views + sm.seconds / 60 });
    else if (sm.seconds >= 120) out.push({ link: l, sm, reason: 'time', score: 20 + sm.seconds / 60 });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Fil d'activité mélangé : consultations de liens, projets créés / modifiés (par un membre ou par soi), nouveaux membres, liens créés.
 * `me` : uid courant (les événements des autres joailliers sont signalés).
 */
export function activityFeed({ links = [], viewsByLink = {}, projects = [], members = [], me = null, now = Date.now(), limit = 12 } = {}) {
  const ev = [], nameOf = Object.fromEntries(links.map((l) => [l.id, l.label || l.modelName || '']));
  for (const [id, views] of Object.entries(viewsByLink)) for (const v of views) ev.push({ type: 'view', at: v.last || v.at, linkId: id, name: nameOf[id] ?? '', seconds: v.seconds || 0, tryon: v.tryon || 0, photo: v.photo || 0, opened: !!v.opened, device: v.device });
  for (const p of projects) if (p.updated) ev.push({ type: 'project', at: p.updated, id: p.id, name: p.name, by: p.by || '', byOther: !!(p.byUid && me && p.byUid !== me), isNew: !!p.created && Math.abs(p.updated - p.created) < 60000 });
  for (const m of members) if (m.joined) ev.push({ type: 'member', at: m.joined, name: m.name || m.email || '' });
  for (const l of links) if (l.created) ev.push({ type: 'link', at: l.created, name: l.label || l.modelName || '' });
  return ev.filter((e) => e.at && e.at <= now + 60000).sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Activité des membres d'après les projets qu'ils ont enregistrés : nombre et dernière modification. */
export function memberStats(members = [], projects = []) {
  return members.map((m) => {
    const mine = projects.filter((p) => p.byUid === m.uid);
    return { ...m, made: mine.length, last: mine.reduce((a, p) => Math.max(a, p.updated || 0), 0) || null };
  });
}

/** Initiales pour un avatar (« Alice Owner » → « AO »). */
export function initials(name = '') {
  const w = String(name).trim().split('@')[0].split(/[\s._-]+/).filter(Boolean); // adresse e-mail : seule la partie locale compte
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() || '·';
}
