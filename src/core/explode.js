// Vue éclatée : chaque partie (zone) s'écarte du centre de la bague, en douceur, et revient se ranger.
// Les décalages sont calculés dans le repère du modèle (mm) : direction = centre de la zone − centre de la bague.
import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2); // easeInOutCubic
const DURATION = 900; // ms
const STAGGER = 140;  // ms max entre la partie la plus proche et la plus éloignée

export class Exploder {
  constructor(app) {
    this.app = app;
    this.amount = new Map();   // zoneId → 0..1 (état courant)
    this.target = new Map();   // zoneId → 0 | 1
    this.tweens = new Map();   // zoneId → { from, to, start, delay }
    this.offsets = new Map();  // zoneId → Vector3 (repère de la racine, mm)
    this.base = new Map();     // pieceId → position d'origine du mesh
    this.factor = 0.62;
    this.boxes = new Map();
    this.raf = 0;
  }

  /** (Re)calcule les décalages ; à appeler quand le modèle ou les zones changent. */
  compute() {
    const app = this.app, root = app.viewer.root;
    if (!root) return;
    // remettre d'abord chaque mesh à sa position d'origine : les boîtes et positions de base se mesurent à l'état assemblé
    for (const [id, b] of this.base) { const p = app.pieceById(id); if (p) p.mesh.position.copy(b); }
    this.tweens.clear();
    this.base.clear(); this.offsets.clear();
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const boxes = new Map();
    const all = new THREE.Box3();
    for (const z of app.zones) {
      const b = new THREE.Box3();
      for (const id of z.pieceIds) {
        const p = app.pieceById(id); if (!p) continue;
        this.base.set(id, p.mesh.position.clone());
        b.union(new THREE.Box3().setFromObject(p.mesh).applyMatrix4(inv));
      }
      if (!b.isEmpty()) { boxes.set(z.id, b); all.union(b); }
    }
    // centre de la bague = centre du trou (origine du modèle normalisé), repli sur le centre de la boîte
    const o = new THREE.Vector3(0, 0, 0);
    const size = all.getSize(new THREE.Vector3()).length() || 1;
    // « haut » de la bague = direction moyenne des pierres / sertissage ; le corps (anneau) descend à l'opposé
    const up = new THREE.Vector3();
    for (const z of app.zones) { const b = boxes.get(z.id); if (b && z.role !== 'body') up.add(b.getCenter(new THREE.Vector3()).sub(o)); }
    if (up.lengthSq() > 1e-9) up.normalize(); else up.set(0, 1, 0);
    for (const [zid, b] of boxes) {
      const zone = app.zones.find((x) => x.id === zid);
      if (zone?.role === 'body') { this.offsets.set(zid, up.clone().multiplyScalar(-size * 0.3)); continue; }
      const c = b.getCenter(new THREE.Vector3());
      const v = c.clone().sub(o);
      const dist = v.length();
      // les parties quasi centrées (corps de l'anneau) restent en place ; les autres s'écartent radialement
      const k = dist < size * 0.04 ? 0 : this.factor;
      const off = v.multiplyScalar(k);
      if (off.length() > size * 0.55) off.setLength(size * 0.55); // plafond : la bague reste lisible
      this.offsets.set(zid, off);
    }
    this.boxes = boxes;
    this._order = [...boxes.keys()].sort((a, b) => this.offsets.get(a).length() - this.offsets.get(b).length());
    for (const z of app.zones) if (!this.amount.has(z.id)) { this.amount.set(z.id, 0); this.target.set(z.id, 0); }
    for (const id of [...this.amount.keys()]) if (!boxes.has(id)) { this.amount.delete(id); this.target.delete(id); this.tweens.delete(id); }
    this._apply();
  }

  has(zoneId) { return this.offsets.has(zoneId) && this.offsets.get(zoneId).lengthSq() > 1e-6; }
  isExploded(zoneId) { return (this.target.get(zoneId) ?? 0) > 0.5; }
  get explodable() { return [...this.offsets.keys()].filter((id) => this.has(id)); }
  get anyExploded() { return this.explodable.some((id) => this.isExploded(id)); }
  get allExploded() { const e = this.explodable; return e.length > 0 && e.every((id) => this.isExploded(id)); }

  /** Tout éclater (ou tout ranger si tout est déjà éclaté). */
  toggleAll() { this.setAll(!this.allExploded); }
  setAll(on) {
    const ids = this.explodable;
    ids.forEach((id) => this._go(id, on ? 1 : 0, ids));
    this._dolly();
    this._start();
  }
  toggleZone(zoneId) {
    if (!this.has(zoneId)) return;
    this._go(zoneId, this.isExploded(zoneId) ? 0 : 1, [zoneId]);
    this._dolly();
    this._start();
  }

  _go(id, to, group) {
    const from = this.amount.get(id) ?? 0;
    this.target.set(id, to);
    // départ échelonné : les parties les plus proches du centre partent d'abord quand on éclate, les plus lointaines d'abord quand on range
    const rank = group.length > 1 ? this._order.filter((x) => group.includes(x)).indexOf(id) / (group.length - 1) : 0;
    const delay = STAGGER * (to ? rank : 1 - rank);
    this.tweens.set(id, { from, to, start: performance.now(), delay });
  }

  /** Recule la caméra pour garder toute la bague visible quand elle est éclatée (et revient). */
  _dolly() {
    const v = this.app.viewer;
    if (!v.root) return;
    const dir = v.camera.position.clone().sub(v.controls.target).normalize();
    const fov = (v.camera.fov * Math.PI) / 180;
    let r = v.radius;
    if (this.anyExploded) {
      // rayon nécessaire pour voir toutes les parties à leur position éclatée
      const c = v.root.worldToLocal(v.controls.target.clone());
      for (const [zid, b] of this.boxes) {
        const off = this.isExploded(zid) ? this.offsets.get(zid) : new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
          const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).add(off);
          r = Math.max(r, p.distanceTo(c));
        }
      }
    }
    const dist = (r / Math.sin(Math.min(fov, fov * v.camera.aspect) / 2)) * 1.12;
    v.setView(dir.toArray(), true, dist);
  }

  _start() { if (!this.raf) this.raf = requestAnimationFrame((t) => this._tick(t)); }

  _tick() {
    const now = performance.now();
    let busy = false;
    for (const [id, tw] of this.tweens) {
      const t = Math.min(1, Math.max(0, (now - tw.start - tw.delay) / DURATION));
      this.amount.set(id, tw.from + (tw.to - tw.from) * ease(t));
      if (t < 1) busy = true; else this.tweens.delete(id);
    }
    this._apply();
    this.raf = busy ? requestAnimationFrame((t) => this._tick(t)) : 0;
    if (!busy) this.app.emit('explode');
  }

  _apply() {
    const app = this.app;
    for (const z of app.zones) {
      const off = this.offsets.get(z.id); if (!off) continue;
      const a = this.amount.get(z.id) ?? 0;
      for (const id of z.pieceIds) {
        const p = app.pieceById(id), b = this.base.get(id); if (!p || !b) continue;
        const parent = p.mesh.parent;
        // décalage exprimé dans le repère du parent du mesh (la racine peut avoir une échelle / rotation)
        const local = off.clone();
        if (parent) {
          const m = app.viewer.root.matrixWorld; // racine → monde
          parent.updateMatrixWorld(true);
          const pInv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
          const w0 = new THREE.Vector3().applyMatrix4(m), w1 = off.clone().applyMatrix4(m);
          local.copy(w1.applyMatrix4(pInv)).sub(w0.applyMatrix4(pInv));
        }
        p.mesh.position.copy(b).addScaledVector(local, a);
      }
    }
    app.viewer.invalidate();
  }

  /** Range le temps d'un export ; renvoie la fonction qui rétablit l'état précédent. */
  suspend() {
    const saved = new Map(this.amount);
    this.assembleNow(false); this._apply();
    return () => { for (const [k, v] of saved) this.amount.set(k, v); this._apply(); };
  }

  /** Range immédiatement (export, essayage, nouveau modèle). */
  assembleNow(redraw = true) {
    this.tweens.clear();
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    for (const id of this.amount.keys()) { this.amount.set(id, 0); this.target.set(id, 0); }
    if (redraw) { this._apply(); this.app.emit('explode'); }
  }
}
