// Ateliers partagés (Firebase). L'atelier d'un joaillier = ses projets (users/{owner}/projects). Il peut y inviter d'autres joailliers
// par un LIEN à usage unique (7 jours) : ils y voient, ouvrent, modifient et créent des projets. Le propriétaire les retire à tout moment.
//   invites/{jeton}                    lien secret (128 bits) : propriétaire, e-mail indicatif, expiration, utilisé ?
//   workspaces/{owner}/members/{uid}   membres de l'atelier
//   users/{uid}/memberships/{owner}    ateliers que j'ai rejoints (index inverse, pour les lister)
// Les règles de sécurité (firestore.rules, testées sur l'émulateur) garantissent l'usage unique, l'expiration et les droits.
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, writeBatch } from 'firebase/firestore';
import { inviteUrl } from '../state/store.js';

export const INVITE_TTL = 7 * 24 * 3600 * 1000;
const KEY = 'rc:workspace';
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

/** @param {import('firebase/firestore').Firestore} db @param {() => {uid:string, email:string, name:string}} me utilisateur courant (exige d'être connecté) */
export function createWorkspaces(db, me) {
  let active = null; // propriétaire de l'atelier ouvert ; null = le mien
  try { active = localStorage.getItem(KEY) || null; } catch { /* stockage indisponible */ }
  const persist = () => { try { active ? localStorage.setItem(KEY, active) : localStorage.removeItem(KEY); } catch { /* idem */ } };

  const api = {
    /** Identifiant (uid du propriétaire) de l'atelier actif. */
    get active() { const u = me().uid; return !active || active === u ? u : active; },
    get isOwn() { return this.active === me().uid; },
    setActive(owner) { active = owner && owner !== me().uid ? owner : null; persist(); },

    /** Ateliers disponibles : le mien, puis ceux que j'ai rejoints. */
    async list() {
      const snap = await getDocs(collection(db, 'users', me().uid, 'memberships'));
      return [{ owner: me().uid, name: null, self: true }, ...snap.docs.map((d) => ({ owner: d.id, name: d.data().ownerName || '', self: false }))];
    },

    /** Si l'atelier actif n'est plus accessible (retiré par son propriétaire), retour à mon atelier. */
    async validate() {
      if (api.isOwn) return;
      const m = await getDoc(doc(db, 'users', me().uid, 'memberships', api.active));
      if (!m.exists()) api.setActive(null);
    },

    async members() {
      const snap = await getDocs(collection(db, 'workspaces', api.active, 'members'));
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.joined || 0) - (b.joined || 0));
    },

    /** Propriétaire : retire un joaillier (adhésion + index inverse, en une fois). */
    async removeMember(uid) {
      const owner = me().uid, b = writeBatch(db);
      b.delete(doc(db, 'workspaces', owner, 'members', uid));
      b.delete(doc(db, 'users', uid, 'memberships', owner));
      await b.commit();
    },

    /** Membre : quitte l'atelier d'un autre joaillier. */
    async leave(owner) {
      const uid = me().uid, b = writeBatch(db);
      b.delete(doc(db, 'workspaces', owner, 'members', uid));
      b.delete(doc(db, 'users', uid, 'memberships', owner));
      await b.commit();
      if (active === owner) api.setActive(null);
    },

    invites: {
      /** Crée un lien d'invitation (usage unique, 7 jours). `email` : simple repère pour le propriétaire. */
      async create(email = '') {
        const u = me(), t = token(), now = Date.now();
        await setDoc(doc(db, 'invites', t), { owner: u.uid, ownerName: u.name, ownerEmail: u.email || '', email: String(email).trim().toLowerCase().slice(0, 200), created: now, expires: now + INVITE_TTL, used: false });
        return { token: t, url: inviteUrl(t) };
      },
      /** Invitations en attente (non utilisées, non expirées) de mon atelier. */
      async list() {
        const snap = await getDocs(query(collection(db, 'invites'), where('owner', '==', me().uid), where('used', '==', false)));
        const now = Date.now();
        return snap.docs.map((d) => ({ token: d.id, ...d.data() })).filter((i) => i.expires > now).sort((a, b) => b.created - a.created);
      },
      revoke: (t) => deleteDoc(doc(db, 'invites', t)),
      /** Lit une invitation (null si inconnue) pour l'afficher avant d'accepter. */
      async info(t) {
        const s = await getDoc(doc(db, 'invites', t));
        if (!s.exists()) return null;
        const d = s.data();
        return { owner: d.owner, ownerName: d.ownerName || '', ownerEmail: d.ownerEmail || '', valid: !d.used && d.expires > Date.now(), mine: d.owner === me().uid };
      },
      /** Accepte : jeton consommé, adhésion et index inverse écrits ensemble (les règles exigent le même lot). */
      async accept(t) {
        const u = me(), info = await api.invites.info(t);
        if (!info?.valid || info.mine) throw Object.assign(new Error('invitation invalide'), { code: info?.mine ? 'invite/own' : 'invite/invalid' });
        const b = writeBatch(db), now = Date.now();
        b.update(doc(db, 'invites', t), { used: true, usedBy: u.uid, usedAt: now });
        b.set(doc(db, 'workspaces', info.owner, 'members', u.uid), { uid: u.uid, name: u.name, email: u.email || '', joined: now, invite: t });
        b.set(doc(db, 'users', u.uid, 'memberships', info.owner), { owner: info.owner, ownerName: info.ownerName, joined: now, invite: t });
        await b.commit();
        api.setActive(info.owner);
        return { owner: info.owner, ownerName: info.ownerName };
      },
    },
  };
  return api;
}
