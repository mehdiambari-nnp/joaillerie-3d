import { describe, it, expect } from 'vitest';
import { handleModels, handleApi, memoryStore } from '../../netlify/lib/api.mjs';
import { uploadModel, downloadModel, modelId } from '../../src/share/remote.js';

const rig = () => {
  const store = memoryStore();
  const fetchImpl = (url, init = {}) => handleApi(new Request('http://x' + url, init), store);
  return { store, fetchImpl };
};
const big = () => { const u = new Uint8Array(9 * 1024 * 1024); let s = 7; for (let i = 0; i < u.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; u[i] = s >> 16; } return u.buffer; }; // peu compressible → plusieurs morceaux

describe('hébergement des modèles', () => {
  it('aller-retour fidèle, plusieurs morceaux, options conservées', async () => {
    const { fetchImpl } = rig(); const buffer = big();
    const id = await uploadModel({ buffer, name: 'ma-bague.fbx', options: { flipUp: true } }, { fetchImpl });
    expect(id).toBe(await modelId(buffer));
    const r = await downloadModel(id, { fetchImpl });
    expect(r.name).toBe('ma-bague.fbx'); expect(r.options).toEqual({ flipUp: true });
    expect(Buffer.compare(Buffer.from(r.buffer), Buffer.from(buffer))).toBe(0);
  });
  it('ne renvoie pas deux fois le même fichier', async () => {
    const { fetchImpl } = rig(); const buffer = new Uint8Array(1000).fill(3).buffer; let puts = 0;
    const spy = (u, i) => { if (i?.method === 'PUT') puts++; return fetchImpl(u, i); };
    await uploadModel({ buffer, name: 'a.glb' }, { fetchImpl: spy }); const n = puts;
    await uploadModel({ buffer, name: 'a.glb' }, { fetchImpl: spy });
    expect(puts).toBe(n);
  });
  it('refuse les identifiants invalides, les morceaux manquants et les méthodes inconnues', async () => {
    const { fetchImpl } = rig(); const id = 'a'.repeat(32);
    expect((await fetchImpl('/api/models/../../x')).status).toBe(400);
    expect((await fetchImpl(`/api/models/${id}`)).status).toBe(404);
    expect((await fetchImpl(`/api/models/${id}`, { method: 'PUT', body: JSON.stringify({ parts: 2 }) })).status).toBe(409);
    expect((await fetchImpl(`/api/models/${id}/99`)).status).toBe(400);
    expect((await fetchImpl(`/api/models/${id}`, { method: 'DELETE' })).status).toBe(405);
  });
});

import { buildShareUrl, parseShareHash } from '../../src/state/store.js';
describe('lien de partage', () => {
  it('transporte l’identifiant du modèle hébergé', () => {
    const url = buildShareUrl('http://x/', { modelId: 'a.fbx', assign: { p1: { m: 'rose' } }, hidden: [], client: true, remote: 'b'.repeat(32) });
    const p = parseShareHash(new URL(url).hash);
    expect(p.remote).toBe('b'.repeat(32)); expect(p.client).toBe(true);
    expect(parseShareHash(new URL(buildShareUrl('http://x/', { modelId: 'a', assign: {}, hidden: [] })).hash).remote).toBeNull();
  });
});

import { sharePayload, shareId, shortShareRef, parseShareJson } from '../../src/state/store.js';
describe('liens courts', () => {
  it('aller-retour via l’API, identifiant court et stable, sans écrasement', async () => {
    const { fetchImpl } = rig();
    const json = JSON.stringify(sharePayload({ modelId: 'a.fbx', assign: { p1: { m: 'rose' }, p2: { m: 'rose' } }, env: 'studio', envRot: 10, hidden: ['p3'], client: true, remote: 'c'.repeat(32) }));
    const id = await shareId(json);
    expect(id).toMatch(/^[a-f0-9]{12}$/); expect(await shareId(json)).toBe(id);
    expect((await fetchImpl(`/api/shares/${id}`, { method: 'PUT', body: JSON.stringify({ p: json }) })).status).toBe(200);
    await fetchImpl(`/api/shares/${id}`, { method: 'PUT', body: JSON.stringify({ p: '{"v":1,"model":"autre"}' }) }); // tentative d'écrasement
    const got = (await (await fetchImpl(`/api/shares/${id}`)).json()).p;
    expect(got).toBe(json);
    const p = parseShareJson(got);
    expect(p.client).toBe(true); expect(p.remote).toBe('c'.repeat(32)); expect(p.assign.p2.m).toBe('rose'); expect(p.hidden).toEqual(['p3']);
    expect(shortShareRef(`#s=${id}`)).toBe(id); expect(shortShareRef('#c=abc')).toBeNull();
  });
  it('rejette les identifiants et contenus invalides', async () => {
    const { fetchImpl } = rig();
    expect((await fetchImpl('/api/shares/xyz')).status).toBe(400);
    expect((await fetchImpl(`/api/shares/${'a'.repeat(12)}`)).status).toBe(404);
    expect((await fetchImpl(`/api/shares/${'a'.repeat(12)}`, { method: 'PUT', body: 'pas du json' })).status).toBe(400);
    expect((await fetchImpl(`/api/shares/${'a'.repeat(12)}`, { method: 'PUT', body: JSON.stringify({ p: 'x'.repeat(20000) }) })).status).toBe(413);
  });
});
