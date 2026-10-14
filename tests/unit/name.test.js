import { describe, it, expect } from 'vitest';
import { displayName } from '../../src/cloud/name.js';

describe('displayName', () => {
  it('préfère le nom du profil', () => expect(displayName({ name: 'Mehdi Ambari', email: 'x@y.fr' })).toBe('Mehdi Ambari'));
  it('déduit prénom et nom de l’e-mail', () => expect(displayName({ email: 'mehdi.ambari@nonameprojects.fr' })).toBe('Mehdi Ambari'));
  it('gère tirets, chiffres et majuscules', () => expect(displayName({ email: 'JEAN-luc_dupont42@mail.com' })).toBe('Jean Luc Dupont'));
  it('repli sur l’adresse si rien d’exploitable', () => expect(displayName({ email: '123@mail.com' })).toBe('123@mail.com'));
  it('utilisateur absent', () => expect(displayName(null)).toBe(''));
});
