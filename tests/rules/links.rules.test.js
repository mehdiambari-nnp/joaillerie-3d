// Règles Firestore : liens clients suivis (consultations anonymes, tableau de bord du joaillier). Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, collectionGroup, query, where } from 'firebase/firestore';

const OWNER = 'owner1', OTHER = 'other1', VISITOR = 'visitor1', VISITOR2 = 'visitor2';
const LINK = 'a'.repeat(20), VIEW = 'b'.repeat(20), VIEW2 = 'c'.repeat(20);
let env;

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-jewel3d-links', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.fr` }).firestore();
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

const link = (x = {}) => ({ p: '{"v":1}', owner: OWNER, enabled: true, expires: null, created: Date.now(), ...x });
const view = (x = {}) => ({ owner: OWNER, uid: VISITOR, at: Date.now(), last: Date.now(), seconds: 0, opened: false, tryon: 0, photo: 0, taps: 0, device: 'mobile', os: 'iOS', browser: 'Safari', lang: 'fr', ...x });
const seedLink = (x) => seed((db) => setDoc(doc(db, 'links', LINK), link(x)));
const seedView = (x, id = VIEW) => seed((db) => setDoc(doc(db, 'links', LINK, 'views', id), view(x)));

describe('lien (partie publique)', () => {
  it('le propriétaire crée un lien à son nom', async () => { await assertSucceeds(setDoc(doc(real(OWNER), 'links', LINK), link())); });
  it('refuse : propriétaire usurpé, désactivé à la création, champ en trop, mauvais identifiant, compte anonyme, non connecté', async () => {
    await assertFails(setDoc(doc(real(OTHER), 'links', LINK), link()));
    await assertFails(setDoc(doc(real(OWNER), 'links', LINK), link({ enabled: false })));
    await assertFails(setDoc(doc(real(OWNER), 'links', LINK), link({ label: 'secret' })));
    await assertFails(setDoc(doc(real(OWNER), 'links', 'court'), link()));
    await assertFails(setDoc(doc(anon(VISITOR), 'links', LINK), link({ owner: VISITOR })));
    await assertFails(setDoc(doc(guest(), 'links', LINK), link()));
  });
  it('le client (non connecté) lit un lien par son identifiant ; pas de listing', async () => {
    await seedLink();
    await assertSucceeds(getDoc(doc(guest(), 'links', LINK)));
    await assertFails(getDocs(collection(guest(), 'links')));
    await assertFails(getDocs(collection(real(OTHER), 'links')));
  });
  it('le propriétaire désactive, réactive, change l\'expiration et la configuration', async () => {
    await seedLink();
    const d = doc(real(OWNER), 'links', LINK);
    await assertSucceeds(updateDoc(d, { enabled: false }));
    await assertSucceeds(updateDoc(d, { enabled: true, expires: Date.now() + 86400000 }));
    await assertSucceeds(updateDoc(d, { p: '{"v":2}' }));
  });
  it('personne d\'autre ne modifie ; le propriétaire ne peut changer ni owner ni created', async () => {
    await seedLink();
    await assertFails(updateDoc(doc(real(OTHER), 'links', LINK), { enabled: false }));
    await assertFails(updateDoc(doc(anon(VISITOR), 'links', LINK), { enabled: false }));
    await assertFails(updateDoc(doc(guest(), 'links', LINK), { enabled: false }));
    await assertFails(updateDoc(doc(real(OWNER), 'links', LINK), { owner: OTHER }));
    await assertFails(updateDoc(doc(real(OWNER), 'links', LINK), { created: 1 }));
  });
  it('le propriétaire supprime ; un autre non', async () => {
    await seedLink();
    await assertFails(deleteDoc(doc(real(OTHER), 'links', LINK)));
    await assertFails(deleteDoc(doc(anon(VISITOR), 'links', LINK)));
    await assertSucceeds(deleteDoc(doc(real(OWNER), 'links', LINK)));
  });
});

describe('consultations : création (client anonyme)', () => {
  beforeEach(() => seedLink());
  it('un client anonyme enregistre sa consultation', async () => { await assertSucceeds(setDoc(doc(anon(VISITOR), 'links', LINK, 'views', VIEW), view())); });
  it('un compte réel (ex. le joaillier qui teste) peut aussi enregistrer', async () => { await assertSucceeds(setDoc(doc(real(OTHER), 'links', LINK, 'views', VIEW), view({ uid: OTHER }))); });
  it('refuse sans authentification', async () => { await assertFails(setDoc(doc(guest(), 'links', LINK, 'views', VIEW), view())); });
  it('refuse sur un lien désactivé, expiré ou inexistant', async () => {
    await seed((db) => setDoc(doc(db, 'links', LINK), link({ enabled: false })));
    await assertFails(setDoc(doc(anon(VISITOR), 'links', LINK, 'views', VIEW), view()));
    await seed((db) => setDoc(doc(db, 'links', LINK), link({ expires: Date.now() - 1000 })));
    await assertFails(setDoc(doc(anon(VISITOR), 'links', LINK, 'views', VIEW), view()));
    await assertFails(setDoc(doc(anon(VISITOR), 'links', 'f'.repeat(20), 'views', VIEW), view()));
  });
  it('refuse : propriétaire falsifié, uid d\'un autre, compteurs non nuls, champ en trop, date lointaine, appareil inconnu', async () => {
    const db = anon(VISITOR), at = (x) => doc(db, 'links', LINK, 'views', VIEW);
    await assertFails(setDoc(at(), view({ owner: OTHER })));
    await assertFails(setDoc(at(), view({ uid: VISITOR2 })));
    await assertFails(setDoc(at(), view({ seconds: 500 })));
    await assertFails(setDoc(at(), view({ tryon: 3 })));
    await assertFails(setDoc(at(), view({ opened: true })));
    await assertFails(setDoc(at(), view({ ip: '1.2.3.4' })));
    await assertFails(setDoc(at(), view({ at: Date.now() + 3600000, last: Date.now() + 3600000 })));
    await assertFails(setDoc(at(), view({ device: 'fridge' })));
    await assertFails(setDoc(at(), view({ browser: 'x'.repeat(21) })));
  });
});

describe('consultations : mise à jour (temps passé, actions)', () => {
  beforeEach(async () => { await seedLink(); await seedView({ at: Date.now() - 60000, last: Date.now() - 60000 }); });
  const d = (db) => doc(db, 'links', LINK, 'views', VIEW);
  it('le même visiteur fait avancer le temps et les actions', async () => {
    const db = anon(VISITOR);
    await assertSucceeds(updateDoc(d(db), { seconds: 30, last: Date.now(), opened: true, taps: 4 }));
    await assertSucceeds(updateDoc(d(db), { seconds: 45, tryon: 1, photo: 1, last: Date.now() }));
  });
  it('le temps ne peut pas dépasser le temps réellement écoulé, ni reculer', async () => {
    await assertFails(updateDoc(d(anon(VISITOR)), { seconds: 4000, last: Date.now() }));
    await seed((db) => updateDoc(d(db), { seconds: 40 }));
    await assertFails(updateDoc(d(anon(VISITOR)), { seconds: 10, last: Date.now() }));
  });
  it('un autre visiteur ou le propriétaire ne modifie pas la consultation', async () => {
    await assertFails(updateDoc(d(anon(VISITOR2)), { seconds: 5, last: Date.now() }));
    await assertFails(updateDoc(d(real(OWNER)), { seconds: 5, last: Date.now() }));
  });
  it('seuls les compteurs changent (pas owner, uid, at, appareil) ; bornes des compteurs', async () => {
    const db = anon(VISITOR);
    await assertFails(updateDoc(d(db), { owner: OTHER }));
    await assertFails(updateDoc(d(db), { uid: VISITOR2 }));
    await assertFails(updateDoc(d(db), { at: 1 }));
    await assertFails(updateDoc(d(db), { device: 'desktop' }));
    await assertFails(updateDoc(d(db), { tryon: 999 }));
    await assertFails(updateDoc(d(db), { taps: 99999 }));
  });
});

describe('consultations : lecture et suppression (propriétaire seulement)', () => {
  beforeEach(async () => { await seedLink(); await seedView(); await seedView({ uid: VISITOR2 }, VIEW2); });
  it('le propriétaire lit les consultations d\'un lien et toutes les siennes (requête de groupe)', async () => {
    await assertSucceeds(getDocs(query(collection(real(OWNER), 'links', LINK, 'views'), where('owner', '==', OWNER))));
    await assertSucceeds(getDocs(query(collectionGroup(real(OWNER), 'views'), where('owner', '==', OWNER))));
  });
  it('un autre joaillier, un visiteur ou un inconnu ne lisent pas', async () => {
    await assertFails(getDoc(doc(real(OTHER), 'links', LINK, 'views', VIEW)));
    await assertFails(getDoc(doc(anon(VISITOR), 'links', LINK, 'views', VIEW)));
    await assertFails(getDocs(query(collection(real(OTHER), 'links', LINK, 'views'), where('owner', '==', OWNER))));
    await assertFails(getDocs(collection(real(OWNER), 'links', LINK, 'views'))); // toute lecture en liste doit filtrer sur owner
    await assertFails(getDocs(query(collectionGroup(real(OTHER), 'views'), where('owner', '==', OWNER))));
    await assertFails(getDocs(collectionGroup(real(OWNER), 'views'))); // sans filtre sur owner : refusé
  });
  it('le propriétaire supprime des consultations ; un autre non', async () => {
    await assertFails(deleteDoc(doc(real(OTHER), 'links', LINK, 'views', VIEW)));
    await assertFails(deleteDoc(doc(anon(VISITOR), 'links', LINK, 'views', VIEW)));
    await assertSucceeds(deleteDoc(doc(real(OWNER), 'links', LINK, 'views', VIEW)));
  });
});

describe('fiche privée du lien', () => {
  const fiche = (x = {}) => ({ label: 'Mme Dupont', note: 'Alliance or rose', created: Date.now(), ...x });
  it('le joaillier lit et écrit sa fiche ; personne d\'autre', async () => {
    await assertSucceeds(setDoc(doc(real(OWNER), 'users', OWNER, 'links', LINK), fiche()));
    await assertSucceeds(getDoc(doc(real(OWNER), 'users', OWNER, 'links', LINK)));
    await assertFails(getDoc(doc(real(OTHER), 'users', OWNER, 'links', LINK)));
    await assertFails(getDoc(doc(guest(), 'users', OWNER, 'links', LINK)));
    await assertFails(setDoc(doc(real(OTHER), 'users', OWNER, 'links', LINK), fiche()));
    await assertFails(setDoc(doc(anon(VISITOR), 'users', VISITOR, 'links', LINK), fiche()));
  });
  it('limites de taille', async () => {
    await assertFails(setDoc(doc(real(OWNER), 'users', OWNER, 'links', LINK), fiche({ label: 'x'.repeat(121) })));
    await assertFails(setDoc(doc(real(OWNER), 'users', OWNER, 'links', LINK), fiche({ note: 'x'.repeat(1001) })));
  });
});

describe('un compte anonyme ne peut rien d\'autre', () => {
  it('ni projets, ni liens courts, ni invitations, ni adhésions', async () => {
    const db = anon(VISITOR);
    await assertFails(setDoc(doc(db, 'users', VISITOR, 'projects', 'p1'), { name: 'x', modelHash: 'c'.repeat(32) }));
    await assertFails(setDoc(doc(db, 'shares', 'a'.repeat(12)), { p: '{}', created: 1 }));
    await assertFails(setDoc(doc(db, 'invites', 'a'.repeat(32)), { owner: VISITOR, ownerName: 'x', ownerEmail: '', email: '', created: Date.now(), expires: Date.now() + 1000, used: false }));
  });
});
