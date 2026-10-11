// LOD pour l'essayage : simplifie les métaux (≈ 25 % des triangles) avec meshoptimizer ; les pierres sont déjà légères.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';

/** Remplace temporairement la géométrie des pièces métal ; retourne une fonction de restauration. */
export async function applyTryOnLOD(pieces, ratio = 0.25) {
  await MeshoptSimplifier.ready;
  const swapped = [];
  let before = 0, after = 0;
  for (const p of pieces) {
    const g = p.mesh.geometry;
    before += g.index ? g.index.count / 3 : 0;
    if (p.kind !== 'metal' || !g.index || !MeshoptSimplifier.supported) { after += g.index ? g.index.count / 3 : 0; continue; }
    const idx = g.index.array instanceof Uint32Array ? g.index.array : new Uint32Array(g.index.array);
    const pos = g.attributes.position.array;
    const target = Math.max(300, Math.floor((idx.length * ratio) / 3) * 3);
    const [simplified] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, ['LockBorder']);
    const lod = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) lod.setAttribute(k, a); // buffers partagés
    lod.setIndex(new THREE.BufferAttribute(simplified, 1));
    lod.boundingBox = g.boundingBox; lod.boundingSphere = g.boundingSphere;
    swapped.push({ mesh: p.mesh, original: g, lod });
    p.mesh.geometry = lod;
    after += simplified.length / 3;
  }
  return {
    stats: { before, after },
    restore() { for (const s of swapped) { s.mesh.geometry = s.original; s.lod.dispose(); } },
  };
}
