import { describe, it, expect } from 'vitest';
import { cleanVariants } from '../../src/state/store.js';

describe('cleanVariants', () => {
  it('neutralise un identifiant piégé et écarte les entrées invalides', () => {
    const out = cleanVariants([{ id: '"><img src=x onerror=alert(1)>', name: 'ok', snap: {} }, { id: 'v1', name: 5, snap: {} }, null, { id: 'v2', name: 'b', snap: {} }]);
    expect(out.map((v) => v.id)).toEqual(['imgsrcxonerroralert1', 'v2']);
    expect(out.every((v) => /^[\w-]+$/.test(v.id))).toBe(true);
  });
  it('tolère une valeur absente ou non-tableau', () => {
    expect(cleanVariants(undefined)).toEqual([]);
    expect(cleanVariants({})).toEqual([]);
  });
});
