import { describe, it, expect } from 'vitest';
import { normalizeAssignment, resolveGem, resolveMetal, validHex, hexToHsl, hslToHex, METALS, FINISHES, GEMS, CUSTOM } from '../../src/materials/library.js';
import { packAssign, unpackAssign, buildShareUrl, parseShareHash } from '../../src/state/store.js';

describe('matériaux', () => {
  it('anciens identifiants convertis', () => {
    expect(normalizeAssignment('metal', { m: 'gold18', f: 'matte' })).toEqual({ m: 'yellow', f: 'satin' });
    expect(normalizeAssignment('metal', { m: 'white18', f: 'polish' }).m).toBe('grey');
    expect(normalizeAssignment('gem', { m: 'moissanite' })).toEqual({ m: 'diamond' });
    expect(normalizeAssignment('gem', { m: 'sapphire' }).m).toBe('blue-medium');
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
  it('pierres : le diamant est incolore, les autres colorées sans nom d’espèce', () => {
    expect(resolveGem({ m: 'diamond' }).ior).toBeGreaterThan(2.3);
    expect(GEMS.some((g) => /saphir|rubis|moissanite|zirconium|améthyste|topaze/i.test(g.name))).toBe(false);
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
