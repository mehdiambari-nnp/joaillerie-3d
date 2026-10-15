// Règles Firestore : ateliers partagés et invitations (émulateur). Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, query, where, writeBatch } from 'firebase/firestore';

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
const addMember = (db, uid, owner = OWNER) => setDoc(doc(db, 'workspaces', owner, 'members', uid), { uid, name: 'Invité', email: `${uid}@test.fr`, joined: Date.now(), invite: TOKEN });

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
    await seed(async (db) => { await setDoc(doc(db, 'users', OWNER, 'projects', 'p1'), project()); await addMember(db, GUEST); });
    const db = as(GUEST);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'projects', 'p1')));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'projects', 'p2'), project({ name: 'Alliance' })));
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
    await assertSucceeds(setDoc(doc(as(GUEST), 'users', OWNER, 'projects', 'n2'), project()));
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
