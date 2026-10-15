// Règles Firestore : ateliers partagés et invitations (émulateur). Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, collectionGroup, query, where, writeBatch } from 'firebase/firestore';

const TOKEN = 'a'.repeat(32), TOKEN2 = 'b'.repeat(32);
const OWNER = 'owner1', OWNER2 = 'owner2', GUEST = 'guest1', GUEST2 = 'guest2', STRANGER = 'stranger1';
const DAY = 24 * 3600 * 1000;
let env;

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-jewel3d', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.fr` }).firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const project = (extra = {}) => ({ name: 'Solitaire', modelHash: 'c'.repeat(32), updated: Date.now(), private: false, archived: false, ...extra });
const invite = (extra = {}) => ({ owner: OWNER, ownerName: 'Mehdi', ownerEmail: 'm@test.fr', email: 'guest@test.fr', created: Date.now(), expires: Date.now() + 7 * DAY, used: false, ...extra });
const addMember = (db, uid, owner = OWNER, rights = {}) => setDoc(doc(db, 'workspaces', owner, 'members', uid), { uid, name: 'Invité', email: `${uid}@test.fr`, joined: Date.now(), invite: TOKEN, ...rights });

/** Acceptation d'une invitation, telle que l'écrit l'application (une transaction : jeton consommé + adhésion + index inverse). */
const accept = (db, uid, { token = TOKEN, owner = OWNER } = {}) => {
  const b = writeBatch(db);
  b.update(doc(db, 'invites', token), { used: true, usedBy: uid, usedAt: Date.now() });
  b.set(doc(db, 'workspaces', owner, 'members', uid), { uid, name: 'Invité', email: `${uid}@test.fr`, joined: Date.now(), invite: token });
  b.set(doc(db, 'users', uid, 'memberships', owner), { owner, ownerName: 'Mehdi', joined: Date.now(), invite: token });
  return b.commit();
};

describe('projets de l\'atelier', () => {
  it('le propriétaire lit et écrit ses projets', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
  });
  it('un inconnu ne lit ni n\'écrit', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()));
    const db = as(STRANGER);
    await assertFails(getDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'projects', 'p2'), project()));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
  });
  it('un visiteur non connecté ne lit rien', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', OWNER, 'projects', 'p1')));
  });
  it('un membre lit, écrit et supprime dans l\'atelier', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()); await addMember(db, GUEST, OWNER, { perms: { delete: true } }); });
    const db = as(GUEST);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'projects', 'p2'), project({ name: 'Alliance', sharedWith: [GUEST] })));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
  });
  it('un membre d\'un atelier n\'accède pas aux autres ateliers', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER2, 'projects', 'p9'), project()); await addMember(db, GUEST); });
    await assertFails(getDoc(doc(as(GUEST), 'users', OWNER2, 'projects', 'p9')));
  });
  it('les règles de forme des projets restent appliquées aux membres', async () => {
    await seed((db) => addMember(db, GUEST));
    await assertFails(setDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'p3'), project({ modelHash: 'zz' })));
    await assertFails(setDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'p3'), project({ name: 'x'.repeat(121) })));
  });
});

describe('visibilité des projets (privé / visible pour les membres)', () => {
  beforeEach(() => seed(async (db) => {
    await setDoc(doc(db, 'users', OWNER, 'projects', 'pub'), project({ name: 'Visible' }));
    await setDoc(doc(db, 'users', OWNER, 'projects', 'priv'), project({ name: 'Privé', private: true }));
    await addMember(db, GUEST);
  }));
  const mine = (db) => query(collection(db, 'users', OWNER, 'projects'), where('private', '==', false));
  it('le propriétaire lit tout, y compris les projets privés', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'users', OWNER, 'projects', 'priv')));
    await assertSucceeds(getDocs(collection(as(OWNER), 'users', OWNER, 'projects')));
  });
  it('un membre ne lit pas un projet privé (ni par identifiant, ni par liste), mais lit les visibles', async () => {
    await assertFails(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'priv')));
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'pub')));
    await assertSucceeds(getDocs(mine(as(GUEST))));
    await assertFails(getDocs(collection(as(GUEST), 'users', OWNER, 'projects'))); // liste non filtrée : refusée
  });
  it('un membre ne modifie ni ne supprime un projet privé', async () => {
    await assertFails(updateDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'priv'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'priv')));
    await assertSucceeds(updateDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'pub'), { name: 'Renommé', archived: true }));
  });
  it('le propriétaire seul change la visibilité', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'users', OWNER, 'projects', 'pub'), { private: true }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'users', OWNER, 'projects', 'priv'), { private: false }));
    await assertFails(updateDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'pub'), { private: true }));
  });
  it('un membre peut lire un projet inexistant (l\'application le fait avant d\'enregistrer un nouveau projet)', async () => {
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'nouveau')));
  });
  it('un membre ne crée pas de projet privé ; un projet doit porter private et archived', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'n1'), project({ private: true })));
    await assertSucceeds(setDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'n2'), project({ sharedWith: [GUEST] })));
    const { private: _p, ...sans } = project();
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER, 'projects', 'n3'), sans));
  });
  it('ancien projet sans champ private : lisible par identifiant, absent des listes de membres ; le propriétaire le complète', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'projects', 'old'), { name: 'Ancien', modelHash: 'c'.repeat(32), updated: 1 }));
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'old')));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'users', OWNER, 'projects', 'old'), { private: false, archived: false }));
    await assertSucceeds(getDocs(mine(as(GUEST))));
  });
});

describe('création d\'invitations', () => {
  it('le propriétaire crée une invitation à son nom', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'invites', TOKEN), invite()));
  });
  it('refuse une invitation au nom d\'un autre', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'invites', TOKEN), invite({ owner: OWNER })));
  });
  it('refuse une durée de plus de 8 jours, une expiration passée, un jeton mal formé, used=true', async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'invites', TOKEN), invite({ expires: Date.now() + 30 * DAY })));
    await assertFails(setDoc(doc(db, 'invites', TOKEN), invite({ expires: Date.now() - 1000 })));
    await assertFails(setDoc(doc(db, 'invites', 'court'), invite()));
    await assertFails(setDoc(doc(db, 'invites', TOKEN), invite({ used: true })));
    await assertFails(setDoc(doc(db, 'invites', TOKEN), invite({ extra: 1 })));
  });
  it('un visiteur non connecté ne crée rien', async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'invites', TOKEN), invite()));
  });
  it('un membre ne peut pas inviter dans l\'atelier du propriétaire', async () => {
    await seed((db) => addMember(db, GUEST));
    await assertFails(setDoc(doc(as(GUEST), 'invites', TOKEN2), invite({ owner: OWNER })));
  });
});

describe('lecture des invitations', () => {
  beforeEach(() => seed((db) => setDoc(doc(db, 'invites', TOKEN), invite())));
  it('qui détient le lien (connecté) la lit', async () => { await assertSucceeds(getDoc(doc(as(GUEST), 'invites', TOKEN))); });
  it('non connecté : refusé', async () => { await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'invites', TOKEN))); });
  it('le propriétaire liste ses invitations en attente', async () => {
    await assertSucceeds(getDocs(query(collection(as(OWNER), 'invites'), where('owner', '==', OWNER), where('used', '==', false))));
  });
  it('un autre ne peut pas lister celles d\'un propriétaire, ni tout lister', async () => {
    await assertFails(getDocs(query(collection(as(GUEST), 'invites'), where('owner', '==', OWNER))));
    await assertFails(getDocs(collection(as(GUEST), 'invites')));
  });
});

describe('acceptation d\'une invitation', () => {
  beforeEach(() => seed((db) => setDoc(doc(db, 'invites', TOKEN), invite())));
  it('un joaillier accepte : il devient membre et accède aux projets', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()));
    await assertSucceeds(accept(as(GUEST), GUEST));
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'p1')));
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', GUEST, 'memberships', OWNER)));
  });
  it('le lien est à usage unique', async () => {
    await assertSucceeds(accept(as(GUEST), GUEST));
    await assertFails(accept(as(GUEST2), GUEST2));
  });
  it('une invitation expirée est refusée', async () => {
    await seed((db) => setDoc(doc(db, 'invites', TOKEN2), invite({ expires: Date.now() - 1000 })));
    await assertFails(accept(as(GUEST), GUEST, { token: TOKEN2 }));
  });
  it('le propriétaire ne peut pas accepter sa propre invitation', async () => {
    await assertFails(accept(as(OWNER), OWNER));
  });
  it('on ne s\'ajoute pas comme membre sans invitation valide', async () => {
    await assertFails(addMember(as(GUEST), GUEST));
    await assertFails(setDoc(doc(as(GUEST), 'users', GUEST, 'memberships', OWNER), { owner: OWNER, ownerName: 'x', joined: 1, invite: TOKEN }));
  });
  it('on n\'ajoute pas quelqu\'un d\'autre, ni dans un autre atelier avec l\'invitation d\'un propriétaire', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'workspaces', OWNER, 'members', GUEST2), { uid: GUEST2, name: 'x', email: 'x@test.fr', joined: 1, invite: TOKEN }));
    await assertFails(setDoc(doc(as(GUEST), 'workspaces', OWNER2, 'members', GUEST), { uid: GUEST, name: 'x', email: 'x@test.fr', joined: 1, invite: TOKEN }));
  });
  it('l\'acceptation ne peut modifier que les champs d\'usage de l\'invitation', async () => {
    await assertFails(updateDoc(doc(as(GUEST), 'invites', TOKEN), { used: true, usedBy: GUEST, usedAt: 1, owner: GUEST }));
    await assertFails(updateDoc(doc(as(GUEST), 'invites', TOKEN), { used: true, usedBy: GUEST2, usedAt: 1 }));
    await assertFails(updateDoc(doc(as(GUEST), 'invites', TOKEN), { expires: Date.now() + 8 * DAY }));
  });
});

describe('membres', () => {
  beforeEach(() => seed(async (db) => { await setDoc(doc(db, 'invites', TOKEN), invite()); await addMember(db, GUEST); await addMember(db, GUEST2); }));
  it('propriétaire et membres voient la liste ; un inconnu non', async () => {
    await assertSucceeds(getDocs(collection(as(OWNER), 'workspaces', OWNER, 'members')));
    await assertSucceeds(getDocs(collection(as(GUEST), 'workspaces', OWNER, 'members')));
    await assertFails(getDocs(collection(as(STRANGER), 'workspaces', OWNER, 'members')));
  });
  it('le propriétaire retire un membre (adhésion + index inverse)', async () => {
    await seed((db) => setDoc(doc(db, 'users', GUEST, 'memberships', OWNER), { owner: OWNER, ownerName: 'M', joined: 1, invite: TOKEN }));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'workspaces', OWNER, 'members', GUEST)));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'users', GUEST, 'memberships', OWNER)));
  });
  it('un membre quitte l\'atelier ; il ne retire pas les autres', async () => {
    await assertFails(deleteDoc(doc(as(GUEST), 'workspaces', OWNER, 'members', GUEST2)));
    await assertSucceeds(deleteDoc(doc(as(GUEST), 'workspaces', OWNER, 'members', GUEST)));
  });
  it('un retiré perd l\'accès aux projets', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'workspaces', OWNER, 'members', GUEST)));
    await assertFails(getDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'p1')));
  });
  it('l\'index inverse n\'est lisible que par son titulaire', async () => {
    await seed((db) => setDoc(doc(db, 'users', GUEST, 'memberships', OWNER), { owner: OWNER, ownerName: 'M', joined: 1, invite: TOKEN }));
    await assertSucceeds(getDoc(doc(as(GUEST), 'users', GUEST, 'memberships', OWNER)));
    await assertFails(getDoc(doc(as(STRANGER), 'users', GUEST, 'memberships', OWNER)));
  });
  it('le propriétaire révoque (supprime) une invitation ; un autre non', async () => {
    await assertFails(deleteDoc(doc(as(STRANGER), 'invites', TOKEN)));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'invites', TOKEN)));
  });
});

describe('droits d\'un membre (accès aux projets un par un, fonctionnalités)', () => {
  const P = (id) => doc(as(GUEST), 'users', OWNER, 'projects', id);
  const asOwner = (id) => doc(as(OWNER), 'users', OWNER, 'projects', id);
  const setMember = (rights) => updateDoc(doc(as(OWNER), 'workspaces', OWNER, 'members', GUEST), rights);

  it('par défaut : tous les projets non privés, créer et modifier oui, supprimer non', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()); await addMember(db, GUEST); });
    await assertSucceeds(getDoc(P('p1')));
    await assertSucceeds(updateDoc(P('p1'), { name: 'Renommé' }));
    await assertFails(deleteDoc(P('p1')));
  });
  it('seul le propriétaire change les droits ; le membre ne peut pas se les accorder', async () => {
    await seed((db) => addMember(db, GUEST));
    await assertSucceeds(setMember({ projects: 'selected', perms: { delete: true, createLinks: true } }));
    await assertFails(updateDoc(doc(as(GUEST), 'workspaces', OWNER, 'members', GUEST), { perms: { delete: true } }));
    await assertFails(setMember({ perms: { inconnu: true } }));
    await assertFails(setMember({ perms: { delete: 'oui' } }));
    await assertFails(setMember({ projects: 'plein' }));
    await assertFails(setMember({ name: 'Autre' }));
  });
  it('à l\'arrivée, un invité ne peut pas fixer ses propres droits', async () => {
    await seed((db) => setDoc(doc(db, 'invites', TOKEN), invite()));
    const db = as(GUEST), b = writeBatch(db);
    b.update(doc(db, 'invites', TOKEN), { used: true, usedBy: GUEST, usedAt: Date.now() });
    b.set(doc(db, 'workspaces', OWNER, 'members', GUEST), { uid: GUEST, name: 'x', email: 'x@test.fr', joined: Date.now(), invite: TOKEN, perms: { delete: true } });
    b.set(doc(db, 'users', GUEST, 'memberships', OWNER), { owner: OWNER, ownerName: 'M', joined: Date.now(), invite: TOKEN });
    await assertFails(b.commit());
  });
  it('mode « sélection » : seuls les projets accordés un par un sont visibles, en lecture directe et en liste', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER, 'projects', 'a'), project({ sharedWith: [GUEST] }));
      await setDoc(doc(db, 'users', OWNER, 'projects', 'b'), project());
      await setDoc(doc(db, 'users', OWNER, 'projects', 'c'), project({ private: true, sharedWith: [GUEST] }));
      await addMember(db, GUEST, OWNER, { projects: 'selected' });
    });
    await assertSucceeds(getDoc(P('a')));
    await assertFails(getDoc(P('b')));
    await assertSucceeds(getDoc(P('c')));
    const col = collection(as(GUEST), 'users', OWNER, 'projects');
    const snap = await assertSucceeds(getDocs(query(col, where('sharedWith', 'array-contains', GUEST))));
    if (snap.size !== 2) throw new Error('attendu 2 projets, reçu ' + snap.size);
    await assertFails(getDocs(query(col, where('private', '==', false)))); // la liste « tous » est refusée en mode sélection
  });
  it('mode « tous » : un projet privé reste caché, sauf accord explicite', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER, 'projects', 'v'), project());
      await setDoc(doc(db, 'users', OWNER, 'projects', 'p'), project({ private: true }));
      await setDoc(doc(db, 'users', OWNER, 'projects', 'g'), project({ private: true, sharedWith: [GUEST] }));
      await addMember(db, GUEST);
    });
    await assertSucceeds(getDoc(P('v')));
    await assertFails(getDoc(P('p')));
    await assertSucceeds(getDoc(P('g')));
  });
  it('un membre ne change ni la visibilité ni les accès ; il crée un projet visible de lui seul (sélection) ou de tous', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()); await addMember(db, GUEST); });
    await assertFails(updateDoc(P('p1'), { private: true }));
    await assertFails(updateDoc(P('p1'), { sharedWith: [GUEST, STRANGER] }));
    await assertFails(setDoc(P('n1'), project())); // sans sharedWith = [lui]
    await assertFails(setDoc(P('n2'), project({ sharedWith: [GUEST, STRANGER] })));
    await assertSucceeds(setDoc(P('n3'), project({ sharedWith: [GUEST] })));
    await assertSucceeds(updateDoc(asOwner('p1'), { sharedWith: [GUEST] })); // le propriétaire accorde
  });
  it('sans le droit « créer / modifier » : lecture seule', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()); await addMember(db, GUEST, OWNER, { perms: { save: false } }); });
    await assertSucceeds(getDoc(P('p1')));
    await assertFails(updateDoc(P('p1'), { name: 'X' }));
    await assertFails(setDoc(P('n1'), project({ sharedWith: [GUEST] })));
  });
  it('le droit « supprimer » ne dépasse pas les projets accessibles', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project({ private: true }));
      await addMember(db, GUEST, OWNER, { perms: { delete: true } });
    });
    await assertFails(deleteDoc(P('p1')));
  });
});

describe('droits d\'un membre : liens clients', () => {
  const L = 'e'.repeat(20), V = 'f'.repeat(20);
  const pub = (x = {}) => ({ p: '{"v":1}', owner: OWNER, enabled: true, expires: null, created: Date.now(), by: GUEST, ...x });
  const sheet = (x = {}) => ({ label: 'Mme X', note: '', enabled: true, created: Date.now(), by: GUEST, ...x });
  const makeLink = (db) => { const b = writeBatch(db); b.set(doc(db, 'links', L), pub()); b.set(doc(db, 'users', OWNER, 'links', L), sheet()); return b.commit(); };

  it('sans le droit : un membre ne crée pas de lien pour l\'atelier ; avec le droit : oui, à son nom', async () => {
    await seed((db) => addMember(db, GUEST));
    await assertFails(makeLink(as(GUEST)));
    await seed((db) => addMember(db, GUEST, OWNER, { perms: { createLinks: true } }));
    await assertSucceeds(makeLink(as(GUEST)));
    await assertFails(setDoc(doc(as(GUEST), 'links', 'd'.repeat(20)), pub({ by: OWNER }))); // auteur usurpé
    await assertFails(setDoc(doc(as(GUEST), 'links', 'd'.repeat(20)), pub({ owner: OWNER2 }))); // autre atelier
  });
  it('un membre gère ses liens, pas ceux du propriétaire', async () => {
    await seed(async (db) => {
      await addMember(db, GUEST, OWNER, { perms: { createLinks: true } });
      await setDoc(doc(db, 'links', L), pub()); await setDoc(doc(db, 'users', OWNER, 'links', L), sheet());
      await setDoc(doc(db, 'links', 'd'.repeat(20)), pub({ by: OWNER })); await setDoc(doc(db, 'users', OWNER, 'links', 'd'.repeat(20)), sheet({ by: OWNER }));
    });
    await assertSucceeds(updateDoc(doc(as(GUEST), 'links', L), { enabled: false }));
    await assertFails(updateDoc(doc(as(GUEST), 'links', 'd'.repeat(20)), { enabled: false }));
    await assertFails(deleteDoc(doc(as(GUEST), 'links', 'd'.repeat(20))));
    await assertSucceeds(deleteDoc(doc(as(GUEST), 'links', L)));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'links', 'd'.repeat(20)), { enabled: false })); // le propriétaire garde la main
  });
  it('visibilité : « voir les liens » donne toutes les fiches et statistiques de l\'atelier ; sinon seulement les fiches qu\'on a créées', async () => {
    await seed(async (db) => {
      await addMember(db, GUEST, OWNER, { perms: { createLinks: true } });
      await setDoc(doc(db, 'users', OWNER, 'links', L), sheet()); await setDoc(doc(db, 'users', OWNER, 'links', 'd'.repeat(20)), sheet({ by: OWNER }));
      await setDoc(doc(db, 'links', 'd'.repeat(20)), pub({ by: OWNER }));
      await setDoc(doc(db, 'links', 'd'.repeat(20), 'views', V), { owner: OWNER, uid: 'v', at: Date.now(), last: Date.now(), seconds: 3 });
    });
    const sheets = collection(as(GUEST), 'users', OWNER, 'links');
    await assertFails(getDocs(sheets));
    const own = await assertSucceeds(getDocs(query(sheets, where('by', '==', GUEST))));
    if (own.size !== 1) throw new Error('attendu 1 fiche');
    await assertFails(getDocs(query(collectionGroup(as(GUEST), 'views'), where('owner', '==', OWNER))));
    await seed((db) => updateDoc(doc(db, 'workspaces', OWNER, 'members', GUEST), { perms: { createLinks: true, viewLinks: true } }));
    await assertSucceeds(getDocs(sheets));
    await assertSucceeds(getDocs(query(collectionGroup(as(GUEST), 'views'), where('owner', '==', OWNER))));
  });
  it('un inconnu ou un membre d\'un autre atelier ne voit rien', async () => {
    await seed(async (db) => { await addMember(db, GUEST, OWNER2, { perms: { viewLinks: true, createLinks: true } }); await setDoc(doc(db, 'users', OWNER, 'links', L), sheet({ by: OWNER })); });
    await assertFails(getDocs(collection(as(GUEST), 'users', OWNER, 'links')));
    await assertFails(getDocs(query(collectionGroup(as(GUEST), 'views'), where('owner', '==', OWNER))));
  });
});
