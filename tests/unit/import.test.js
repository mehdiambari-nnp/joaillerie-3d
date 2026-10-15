import './_node-env.js';
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { importModel } from '../../src/import/fbxImport.js';
import { fitCircle } from '../../src/import/analysis.js';
import { frenchRingSize, guessUnitToMM, norm } from '../../src/import/zones.js';

// Fichier privé, absent du dépôt et de la CI : sans lui, ces tests sont sautés (et non en échec).
const HAS_GEMV = fs.existsSync('assets/test/MAQUETTE_GEMV.fbx');
let model;
beforeAll(async () => {
  if (!HAS_GEMV) return;
  const b = fs.readFileSync('assets/test/MAQUETTE_GEMV.fbx');
  model = await importModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), 'MAQUETTE_GEMV.fbx');
});

describe.skipIf(!HAS_GEMV)('MAQUETTE_GEMV.fbx (fichier de test de référence, brief §3.3)', () => {
  it('détecte les 3 pièces en double et garde 24 pièces utiles', () => {
    expect(model.report.dupes.map((d) => d.name).sort()).toEqual(['Objet_19', 'Objet_20', 'Objet_21']);
    expect(model.pieces).toHaveLength(24);
  });
  it('détecte l’unité en mm et les dimensions hors-tout (≈ 26 × 20 × 30 mm)', () => {
    expect(model.meta.unit).toBe('mm');
    const [x, y, z] = model.meta.size; // repère normalisé : X côté, Y dessus, Z doigt
    expect(x).toBeGreaterThan(25); expect(x).toBeLessThan(27);
    expect(y).toBeGreaterThan(29); expect(y).toBeLessThan(30.5);
    expect(z).toBeGreaterThan(19); expect(z).toBeLessThan(20.5);
  });
  it('propose les 6 zones attendues', () => {
    const names = model.zones.map((z) => z.name);
    expect(names).toEqual(['Pierre centrale', 'Pierres latérales', 'Chaton central', 'Paniers latéraux', 'Griffes', 'Corps']);
    const by = Object.fromEntries(model.zones.map((z) => [z.name, z.pieceIds.length]));
    expect(by['Pierre centrale']).toBe(1);
    expect(by['Pierres latérales']).toBe(2);
    expect(by['Griffes']).toBe(8);
    expect(by['Corps']).toBe(10);
  });
  it('classe le métal « Matériau_11 » (Objet_10) comme métal malgré son matériau différent', () => {
    const p = model.pieces.find((p) => p.name === 'Objet_10');
    expect(p.kind).toBe('metal');
  });
  it('met les pierres au-dessus (Y+) : conversion Z-up → Y-up réussie', () => {
    const gem = model.pieces.find((p) => p.kind === 'gem');
    const box = new THREE.Box3().setFromObject(gem.mesh);
    expect(box.getCenter(new THREE.Vector3()).y).toBeGreaterThan(5);
  });
  it('mesure le diamètre intérieur (≈ 19,5 mm → taille FR 61)', () => {
    expect(model.meta.innerDiameter).toBeGreaterThan(18.5);
    expect(model.meta.innerDiameter).toBeLessThan(20.5);
    expect(model.meta.frSize).toBe(frenchRingSize(model.meta.innerDiameter));
  });
  it('récupère les vues Face / Dessus / Droite du fichier', () => {
    const names = model.views.map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['Face', 'Dessus', 'Droite']));
    const dessus = model.views.find((v) => v.name === 'Dessus');
    expect(dessus.dir[1]).toBeGreaterThan(0.99); // regarde d'en haut = +Y
  });
  it('réduit la mémoire (sommets fusionnés)', () => {
    const verts = model.pieces.reduce((a, p) => a + p.verts, 0);
    const tris = model.pieces.reduce((a, p) => a + p.tris, 0);
    expect(verts).toBeLessThan(tris * 3 * 0.6);
  });
});

describe.skipIf(!HAS_GEMV)('utilitaires', () => {
  it('ajuste un cercle', () => {
    const pts = []; for (let a = 0; a < 6.28; a += 0.2) pts.push([3 + 5 * Math.cos(a), -2 + 5 * Math.sin(a)]);
    const f = fitCircle(pts);
    expect(f.r).toBeCloseTo(5, 3); expect(f.cx).toBeCloseTo(3, 3); expect(f.cy).toBeCloseTo(-2, 3);
  });
  it('devine les unités', () => {
    expect(guessUnitToMM(26).unit).toBe('mm');
    expect(guessUnitToMM(2.6).unit).toBe('cm');
    expect(guessUnitToMM(0.026).unit).toBe('m');
  });
  it('normalise les noms accentués', () => {
    expect(norm('Matériau_11')).toBe('materiau_11');
    expect(norm('Métal')).toBe('metal');
  });
});
