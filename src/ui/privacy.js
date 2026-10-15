// Information du client sur la mesure d'audience anonyme d'un lien suivi : bandeau discret visible dès l'ouverture (écrin compris),
// page « en savoir plus » et refus possible à tout moment. Texte à faire valider par votre conseil (RGPD / cookies).
import theme from '../config/theme.js';
import { t } from './i18n.js';
import { trackingRefused, setTrackingRefused } from '../cloud/optout.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function openPrivacy(ui) {
  const body = () => `<p>${esc(t('privP1').replace('{brand}', theme.brand.name))}</p>
    <p>${esc(t('privP2'))}</p><p>${esc(t('privP3'))}</p><p>${esc(t('privP4'))}</p><p>${esc(t('privP5'))}</p>
    <p class="muted tiny"><b>${esc(trackingRefused() ? t('privOff') : t('privActive'))}</b></p>
    <div class="row"><button class="btn primary" data-s="toggle">${esc(trackingRefused() ? t('privAccept') : t('privRefuse'))}</button><button class="btn" data-s="close">${esc(t('close'))}</button></div>`;
  const d = ui.html(body());
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'close') { ui.dlg.close(); return; }
    setTrackingRefused(!trackingRefused()); d.innerHTML = body();
  });
  ui.openDialog(t('privTitle'), d);
}

/** Bandeau fixe (haut de l'écran) : mention courte + « En savoir plus ». */
export function showPrivacyBar(ui) {
  const bar = document.createElement('div');
  bar.className = 'privacy-bar'; bar.setAttribute('role', 'note');
  const render = () => { bar.innerHTML = `<span>${esc(trackingRefused() ? t('privOff') : t('privShort'))}</span> <button type="button" class="link">${esc(t('privMore'))}</button>`; };
  bar.addEventListener('click', (e) => { if (e.target.closest('button')) openPrivacy(ui); });
  window.addEventListener('rc:optout', render);
  render();
  ui.root.append(bar);
}
