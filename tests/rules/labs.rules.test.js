// Règles Firestore : textures d'or partagées dans l'atelier (émulateur). Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const OWNER = 'owner1', GUEST = 'guest1', STRANGER = 'stranger1';
let env;
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-jewel3d-labs', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.fr` }).firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const lab = (extra = {}) => ({ name: 'Or chaud', l: '{"roughness":0.3}', light: null, by: 'Mehdi', byUid: OWNER, updated: Date.now(), ...extra });
const member = (perms = {}) => seed((db) => setDoc(doc(db, 'workspaces', OWNER, 'members', GUEST), { uid: GUEST, name: 'Invité', email: 'g@test.fr', joined: Date.now(), perms }));

describe('textures d\'or de l\'atelier', () => {
  it('le propriétaire crée, lit et supprime', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab()));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'labs')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'labs', 'l1abc')));
  });
  it('un membre lit et crée, mais ne supprime pas par défaut', async () => {
    await member();
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab()));
    const db = as(GUEST);
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'labs')));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'labs', 'l2abc'), lab({ byUid: GUEST, name: 'Or rosé' })));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'labs', 'l1abc')));
  });
  it('un membre autorisé à supprimer supprime', async () => {
    await member({ delete: true });
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab()));
    await assertSucceeds(deleteDoc(doc(as(GUEST), 'users', OWNER, 'labs', 'l1abc')));
  });
  it('un inconnu ne lit ni n\'écrit', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab()));
    const db = as(STRANGER);
    await assertFails(getDoc(doc(db, 'users', OWNER, 'labs', 'l1abc')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'labs', 'l2abc'), lab({ byUid: STRANGER })));
  });
  it('refuse les données invalides', async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab({ name: '' })));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab({ l: 'x'.repeat(3001) })));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab({ extra: 1 })));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'labs', 'l1abc'), lab({ byUid: 'autre' })));
  });
});
