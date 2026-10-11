// Point d'entrée : crée le configurateur, l'interface, charge la bague de démo (ou le fichier demandé).
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import './style.css';
import * as THREE from 'three';
import { Configurator } from './app.js';
import { UI } from './ui/ui.js';
import { t } from './ui/i18n.js';
import { importModel, sniffFormat } from './import/fbxImport.js';
import { buildDemoRingGLB } from './demo/proceduralRing.js';
import { parseShareHash } from './state/store.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function boot() {
  if (!hasWebGL2()) { root.innerHTML = `<p style="padding:24px;font:16px system-ui">${t('webgl')}</p>`; return; }
  if (params.has('debug')) import('eruda').then((m) => m.default.init()); // console intégrée (iPhone sans Mac)

  const holder = document.createElement('div'); // le viewer est ensuite déplacé dans l'interface
  const app = new Configurator(holder);
  const svc = { options: {}, last: null };
  let pending = parseShareHash(location.hash); // configuration d'un lien de partage

  const ui = new UI(root, app, svc);
  ui.initTheme(); app.viewer._applyBackground();
  if (pending?.client) ui.lockClient(); // lien client : interface épurée et verrouillée
  window.__rc = { app, ui, THREE }; // pratique pour le débogage et les tests E2E

  /** Importe un buffer et l'installe dans le configurateur. */
  async function load(buffer, name, opts = {}, config = null, modelId = name) {
    svc.last = { buffer, name }; svc.options = opts;
    ui.progress(1, t('loading'));
    try {
      const model = await importModel(buffer, name, { ...opts, onProgress: (p, l) => ui.progress(p, l) });
      let cfg = config ?? model.project ?? null;
      if (pending && (pending.modelId === modelId)) { cfg = { ...(cfg || {}), assign: pending.assign, hidden: pending.hidden }; }
      app.setModel(model, modelId, cfg);
      if (model.project?.variants) { app.variants = model.project.variants; app.emit('variants'); }
      if (pending && pending.modelId === modelId) {
        if (pending.env) app.viewer.setEnvironment(pending.env);
        if (pending.envRot != null) app.viewer.setEnvironmentRotation(pending.envRot);
        pending = null;
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

  svc.openFile = async (file) => {
    const buffer = await file.arrayBuffer();
    if (!sniffFormat(buffer, file.name)) { ui.fatal(t('errorFormat')); return; }
    await load(buffer, file.name, {}, null, file.name);
  };

  svc.reimport = async (patch) => {
    if (!svc.last) return;
    const cfg = app.config();
    await load(svc.last.buffer, svc.last.name, { ...svc.options, ...patch }, cfg, app.modelId);
  };

  // Modèle initial
  const dev = import.meta.env.DEV;
  if (dev && params.get('model') === 'gemv') {
    const buf = await (await fetch('/test-assets/MAQUETTE_GEMV.fbx')).arrayBuffer();
    await load(buf, 'MAQUETTE_GEMV.fbx', {}, null, 'MAQUETTE_GEMV.fbx');
  } else {
    const glb = await buildDemoRingGLB();
    await load(glb, 'bague-demo.glb', {}, null, 'demo-ring');
  }
  app.viewer.setAutoRotate(ui.mode !== 'atelier');
  ui.loadThumbnails();
  ui.onboard();
  if (pending) ui.toast(`Lien pour « ${pending.modelId} » : ouvrez ce fichier pour appliquer la configuration.`, 5000);

  if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
