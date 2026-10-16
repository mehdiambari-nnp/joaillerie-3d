// Service Firebase : Auth (joaillier), Cloud Storage (modèles, adressés par empreinte, lisibles par lien), Firestore (projets par utilisateur).
// Le SDK n'est chargé qu'à la demande (import dynamique depuis ./index.js).
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut, updateProfile, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadBytesResumable, getBytes, getMetadata } from 'firebase/storage';
import { modelId, gzip, gunzip } from '../share/remote.js';
import { createWorkspaces } from './workspaces.js';
import { createLinks } from './links.js';
import { displayName } from './name.js';

// Développement : `?emulator` branche l'application sur les émulateurs locaux (npm run emulators) : comptes et données fictifs,
// projet « demo-jewel3d », rien n'est écrit en production. Jamais actif dans le build publié (import.meta.env.DEV).
const useEmulator = () => { try { return import.meta.env.DEV && new URLSearchParams(location.search).has('emulator'); } catch { return false; } };

const hex12 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

export function create(config) {
  const emu = useEmulator();
  const app = initializeApp(emu ? { ...config, projectId: 'demo-jewel3d', apiKey: 'demo-key', storageBucket: 'demo-jewel3d.appspot.com' } : config);
  const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
  if (emu) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); connectStorageEmulator(storage, '127.0.0.1', 9199); }
  const state = { user: undefined, subs: new Set() }; // undefined : état pas encore connu
  onAuthStateChanged(auth, (u) => { state.user = u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null; state.subs.forEach((f) => f(state.user)); });
  const uid = () => { if (!auth.currentUser) throw Object.assign(new Error('Connexion requise'), { code: 'auth/required' }); return auth.currentUser.uid; };

  const authApi = {
    enabled: true,
    get user() { return state.user ?? null; },
    onChange(cb) { state.subs.add(cb); if (state.user !== undefined) cb(state.user); return () => state.subs.delete(cb); },
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    async signUp(email, pw, name = '') { // le nom (prénom + nom) est enregistré dans le profil du compte
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (name) { try { await updateProfile(cred.user, { displayName: name }); if (state.user) state.user.name = name; } catch (e) { console.warn('Nom non enregistré', e); } }
      return cred;
    },
    signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    reset: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
  };

  const exists = async (r) => { try { await getMetadata(r); return true; } catch (e) { if (e.code === 'storage/object-not-found') return false; throw e; } };

  const models = {
    /** Dépose le fichier (gzip) s'il n'existe pas déjà ; l'identifiant est son empreinte. Exige d'être connecté. */
    async upload({ buffer, name, options = {} }, { onProgress = () => {} } = {}) {
      uid();
      const id = await modelId(buffer), r = ref(storage, `models/${id}`);
      if (await exists(r)) return id;
      const gz = await gzip(buffer);
      const data = gz ?? buffer;
      const task = uploadBytesResumable(r, data, { contentType: 'application/octet-stream', customMetadata: { name: String(name).slice(0, 200), opts: JSON.stringify(options), gz: gz ? '1' : '0', size: String(buffer.byteLength) } });
      await new Promise((res, rej) => task.on('state_changed', (s) => onProgress(s.bytesTransferred / s.totalBytes), rej, res));
      return id;
    },
    async download(id, { onProgress = () => {} } = {}) {
      const r = ref(storage, `models/${id}`);
      const meta = await getMetadata(r);
      let buffer = await getBytes(r);
      onProgress(1);
      const c = meta.customMetadata || {};
      if (c.gz === '1') buffer = await gunzip(buffer);
      if ((await modelId(buffer)) !== id) throw new Error('Modèle altéré : empreinte différente de son identifiant'); // l'identifiant EST l'empreinte du fichier
      let options = {}; try { options = JSON.parse(c.opts || '{}'); } catch { /* options absentes */ }
      return { buffer, name: c.name || 'modele.glb', options };
    },
  };

  const shares = {
    async put(id, json) { const d = doc(db, 'shares', id); uid(); if (!(await getDoc(d)).exists()) await setDoc(d, { p: json, created: Date.now() }); },
    async get(id) { const s = await getDoc(doc(db, 'shares', id)); if (!s.exists()) throw new Error('partage introuvable'); return s.data().p; },
  };

  // Ateliers partagés : les projets sont ceux de l'atelier actif (le mien, ou celui d'un joaillier qui m'a invité)
  const workspaces = createWorkspaces(db, () => { uid(); const u = auth.currentUser; return { uid: u.uid, email: u.email || '', name: displayName({ name: u.displayName, email: u.email }) }; });
  const links = createLinks(db, auth, () => { uid(); return { uid: auth.currentUser.uid, name: displayName({ name: auth.currentUser.displayName, email: auth.currentUser.email }) }; }, workspaces);
  const col = () => { uid(); return collection(db, 'users', workspaces.active, 'projects'); };
  const projects = {
    /** Projets de l'atelier actif, du plus récent au plus ancien. Un membre ne reçoit que ceux qui lui sont accessibles :
     *  les projets non privés (s'il voit « tous ») et ceux que le propriétaire lui a accordés un par un (`sharedWith`). */
    async list() {
      const own = workspaces.isOwn;
      let docs;
      if (own) docs = (await getDocs(col())).docs;
      else {
        const me = auth.currentUser.uid;
        const fetchAll = async () => {
          const r = await workspaces.rights(), seen = new Map();
          const queries = [getDocs(query(col(), where('sharedWith', 'array-contains', me)))];
          if (r.projects === 'all') queries.push(getDocs(query(col(), where('private', '==', false))));
          for (const s of await Promise.all(queries)) for (const d of s.docs) seen.set(d.id, d);
          return [...seen.values()];
        };
        try { docs = await fetchAll(); }
        catch (e) { if (e?.code !== 'permission-denied') throw e; workspaces.refreshRights(); docs = await fetchAll(); } // droits modifiés par le propriétaire depuis la dernière lecture
      }
      const snap = { docs };
      const out = snap.docs.map((d) => { const { config, options, ...rest } = d.data(); return { id: d.id, ...rest }; }); // la configuration n'est lue qu'à l'ouverture
      // anciens projets sans `private` / `archived` : le propriétaire les complète (une liste filtrée ne retrouve que les documents qui portent le champ)
      if (own) {
        const old = snap.docs.filter((d) => typeof d.data().private !== 'boolean' || typeof d.data().archived !== 'boolean');
        if (old.length) {
          const b = writeBatch(db);
          for (const d of old) { const x = d.data(); b.update(d.ref, { private: x.private === true, archived: x.archived === true }); }
          b.commit().catch((e) => console.warn('Complément des anciens projets impossible', e));
          for (const p of out) { p.private = p.private === true; p.archived = p.archived === true; }
        }
      }
      return out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    },
    async save(meta, buffer) {
      const { id, config, options, ...rest } = meta;
      const modelHash = buffer ? await models.upload({ buffer, name: meta.modelName, options }) : meta.modelHash;
      const d = doc(col(), id), old = await getDoc(d), o = old.exists() ? old.data() : null;
      const me = auth.currentUser;
      await setDoc(d, {
        ...rest, modelHash, options: JSON.stringify(options || {}), config: JSON.stringify(config || {}),
        created: o ? o.created : Date.now(), updated: Date.now(),
        by: displayName({ name: me.displayName, email: me.email }), byUid: me.uid,
        private: o ? o.private === true : false, archived: o ? o.archived === true : false, // visibilité et archivage conservés à la mise à jour
        sharedWith: o ? o.sharedWith || [] : workspaces.isOwn ? [] : [me.uid], // accès un par un : conservés ; un membre voit ce qu'il crée
      });
      return id;
    },
    /** Modifie nom, visibilité (`private`, propriétaire seulement) ou archivage, sans toucher au fichier ni à la date de modification. */
    update: (id, patch) => updateDoc(doc(col(), id), Object.fromEntries(Object.entries(patch).filter(([k]) => ['name', 'private', 'archived'].includes(k)))),
    /** Propriétaire : accorde (ou retire) à un joaillier l'accès à ce projet, un par un. */
    access: (id, uid, on) => updateDoc(doc(col(), id), { sharedWith: on ? arrayUnion(uid) : arrayRemove(uid) }),
    /** Copie un projet (même fichier : aucun nouveau téléversement). Le propriétaire peut le rendre privé ; la copie d'un membre est visible. */
    async duplicate(id, name) {
      const s = await getDoc(doc(col(), id));
      if (!s.exists()) throw Object.assign(new Error('projet introuvable'), { code: 'project/missing' });
      const me = auth.currentUser, nid = hex12(), now = Date.now();
      await setDoc(doc(col(), nid), { ...s.data(), name: String(name || s.data().name).slice(0, 120), created: now, updated: now, by: displayName({ name: me.displayName, email: me.email }), byUid: me.uid, private: workspaces.isOwn ? s.data().private === true : false, archived: false, sharedWith: workspaces.isOwn ? s.data().sharedWith || [] : [me.uid] });
      return nid;
    },
    async get(id) {
      const s = await getDoc(doc(col(), id));
      if (!s.exists()) return null;
      const { config, options, ...rest } = s.data();
      const m = await models.download(rest.modelHash);
      return { meta: { id, ...rest, config: JSON.parse(config || '{}'), options: JSON.parse(options || '{}') }, buffer: m.buffer };
    },
    remove: (id) => deleteDoc(doc(col(), id)),
  };

  return { kind: 'firebase', auth: authApi, models, projects, shares, workspaces, links };
}
