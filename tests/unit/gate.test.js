import { describe, it, expect } from 'vitest';
import { buildShareUrl, parseShareHash, needsLogin } from '../../src/state/store.js';

const hashOf = (opts) => new URL(buildShareUrl('https://x.test/', { modelId: 'm', assign: {}, env: 'studio', envRot: 0, hidden: [], ...opts })).hash;

describe('porte d’entrée (connexion joaillier)', () => {
  it('lien client valide : ouvert sans compte', () => {
    expect(needsLogin(parseShareHash(hashOf({ client: true })), true)).toBe(false);
  });
  it('lien joaillier, adresse nue, lien illisible ou lien client modifié : connexion exigée', () => {
    expect(needsLogin(parseShareHash(hashOf({ client: false })), true)).toBe(true);
    expect(needsLogin(null, true)).toBe(true);
    expect(needsLogin(parseShareHash('#c=n-importe-quoi'), true)).toBe(true);
    expect(needsLogin(parseShareHash(hashOf({ client: true }).replace('#c=', '#c=Z')), true)).toBe(true);
  });
  it('sans Firebase (mode local / tests) : jamais de connexion', () => {
    expect(needsLogin(null, false)).toBe(false);
  });
});
