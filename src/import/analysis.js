// Analyse géométrique d'une bague : empreintes, normalisation d'axes, mesure du diamètre intérieur.
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Active le raycast accéléré (BVH) globalement.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Hash d'un échantillon de positions (détection de doublons exacts). */
export function positionHash(geometry, samples = 64) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  let h = 2166136261;
  const step = Math.max(1, Math.floor(n / samples));
  for (let i = 0; i < n; i += step) {
    for (const v of [pos.getX(i), pos.getY(i), pos.getZ(i)]) {
      h ^= Math.round(v * 1000);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16);
}

/** Descripteur léger d'une géométrie (dans le repère courant). */
export function describeGeometry(geometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  const size = b.getSize(new THREE.Vector3()).toArray();
  const center = b.getCenter(new THREE.Vector3()).toArray();
  const verts = geometry.attributes.position.count;
  return {
    verts,
    tris: geometry.index ? geometry.index.count / 3 : verts / 3,
    hasUV: !!geometry.attributes.uv,
    size,
    center,
    hash: positionHash(geometry),
  };
}

/** UV par projection « boîte » (pour les pièces sans UV : nécessaire aux textures procédurales, ex. martelé). */
export function generateBoxUV(geometry, scale = 1 / 6) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      let u, v;
      if (ax >= ay && ax >= az) { u = p.y; v = p.z; } else if (ay >= az) { u = p.x; v = p.z; } else { u = p.x; v = p.y; }
      uv[(i + k) * 2] = u * scale; uv[(i + k) * 2 + 1] = v * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Axe du doigt = axe de plus faible étendue (une bague est plus étroite que large). */
export function detectFingerAxis(size) {
  let k = 0;
  for (let i = 1; i < 3; i++) if (size[i] < size[k]) k = i;
  return k;
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/**
 * Matrice file → repère normalisé : axe du doigt = +Z, dessus (pierres) = +Y, côté = +X.
 * gemCenters : centres des pierres (repère du fichier), bboxCenter : centre de la boîte.
 */
export function buildNormalizationMatrix({ fingerAxis, gemCenters, bboxCenter, flipUp = false }) {
  const fAxis = AXES[fingerAxis].clone();
  // dessus : direction (dans le plan ⊥ doigt) du centre de boîte vers le barycentre des pierres
  const inPlane = [0, 1, 2].filter((i) => i !== fingerAxis);
  let up = null;
  if (gemCenters.length) {
    const c = gemCenters.reduce((a, g) => a.add(new THREE.Vector3(...g)), new THREE.Vector3()).multiplyScalar(1 / gemCenters.length);
    const d = c.sub(new THREE.Vector3(...bboxCenter));
    // on projette sur l'axe principal du plan le plus marqué (CAO alignée sur les axes)
    const i = Math.abs(d.getComponent(inPlane[0])) >= Math.abs(d.getComponent(inPlane[1])) ? inPlane[0] : inPlane[1];
    if (Math.abs(d.getComponent(i)) > 1e-6) up = AXES[i].clone().multiplyScalar(Math.sign(d.getComponent(i)));
  }
  if (!up) up = AXES[fingerAxis === 2 ? 1 : 2].clone(); // repli : Z-up sauf si le doigt est selon Z
  if (flipUp) up.negate();
  const right = new THREE.Vector3().crossVectors(up, fAxis); // X = Y × Z
  const m = new THREE.Matrix4().set(
    right.x, right.y, right.z, 0,
    up.x, up.y, up.z, 0,
    fAxis.x, fAxis.y, fAxis.z, 0,
    0, 0, 0, 1,
  );
  return m;
}

/** Ajustement algébrique d'un cercle (Kåsa) : retourne {cx, cy, r}. */
export function fitCircle(points) {
  const n = points.length;
  if (n < 3) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of points) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const [x, y] of points) {
    const u = x - mx, v = y - my;
    suu += u * u; suv += u * v; svv += v * v;
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const uc = ((suuu + suvv) * svv - (svvv + svuu) * suv) / (2 * det);
  const vc = ((svvv + svuu) * suu - (suuu + suvv) * suv) / (2 * det);
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return { cx: uc + mx, cy: vc + my, r };
}

/**
 * Mesure le trou du doigt. Les meshes doivent avoir un BVH et être dans le repère normalisé
 * (doigt = Z, dessus = +Y), centrés sur leur boîte englobante.
 * On lance des rayons radiaux vers le bas (demi-plan inférieur, toujours fermé par le jonc)
 * depuis une estimation du centre, puis on ajuste un cercle (3 itérations, rejet des aberrations).
 */
export function measureHole(meshes, bbox) {
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const size = bbox.getSize(new THREE.Vector3());
  const zMid = (bbox.min.z + bbox.max.z) / 2;
  const results = [];
  for (const dz of [-0.18, 0, 0.18]) {
    const z = zMid + dz * size.z;
    let cx = (bbox.min.x + bbox.max.x) / 2;
    let cy = bbox.min.y + 0.38 * size.y;
    let fit = null;
    for (let it = 0; it < 4; it++) {
      const pts = [];
      for (let a = 195; a <= 345; a += 3) {
        const th = (a * Math.PI) / 180;
        raycaster.set(new THREE.Vector3(cx, cy, z), new THREE.Vector3(Math.cos(th), Math.sin(th), 0));
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (hit) pts.push([hit.point.x, hit.point.y]);
      }
      let f = fitCircle(pts);
      if (!f) break;
      const inl = pts.filter(([x, y]) => Math.abs(Math.hypot(x - f.cx, y - f.cy) - f.r) < 0.6);
      if (inl.length >= 8) f = fitCircle(inl) || f;
      fit = f; cx = f.cx; cy = f.cy;
    }
    if (fit && fit.r > 3 && fit.r < 20) results.push({ ...fit, z });
  }
  if (!results.length) return null;
  results.sort((a, b) => a.r - b.r);
  const best = results[0]; // plus petit diamètre = celui qui compte pour le doigt
  return { cx: best.cx, cy: best.cy, diameter: 2 * best.r, samples: results.map((r) => 2 * r.r) };
}
