// Import de modèles de bijoux (FBX, GLB/GLTF, OBJ) : normalisation, doublons, zones, mesure du doigt.
// Tout s'exécute dans le navigateur : le fichier ne quitte jamais l'appareil.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  describeGeometry, generateBoxUV, detectFingerAxis, buildNormalizationMatrix, measureHole,
} from './analysis.js';
import { gunzip } from '../share/remote.js';
import {
  norm, classifyKind, detectZones, findDuplicates, frenchRingSize, guessUnitToMM, UNIT_FACTORS,
} from './zones.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Identifie le format par l'en-tête (iOS ne connaît pas l'extension .fbx : on ne se fie pas au type MIME). */
export function sniffFormat(buffer, fileName = '') {
  const head = new Uint8Array(buffer, 0, Math.min(32, buffer.byteLength));
  const ascii = String.fromCharCode(...head);
  if (head[0] === 0x1f && head[1] === 0x8b) return 'gzip'; // fichier compressé (ex. FBX .gz renommé en .fbx) : décompressé au chargement
  if (ascii.startsWith('Kaydara FBX Binary')) return 'fbx';
  if (ascii.startsWith('; FBX')) return 'fbx';
  if (ascii.startsWith('glTF')) return 'glb';
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'gltf') return 'gltf';
  if (ext === 'obj') return 'obj';
  return null;
}

/** Sépare un mesh multi-matériaux en une pièce par groupe de matériau. */
function splitByGroups(geometry, materials) {
  if (!Array.isArray(materials) || geometry.groups.length <= 1) return [{ geometry, material: Array.isArray(materials) ? materials[0] : materials }];
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  return g.groups.map((grp) => {
    const out = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const s = attr.itemSize;
      out.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(grp.start * s, (grp.start + grp.count) * s), s, attr.normalized));
    }
    return { geometry: out, material: materials[grp.materialIndex] };
  });
}

/** Lecture brute : retourne les meshes (géométrie « cuite » dans le repère monde du fichier) et les vues de caméra. */
export async function loadRaw(buffer, fileName) {
  let fmt = sniffFormat(buffer, fileName);
  if (fmt === 'gzip') {
    buffer = await gunzip(buffer);
    fmt = sniffFormat(buffer, fileName.replace(/\.gz$/i, ''));
  }
  if (!fmt || fmt === 'gzip') throw new Error('Format non reconnu. Formats acceptés : FBX, GLB/GLTF, OBJ.');
  let root, project = null;
  if (fmt === 'fbx') {
    root = new FBXLoader().parse(buffer, '');
  } else if (fmt === 'obj') {
    root = new OBJLoader().parse(new TextDecoder().decode(buffer));
  } else {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    root = gltf.scene;
    const cfg = gltf.scene.userData?.ringConfig || gltf.userData?.ringConfig;
    if (cfg) project = cfg;
  }
  root.updateMatrixWorld(true);
  const meshes = [];
  const nodes = [];
  let idx = 0;
  root.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position) {
      const parts = splitByGroups(o.geometry, o.material);
      parts.forEach((p, k) => {
        const g = (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone());
        g.applyMatrix4(o.matrixWorld);
        g.clearGroups();
        meshes.push({
          idx: idx++,
          name: (o.name || 'Objet').normalize('NFC') + (parts.length > 1 ? `#${k + 1}` : ''),
          materialName: (p.material?.name || '').normalize('NFC'),
          geometry: g,
          userData: o.userData || {},
        });
      });
    } else if (o !== root) {
      nodes.push({ name: (o.name || '').normalize('NFC'), type: o.type, position: o.getWorldPosition(new THREE.Vector3()).toArray() });
    }
  });
  return { format: fmt, meshes, nodes, project };
}

/**
 * Pipeline complet. Retourne le modèle normalisé prêt pour le viewer.
 * options : { onProgress(pct, label), unit ('mm'|'cm'|'m'|'inch'), flipUp, keepDuplicates }
 */
export async function importModel(buffer, fileName = 'modele.fbx', options = {}) {
  const { onProgress = () => {}, unit = null, flipUp = false, keepDuplicates = false } = options;
  onProgress(5, 'Lecture du fichier…');
  await tick();
  const raw = await loadRaw(buffer, fileName);
  if (!raw.meshes.length) throw new Error('Aucune géométrie trouvée dans le fichier.');
  const report = { notes: [], dupes: [], format: raw.format };
  onProgress(25, 'Analyse des pièces…');
  await tick();

  // 1. Descripteurs + doublons superposés
  let pieces = raw.meshes.map((m) => ({ ...m, id: m.userData?.pieceId || 'p' + String(m.idx + 1).padStart(2, '0'), ...describeGeometry(m.geometry) }));
  if (!keepDuplicates) {
    const { keep, dupes } = findDuplicates(pieces);
    report.dupes = dupes;
    for (const d of dupes) pieces.find((p) => p.id === d.id).geometry.dispose();
    pieces = keep;
    if (dupes.length) report.notes.push(`${dupes.length} pièce(s) en double (superposées) ignorée(s) : ${dupes.map((d) => d.name).join(', ')}.`);
  }

  // 2. Unités (taille de la boîte englobante globale, repère du fichier)
  const fileBox = new THREE.Box3();
  for (const p of pieces) fileBox.union(p.geometry.boundingBox);
  const fileSize = fileBox.getSize(new THREE.Vector3());
  const unitInfo = unit ? { unit, factor: UNIT_FACTORS[unit] } : guessUnitToMM(Math.max(fileSize.x, fileSize.y, fileSize.z));
  report.unit = unitInfo.unit;
  report.notes.push(`Unité ${unit ? 'choisie' : 'détectée'} : ${unitInfo.unit}.`);

  // 3. Classification (repère du fichier, invariante d'échelle)
  const fileMax = Math.max(...fileSize.toArray());
  for (const p of pieces) { p.kind = p.userData?.kind || classifyKind({ ...p, name: p.name }, { modelMax: fileMax }); }
  const gems = pieces.filter((p) => p.kind === 'gem');
  const fileCenter = fileBox.getCenter(new THREE.Vector3());

  // 4. Normalisation : doigt = Z, dessus = +Y, mm, centré
  const fingerAxis = detectFingerAxis(fileSize.toArray());
  const R = buildNormalizationMatrix({ fingerAxis, gemCenters: gems.map((g) => g.center), bboxCenter: fileCenter.toArray(), flipUp });
  const M = new THREE.Matrix4()
    .makeScale(unitInfo.factor, unitInfo.factor, unitInfo.factor)
    .multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-fileCenter.x, -fileCenter.y, -fileCenter.z));

  // 5. Traitement par pièce (async pour garder l'UI vivante)
  const group = new THREE.Group();
  group.name = 'ring-content';
  const outPieces = [];
  let n = 0;
  for (const p of pieces) {
    let g = p.geometry;
    g.applyMatrix4(M);
    if (p.kind === 'gem') {
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      g.computeVertexNormals(); // pierres : facettes planes (géométrie non indexée)
    } else {
      if (!g.attributes.uv) g = generateBoxUV(g);
      if (!g.attributes.normal) g.computeVertexNormals();
    }
    g = mergeVertices(g, 1e-4); // 3× moins de sommets, sans toucher aux arêtes vives (normales différentes)
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: p.kind === 'gem' ? 0x88aaff : 0xc9a24a, metalness: p.kind === 'gem' ? 0 : 1, roughness: 0.2 }));
    mesh.name = p.name;
    mesh.userData = { pieceId: p.id, kind: p.kind };
    group.add(mesh);
    outPieces.push({ id: p.id, name: p.name, materialName: p.materialName, mesh, kind: p.kind, tris: p.tris, verts: g.attributes.position.count, hasUV: p.hasUV });
    n++;
    onProgress(25 + Math.round((n / pieces.length) * 45), `Optimisation des pièces (${n}/${pieces.length})…`);
    await tick();
  }

  // 6. Descripteurs dans le repère normalisé → zones
  const desc = outPieces.map((p) => {
    const d = describeGeometry(p.mesh.geometry);
    return { id: p.id, name: p.name, materialName: p.materialName, tris: p.tris, hasUV: p.hasUV, size: d.size, center: d.center, kind: p.kind };
  });
  const { zones, roles } = detectZones(desc);
  for (const p of outPieces) p.role = roles[p.id];

  // 7. BVH + mesure du trou du doigt
  onProgress(75, 'Index de sélection (BVH)…');
  await tick();
  for (const p of outPieces) p.mesh.geometry.computeBoundsTree();
  const box = new THREE.Box3().setFromObject(group);
  const metalMeshes = outPieces.filter((p) => p.kind === 'metal').map((p) => p.mesh);
  group.updateMatrixWorld(true);
  onProgress(88, 'Mesure du diamètre intérieur…');
  await tick();
  const hole = metalMeshes.length ? measureHole(metalMeshes, box) : null;
  const root = new THREE.Group();
  root.name = 'ring-root';
  root.add(group);
  let innerDiameter = null, frSize = null;
  if (hole) {
    group.position.set(-hole.cx, -hole.cy, 0); // origine du modèle = centre du doigt
    innerDiameter = hole.diameter;
    frSize = frenchRingSize(hole.diameter);
    report.notes.push(`Diamètre intérieur ≈ ${hole.diameter.toFixed(1)} mm (taille FR ≈ ${frSize}).`);
  } else {
    report.notes.push('Diamètre intérieur non mesuré (trou du doigt introuvable).');
  }
  group.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(root);
  const size = finalBox.getSize(new THREE.Vector3()).toArray();

  // 8. Vues prédéfinies issues des caméras du fichier (Face, Dessus, Droite…)
  const views = [];
  const normal3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().extractRotation(M));
  for (const nd of raw.nodes) {
    if (!/face|dessus|droite|gauche|derri|persp|front|top|right|left|back/i.test(nd.name)) continue;
    const v = new THREE.Vector3(...nd.position).sub(fileCenter).applyMatrix3(normal3).normalize();
    if (v.lengthSq() > 0.5) views.push({ name: nd.name, dir: v.toArray() });
  }
  onProgress(100, 'Terminé');
  return {
    root, content: group, pieces: outPieces, zones,
    views,
    meta: { fileName, format: raw.format, unit: unitInfo.unit, size, innerDiameter, frSize, fingerAxis: 'Z', up: '+Y' },
    report,
    project: raw.project,
  };
}

/** Quelques statistiques utiles (affichées dans le rapport d'import). */
export function summarize(model) {
  const tris = model.pieces.reduce((a, p) => a + p.tris, 0);
  return { pieces: model.pieces.length, zones: model.zones.length, tris };
}

export { norm };
