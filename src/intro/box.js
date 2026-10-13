// Écrin de la marque, d'après la charte (Storez Studio) : boîte carrée en laque bordeaux, couvercle à pans coupés
// (dessus plat plus sombre), intérieur en suédine noire, logo marqué à chaud or (Kurtz 232) sous le couvercle.
// Dimensions proportionnelles à S (côté de la boîte, en unités de la scène = mm).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const COL = { lac: '#2a050c', lacTop: '#220409', lacRim: '#180306', suede: '#2a0612', suedeTop: '#16030a', rim: '#320713', black: '#070708', sheen: '#3a0f1b', blackSheen: '#16161a', gold: '#ddd5ac' };

let pileTex = null;
let ENV = null; // environnement de la scène : sans lui, envMapIntensity du matériau est sans effet (three ≥ r163)
/** Grain de suédine : bruit fin utilisé comme bump. */
function pile() {
  if (pileTex || typeof document === 'undefined') return pileTex;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  let s = 99; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) { const v = 90 + rnd() * 120; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  pileTex = new THREE.CanvasTexture(c); pileTex.wrapS = pileTex.wrapT = THREE.RepeatWrapping; pileTex.repeat.set(10, 10);
  return pileTex;
}
function suede(color, sheen, side = THREE.FrontSide, env = 0.5, sheenAmt = 0.45) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, sheen: sheenAmt, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.5, bumpMap: pile(), bumpScale: 0.5, side, envMap: ENV, envMapIntensity: env });
}

/** Laque brillante (charte V3 : coffret bordeaux laqué) : base lisse + vernis, reflets de l'environnement. */
function lacquer(color, env = 0.75) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.5, envMap: ENV, envMapIntensity: env });
}

/** SVG du logo en or → texture (canvas) ; `svg` utilise currentColor. */
function logoTexture(svg, ratio) {
  return new Promise((resolve) => {
    if (!svg) return resolve(null);
    const W = 1024, H = Math.round(W / ratio);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t);
    };
    img.onerror = () => resolve(null);
    const body = svg.replace(/currentColor/g, '#ffffff');
    const withSize = body.replace('<svg', '<svg width="1024"');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withSize);
  });
}

/** Normales à plat : un CylinderGeometry à 4 segments aurait des normales radiales interpolées → faces bombées, reflets en traînées. */
const flat = (g) => { const n = g.toNonIndexed(); n.computeVertexNormals(); g.dispose(); return n; };
const squareTube = (side, h, open = true) => flat(new THREE.CylinderGeometry(side / Math.SQRT2, side / Math.SQRT2, h, 4, 1, open).rotateY(Math.PI / 4));

/** Coque laquée à coins verticaux arrondis et arêtes adoucies (extrusion biseautée), de y = 0 à y = h ; `hole` = côté d'une ouverture carrée. */
function roundedShell(w, h, hole = 0, rr = 0.07 * w, bev = 0.025 * w) {
  const o = (w - 2 * bev) / 2, r = rr;
  const sh = new THREE.Shape();
  sh.moveTo(-o + r, -o); sh.lineTo(o - r, -o); sh.absarc(o - r, -o + r, r, -Math.PI / 2, 0);
  sh.lineTo(o, o - r); sh.absarc(o - r, o - r, r, 0, Math.PI / 2);
  sh.lineTo(-o + r, o); sh.absarc(-o + r, o - r, r, Math.PI / 2, Math.PI);
  sh.lineTo(-o, -o + r); sh.absarc(-o + r, -o + r, r, Math.PI, 1.5 * Math.PI);
  if (hole > 0) { const i = hole / 2 + bev, p = new THREE.Path(); p.moveTo(-i, -i); p.lineTo(i, -i); p.lineTo(i, i); p.lineTo(-i, i); p.closePath(); sh.holes.push(p); } // ouverture (sens inverse du contour)
  let g = new THREE.ExtrudeGeometry(sh, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, bev, 0);
  g = toCreasedNormals(g, Math.PI / 5); // arêtes douces, plans bien plats
  return g;
}

/** Contour carré à coins arrondis (sens trigonométrique vu de dessus), à la hauteur y. */
function roundedRing(side, r, y, n = 6) {
  const pts = [], c = side / 2 - r;
  for (const [cx, cz, a0] of [[c, c, 0], [-c, c, 90], [-c, -c, 180], [c, -c, 270]]) {
    for (let i = 0; i <= n; i++) { const a = ((a0 + (90 * i) / n) * Math.PI) / 180; pts.push(new THREE.Vector3(cx + r * Math.cos(a), y, cz + r * Math.sin(a))); }
  }
  return pts;
}
/** Habillage entre contours superposés (normales vers l'extérieur) ; `cap` ferme le dernier contour (éventail). */
function loft(rings, capTop, capBottom) {
  const pos = [], push = (a, b, c) => { // oriente chaque triangle vers l'extérieur de la pièce
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    const m = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3); m.y = 0;
    const out = capTop || capBottom ? 0 : 1;
    pos.push(...(out && n.dot(m) < 0 ? [a, c, b] : [a, b, c]).flatMap((v) => [v.x, v.y, v.z]));
  };
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1], N = A.length;
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; push(A[i], A[j], B[j]); push(A[i], B[j], B[i]); }
  }
  return pos;
}
function cap(ring, up) {
  const c = new THREE.Vector3(0, ring[0].y, 0), pos = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ny = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(a, c), new THREE.Vector3().subVectors(b, c)).y; // >0 : triangle vers le haut
    pos.push(...((ny > 0) === up ? [c, a, b] : [c, b, a]).flatMap((v) => [v.x, v.y, v.z]));
  }
  return pos;
}
/** Couvercle à pans coupés (pyramide plate) : paroi droite arrondie, épaule inclinée, dessus plat plus sombre. */
function lidGeometries(S, h1, h, topSide) {
  const r = 0.07 * S, rt = 0.045 * S, b = 0.012 * S;
  const rings = [roundedRing(S - 2 * b, r, 0), roundedRing(S, r + b, b), roundedRing(S, r + b, h1), roundedRing(S - 0.012 * S, r + b, h1 + 0.012 * S), roundedRing(topSide + 0.02 * S, rt + 0.01 * S, h - 0.006 * S), roundedRing(topSide, rt, h)];
  const mk = (pos, creased) => {
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g = creased ? toCreasedNormals(g, Math.PI / 6) : (g.computeVertexNormals(), g);
    return g;
  };
  const side = mk(loft(rings), true), P = side.attributes.position, Nn = side.attributes.normal, wall = [], wn = [], slope = [], sn = [];
  for (let i = 0; i < P.count; i += 3) { // sépare la paroi verticale de l'épaule inclinée (reflets différents)
    const dst = (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3 > h1 ? [slope, sn] : [wall, wn];
    for (let k = 0; k < 3; k++) { dst[0].push(P.getX(i + k), P.getY(i + k), P.getZ(i + k)); dst[1].push(Nn.getX(i + k), Nn.getY(i + k), Nn.getZ(i + k)); }
  }
  const part = (a, n) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); return g; };
  side.dispose();
  return { wall: part(wall, wn), slope: part(slope, sn), top: mk(cap(rings.at(-1), true), false), bottom: mk(cap(rings[0], false), false) };
}
function squareRing(outer, inner) {
  const sh = new THREE.Shape(); const o = outer / 2, i = inner / 2;
  sh.moveTo(-o, -o); sh.lineTo(o, -o); sh.lineTo(o, o); sh.lineTo(-o, o); sh.closePath();
  if (inner > 0) { const h = new THREE.Path(); h.moveTo(-i, -i); h.lineTo(-i, i); h.lineTo(i, i); h.lineTo(i, -i); h.closePath(); sh.holes.push(h); }
  return new THREE.ShapeGeometry(sh);
}

/**
 * Construit l'écrin. Origine du groupe = centre du fond de la base. Retourne { group, lid, S, floorY, totalH, lidH, dispose, setOpacity }.
 */
export async function buildBox(S, { logoSvg = null, logoRatio = 4.2, env = null } = {}) {
  ENV = env;
  const hb = 0.3 * S, ins = 0.09 * S, hc = 0.07 * S, t = 0.03 * S;           // base, retrait du collier, hauteur du collier, épaisseur
  const floorY = 0.62 * hb;                                                      // fond de l'écrin (coussin noir)
  const mats = []; const geos = [];
  const M = (m) => { mats.push(m); return m; }; const G = (g) => { geos.push(g); return g; };
  const bord = M(lacquer(COL.lac)), bordTop = M(lacquer('#3a0711', 0.03)), bordRim = M(lacquer(COL.lacRim));
  const blk = M(suede(COL.black, COL.blackSheen, THREE.FrontSide, 0.03, 0.08)), blkIn = M(suede(COL.black, COL.blackSheen, THREE.BackSide, 0.03, 0.08));
  const group = new THREE.Group();
  const add = (parent, geo, mat, y = 0, rx = 0) => { const m = new THREE.Mesh(G(geo), mat); m.position.y = y; m.rotation.x = rx; parent.add(m); return m; };

  // ----- Base : coque laquée ouverte sur le dessus, collier et intérieur noir -----
  const lidH = 0.4 * S;
  add(group, roundedShell(S, hb, S - 2 * ins), bord);                                      // paroi + épaulement (ouvert au centre)
  add(group, squareTube(S - 2 * ins, hc), bord, hb + hc / 2);                              // collier (extérieur)
  add(group, squareRing(S - 2 * ins, S - 2 * ins - 2 * t), bordRim, hb + hc, -Math.PI / 2); // tranche du collier
  add(group, squareTube(S - 2 * ins - 2 * t, hb + hc - floorY), blkIn, floorY + (hb + hc - floorY) / 2); // intérieur noir
  add(group, squareRing(S - 2 * ins - 2 * t, 0), blk, floorY, -Math.PI / 2);                // coussin

  // ----- Couvercle laqué (origine = centre du bas du couvercle, posé sur l'épaulement) -----
  const lid = new THREE.Group(); lid.position.y = hb; group.add(lid);
  const lg = lidGeometries(S, 0.2 * S, lidH, 0.42 * S);
  add(lid, lg.wall, bord); add(lid, lg.slope, M(lacquer('#34060f', 0.1))); add(lid, lg.top, bordTop); add(lid, lg.bottom, bord);
  // dessous du couvercle : plafond noir encadré d'une tranche laquée
  add(lid, squareRing(S - 2 * t, 0), blk, -0.02, Math.PI / 2);

  // logo or marqué à chaud, centré sous le plafond
  const tex = await logoTexture(logoSvg, logoRatio);
  let logoMat = null;
  if (tex) {
    const w = 0.3 * S, h = w / logoRatio;
    logoMat = M(new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 0.85, roughness: 0.38, alphaMap: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMap: ENV, envMapIntensity: 1.2 }));
    const p = new THREE.Mesh(G(new THREE.PlaneGeometry(w, h)), logoMat);
    p.rotation.x = Math.PI / 2; p.position.y = -0.04; lid.add(p);
  }

  const totalH = hb + lidH;
  const setOpacity = (o) => {
    for (const m of mats) { m.transparent = o < 1 || m === logoMat; m.opacity = o; m.needsUpdate = false; }
  };
  const dispose = () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); tex?.dispose(); };
  return { group, lid, S, floorY, totalH, lidH, hb, setOpacity, dispose, logo: !!tex };
}
