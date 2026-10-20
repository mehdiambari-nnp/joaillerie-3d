// Refus de la mesure d'audience d'un lien suivi : mémorisé sur l'appareil du visiteur (aucune dépendance Firebase : chargé par l'interface).
const KEY = 'rc:notrack';
export const trackingRefused = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export function setTrackingRefused(on) {
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch { /* stockage indisponible : le refus vaut pour la session */ }
  window.dispatchEvent(new CustomEvent('rc:optout', { detail: !!on }));
}
