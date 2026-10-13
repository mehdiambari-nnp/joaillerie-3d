// Écrin de la marque, d'après la charte (Storez Studio) : boîte carrée en laque bordeaux, couvercle à pans coupés
// (dessus plat plus sombre), intérieur en suédine noire, logo marqué à chaud or (Kurtz 232) sous le couvercle.
// Dimensions proportionnelles à S (côté de la boîte, en unités de la scène = mm).
import * as THREE from 'three';

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
function suede(color, sheen, side = THREE.FrontSide, env = 0.5) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, sheen: 0.45, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.5, bumpMap: pile(), bumpScale: 0.5, side, envMap: ENV, envMapIntensity: env });
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

const squareTube = (side, h, open = true) => new THREE.CylinderGeometry(side / Math.SQRT2, side / Math.SQRT2, h, 4, 1, open).rotateY(Math.PI / 4);
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
  const hb = 0.32 * S, ins = 0.07 * S, hc = 0.07 * S, t = 0.03 * S;           // base, retrait du collier, hauteur du collier, épaisseur
  const hw = 0.3 * S, rise = 0.17 * S, topW = 0.42 * S;                          // couvercle : paroi droite, pans coupés, dessus
  const floorY = 0.62 * hb;                                                      // fond de l'écrin (coussin noir)
  const mats = []; const geos = [];
  const M = (m) => { mats.push(m); return m; }; const G = (g) => { geos.push(g); return g; };
  const bord = M(lacquer(COL.lac)), bordTop = M(lacquer(COL.lacTop, 0.3)), bordRim = M(lacquer(COL.lacRim));
  const blk = M(suede(COL.black, COL.blackSheen, THREE.FrontSide, 0.1)), blkIn = M(suede(COL.black, COL.blackSheen, THREE.BackSide, 0.1));
  const group = new THREE.Group();
  const add = (parent, geo, mat, y = 0, rx = 0) => { const m = new THREE.Mesh(G(geo), mat); m.position.y = y; m.rotation.x = rx; parent.add(m); return m; };

  // ----- Base : paroi, épaulement, collier, intérieur noir -----
  add(group, squareTube(S, hb), bord, hb / 2);
  add(group, new THREE.CylinderGeometry(S / Math.SQRT2, S / Math.SQRT2, 0.001, 4, 1).rotateY(Math.PI / 4), bordRim, 0.0005); // dessous
  add(group, squareRing(S, S - 2 * ins), bordRim, hb, -Math.PI / 2);                       // épaulement
  add(group, squareTube(S - 2 * ins, hc), bord, hb + hc / 2);                              // collier (extérieur)
  add(group, squareRing(S - 2 * ins, S - 2 * ins - 2 * t), bordRim, hb + hc, -Math.PI / 2); // tranche du collier
  add(group, squareTube(S - 2 * ins - 2 * t, hb + hc - floorY), blkIn, floorY + (hb + hc - floorY) / 2); // intérieur noir
  add(group, squareRing(S - 2 * ins - 2 * t, 0), blk, floorY, -Math.PI / 2);                // coussin

  // ----- Couvercle (origine = centre du bas du couvercle, posé sur l'épaulement) -----
  const lid = new THREE.Group(); lid.position.y = hb; group.add(lid);
  add(lid, squareTube(S, hw), bord, hw / 2);
  const frustum = (top, bottom, h, y, mat) => add(lid, new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4, 1, true).rotateY(Math.PI / 4), mat, y);
  frustum(topW, S, rise, hw + rise / 2, bord);
  add(lid, squareRing(topW, 0), bordTop, hw + rise, -Math.PI / 2);                           // dessus plat, plus sombre
  // intérieur du couvercle : suédine noire + tranche bordeaux
  add(lid, squareTube(S - 2 * t, hw), blkIn, hw / 2);
  frustum(topW - 2 * t, S - 2 * t, rise, hw + rise / 2, blkIn);
  add(lid, squareRing(topW - 2 * t, 0), blk, hw + rise - 0.01, Math.PI / 2);                  // plafond (face vers le bas)
  add(lid, squareRing(S, S - 2 * t), bordRim, 0, Math.PI / 2);                                // tranche basse du couvercle

  // logo or marqué à chaud, centré sous le plafond
  const tex = await logoTexture(logoSvg, logoRatio);
  let logoMat = null;
  if (tex) {
    const w = 0.3 * S, h = w / logoRatio;
    logoMat = M(new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 0.85, roughness: 0.38, alphaMap: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMap: ENV, envMapIntensity: 1.2 }));
    const p = new THREE.Mesh(G(new THREE.PlaneGeometry(w, h)), logoMat);
    p.rotation.x = Math.PI / 2; p.position.y = hw + rise - 0.03; lid.add(p);
  }

  const totalH = hb + hw + rise;
  const setOpacity = (o) => {
    for (const m of mats) { m.transparent = o < 1 || m === logoMat; m.opacity = o; m.needsUpdate = false; }
  };
  const dispose = () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); tex?.dispose(); };
  return { group, lid, S, floorY, totalH, lidH: hw + rise, hb, setOpacity, dispose, logo: !!tex };
}
