import { describe, it, expect } from 'vitest';
import { resolveRights, canSeeProject, permsPatch, OWNER_RIGHTS } from '../../src/cloud/rights.js';

describe('droits des membres', () => {
  it('valeurs par défaut : tous les projets, créer/modifier oui, le reste non', () => {
    expect(resolveRights({})).toEqual({ projects: 'all', save: true, delete: false, createLinks: false, viewLinks: false, owner: false });
    expect(resolveRights(null).save).toBe(true);
  });
  it('droits accordés et retirés', () => {
    const r = resolveRights({ projects: 'selected', perms: { save: false, delete: true, createLinks: true } });
    expect(r).toMatchObject({ projects: 'selected', save: false, delete: true, createLinks: true, viewLinks: false });
  });
  it('valeur inattendue : repli sur « tous »', () => { expect(resolveRights({ projects: 'x' }).projects).toBe('all'); });
  it('accès aux projets : tous (hors privés) ou accordés un par un', () => {
    const all = resolveRights({}), sel = resolveRights({ projects: 'selected' });
    expect(canSeeProject({ private: false }, 'u', all)).toBe(true);
    expect(canSeeProject({ private: true }, 'u', all)).toBe(false);
    expect(canSeeProject({ private: true, sharedWith: ['u'] }, 'u', all)).toBe(true);
    expect(canSeeProject({ private: false }, 'u', sel)).toBe(false);
    expect(canSeeProject({ private: false, sharedWith: ['u'] }, 'u', sel)).toBe(true);
    expect(canSeeProject({ sharedWith: ['autre'] }, 'u', sel)).toBe(false);
  });
  it('permsPatch : booléens, clés connues seulement', () => {
    expect(permsPatch({ save: 1, delete: 0, createLinks: true, x: 1 })).toEqual({ save: true, delete: false, createLinks: true, viewLinks: false });
  });
  it('le propriétaire a tout', () => { expect(OWNER_RIGHTS).toMatchObject({ save: true, delete: true, createLinks: true, viewLinks: true, owner: true }); });
});
