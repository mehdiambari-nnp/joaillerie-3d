import { describe, it, expect } from 'vitest';
import { parseInviteHash, inviteUrl } from '../../src/state/store.js';

const T = '0123456789abcdef0123456789abcdef';
describe('liens d\'invitation (#i=)', () => {
  it('lit le jeton de 32 caractères hexadécimaux', () => expect(parseInviteHash(`#i=${T}`)).toBe(T));
  it('accepte le jeton parmi d\'autres paramètres du fragment', () => expect(parseInviteHash(`#x=1&i=${T}`)).toBe(T));
  it('refuse un jeton trop court, trop long ou non hexadécimal', () => {
    expect(parseInviteHash('#i=abc')).toBeNull();
    expect(parseInviteHash(`#i=${T}0`.slice(0, 0) + '#i=' + 'z'.repeat(32))).toBeNull();
    expect(parseInviteHash('')).toBeNull();
    expect(parseInviteHash(null)).toBeNull();
  });
  it('ne se confond pas avec un lien de partage', () => { expect(parseInviteHash('#s=6de04034be8f')).toBeNull(); expect(parseInviteHash('#c=abc')).toBeNull(); });
  it('inviteUrl compose le lien', () => expect(inviteUrl(T, 'https://x.fr/')).toBe(`https://x.fr/#i=${T}`));
});
