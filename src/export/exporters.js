// Exports : projet GLB (config incluse), GLB/USDZ pour l'AR, téléchargement, partage natif.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { resolveGem, gemSubstitute, describeAssignment, swatchOf, FINISHES, byId } from '../materials/library.js';

/** Désactive la surbrillance de sélection le temps d'un export / d'une capture. */
export async function withoutHighlight(app, fn) {
  const sel = new Set(app.selection), hov = app.hover;
  app.selection = new Set(); app.hover = null;
  app._refreshHighlight();
  try { return await fn(); } finally { app.selection = sel; app.hover = hov; app._refreshHighlight(); }
}

/** Projet complet : un seul .glb contenant le modèle normalisé ET la configuration (scene.extras). */
export async function exportProjectGLB(app) {
  return withoutHighlight(app, async () => {
    const scene = new THREE.Scene();
    scene.name = 'ring-project';
    scene.userData.ringConfig = app.config();
    scene.add(app.viewer.root.clone(true));
    const buf = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
    return new Blob([buf], { type: 'model/gltf-binary' });
  });
}

/**
 * Scène AR : mètres, posée sur le plan (y = 0), pierres remplacées par un matériau compatible Quick Look.
 * scaleMode : 'real' (1 mm = 0,001 m) ou 'big' (×10).
 */
export function buildARScene(app, scaleMode = 'real') {
  const k = scaleMode === 'big' ? 0.01 : 0.001;
  const holder = new THREE.Group();
  const clone = app.viewer.root.clone(true);
  clone.traverse((o) => {
    if (!o.isMesh) return;
    const piece = app.pieces.find((p) => p.mesh.userData.pieceId === o.userData.pieceId);
    const a = app.assign[o.userData.pieceId];
    if (!piece || !a || !piece.mesh.visible) { o.visible = false; return; }
    if (piece.kind === 'gem') {
      const s = gemSubstitute(resolveGem(a));
      o.material = new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metalness, roughness: s.roughness, side: THREE.FrontSide });
    } else {
      const src = piece.mesh.material;
      o.material = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 1, roughness: Math.max(0.08, src.roughness), side: THREE.FrontSide });
    }
  });
  holder.add(clone);
  holder.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.y = -box.min.y; // pose sur le plan
  const scene = new THREE.Scene();
  scene.add(holder);
  scene.updateMatrixWorld(true);
  return scene;
}

export async function exportARGLB(app, scaleMode) {
  return withoutHighlight(app, async () => {
    const scene = buildARScene(app, scaleMode);
    const buf = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
    return new Blob([buf], { type: 'model/gltf-binary' });
  });
}

export async function exportARUSDZ(app, scaleMode) {
  return withoutHighlight(app, async () => {
    const scene = buildARScene(app, scaleMode);
    const buf = await new USDZExporter().parseAsync(scene, {
      ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
      includeAnchoringProperties: true, quickLookCompatible: true, maxTextureSize: 1024,
    });
    return new Blob([buf], { type: 'model/vnd.usdz+zip' });
  });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Partage natif (iOS : feuille de partage) avec repli sur le téléchargement. */
export async function shareOrDownload(blob, filename, title = '') {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  download(blob, filename);
  return 'downloaded';
}

/** Lignes de la fiche récapitulative : zone → matériau. */
export function recapRows(app) {
  return app.zones.map((z) => {
    const a = app.assign[z.pieceIds[0]];
    const names = new Set(z.pieceIds.map((id) => {
      const x = app.assign[id];
      const d = describeAssignment(x, z.type === 'gem' ? 'gem' : 'metal');
      return x?.f && !d.includes('·') ? `${d} · ${app.finishName?.(x.f) ?? byId(FINISHES, x.f)?.name ?? x.f}` : d;
    }));
    return { zone: z.name, type: z.type, material: [...names].join(' / '), swatch: swatchOf(z.type === 'gem' ? 'gem' : 'metal', a) };
  });
}
