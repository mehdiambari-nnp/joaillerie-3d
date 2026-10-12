import { describe, it, expect } from 'vitest';
import { normalizeAssignment, resolveGem, resolveMetal, validHex, hexToHsl, hslToHex, METALS, FINISHES, GEMS, CUSTOM } from '../../src/materials/library.js';
import { packAssign, unpackAssign, buildShareUrl, parseShareHash } from '../../src/state/store.js';

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
