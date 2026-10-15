// Statistiques d'un lien client suivi : analyse du navigateur (appareil grossier, aucune donnée personnelle), agrégats, formats.
// Fonctions pures (testées), sans Firebase.

/** Appareil / système / navigateur à gros grain, d'après le user-agent. Aucune adresse IP, aucune localisation. */
export function deviceInfo(ua = '', lang = '') {
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(ua);
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Autre';
  const browser = /EdgiOS|EdgA|Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /FxiOS|Firefox/i.test(ua) ? 'Firefox' : /CriOS|Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Autre';
  return { device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', os, browser, lang: String(lang || '').slice(0, 10) };
}

/** Statut d'un lien : actif, désactivé ou expiré. */
export function linkStatus(l, now = Date.now()) {
  if (l.enabled === false) return 'disabled';
  if (l.expires != null && l.expires <= now) return 'expired';
  return 'active';
}

/** Agrège les consultations d'un lien. `views` : documents { uid, at, last, seconds, opened, tryon, photo, taps, device, os, browser }. */
export function summarize(views = []) {
  const n = views.length;
  const sum = (k) => views.reduce((a, v) => a + (Number(v[k]) || 0), 0);
  const seconds = sum('seconds'), tryon = sum('tryon'), photo = sum('photo');
  const top = (k) => { const c = {}; for (const v of views) if (v[k]) c[v[k]] = (c[v[k]] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
  const lasts = views.map((v) => v.last || v.at || 0).filter(Boolean), firsts = views.map((v) => v.at || 0).filter(Boolean);
  const visitors = new Set(views.map((v) => v.uid)).size;
  const opened = views.filter((v) => v.opened).length;
  const triedOn = views.filter((v) => v.tryon > 0).length;
  // Intérêt (repère, pas une mesure exacte) : essayage et photo pèsent le plus, puis les retours et le temps passé
  const score = tryon * 3 + photo * 2 + Math.min(n, 5) + Math.min(seconds / 60, 5);
  return {
    views: n, visitors, seconds, avgSeconds: n ? Math.round(seconds / n) : 0, opened, triedOn, tryon, photo,
    first: firsts.length ? Math.min(...firsts) : null, last: lasts.length ? Math.max(...lasts) : null,
    device: top('device'), browser: top('browser'), os: top('os'),
    interest: n === 0 ? 'none' : score >= 10 ? 'high' : score >= 4 ? 'medium' : 'low',
  };
}

/** Consultations par jour sur les `days` derniers jours (le plus ancien en premier), pour le petit graphique. */
export function perDay(views = [], days = 14, now = Date.now()) {
  const day = 86400000, start = new Date(now); start.setHours(0, 0, 0, 0);
  const out = Array.from({ length: days }, (_, i) => ({ t: start.getTime() - (days - 1 - i) * day, n: 0 }));
  for (const v of views) { const i = Math.floor((v.at - out[0].t) / day); if (i >= 0 && i < days) out[i].n++; }
  return out;
}

/** « 42 s », « 3 min 05 », « 1 h 12 ». */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return `${m} min ${String(s).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
