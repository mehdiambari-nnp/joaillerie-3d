import './_node-env.js';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { nonConvexity, isConvexSolid, describeGeometry } from '../../src/import/analysis.js';
import { classifyKind, detectZones } from '../../src/import/zones.js';

// Cas réel qui a motivé ces règles : la pierre centrale d'une CAO exportée avec UV, ~1 200 triangles et un matériau générique
// était classée « métal » (et rangée avec les paniers), tandis qu'un pavé de petites pierres décalait le « centre » des pierres.
const stone = () => new THREE.IcosahedronGeometry(3.5, 8);                      // ≈ 1 300 triangles, UV, convexe
const ringBand = () => new THREE.TorusGeometry(9, 1.2, 24, 64);                  // creux : non convexe
const bezel = () => { const g = new THREE.TorusGeometry(4, 0.6, 12, 32); return g; };

describe('nonConvexity / isConvexSolid', () => {
  it('une pierre (solide convexe) est convexe, même maillée finement avec des UV', () => {
    const g = stone(); expect(g.attributes.uv).toBeTruthy(); expect(g.attributes.position.count).toBeGreaterThan(1000);
    expect(nonConvexity(g)).toBeLessThan(0.001); expect(isConvexSolid(g)).toBe(true);
  });
  it('un anneau, un chaton ou une griffe courbe ne sont pas convexes', () => {
    expect(isConvexSolid(ringBand())).toBe(false); expect(isConvexSolid(bezel())).toBe(false);
    expect(nonConvexity(ringBand())).toBeGreaterThan(0.05);
  });
  it('indépendant de l\'orientation des normales (maillage retourné)', () => {
    const g = stone().toNonIndexed(); const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); }
    expect(isConvexSolid(g)).toBe(true);
  });
  it('describeGeometry expose `convex`', () => { expect(describeGeometry(stone()).convex).toBe(true); expect(describeGeometry(ringBand()).convex).toBe(false); });
});

describe('classifyKind : géométrie', () => {
  const MAX = 24;
  const p = (o) => ({ name: 'Objet_99', materialName: 'Matériau_2', tris: 1204, hasUV: true, size: [7, 4, 9], convex: true, ...o });
  it('solide convexe de taille notable, avec UV et maillage dense : pierre', () => expect(classifyKind(p(), { modelMax: MAX })).toBe('gem'));
  it('même forme non convexe : métal', () => expect(classifyKind(p({ convex: false }), { modelMax: MAX })).toBe('metal'));
  it('grain minuscule (convexe mais < 2 % du modèle) : métal', () => expect(classifyKind(p({ size: [0.2, 1.2, 0.3] }), { modelMax: MAX })).toBe('metal'));
  it('les mots-clés priment (chaton nommé « metal » convexe : métal)', () => expect(classifyKind(p({ materialName: 'Metal' }), { modelMax: MAX })).toBe('metal'));
  it('règle d\'origine conservée : peu de triangles et sans UV : pierre', () => expect(classifyKind({ name: 'x', materialName: 'y', tris: 176, hasUV: false, size: [1, 1, 1] }, { modelMax: MAX })).toBe('gem'));
  it('pièce non convexe, dense, avec UV : métal', () => expect(classifyKind(p({ convex: false, tris: 30000, size: [20, 12, 3] }), { modelMax: MAX })).toBe('metal'));
});

describe('detectZones : pierre centrale et griffes', () => {
  const piece = (id, kind, size, center, tris = 176) => ({ id, name: id, materialName: 'M', kind, tris, hasUV: kind === 'metal', size, center });
  const pave = Array.from({ length: 30 }, (_, i) => piece('v' + i, 'gem', [1, 1, 1.2], [-8 + (i % 6) * 1.2, 11, -4 + Math.floor(i / 6) * 2]));
  it('la pierre centrale est la plus grosse, pas celle proche du barycentre d\'un pavé', () => {
    const centre = piece('c', 'gem', [7, 4, 9], [0, 12, 0], 1204);
    const { roles } = detectZones([...pave, centre, piece('shank', 'metal', [24, 12, 3], [0, 0, 0], 60000)]);
    expect(roles.c).toBe('gem-center');
    expect(pave.every((g) => roles[g.id] === 'gem-side')).toBe(true);
  });
  it('sans pierre nettement plus grosse : repli sur la pierre proche du barycentre', () => {
    const gems = [piece('a', 'gem', [3, 3, 3], [-5, 0, 0]), piece('b', 'gem', [3, 3, 3], [0, 0, 0]), piece('c', 'gem', [3, 3, 3], [5, 0, 0])];
    expect(detectZones([...gems, piece('s', 'metal', [24, 12, 3], [0, 0, 0], 60000)]).roles.b).toBe('gem-center');
  });
  it('petite pièce de métal très maillée (3 400 triangles, 3 mm) : griffe, pas chaton', () => {
    const { roles } = detectZones([piece('g1', 'gem', [7, 4, 9], [0, 12, 0], 1204), piece('shank', 'metal', [24, 12, 3], [0, 0, 0], 60000), piece('claw', 'metal', [3, 2, 3.4], [4, 12, 4], 3426), piece('bezel', 'metal', [8.5, 2.2, 10.5], [0, 11.8, 0], 918)]);
    expect(roles.claw).toBe('claw'); expect(roles.bezel).toBe('setting');
  });
  it('le `kind` décidé à l\'import prime sur la re-classification par les noms', () => {
    const { roles } = detectZones([{ ...piece('x', 'gem', [7, 4, 9], [0, 12, 0], 1204), materialName: 'Matériau_2' }, piece('shank', 'metal', [24, 12, 3], [0, 0, 0], 60000)]);
    expect(roles.x).toBe('gem');
  });
});
