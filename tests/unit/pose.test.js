import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeRingPose, focalPx, FINGERS } from '../../src/tryon/pose.js';
import { OneEuro } from '../../src/tryon/oneEuro.js';

// Main droite à plat, dos vers la caméra, doigts vers le haut (repère MediaPipe : y vers le bas).
function syntheticHand({ Z = 0.35, W = 720, H = 1280, fov = 66, cx = 0, cy = 0, mirrorX = false } = {}) {
  const f = focalPx(W, H, fov);
  const P = {
    0: [0, 0], 1: [-0.03, -0.02], 2: [-0.045, -0.045], 3: [-0.055, -0.065], 4: [-0.06, -0.085],
    5: [-0.03, -0.09], 6: [-0.034, -0.125], 7: [-0.036, -0.15], 8: [-0.037, -0.17],
    9: [-0.005, -0.095], 10: [-0.006, -0.135], 11: [-0.006, -0.162], 12: [-0.006, -0.185],
    13: [0.02, -0.09], 14: [0.022, -0.128], 15: [0.023, -0.152], 16: [0.024, -0.172],
    17: [0.04, -0.078], 18: [0.045, -0.108], 19: [0.047, -0.127], 20: [0.048, -0.142],
  };
  const wl = [], lm = [];
  for (let i = 0; i < 21; i++) {
    const [x, y] = P[i];
    wl.push({ x: mirrorX ? -x : x, y, z: 0 });
    const X = cx + (mirrorX ? -x : x), Y = cy + y;
    lm.push({ x: (W / 2 + (f * X) / Z) / W, y: (H / 2 + (f * Y) / Z) / H, z: 0 });
  }
  return { lm, wl, W, H, f };
}

describe('pose de la bague (MediaPipe → three.js)', () => {
  it('retrouve la profondeur et la position sur l’annulaire', () => {
    const { lm, wl, W, H } = syntheticHand({ Z: 0.35 });
    const pose = computeRingPose({ lm, wl, label: 'Left', width: W, height: H });
    // l'échelle vient de la taille moyenne d'une paume : ±6 % suffisent pour un aperçu indicatif
    expect(Math.abs(pose.depth - 0.35) / 0.35).toBeLessThan(0.06);
    expect(Math.abs(pose.position.z + 0.35) / 0.35).toBeLessThan(0.06);
    // point attendu : 36 % entre MCP(13) et PIP(14), à la profondeur estimée
    const k = pose.depth / 0.35;
    const ex = (0.02 + 0.002 * 0.36) * k, ey = -(0.09 + 0.038 * 0.36) * k; // mètres, y vers le haut
    expect(pose.position.x).toBeCloseTo(ex, 3);
    expect(pose.position.y).toBeCloseTo(-ey, 3);
  });
  it('l’échelle varie en 1/profondeur', () => {
    const a = syntheticHand({ Z: 0.3 }), b = syntheticHand({ Z: 0.6 });
    const pa = computeRingPose({ ...a, label: 'Left', width: a.W, height: a.H });
    const pb = computeRingPose({ ...b, label: 'Left', width: b.W, height: b.H });
    expect(pb.depth / pa.depth).toBeCloseTo(2, 2);
  });
  it('oriente l’axe de la bague vers le bout du doigt et le dessus vers la caméra (dos de la main)', () => {
    const { lm, wl, W, H } = syntheticHand();
    const pose = computeRingPose({ lm, wl, label: 'Left', width: W, height: H });
    expect(pose.axis.y).toBeGreaterThan(0.99);
    expect(pose.top.z).toBeGreaterThan(0.95); // +z = vers la caméra
    // le repère local +Z (axe du doigt) doit pointer vers le haut, +Y (dessus) vers la caméra
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
    const y = new THREE.Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
    expect(z.y).toBeGreaterThan(0.99);
    expect(y.z).toBeGreaterThan(0.95);
  });
  it('dessus vers la caméra pour les deux mains (dos visible) ; « retourner » l’inverse', () => {
    const { lm, wl, W, H } = syntheticHand({ mirrorX: true }); // main gauche, dos à la caméra
    const left = computeRingPose({ lm, wl, label: 'Right', width: W, height: H });
    expect(left.top.z).toBeGreaterThan(0.95);
    const right = computeRingPose({ ...syntheticHand(), label: 'Left', width: 720, height: 1280 });
    expect(right.top.z).toBeGreaterThan(0.95);
    const flipped = computeRingPose({ lm, wl, label: 'Right', width: W, height: H, flip: true });
    expect(flipped.top.z).toBeLessThan(-0.95);
  });
  it('gère un autre doigt', () => {
    const { lm, wl, W, H } = syntheticHand();
    const m = computeRingPose({ lm, wl, label: 'Left', width: W, height: H, finger: 'middle' });
    expect(Object.keys(FINGERS)).toContain('middle');
    expect(m.position.x).toBeLessThan(0.01);
  });
  it('retourne null si les points manquent', () => {
    expect(computeRingPose({ lm: [], wl: [], width: 10, height: 10 })).toBeNull();
  });
});

describe('filtre One Euro', () => {
  it('lisse le bruit mais suit un mouvement lent', () => {
    const f = new OneEuro(1, 0.01, 1);
    let out = 0, noisy = 0;
    for (let i = 0; i < 100; i++) { noisy = 10 + (i % 2 ? 0.5 : -0.5); out = f.filter(noisy, i / 30); }
    expect(Math.abs(out - 10)).toBeLessThan(0.3);
    const g = new OneEuro(1, 0.01, 1);
    for (let i = 0; i < 60; i++) out = g.filter(i * 0.1, i / 30); // rampe
    expect(Math.abs(out - 5.9)).toBeLessThan(0.8);
  });
});
