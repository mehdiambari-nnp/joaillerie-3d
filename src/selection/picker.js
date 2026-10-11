// Sélection par pointeur (souris + tactile) : raycast accéléré BVH, survol, clic, double-clic.
import * as THREE from 'three';

export class Picker {
  /**
   * @param viewer Viewer
   * @param handlers { onHover(pieceId|null), onPick(pieceId|null, {shift}), onFocus(pieceId) }
   */
  constructor(viewer, handlers) {
    this.viewer = viewer;
    this.h = handlers;
    this.pieces = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true; // BVH : ne garde que le premier impact
    this.ndc = new THREE.Vector2();
    this.down = null;
    this.lastTap = { t: 0, x: 0, y: 0 };
    this._hoverId = null;
    const el = viewer.canvas;
    el.addEventListener('pointerdown', (e) => this._down(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerleave', () => this._setHover(null));
    // iOS Safari : bloque le zoom de page par geste
    for (const ev of ['gesturestart', 'gesturechange']) el.addEventListener(ev, (e) => e.preventDefault());
  }

  setPieces(pieces) { this.pieces = pieces; }

  /** Retourne { piece, point } du premier impact visible sous (clientX, clientY). */
  pick(clientX, clientY) {
    const r = this.viewer.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.viewer.camera);
    const meshes = this.pieces.filter((p) => p.mesh.visible).map((p) => p.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const piece = this.pieces.find((p) => p.mesh === hit.object);
    return piece ? { piece, point: hit.point } : null;
  }

  _down(e) { this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }

  _up(e) {
    if (!this.down) return;
    const d = this.down; this.down = null;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 7 || performance.now() - d.t > 600) return; // glisser = rotation, pas un clic
    const hit = this.pick(e.clientX, e.clientY);
    const now = performance.now();
    const dbl = now - this.lastTap.t < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 22;
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (dbl && hit) { this.h.onFocus?.(hit.piece.id); return; }
    this.h.onPick?.(hit ? hit.piece.id : null, { shift: e.shiftKey || e.ctrlKey || e.metaKey });
  }

  _move(e) {
    if (e.pointerType !== 'mouse' || this.down) return; // pas de survol en tactile
    if (!this._throttle || performance.now() - this._throttle > 40) {
      this._throttle = performance.now();
      const hit = this.pick(e.clientX, e.clientY);
      this._setHover(hit ? hit.piece.id : null, e);
    }
  }

  _setHover(id, e) {
    if (id === this._hoverId) return;
    this._hoverId = id;
    this.h.onHover?.(id, e);
  }
}
