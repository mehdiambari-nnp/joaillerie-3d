// Liens clients suivis (Firebase). Un lien = un envoi à un client, avec son propre identifiant secret (#l=<20 hex>) :
//   links/{id}                public : configuration, propriétaire, actif / désactivé, expiration (le client l'ouvre sans compte)
//   users/{uid}/links/{id}    privé : nom donné au lien, note, vignette (visible du seul joaillier)
//   links/{id}/views/{vid}    une ligne par consultation, écrite par le client (compte ANONYME) : durée, actions, appareil grossier
// Aucune donnée personnelle : ni adresse IP, ni localisation, ni identité du client. Règles : firestore.rules (testées sur l'émulateur).
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, collectionGroup, query, where, limit, writeBatch, Timestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { deviceInfo } from './linkStats.js';
import { trackingRefused } from './optout.js';

const hex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export const RETENTION_DAYS = 395; // 13 mois : suppression automatique des consultations (TTL Firestore sur `expireAt`)
export const linkUrl = (id, base = location.origin + location.pathname) => `${base}#l=${id}`;

/** @param {import('firebase/firestore').Firestore} db @param {import('firebase/auth').Auth} auth @param {() => {uid:string}} me */
export function createLinks(db, auth, me) {
  const priv = (id) => doc(db, 'users', me().uid, 'links', id);
  const pub = (id) => doc(db, 'links', id);

  const api = {
    /** Crée un lien client suivi : partie publique + fiche privée, en une écriture groupée. */
    async create({ json, label = '', note = '', expires = null, modelName = '', modelId = '', thumb = null }) {
      const id = hex(10), now = Date.now(), b = writeBatch(db);
      b.set(pub(id), { p: json, owner: me().uid, enabled: true, expires, created: now });
      b.set(priv(id), { label: String(label).trim().slice(0, 120), note: String(note).slice(0, 1000), modelName: String(modelName).slice(0, 200), modelId: String(modelId).slice(0, 200), thumb, enabled: true, expires, created: now });
      await b.commit();
      return { id, url: linkUrl(id) };
    },

    /** Fiches de mes liens (privées), les plus récents d'abord. */
    async list() {
      const snap = await getDocs(collection(db, 'users', me().uid, 'links'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.created || 0) - (a.created || 0));
    },

    /** Toutes mes consultations, regroupées par lien : { [id]: vues[] } (une seule requête de groupe). */
    async views() {
      const snap = await getDocs(query(collectionGroup(db, 'views'), where('owner', '==', me().uid), limit(5000)));
      const by = {};
      for (const d of snap.docs) (by[d.ref.parent.parent.id] ||= []).push({ id: d.id, ...d.data() });
      for (const k of Object.keys(by)) by[k].sort((a, b) => b.at - a.at);
      return by;
    },

    /** Modifie un lien : nom, note, expiration, actif / désactivé, configuration. Public et privé restent cohérents. */
    async update(id, { label, note, expires, enabled, json }) {
      const b = writeBatch(db), cur = await getDoc(pub(id));
      if (!cur.exists()) throw Object.assign(new Error('lien introuvable'), { code: 'link/missing' });
      const p = cur.data(), next = { ...p };
      if (enabled !== undefined) next.enabled = !!enabled;
      if (expires !== undefined) next.expires = expires;
      if (json !== undefined) next.p = json;
      b.set(pub(id), next);
      const f = {};
      if (label !== undefined) f.label = String(label).trim().slice(0, 120);
      if (note !== undefined) f.note = String(note).slice(0, 1000);
      if (enabled !== undefined) f.enabled = !!enabled;
      if (expires !== undefined) f.expires = expires;
      if (Object.keys(f).length) b.update(priv(id), f);
      await b.commit();
    },

    /** Supprime le lien, sa fiche et toutes ses consultations (par lots de 400). Le client ne peut plus l'ouvrir. */
    async remove(id) {
      for (;;) {
        const snap = await getDocs(query(collection(db, 'links', id, 'views'), where('owner', '==', me().uid), limit(400)));
        if (snap.empty) break;
        const b = writeBatch(db); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit();
      }
      const b = writeBatch(db); b.delete(pub(id)); b.delete(priv(id)); await b.commit();
    },

    /** Lecture publique (côté client) : null si le lien n'existe pas. */
    async open(id) {
      const s = await getDoc(pub(id));
      if (!s.exists()) return null;
      const d = s.data();
      return { id, owner: d.owner, p: d.p, enabled: d.enabled !== false, expired: d.expires != null && d.expires <= Date.now() };
    },

    /**
     * Mesure la consultation (côté client) : une ligne par ouverture, mise à jour toutes les 10 s avec le temps VISIBLE et les actions.
     * Compte anonyme pour le client ; aucun suivi si c'est un joaillier connecté qui teste. Ne doit jamais gêner l'expérience : tout est silencieux.
     */
    async track(id, owner) {
      try {
        if (trackingRefused() || (auth.currentUser && !auth.currentUser.isAnonymous)) return { stop() {} };
        if (!auth.currentUser) await signInAnonymously(auth);
        const vid = hex(10), ref = doc(db, 'links', id, 'views', vid), now = Date.now();
        const st = { opened: false, tryon: 0, photo: 0, taps: 0 };
        await setDoc(ref, { owner, uid: auth.currentUser.uid, at: now, last: now, seconds: 0, ...st, ...deviceInfo(navigator.userAgent, navigator.language), expireAt: Timestamp.fromMillis(now + RETENTION_DAYS * 86400000) });
        let visibleMs = 0, lastTick = performance.now(), sent = '', stopped = false;
        const tick = () => { const n = performance.now(); if (document.visibilityState === 'visible') visibleMs += n - lastTick; lastTick = n; };
        const flush = async () => {
          if (stopped) return; tick();
          const body = { seconds: Math.floor(visibleMs / 1000), ...st }, key = JSON.stringify(body);
          if (key === sent) return; sent = key;
          try { await updateDoc(ref, { ...body, last: Date.now() }); } catch { /* lien désactivé ou hors ligne : on réessaiera */ sent = ''; }
        };
        const onEvent = (e) => {
          const k = e.detail;
          if (k === 'open') st.opened = true; else if (k === 'tryon') st.tryon = Math.min(200, st.tryon + 1); else if (k === 'photo') st.photo = Math.min(200, st.photo + 1);
        };
        const onTap = () => { st.taps = Math.min(5000, st.taps + 1); };
        const onVis = () => { tick(); if (document.visibilityState === 'hidden') flush(); };
        window.addEventListener('rc:track', onEvent); window.addEventListener('pointerdown', onTap, { passive: true });
        document.addEventListener('visibilitychange', onVis); window.addEventListener('pagehide', flush);
        const timer = setInterval(flush, 10000);
        const stop = () => {
          stopped = true; clearInterval(timer);
          window.removeEventListener('rc:track', onEvent); window.removeEventListener('pointerdown', onTap);
          document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', flush); window.removeEventListener('rc:optout', onOptOut);
        };
        const onOptOut = (e) => { if (e.detail) stop(); }; // le visiteur refuse la mesure : on s'arrête aussitôt
        window.addEventListener('rc:optout', onOptOut);
        return { stop };
      } catch (e) { console.warn('Suivi indisponible', e); return { stop() {} }; }
    },
  };
  return api;
}
