import { describe, it, expect } from 'vitest';
import { normalizeAssignment, resolveGem, resolveMetal, validHex, hexToHsl, hslToHex, METALS, FINISHES, GEMS, GEM_GROUPS, CUSTOM, byId } from '../../src/materials/library.js';
import { packAssign, unpackAssign, buildShareUrl, parseShareHash } from '../../src/state/store.js';

import { GEM_PATTERNS } from '../../src/materials/gem.js';
describe('matériaux', () => {
  it('anciens identifiants convertis', () => {
    expect(normalizeAssignment('metal', { m: 'gold18', f: 'matte' })).toEqual({ m: 'yellow', f: 'satin' });
    expect(normalizeAssignment('metal', { m: 'white18', f: 'polish' }).m).toBe('grey');
    expect(normalizeAssignment('gem', { m: 'moissanite' })).toEqual({ m: 'diamond' });
    expect(normalizeAssignment('gem', { m: 'sapphire' }).m).toBe('blue-medium');
    expect(normalizeAssignment('gem', { m: 'tsavorite' }).m).toBe('green-deep');
  });
  it('teinte libre validée', () => {
    expect(normalizeAssignment('gem', { m: CUSTOM, c: '#ABC' })).toEqual({ m: CUSTOM, c: '#aabbcc' });
    expect(normalizeAssignment('gem', { m: CUSTOM, c: 'zz' }).c).toMatch(/^#[0-9a-f]{6}$/);
    expect(validHex('12ab34')).toBe('#12ab34');
    expect(validHex('#12')).toBeNull();
  });
  it('conversion HSL aller-retour', () => {
    for (const h of ['#e0102c', '#0f9a9c', '#808080', '#f4c430']) expect(hslToHex(...hexToHsl(h))).toBe(h);
  });
  it('le platine est plus blanc que l’or gris', () => {
    const lum = (id) => resolveMetal({ m: id, f: 'polish' }).rgb.reduce((a, b) => a + b, 0);
    expect(lum('platinum')).toBeGreaterThan(lum('grey'));
  });
  it('pierres : nommées par espèce, avec leurs propriétés optiques', () => {
    expect(resolveGem({ m: 'diamond' }).ior).toBeGreaterThan(2.3);
    const ruby = resolveGem({ m: 'red-vivid' }), emerald = resolveGem({ m: 'green-emerald' }), zircon = resolveGem({ m: 'teal' });
    expect(ruby.name).toBe('Rubis'); expect(ruby.ior).toBeCloseTo(1.77, 2);
    expect(emerald.ior).toBeLessThan(ruby.ior); // béryl < corindon
    expect(zircon.ior).toBeGreaterThan(1.9);
    expect(zircon.dispersion).toBeGreaterThan(emerald.dispersion);
    expect(resolveGem({ m: 'diamond' }).dispersion).toBeGreaterThan(zircon.dispersion);
    for (const g of GEMS.filter((x) => !x.opaque && x.id !== 'diamond')) expect(g.ior && g.disp).toBeTruthy();
  });
  it('or jaune : plusieurs nuances, de la plus intense à la plus pâle', () => {
    const ids = ['yellow-deep', 'yellow', 'yellow-light', 'champagne'];
    const blue = (id) => resolveMetal({ m: id, f: 'polish' }).rgb[2];
    for (let i = 1; i < ids.length; i++) expect(blue(ids[i])).toBeGreaterThan(blue(ids[i - 1]));
    expect(METALS.some((m) => /\b(18|24|925)\b|\bk\b/i.test(m.name))).toBe(false);
    expect(FINISHES.map((f) => f.id)).toEqual(['polish', 'satin', 'brushed', 'hammered']);
  });
  it('partage : teinte libre et mode client aller-retour', () => {
    const assign = { a: { m: CUSTOM, c: '#17b2a8' }, b: { m: 'rose', f: 'brushed' }, c: { m: 'diamond' } };
    expect(unpackAssign(packAssign(assign))).toEqual(assign);
    const url = buildShareUrl('https://x/', { modelId: 'm', assign, env: 'studio', envRot: 0, hidden: [], client: true });
    const p = parseShareHash(url.slice(url.indexOf('#')));
    expect(p.client).toBe(true);
    expect(p.assign).toEqual(assign);
  });
});

describe('intensité des finitions', () => {
  it('satiné : plus d’intensité = plus de rugosité', async () => {
    const { resolveMetal } = await import('../../src/materials/library.js');
    const lo = resolveMetal({ m: 'yellow', f: 'satin', i: 0 }).fin.roughness;
    const hi = resolveMetal({ m: 'yellow', f: 'satin', i: 1 }).fin.roughness;
    expect(hi).toBeGreaterThan(lo);
  });
  it('brossé : angle 0–90° ; martelé : taille croissante', async () => {
    const { resolveMetal } = await import('../../src/materials/library.js');
    expect(resolveMetal({ m: 'yellow', f: 'brushed', i: 1 }).fin.grainAngle).toBeCloseTo(Math.PI / 2);
    expect(resolveMetal({ m: 'yellow', f: 'hammered', i: 1 }).fin.hamSize).toBeGreaterThan(resolveMetal({ m: 'yellow', f: 'hammered', i: 0 }).fin.hamSize);
  });
  it('l’intensité est bornée, ignorée sur poli, et survit au lien de partage', async () => {
    const { normalizeAssignment } = await import('../../src/materials/library.js');
    const { packAssign, unpackAssign } = await import('../../src/state/store.js');
    expect(normalizeAssignment('metal', { m: 'yellow', f: 'satin', i: 7 }).i).toBe(1);
    expect(normalizeAssignment('metal', { m: 'yellow', f: 'polish', i: 0.5 }).i).toBeUndefined();
    const a = { p1: { m: 'yellow', f: 'hammered', i: 0.4 }, p2: { m: 'rose', f: 'satin' } };
    expect(unpackAssign(packAssign(a))).toEqual(a);
  });
  it('satiné : aucune texture de relief (pas de rayures)', async () => {
    const { metalParams } = await import('../../src/materials/factory.js');
    const p = metalParams({ m: 'yellow', f: 'satin' });
    expect(p.satin || p.brushed || p.hammered).toBe(false);
  });
});

describe('catalogue de pierres (Atlas chromatique)', () => {
  it('identifiants uniques, famille connue, couleur valide, dureté et espèce renseignées', () => {
    const ids = GEMS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GEMS) {
      expect(GEM_GROUPS.some((x) => x.id === g.group), g.id).toBe(true);
      expect(validHex(g.hex), g.id).toBeTruthy();
      expect(g.mineral && g.mohs && g.note, g.id).toBeTruthy();
    }
  });
  it('sept familles, toutes peuplées ; plus de 45 pierres', () => {
    expect(GEM_GROUPS).toHaveLength(7);
    for (const f of GEM_GROUPS) expect(GEMS.some((g) => g.group === f.id), f.id).toBe(true);
    expect(GEMS.length).toBeGreaterThan(45);
  });
  it('pierres opaques à motif : motif connu et trois teintes ; transparentes : indice et dispersion', () => {
    for (const g of GEMS.filter((x) => x.pattern)) {
      expect(GEM_PATTERNS[g.pattern], g.id).toBeGreaterThan(0);
      expect(g.opaque && validHex(g.hex2) && validHex(g.hex3), g.id).toBeTruthy();
    }
    for (const g of GEMS.filter((x) => !x.opaque && x.id !== 'diamond')) expect(g.ior > 1.4 && g.disp > 0, g.id).toBe(true);
  });
  it('effets : l’alexandrite et l’ametrine ont une seconde teinte', () => {
    expect(resolveGem({ m: 'alexandrite' }).att2).toBeTruthy();
    expect(resolveGem({ m: 'ametrine' }).att2).toBeTruthy();
    expect(resolveGem({ m: 'ruby' }).att2).toBeUndefined();
  });
  it('anciens identifiants toujours reconnus', () => {
    for (const old of ['ruby', 'emerald', 'sapphire', 'amethyst', 'topaz', 'onyx', 'moissanite']) expect(byId(GEMS, normalizeAssignment('gem', { m: old }).m), old).toBeTruthy();
    expect(normalizeAssignment('gem', { m: 'lapis' }).m).toBe('lapis');
    expect(normalizeAssignment('gem', { m: 'turquoise' }).m).toBe('turquoise');
  });
});
