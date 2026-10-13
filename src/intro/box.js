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
  const bord = M(lacquer(COL.lac)), bordTop = M(lacquer('#3a0711', 0.3)), bordRim = M(lacquer(COL.lacRim));
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
  add(lid, roundedShell(S, lidH), [bordTop, bord]); // [dessus et dessous, côtés]
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
