// Droits d'un membre d'atelier, fixés par le propriétaire (voir firestore.rules). Fonctions pures : mêmes valeurs par défaut que les règles.
//   projects : 'all' (tous les projets non privés) | 'selected' (seulement ceux accordés un par un, `sharedWith`)
//   save : créer / modifier des projets · delete : supprimer · createLinks : créer des liens clients · viewLinks : voir les liens de l'atelier et leurs statistiques
export const RIGHT_KEYS = ['save', 'delete', 'createLinks', 'viewLinks'];
export const OWNER_RIGHTS = Object.freeze({ projects: 'all', save: true, delete: true, createLinks: true, viewLinks: true, owner: true });

/** Droits effectifs d'un document membre (champs absents = valeurs par défaut). */
export function resolveRights(m) {
  const p = (m && m.perms) || {};
  return { projects: m?.projects === 'selected' ? 'selected' : 'all', save: p.save !== false, delete: p.delete === true, createLinks: p.createLinks === true, viewLinks: p.viewLinks === true, owner: false };
}

/** Un projet est-il accessible à ce membre ? (même logique que les règles) */
export function canSeeProject(project, uid, rights) {
  if ((project.sharedWith || []).includes(uid)) return true;
  return rights.projects === 'all' && project.private !== true;
}

/** Document `perms` à écrire : uniquement les clés connues, en booléens. */
export function permsPatch(rights) {
  return Object.fromEntries(RIGHT_KEYS.map((k) => [k, !!rights[k]]));
}
