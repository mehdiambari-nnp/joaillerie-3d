// Page affichée au client quand son lien n'est plus utilisable (désactivé, expiré ou supprimé par le joaillier).
import theme, { brandHTML } from '../config/theme.js';
import { t } from './i18n.js';

export function showLinkOff(root, reason = 'missing') {
  const el = document.createElement('main');
  el.className = 'login in';
  el.innerHTML = `
    <div class="login-mark" aria-hidden="true">${theme.logoSvg?.monogram || ''}</div>
    <section class="login-card" aria-labelledby="off-h">
      <div class="login-brand">${brandHTML()}</div>
      <p class="login-eyebrow">${theme.brand.tagline || ''}</p>
      <h1 id="off-h">${t('linkOffTitle')}</h1>
      <p class="login-lead">${t('linkOff_' + reason)}</p>
    </section>`;
  root.replaceChildren(el);
}
