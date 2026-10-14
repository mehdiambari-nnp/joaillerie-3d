import { describe, it, expect } from 'vitest';
import { CHANGELOG, CURRENT_VERSION, unseenEntries } from '../../src/config/changelog.js';

describe('changelog', () => {
  it('version courante = entrée la plus récente', () => expect(CURRENT_VERSION).toBe(CHANGELOG[0].version));
  it('rien à montrer si la version est déjà vue', () => expect(unseenEntries(CURRENT_VERSION)).toEqual([]));
  it('jamais vu : seulement la plus récente', () => expect(unseenEntries(null)).toEqual([CHANGELOG[0]]));
  it('ancienne version : les entrées plus récentes', () => expect(unseenEntries('0.1.0').map((e) => e.version)).toEqual(['0.5.0', '0.4.0', '0.3.1', '0.3.0', '0.2.0']));
  it('version inconnue plus récente : rien', () => expect(unseenEntries('9.9.9')).toEqual([]));
});
