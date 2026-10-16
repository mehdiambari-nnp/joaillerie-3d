// Point d'entrée LÉGER : lit le lien, applique la porte d'entrée (page de connexion), puis charge l'application (appMain.js : three.js,
// interface, essayage). La page de connexion n'embarque donc ni three.js ni MediaPipe.
import theme from './config/theme.js'; // marque blanche : polices + palettes du thème (themes/<client>/theme.json)
import './style.css';
import { t } from './ui/i18n.js';
import { parseShareHash, shortShareRef, parseShareJson, needsLogin, trackedLinkRef } from './state/store.js';
import { getCloud } from './cloud/index.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function boot() {
  if (!hasWebGL2()) { root.innerHTML = `<p style="padding:24px;font:16px system-ui">${t('webgl')}</p>`; return; }
  const hasLink = /[#&][csl]=/.test(location.hash);
  let pending = parseShareHash(location.hash); // lien long (#c=) : configuration lue sur place
  let shareFailed = false;
  const shortRef = shortShareRef(location.hash); // lien court (#s=) : configuration à récupérer sur le serveur
  if (shortRef) {
    try { pending = parseShareJson(await (await getCloud()).shares.get(shortRef)); if (!pending) throw new Error('lien illisible'); }
    catch (e) { console.warn('Lien de partage introuvable', e); shareFailed = true; } // lien introuvable : modèle par défaut, sans l'écrin
  }
  // Lien client SUIVI (#l=) : configuration lue sur le serveur ; désactivé, expiré ou supprimé : page d'information, rien d'autre.
  const trackedRef = trackedLinkRef(location.hash);
  let tracking = null;
  if (trackedRef) {
    try {
      const links = (await getCloud()).links;
      if (!links) throw new Error('liens suivis indisponibles (mode hors ligne)');
      const l = await links.open(trackedRef);
      if (!l || !l.enabled || l.expired) { (await import('./ui/linkoff.js')).showLinkOff(root, !l ? 'missing' : l.expired ? 'expired' : 'disabled'); return; }
      pending = parseShareJson(l.p);
      if (!pending) throw new Error('lien illisible');
      tracking = { id: trackedRef, owner: l.owner };
    } catch (e) { console.warn('Lien suivi introuvable', e); shareFailed = true; }
  }
  // Porte d'entrée : seul un lien CLIENT valide s'ouvre sans compte. Tout le reste (adresse nue, lien joaillier, lien illisible ou modifié)
  // exige la connexion d'un joaillier (Firebase). Les liens joaillier gardent leur configuration une fois connecté.
  {
    const cloud = await getCloud();
    if (needsLogin(pending, cloud.auth.enabled)) {
      await (await import('./ui/login.js')).showLogin(root, cloud);
      cloud.auth.onChange((user) => { if (!user) location.reload(); }); // session expirée ou déconnexion : retour à la page de connexion
    }
  }
  if (import.meta.env.DEV && params.has('debug')) import('eruda').then((m) => m.default.init()); // console intégrée (iPhone sans Mac) ; absente du build publié

  await (await import('./appMain.js')).startApp({ root, params, pending, shareFailed, tracking, hasLink });
}

boot();
