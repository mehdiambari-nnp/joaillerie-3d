import { describe, it, expect } from 'vitest';
import { deviceInfo, summarize, linkStatus, perDay, fmtDuration } from '../../src/cloud/linkStats.js';
import { trackedLinkRef } from '../../src/state/store.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';

describe('deviceInfo (gros grain, sans donnée personnelle)', () => {
  it('iPhone / Safari', () => expect(deviceInfo(IPHONE, 'fr-FR')).toEqual({ device: 'mobile', os: 'iOS', browser: 'Safari', lang: 'fr-FR' }));
  it('iPad = tablette', () => expect(deviceInfo(IPAD).device).toBe('tablet'));
  it('Mac / Chrome = ordinateur', () => expect(deviceInfo(MAC_CHROME)).toMatchObject({ device: 'desktop', os: 'macOS', browser: 'Chrome' }));
  it('Windows / Edge', () => expect(deviceInfo(WIN_EDGE)).toMatchObject({ device: 'desktop', os: 'Windows', browser: 'Edge' }));
  it('Android téléphone / Chrome', () => expect(deviceInfo(ANDROID_PHONE)).toMatchObject({ device: 'mobile', os: 'Android', browser: 'Chrome' }));
  it('Chrome iOS reconnu', () => expect(deviceInfo(IOS_CHROME)).toMatchObject({ os: 'iOS', browser: 'Chrome' }));
  it('inconnu : valeurs sûres', () => expect(deviceInfo('', '')).toEqual({ device: 'desktop', os: 'Autre', browser: 'Autre', lang: '' }));
  it('ne renvoie que des valeurs acceptées par les règles (appareil, longueurs)', () => {
    for (const ua of [IPHONE, IPAD, MAC_CHROME, WIN_EDGE, ANDROID_PHONE, IOS_CHROME, '']) {
      const d = deviceInfo(ua, 'fr-FR-xxxxxxxxxxxxx');
      expect(['mobile', 'tablet', 'desktop']).toContain(d.device);
      expect(d.os.length).toBeLessThanOrEqual(20); expect(d.browser.length).toBeLessThanOrEqual(20); expect(d.lang.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('linkStatus', () => {
  const now = 1_000_000;
  it('actif par défaut', () => expect(linkStatus({ enabled: true, expires: null }, now)).toBe('active'));
  it('désactivé prime', () => expect(linkStatus({ enabled: false, expires: now + 10 }, now)).toBe('disabled'));
  it('expiré', () => expect(linkStatus({ enabled: true, expires: now - 1 }, now)).toBe('expired'));
  it('pas encore expiré', () => expect(linkStatus({ enabled: true, expires: now + 1 }, now)).toBe('active'));
});

describe('summarize', () => {
  const v = (x) => ({ uid: 'a', at: 1000, last: 2000, seconds: 0, opened: false, tryon: 0, photo: 0, taps: 0, device: 'mobile', browser: 'Safari', os: 'iOS', ...x });
  it('aucune consultation', () => expect(summarize([])).toMatchObject({ views: 0, visitors: 0, seconds: 0, avgSeconds: 0, first: null, last: null, interest: 'none', device: null }));
  it('agrège temps, actions, visiteurs distincts, première / dernière', () => {
    const s = summarize([v({ uid: 'a', at: 1000, last: 1500, seconds: 60, opened: true }), v({ uid: 'b', at: 5000, last: 9000, seconds: 120, tryon: 1, photo: 2, device: 'desktop' }), v({ uid: 'a', at: 3000, last: 3500, seconds: 30 })]);
    expect(s).toMatchObject({ views: 3, visitors: 2, seconds: 210, avgSeconds: 70, opened: 1, triedOn: 1, tryon: 1, photo: 2, first: 1000, last: 9000, device: 'mobile' });
  });
  it('l\'intérêt monte avec l\'essayage et les retours', () => {
    expect(summarize([v({ seconds: 5 })]).interest).toBe('low');
    expect(summarize([v({ seconds: 90, opened: true }), v({ seconds: 90 }), v({ seconds: 90 })]).interest).toBe('medium');
    expect(summarize([v({ seconds: 200, tryon: 2, photo: 1 })]).interest).toBe('high');
  });
});

describe('perDay', () => {
  it('place les consultations dans les bons jours (14 jours, le plus ancien d\'abord)', () => {
    const now = new Date(2026, 9, 16, 15, 0).getTime(), day = 86400000;
    const out = perDay([{ at: now }, { at: now - 1000 }, { at: now - day }, { at: now - 30 * day }], 14, now);
    expect(out).toHaveLength(14); expect(out.at(-1).n).toBe(2); expect(out.at(-2).n).toBe(1); expect(out.reduce((a, d) => a + d.n, 0)).toBe(3);
  });
});

describe('fmtDuration', () => {
  it('secondes, minutes, heures', () => { expect(fmtDuration(42)).toBe('42 s'); expect(fmtDuration(185)).toBe('3 min 05'); expect(fmtDuration(4320)).toBe('1 h 12'); expect(fmtDuration(null)).toBe('0 s'); });
});

describe('lien suivi (#l=)', () => {
  const ID = '0123456789abcdef0123';
  it('lit l\'identifiant de 20 caractères hexadécimaux', () => { expect(trackedLinkRef(`#l=${ID}`)).toBe(ID); expect(trackedLinkRef(`#x=1&l=${ID}`)).toBe(ID); });
  it('refuse trop court / long / non hexadécimal, et ne se confond pas avec #s= #c= #i=', () => {
    expect(trackedLinkRef('#l=abc')).toBeNull(); expect(trackedLinkRef(`#l=${ID}0`)).toBeNull(); expect(trackedLinkRef('#l=' + 'z'.repeat(20))).toBeNull();
    expect(trackedLinkRef('#s=6de04034be8f')).toBeNull(); expect(trackedLinkRef('')).toBeNull();
  });
});
