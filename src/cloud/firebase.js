// Service Firebase : Auth (joaillier), Cloud Storage (modèles, adressés par empreinte, lisibles par lien), Firestore (projets par utilisateur).
// Le SDK n'est chargé qu'à la demande (import dynamique depuis ./index.js).
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getBytes, getMetadata } from 'firebase/storage';
import { modelId, gzip, gunzip } from '../share/remote.js';

export function create(config) {
  const app = initializeApp(config);
  const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
  const state = { user: undefined, subs: new Set() }; // undefined : état pas encore connu
  onAuthStateChanged(auth, (u) => { state.user = u ? { uid: u.uid, email: u.email } : null; state.subs.forEach((f) => f(state.user)); });
  const uid = () => { if (!auth.currentUser) throw Object.assign(new Error('Connexion requise'), { code: 'auth/required' }); return auth.currentUser.uid; };

  const authApi = {
    enabled: true,
    get user() { return state.user ?? null; },
    onChange(cb) { state.subs.add(cb); if (state.user !== undefined) cb(state.user); return () => state.subs.delete(cb); },
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    signUp: (email, pw) => createUserWithEmailAndPassword(auth, email, pw),
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
      let options = {}; try { options = JSON.parse(c.opts || '{}'); } catch { /* options absentes */ }
      return { buffer, name: c.name || 'modele.glb', options };
    },
  };

  const shares = {
    async put(id, json) { const d = doc(db, 'shares', id); uid(); if (!(await getDoc(d)).exists()) await setDoc(d, { p: json, created: Date.now() }); },
    async get(id) { const s = await getDoc(doc(db, 'shares', id)); if (!s.exists()) throw new Error('partage introuvable'); return s.data().p; },
  };

  const col = () => collection(db, 'users', uid(), 'projects');
  const projects = {
    async list() {
      const snap = await getDocs(query(col(), orderBy('updated', 'desc')));
      return snap.docs.map((d) => { const { config, options, ...rest } = d.data(); return { id: d.id, ...rest }; }); // la configuration n'est lue qu'à l'ouverture
    },
    async save(meta, buffer) {
      const { id, config, options, ...rest } = meta;
      const modelHash = buffer ? await models.upload({ buffer, name: meta.modelName, options }) : meta.modelHash;
      const d = doc(col(), id), old = await getDoc(d);
      await setDoc(d, { ...rest, modelHash, options: JSON.stringify(options || {}), config: JSON.stringify(config || {}), created: old.exists() ? old.data().created : Date.now(), updated: Date.now() });
      return id;
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

  return { kind: 'firebase', auth: authApi, models, projects, shares };
}
