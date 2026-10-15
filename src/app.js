// Cœur applicatif : relie le viewer, le modèle importé, les zones, les affectations de matériaux,
// la sélection et l'historique. Aucune dépendance au DOM de l'interface (testable / réutilisable).
import { buildGemData, disposeGemData } from './materials/gem.js';
import * as THREE from 'three';
import { Viewer } from './core/viewer.js';
import { Picker } from './selection/picker.js';
import { History } from './state/store.js';
import { createMaterial, transitionMaterial, setGrainFrame } from './materials/factory.js';
import { DEFAULT_METAL, DEFAULT_GEM, isMaterialFor, normalizeAssignment, validHex, CUSTOM } from './materials/library.js';
import { similarPieceIds } from './import/zones.js';
import { Exploder } from './core/explode.js';
import { FEATURES } from './config/features.js';

class Emitter {
  constructor() { this.l = {}; }
  on(ev, f) { (this.l[ev] ||= new Set()).add(f); return () => this.l[ev].delete(f); }
  emit(ev, ...a) { this.l[ev]?.forEach((f) => f(...a)); }
}

export class Configurator extends Emitter {
  constructor(container) {
    super();
    this.viewer = new Viewer(container);
    this.picker = new Picker(this.viewer, {
      onHover: (id, e) => this._onHover(id, e),
      onPick: (id, o) => this._onPick(id, o),
      onFocus: (id) => this.focusPiece(id),
    });
    this.model = null;
    this.zones = [];
    this.pieces = [];
    this.assign = {};
    this.hidden = new Set();
    this.selection = new Set();
    this.hover = null;
    this.multi = false;
    this.interactive = true; // false en mode client : pas de sélection de pièces
    this._zoomKey = '';
    this.on('selection', () => this._autoZoom());
    this.granularity = 'zone'; // 'zone' | 'piece'
    this.history = new History(50);
    this.variants = [];
    this.modelId = null;
    this.exploder = new Exploder(this);
    this.on('zones', () => this.exploder.compute());
    this.on('config', () => this.viewer.requestBake()); // ombre de contact et reflets recalculés après chaque changement
  }

  // ---------- Modèle ----------
  /** Installe un modèle importé. config optionnelle : { assign, hidden, zones } (partage / projet / variante). */
  setModel(model, modelId, config = null) {
    if (this.model) this._disposeModel();
    this.model = model;
    this.modelId = modelId;
    setGrainFrame(new THREE.Box3().setFromObject(model.root).getCenter(new THREE.Vector3()));
    this.pieces = model.pieces;
    this.zones = JSON.parse(JSON.stringify(model.zones.map((z) => ({ ...z, allowed: z.allowed ?? null }))));
    const ids = new Set(model.pieces.map((p) => p.id));
    if (config?.zones?.length && config.zones.every((z) => z.pieceIds?.every((i) => ids.has(i)))) {
      this.zones = JSON.parse(JSON.stringify(config.zones.map((z) => ({ allowed: null, ...z }))));
      for (const z of this.zones) for (const id of z.pieceIds) { const p = model.pieces.find((x) => x.id === id); if (p) p.kind = z.type; }
    } else if (config?.zones) this._mergeZoneConfig(config.zones);
    this.assign = {};
    for (const p of this.pieces) this.assign[p.id] = { ...(p.kind === 'gem' ? DEFAULT_GEM : DEFAULT_METAL) };
    if (config?.assign) Object.assign(this.assign, config.assign);
    this._normalizeAll();
    this.hidden = new Set(config?.hidden || []);
    this.selection.clear();
    for (const p of this.pieces) { this._ensureMaterial(p, false); p.mesh.visible = !this.hidden.has(p.id); }
    this.viewer.setModel(model.root, { views: model.views });
    this.picker.setPieces(this.pieces);
    this.history.reset(this.snapshot());
    this.emit('model', model);
    this.emit('zones');
    this.emit('selection');
    this.emit('config');
    this.emit('history');
    this.viewer.invalidate();
  }

  _disposeModel() {
    for (const p of this.pieces) {
      p.mesh.geometry.disposeBoundsTree?.();
      disposeGemData(p.gemData);
      p._hullGeo?.dispose();
      p.mesh.geometry.dispose();
      p.mesh.material?.dispose?.();
    }
    this.viewer.scene.remove(this.model.root);
  }

  _mergeZoneConfig(zs) {
    for (const z of zs) {
      const mine = this.zones.find((m) => m.id === z.id);
      if (mine) { mine.name = z.name ?? mine.name; mine.allowed = z.allowed ?? null; if (z.type) mine.type = z.type; }
    }
  }

  pieceById(id) { return this.pieces.find((p) => p.id === id); }
  zoneOfPiece(id) { return this.zones.find((z) => z.pieceIds.includes(id)); }
  zoneById(id) { return this.zones.find((z) => z.id === id); }

  // ---------- Matériaux ----------
  _ensureMaterial(piece, animate) {
    const a = this.assign[piece.id];
    const cur = piece.mesh.material;
    if (!cur.userData?.rc || cur.userData.kind !== piece.kind) {
      cur.dispose?.();
      if (piece.kind === 'gem' && piece.gemData === undefined) piece.gemData = buildGemData(this.viewer.renderer, piece.mesh);
      const m = createMaterial(piece.kind, a, piece.kind === 'gem' ? piece.gemData : null);
      m.userData.rc = true; m.userData.kind = piece.kind;
      piece.mesh.material = m;
      return;
    }
    transitionMaterial(cur, piece.kind, a, { duration: animate ? 200 : 0, onTick: () => this.viewer.invalidate() });
  }

  /** Applique une affectation à des pièces (temps réel + historique). */
  applyMaterial(pieceIds, a, { record = true, animate = true } = {}) {
    for (const id of pieceIds) {
      const p = this.pieceById(id);
      if (!p) continue;
      if (a.m != null && !isMaterialFor(p.kind, a.m)) continue; // une pierre ne reçoit pas un métal et inversement
      const prev = this.assign[id] || {};
      const m = a.m ?? prev.m;
      const c = m === CUSTOM ? (validHex(a.c) ?? prev.c) : undefined;
      this.assign[id] = normalizeAssignment(p.kind, p.kind === 'gem' ? { m, c } : { m, c, f: a.f ?? prev.f ?? DEFAULT_METAL.f, i: a.i ?? (a.f && a.f !== prev.f ? undefined : prev.i) });
      this._ensureMaterial(p, animate);
    }
    this._refreshHighlight();
    if (record && this.history.push(this.snapshot())) this.emit('history');
    this.emit('config');
    this.viewer.invalidate();
  }

  applyToSelection(a, opts) { this.applyMaterial([...this.selection], a, opts); }

  // ---------- Sélection ----------
  _onHover(id, e) {
    if (!this.interactive) return;
    this.hover = id;
    this._refreshHighlight();
    this.emit('hover', id ? this.pieceById(id) : null, e);
  }

  _onPick(id, { shift }) {
    if (!this.interactive) return;
    if (!id) { if (!shift && !this.multi) this.clearSelection(); return; }
    const zone = this.granularity === 'zone' ? this.zoneOfPiece(id) : null;
    // 1er clic : toute la partie ; clic suivant dans une partie déjà (en partie) sélectionnée : on bascule la pièce visée
    if (zone && zone.pieceIds.length > 1 && zone.pieceIds.some((x) => this.selection.has(x))) {
      if (zone.pieceIds.every((x) => this.selection.has(x))) this.selection = new Set([id]); // partie entière sélectionnée → on isole la pierre touchée
      else this.selection.has(id) ? this.selection.delete(id) : this.selection.add(id);   // sinon on ajoute / retire la pierre touchée
      this._refreshHighlight();
      this.emit('selection');
      return;
    }
    const target = zone ? zone.pieceIds : [id];
    const multi = shift || this.multi;
    if (multi) {
      const allIn = target.every((t) => this.selection.has(t));
      for (const t of target) allIn ? this.selection.delete(t) : this.selection.add(t);
    } else {
      this.selection = new Set(target);
    }
    this._refreshHighlight();
    this.emit('selection');
  }

  select(ids, add = false) {
    this.selection = add ? new Set([...this.selection, ...ids]) : new Set(ids);
    this._refreshHighlight();
    this.emit('selection');
  }
  selectZone(zoneId, add = false) { const z = this.zoneById(zoneId); if (z) this.select(z.pieceIds, add); }
  clearSelection() { if (!this.selection.size) return; this.selection.clear(); this._refreshHighlight(); this.emit('selection'); }
  selectSimilar() {
    const out = new Set(this.selection);
    for (const id of this.selection) similarPieceIds(this.pieces, id).forEach((x) => out.add(x));
    this.select([...out]);
  }

  /** Type dominant de la sélection : 'metal' | 'gem' | 'mixed' | null. */
  selectionKind() {
    const kinds = new Set([...this.selection].map((id) => this.pieceById(id)?.kind));
    kinds.delete(undefined);
    if (!kinds.size) return null;
    return kinds.size > 1 ? 'mixed' : [...kinds][0];
  }

  _refreshHighlight() {
    for (const p of this.pieces) this.viewer.setHighlight([p], 'x', false);
    if (this.hover && !this.selection.has(this.hover)) this.viewer.setHighlight([this.pieceById(this.hover)], 'hover', true);
    this.viewer.setHighlight([...this.selection].map((i) => this.pieceById(i)).filter(Boolean), 'select', true);
  }

  /** Zoom automatique : cadre la sélection quand elle change de partie, revient à l'ensemble quand elle est vidée. */
  _autoZoom() {
    if (!FEATURES.autoZoomSelect || !this.interactive || !this.model) return;
    const ids = [...this.selection];
    const key = ids.length ? [...new Set(ids.map((i) => this.zoneOfPiece(i)?.id ?? i))].sort().join('|') : '';
    if (key === this._zoomKey) return;
    this._zoomKey = key;
    if (!ids.length) { this.viewer.frameAll(); return; }
    const box = new THREE.Box3();
    for (const i of ids) { const p = this.pieceById(i); if (p) box.expandByObject(p.mesh); }
    if (box.isEmpty()) return;
    // pierres : on les regarde de face (depuis l'extérieur de la bague), pour bien voir la couleur et les facettes
    const onlyGems = ids.every((i) => this.pieceById(i)?.kind === 'gem');
    const lookFrom = onlyGems ? box.getCenter(new THREE.Vector3()).sub(this.viewer.box.getCenter(new THREE.Vector3())) : null;
    this.viewer.focusOn(box, { minFrac: 0.22, margin: 1.25, lookFrom: lookFrom && lookFrom.lengthSq() > 1e-6 ? lookFrom : null });
  }

  focusPiece(id) {
    const ids = this.selection.size ? [...this.selection] : [id];
    const box = new THREE.Box3();
    for (const i of ids) box.expandByObject(this.pieceById(i).mesh);
    this.viewer.focusOn(box);
  }

  // ---------- Visibilité & zones (mode Atelier) ----------
  setHidden(pieceIds, hide) {
    for (const id of pieceIds) { hide ? this.hidden.add(id) : this.hidden.delete(id); this.pieceById(id).mesh.visible = !hide; }
    this.viewer.invalidate();
    if (this.history.push(this.snapshot())) this.emit('history');
    this.emit('zones');
  }

  renameZone(zoneId, name) { const z = this.zoneById(zoneId); if (z) { z.name = name; this.emit('zones'); this.emit('config'); } }

  setZoneRules(zoneId, allowed) { const z = this.zoneById(zoneId); if (z) { z.allowed = allowed; this.emit('zones'); this.emit('config'); } }

  setZoneType(zoneId, type) {
    const z = this.zoneById(zoneId);
    if (!z || z.type === type) return;
    z.type = type;
    for (const id of z.pieceIds) {
      const p = this.pieceById(id);
      p.kind = type;
      p.mesh.userData.kind = type;
      if (type === 'gem') { // facettes planes
        let g = p.mesh.geometry.index ? p.mesh.geometry.toNonIndexed() : p.mesh.geometry;
        g.deleteAttribute('normal'); g.computeVertexNormals();
        p.mesh.geometry.disposeBoundsTree?.(); p.mesh.geometry.dispose();
        g.computeBoundsTree(); p.mesh.geometry = g;
      }
      this.assign[id] = { ...(type === 'gem' ? DEFAULT_GEM : DEFAULT_METAL) };
      this._ensureMaterial(p, false);
    }
    this._refreshHighlight();
    if (this.history.push(this.snapshot())) this.emit('history');
    this.emit('zones'); this.emit('config'); this.viewer.invalidate();
  }

  mergeZones(zoneIds, name) {
    const zs = zoneIds.map((i) => this.zoneById(i)).filter(Boolean);
    if (zs.length < 2) return;
    const first = zs[0];
    first.pieceIds = zs.flatMap((z) => z.pieceIds);
    first.name = name || first.name;
    this.zones = this.zones.filter((z) => z === first || !zoneIds.includes(z.id));
    this.emit('zones'); this.emit('config');
  }

  /** Dissocie une zone : une zone par pièce (ex. choisir la couleur de chaque fil du corps). */
  splitZone(zoneId) {
    const z = this.zoneById(zoneId);
    if (!z || z.pieceIds.length < 2) return;
    const idx = this.zones.indexOf(z);
    const parts = z.pieceIds.map((id, i) => ({ id: `${z.id}-${id}`, name: `${z.name} ${i + 1}`, type: z.type, pieceIds: [id], role: z.role, allowed: z.allowed }));
    this.zones.splice(idx, 1, ...parts);
    this.emit('zones');
  }

  // ---------- Instantanés / projets ----------
  /** Remet toutes les affectations au format courant (anciens liens / projets). */
  _normalizeAll() {
    for (const p of this.pieces) this.assign[p.id] = normalizeAssignment(p.kind, this.assign[p.id]) ?? { ...(p.kind === 'gem' ? DEFAULT_GEM : DEFAULT_METAL) };
  }

  snapshot() { return { assign: this.assign, hidden: [...this.hidden] }; }

  restore(snap) {
    this.assign = JSON.parse(JSON.stringify(snap.assign));
    this._normalizeAll();
    this.hidden = new Set(snap.hidden || []);
    for (const p of this.pieces) {
      p.mesh.visible = !this.hidden.has(p.id);
      if (this.assign[p.id]) this._ensureMaterial(p, true);
    }
    this._refreshHighlight();
    this.emit('config'); this.emit('zones'); this.viewer.invalidate();
  }

  undo() { const s = this.history.undo(); if (s) { this.restore(s); this.emit('history'); } }
  redo() { const s = this.history.redo(); if (s) { this.restore(s); this.emit('history'); } }

  saveVariant(name) {
    this.variants.push({ id: 'v' + Date.now().toString(36), name, snap: JSON.parse(JSON.stringify(this.snapshot())) });
    this.emit('variants');
  }
  applyVariant(id) {
    const v = this.variants.find((x) => x.id === id);
    if (!v) return;
    this.restore(v.snap);
    this.history.push(this.snapshot());
    this.emit('history');
  }
  deleteVariant(id) { this.variants = this.variants.filter((v) => v.id !== id); this.emit('variants'); }

  /** Configuration complète sérialisable (projet GLB / partage). */
  config() {
    return {
      v: 1, normalized: true,
      zones: this.zones.map((z) => ({ id: z.id, name: z.name, type: z.type, pieceIds: z.pieceIds, role: z.role, allowed: z.allowed })),
      assign: this.assign, hidden: [...this.hidden], variants: this.variants,
    };
  }
}
