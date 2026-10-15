import { describe, it, expect } from 'vitest';
import { compareWeeks, hotLeads, activityFeed, memberStats, initials } from '../../src/cloud/dashboardStats.js';

const DAY = 86400000, NOW = 100 * DAY;
const v = (x) => ({ uid: 'a', at: NOW - 1000, last: NOW - 500, seconds: 30, opened: true, tryon: 0, photo: 0, taps: 0, device: 'mobile', ...x });
const link = (id, x = {}) => ({ id, label: 'Lien ' + id, enabled: true, expires: null, created: NOW - 20 * DAY, ...x });

describe('compareWeeks', () => {
  it('compare 7 jours aux 7 précédents', () => {
    const byLink = { l1: [v({ at: NOW - 1 * DAY }), v({ at: NOW - 2 * DAY, tryon: 2 }), v({ at: NOW - 9 * DAY, tryon: 1 })], l2: [v({ at: NOW - 3 * DAY, uid: 'b' }), v({ at: NOW - 20 * DAY })] };
    const c = compareWeeks(byLink, NOW);
    expect(c).toMatchObject({ views: 3, viewsPrev: 1, viewsDelta: 200, tryon: 2, tryonPrev: 1, visitors: 2 });
  });
  it('sans base de comparaison : delta nul (null) ou 0', () => {
    expect(compareWeeks({ l: [v()] }, NOW).viewsDelta).toBeNull();
    expect(compareWeeks({}, NOW).viewsDelta).toBe(0);
  });
});

describe('hotLeads', () => {
  it('un essayage prime ; ordre : essayage, retours, temps passé, jamais ouvert', () => {
    const links = [link('a'), link('b'), link('c'), link('d'), link('e', { created: NOW - 1 * DAY })];
    const byLink = {
      a: [v({ tryon: 1 })],
      b: [v(), v(), v()],
      c: [v({ seconds: 200 })],
      // d : jamais ouvert depuis 20 jours ; e : jamais ouvert mais envoyé hier (trop tôt)
    };
    const r = hotLeads(links, byLink, NOW);
    expect(r.map((x) => [x.link.id, x.reason])).toEqual([['a', 'tryon'], ['b', 'returns'], ['c', 'time'], ['d', 'unopened']]);
  });
  it('ignore les liens désactivés, expirés ou consultés il y a plus de 10 jours', () => {
    const links = [link('x', { enabled: false }), link('y', { expires: NOW - 1 }), link('z')];
    const old = { z: [v({ tryon: 3, at: NOW - 30 * DAY, last: NOW - 30 * DAY })] };
    expect(hotLeads(links, { x: [v({ tryon: 1 })], y: [v({ tryon: 1 })], ...old }, NOW)).toEqual([]);
  });
});

describe('activityFeed', () => {
  it('mélange consultations, projets, membres et liens, du plus récent au plus ancien, limité', () => {
    const feed = activityFeed({
      links: [link('l1', { created: NOW - 5 * DAY })],
      viewsByLink: { l1: [v({ last: NOW - 1 * DAY, tryon: 1 })] },
      projects: [{ id: 'p1', name: 'Alliance', updated: NOW - 2 * DAY, created: NOW - 2 * DAY, by: 'Bob', byUid: 'bob' }],
      members: [{ uid: 'bob', name: 'Bob', joined: NOW - 3 * DAY }],
      me: 'alice', now: NOW, limit: 10,
    });
    expect(feed.map((e) => e.type)).toEqual(['view', 'project', 'member', 'link']);
    expect(feed[1]).toMatchObject({ byOther: true, isNew: true, by: 'Bob' });
    expect(feed[0]).toMatchObject({ name: 'Lien l1', tryon: 1 });
    expect(activityFeed({ links: [link('l1')], viewsByLink: { l1: Array.from({ length: 30 }, (_, i) => v({ last: NOW - i * 1000 })) }, now: NOW, limit: 5 })).toHaveLength(5);
  });
  it('ignore les dates futures aberrantes', () => {
    expect(activityFeed({ projects: [{ id: 'p', name: 'x', updated: NOW + 10 * DAY }], now: NOW })).toEqual([]);
  });
});

describe('memberStats / initials', () => {
  it('compte les projets et la dernière modification de chaque membre', () => {
    const r = memberStats([{ uid: 'bob' }, { uid: 'carl' }], [{ byUid: 'bob', updated: 5 }, { byUid: 'bob', updated: 9 }, { byUid: 'alice', updated: 50 }]);
    expect(r).toEqual([{ uid: 'bob', projects: 2, last: 9 }, { uid: 'carl', projects: 0, last: null }]);
  });
  it('initiales', () => { expect(initials('Alice Owner')).toBe('AO'); expect(initials('mehdi.ambari@x.fr')).toBe('MA'); expect(initials('')).toBe('·'); expect(initials('Bob')).toBe('B'); });
});
