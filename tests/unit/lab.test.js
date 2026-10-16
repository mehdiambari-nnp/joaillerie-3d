import { describe, it, expect } from 'vitest';
import { sanitizeLab, labPack, labUnpack, LAB_DEFAULT, LAB, initLabs, saveLab, deleteLab } from '../../src/materials/lab.js';
import { packAssign, unpackAssign, sharePayload, encodeShare, decodeShare } from '../../src/state/store.js';
import { normalizeAssignment, resolveMetal, isMaterialFor } from '../../src/materials/library.js';

describe('Atelier d’or', () => {
  it('borne et nettoie les réglages', () => {
    const l = sanitizeLab({ roughness: 9, gain: -3, color: 'rouge', tex: 'inconnu', n: 'Mon|or\n', foo: 1 });
    expect(l.roughness).toBe(1); expect(l.gain).toBe(0.4); expect(l.color).toBe(LAB_DEFAULT.color); expect(l.tex).toBe('none');
    expect(l.n).toBe('Monor'); expect(l.foo).toBeUndefined();
  });
  it('forme compacte : aller-retour sans perte', () => {
    const l = sanitizeLab({ roughness: 0.33, clearcoat: 0.5, color: '#d4a017', n: 'Or chaud' });
    expect(labPack(l).length).toBeLessThan(120);
    expect(labUnpack(labPack(l))).toEqual(l);
  });
  it('voyage dans le lien de partage avec l’éclairage ambiant', () => {
    const l = sanitizeLab({ roughness: 0.4, n: 'Test' });
    const assign = { p1: { m: LAB, l }, p2: { m: LAB, l }, p3: { m: 'rose', f: 'polish' } };
    const p = decodeShare(encodeShare(sharePayload({ modelId: 'x', assign, env: 'overpass', envRot: 10, hidden: [], light: { n: 1.5, x: 1 } })));
    const back = unpackAssign(p.a);
    expect(back.p1).toEqual({ m: LAB, l }); expect(back.p2).toEqual({ m: LAB, l }); expect(back.p3.m).toBe('rose');
    expect(p.i).toEqual([1.5, 1]);
    expect(sharePayload({ modelId: 'x', assign, env: 'a', envRot: 0, hidden: [], light: { n: 1, x: 1 } }).i).toBeUndefined();
  });
  it('s’intègre aux affectations : métal seulement', () => {
    expect(isMaterialFor('metal', LAB)).toBe(true); expect(isMaterialFor('gem', LAB)).toBe(false);
    expect(normalizeAssignment('gem', { m: LAB, l: {} }).m).not.toBe(LAB);
    const r = resolveMetal({ m: LAB, l: { roughness: 0.3, tex: 'brushed' } });
    expect(r.fin.roughness).toBe(0.3); expect(r.fin.brushed).toBe(true); expect(r.lab.gain).toBe(2);
  });

  it('bibliothèque partagée : enregistre, relit et supprime via le service de l’atelier', async () => {
    const store = new Map();
    const labs = {
      list: async () => [...store.values()],
      save: async (it) => { store.set(it.id, { ...it, by: 'Collègue' }); },
      remove: async (id) => { store.delete(id); },
    };
    await initLabs({ labs });
    const list = await saveLab('Or chaud', { roughness: 0.3 }, { n: 1.5, x: 1 });
    expect(list.map((x) => x.name)).toEqual(['Or chaud']);
    expect(list[0].l.roughness).toBe(0.3); expect(list[0].l.n).toBe('Or chaud'); expect(list[0].light.n).toBe(1.5); expect(list[0].by).toBe('Collègue');
    const again = await saveLab('or CHAUD', { roughness: 0.5 }); // même nom : remplacé, pas dupliqué
    expect(again).toHaveLength(1); expect(again[0].l.roughness).toBe(0.5);
    expect(await deleteLab(again[0].id)).toEqual([]);
    await initLabs(null);
  });
  it('serveur refusé : enregistrement signalé (null), pas d’exception', async () => {
    await initLabs({ labs: { list: async () => [], save: async () => { throw new Error('permission-denied'); }, remove: async () => {} } });
    expect(await saveLab('X', {})).toBeNull();
    await initLabs(null);
  });
});
