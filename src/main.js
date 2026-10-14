// Point d'entrée : crée le configurateur, l'interface, charge la bague de démo (ou le fichier demandé).
import theme from './config/theme.js'; // marque blanche : polices + palettes du thème (themes/<client>/theme.json)
import { FEATURES } from './config/features.js';
import './style.css';
import * as THREE from 'three';
import { Configurator } from './app.js';
import { UI } from './ui/ui.js';
import { t } from './ui/i18n.js';
import { importModel, sniffFormat } from './import/fbxImport.js';
import { buildDemoRingGLB } from './demo/proceduralRing.js';
import { parseShareHash, shortShareRef, parseShareJson } from './state/store.js';
import { shouldPlayIntro, playIntro } from './intro/intro.js';
import { getCloud } from './cloud/index.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function boot() {
  if (!hasWebGL2()) { root.innerHTML = `<p style="padding:24px;font:16px system-ui">${t('webgl')}</p>`; return; }
  if (import.meta.env.DEV && params.has('debug')) import('eruda').then((m) => m.default.init()); // console intégrée (iPhone sans Mac) ; absente du build publié

  const holder = document.createElement('div'); // le viewer est ensuite déplacé dans l'interface
  const app = new Configurator(holder);
  const svc = { options: {}, last: null, cloud: getCloud };
  let introPending = shouldPlayIntro(theme, params, import.meta.env.DEV); // vrai tant que l'intro n'a pas pris la main
  let pending = parseShareHash(location.hash); // lien long (#c=) : configuration lue sur place
  let shareFailed = false;
  const shortRef = shortShareRef(location.hash); // lien court (#s=) : configuration à récupérer sur le serveur
  if (shortRef) {
    try { pending = parseShareJson(await (await getCloud()).shares.get(shortRef)); if (!pending) throw new Error('lien illisible'); }
    catch (e) { console.warn('Lien de partage introuvable', e); shareFailed = true; }
  }

  const ui = new UI(root, app, svc);
  ui.initTheme(); app.viewer._applyBackground();
  if (pending?.client) ui.lockClient(); // lien client : interface épurée et verrouillée
  window.__rc = { app, ui, THREE }; // pratique pour le débogage et les tests E2E

  /** Importe un buffer et l'installe dans le configurateur. */
  async function load(buffer, name, opts = {}, config = null, modelId = name) {
    svc.last = { buffer, name, remote: null }; svc.options = opts;
    ui.progress(1, t('loading'));
    try {
      const model = await importModel(buffer, name, { ...opts, onProgress: (p, l) => ui.progress(p, l) });
      let cfg = config ?? model.project ?? null;
      if (pending && (pending.modelId === modelId)) { cfg = { ...(cfg || {}), assign: pending.assign, hidden: pending.hidden }; }
      app.setModel(model, modelId, cfg);
      if (introPending) model.root.visible = false; // masquée jusqu'à ce que l'écrin soit prêt (pas d'apparition avant l'intro)
      if (model.project?.variants) { app.variants = model.project.variants; app.emit('variants'); }
      if (pending && pending.modelId === modelId) {
        if (pending.env) app.viewer.setEnvironment(pending.env);
        if (pending.envRot != null) app.viewer.setEnvironmentRotation(pending.envRot);
        pending = null;
        app.exploder.assembleNow(); // un lien de partage s'ouvre toujours bague assemblée, jamais éclatée
      }
      ui.progress(100);
      return model;
    } catch (e) {
      ui.progress(100);
      ui.fatal(/Format non reconnu/.test(e.message) ? t('errorFormat') : `${t('errorGeneric')} (${e.message})`);
      console.error(e);
      return null;
    }
  }

  // Coller un lien de partage dans l'onglet déjà ouvert ne recharge pas la page : on la recharge pour repartir d'un état neuf (assemblé).
  window.addEventListener('hashchange', () => { if (/[#&][cs]=/.test(location.hash)) location.reload(); });

  svc.openFile = async (file) => {
    const buffer = await file.arrayBuffer();
    if (!sniffFormat(buffer, file.name)) { ui.fatal(t('errorFormat')); return; }
    if (await load(buffer, file.name, {}, null, file.name)) svc.projectId = null; // nouveau fichier : ce n'est plus un projet enregistré
  };

  /** Ouvre un projet enregistré (fichier + configuration + lumière). */
  svc.openProject = async (id) => {
    try {
      const p = await (await getCloud()).projects.get(id);
      if (!p) return false;
      const { meta } = p;
      const model = await load(p.buffer, meta.modelName, meta.options || {}, meta.config || null, meta.modelId);
      if (!model) return false;
      if (meta.config?.variants) { app.variants = meta.config.variants; app.emit('variants'); }
      if (meta.env) app.viewer.setEnvironment(meta.env);
      if (meta.envRot != null) app.viewer.setEnvironmentRotation(meta.envRot);
      app.exploder.assembleNow();
      svc.projectId = id;
      return true;
    } catch (e) { console.warn(e); ui.toast(t('projectsUnavailable')); return false; }
  };

  svc.reimport = async (patch) => {
    if (!svc.last) return;
    const cfg = app.config();
    await load(svc.last.buffer, svc.last.name, { ...svc.options, ...patch }, cfg, app.modelId);
  };

  // Modèle par défaut du client (themes/<client>/<defaultModel>), repli : bague de démonstration
  async function loadThemeModel() {
    try {
      const r = await fetch(import.meta.env.BASE_URL + theme.defaultModelUrl);
      if (!r.ok) return false;
      const name = theme.defaultModelUrl.split('/').pop();
      await load(await r.arrayBuffer(), name, {}, null, name);
      return true;
    } catch (e) { console.warn('Modèle par défaut indisponible', e); return false; }
  }
  /** Modèle par défaut (thème), ou bague de démo : ils n'ont pas besoin d'être hébergés pour un lien de partage. */
  const defaultName = theme.defaultModelUrl?.split('/').pop();
  svc.isHostable = () => !!app.model && app.modelId !== defaultName && app.modelId !== 'demo-ring';

  // Lien de partage d'un modèle hébergé : on recharge le fichier du joaillier plutôt que le modèle par défaut
  async function loadRemote(id) {
    try {
      ui.progress(1, t('loading'));
      const m = await (await getCloud()).models.download(id, { onProgress: (p) => ui.progress(Math.max(1, Math.round(p * 60)), t('loading')) });
      await load(m.buffer, m.name, m.options, null, pending.modelId);
      if (svc.last) svc.last.remote = id; // déjà hébergé : inutile de le renvoyer au prochain partage
      return true;
    } catch (e) { console.warn('Modèle partagé indisponible', e); ui.progress(100); remoteFailed = true; return false; }
  }
  let remoteFailed = false;
  // Modèle initial
  const dev = import.meta.env.DEV;
  if (pending?.remote && await loadRemote(pending.remote)) { /* modèle du joaillier chargé */ }
  else if (dev && params.get('model') === 'gemv') {
    const buf = await (await fetch('/test-assets/MAQUETTE_GEMV.fbx')).arrayBuffer();
    await load(buf, 'MAQUETTE_GEMV.fbx', {}, null, 'MAQUETTE_GEMV.fbx');
  } else if (!(theme.defaultModelUrl && await loadThemeModel())) {
    const glb = await buildDemoRingGLB();
    await load(glb, 'bague-demo.glb', {}, null, 'demo-ring');
  }
  app.viewer.setAutoRotate(FEATURES.autoRotate && ui.mode !== 'atelier');
  ui.loadThumbnails();
  if (app.model && introPending) await playIntro(app, ui, theme).catch((e) => console.warn('Intro ignorée', e));
  introPending = false;
  if (app.model) app.model.root.visible = true; // filet de sécurité (intro ignorée ou en erreur)
  ui.onboard();
  ui.changelog();
  if (shareFailed) ui.toast(t('shareLinkFailed'), 6000);
  else if (remoteFailed) ui.toast(t('remoteFailed'), 6000);
  else if (pending) ui.toast(`Lien pour « ${pending.modelId} » : ouvrez ce fichier pour appliquer la configuration.`, 5000);

  if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
