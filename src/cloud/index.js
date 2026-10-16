// Point d'accès unique aux services en ligne : Firebase si le thème en fournit la configuration (themes/<client>/firebase.json, absent en mode `offline`),
// sinon le service local. Interface commune :
//   auth     { enabled, user, onChange(cb) → désabonnement, signIn, signUp, signInGoogle, reset, signOut }
//   models   { upload({buffer, name, options}, {onProgress}) → id, download(id, {onProgress}) → {buffer, name, options} }
//   projects { list(), get(id) → {meta, buffer}, save(meta, buffer), remove(id) }
import theme from 'virtual:theme';

let pending = null;
export function getCloud() {
  pending ??= (theme.firebase ? import('./firebase.js') : import('./local.js')).then((m) => m.create(theme.firebase));
  return pending;
}

/** Service minimal pour la page de connexion : l'authentification seule (Firebase) ; hors Firebase, le service complet (déjà léger). */
export function getAuthCloud() {
  return theme.firebase ? import('./firebase-auth.js').then((m) => ({ auth: m.createAuth(theme.firebase).authApi })) : getCloud();
}
