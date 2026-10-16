// Service Firebase, partie AUTHENTIFICATION seule : c'est tout ce dont la page de connexion a besoin. Firestore et Cloud Storage (≈ 480 Ko)
// ne sont chargés (firebase.js) qu'une fois connecté ou pour un lien client. Instance unique, partagée avec firebase.js.
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut, updateProfile, connectAuthEmulator } from 'firebase/auth';

// Développement : `?emulator` branche l'application sur les émulateurs locaux (npm run emulators) : comptes et données fictifs,
// projet « demo-jewel3d », rien n'est écrit en production. Jamais actif dans le build publié (import.meta.env.DEV).
export const useEmulator = () => { try { return import.meta.env.DEV && new URLSearchParams(location.search).has('emulator'); } catch { return false; } };

let inst = null;
export function createAuth(config) {
  if (inst) return inst;
  const emu = useEmulator();
  const app = initializeApp(emu ? { ...config, projectId: 'demo-jewel3d', apiKey: 'demo-key', storageBucket: 'demo-jewel3d.appspot.com' } : config);
  const auth = getAuth(app);
  if (emu) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const state = { user: undefined, subs: new Set() }; // undefined : état pas encore connu
  onAuthStateChanged(auth, (u) => { state.user = u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null; state.subs.forEach((f) => f(state.user)); });

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
  return (inst = { app, auth, authApi, emu });
}
