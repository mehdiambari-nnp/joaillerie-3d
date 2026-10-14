// Page de connexion plein écran : porte d'entrée de l'outil pour les joailliers (Firebase Auth).
// Les clients n'en voient jamais : un lien de partage (#s= / #c=) s'ouvre directement, sans compte.
import theme, { brandHTML } from '../config/theme.js';
import { t } from './i18n.js';

const AUTH_ERR = { 'auth/invalid-credential': 'authBad', 'auth/wrong-password': 'authBad', 'auth/user-not-found': 'authBad', 'auth/invalid-email': 'authEmail', 'auth/email-already-in-use': 'authExists',
  'auth/weak-password': 'authWeak', 'auth/popup-closed-by-user': 'authCancelled', 'auth/cancelled-popup-request': 'authCancelled', 'auth/network-request-failed': 'authNetwork', 'auth/too-many-requests': 'authMany' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const GOOGLE = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';

/** Affiche la page de connexion tant que personne n'est connecté ; se résout dès qu'un joaillier est identifié. */
export function showLogin(root, cloud) {
  return new Promise((resolve) => {
    let el = null, off = () => {};
    const finish = (user) => { off(); if (el) { el.classList.add('leaving'); setTimeout(() => el.remove(), 350); } document.documentElement.classList.remove('has-login'); resolve(user); };
    document.documentElement.classList.add('has-login');
    off = cloud.auth.onChange((user) => {
      if (user) return finish(user);
      if (!el) { el = build(root, cloud); }
    });
  });
}

function build(root, cloud) {
  let mode = 'in';
  const el = document.createElement('main');
  el.className = 'login';
  el.innerHTML = `
    <div class="login-mark" aria-hidden="true">${theme.logoSvg?.monogram || ''}</div>
    <section class="login-card" aria-labelledby="login-h">
      <div class="login-brand">${brandHTML()}</div>
      <p class="login-eyebrow">${esc(theme.brand.tagline || '')}</p>
      <h1 id="login-h">${t('loginTitle')}</h1>
      <p class="login-lead">${t('loginLead')}</p>
      <div class="login-tabs" role="tablist">
        <button type="button" role="tab" data-m="in" aria-selected="true">${t('signIn')}</button>
        <button type="button" role="tab" data-m="up" aria-selected="false">${t('signUp')}</button>
      </div>
      <form novalidate>
        <label class="fld"><span>${t('email')}</span><input type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required></label>
        <label class="fld"><span>${t('password')}</span>
          <span class="pw"><input type="password" name="pw" autocomplete="current-password" required><button type="button" class="pw-toggle" data-k="show" aria-label="${esc(t('showPw'))}">${t('showPw')}</button></span></label>
        <p class="login-err" role="alert" hidden></p>
        <button class="btn primary wide" type="submit" data-k="submit">${t('signIn')}</button>
        <div class="auth-or" aria-hidden="true"><span>${t('or')}</span></div>
        <button class="btn wide google" type="button" data-k="google">${GOOGLE}<span>${t('signInGoogle')}</span></button>
        <button class="link forgot" type="button" data-k="reset">${t('forgotPw')}</button>
      </form>
      <p class="login-note">${t('loginNote')}</p>
    </section>`;
  root.replaceChildren(el);
  const $ = (s) => el.querySelector(s), form = $('form'), err = $('.login-err'), submit = $('[data-k=submit]'), pw = form.pw;
  const setMode = (m) => {
    mode = m;
    el.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.m === m)));
    submit.textContent = m === 'in' ? t('signIn') : t('loginUp');
    pw.autocomplete = m === 'in' ? 'current-password' : 'new-password';
    $('.forgot').hidden = m === 'up'; err.hidden = true;
  };
  const fail = (msg) => { err.textContent = msg; err.hidden = false; };
  const run = async (fn, okMsg) => {
    err.hidden = true; el.classList.add('busy');
    try { await fn(form.email.value.trim(), form.pw.value); if (okMsg) { err.textContent = okMsg; err.hidden = false; err.classList.add('ok'); } }
    catch (e) { err.classList.remove('ok'); fail(t(AUTH_ERR[e.code] || 'authError')); console.warn(e); }
    finally { el.classList.remove('busy'); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); err.classList.remove('ok'); run((m, p) => (mode === 'in' ? cloud.auth.signIn(m, p) : cloud.auth.signUp(m, p))); });
  el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (m) return setMode(m);
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k === 'google') { err.classList.remove('ok'); run(() => cloud.auth.signInGoogle()); }
    else if (k === 'reset') { if (!form.email.value.trim()) { err.classList.remove('ok'); fail(t('authEmailFirst')); form.email.focus(); } else run((m) => cloud.auth.reset(m), t('resetSent')); }
    else if (k === 'show') { const on = pw.type === 'password'; pw.type = on ? 'text' : 'password'; e.target.textContent = on ? t('hidePw') : t('showPw'); }
  });
  requestAnimationFrame(() => { el.classList.add('in'); form.email.focus({ preventScroll: true }); });
  return el;
}
