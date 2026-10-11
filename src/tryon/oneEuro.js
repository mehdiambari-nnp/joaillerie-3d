// Filtre One Euro (Casiez et al.) : supprime le tremblement sans latence visible.
const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };

export class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = null; this.dx = 0; this.t = null;
  }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  filter(x, tSec) {
    if (this.x === null) { this.x = x; this.t = tSec; return x; }
    const dt = Math.max(1e-3, tSec - this.t);
    this.t = tSec;
    const dx = (x - this.x) / dt;
    this.dx = this.dx + alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x = this.x + alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

/** Filtre One Euro pour un vecteur de n composantes. */
export class OneEuroVec {
  constructor(n, minCutoff, beta, dCutoff) { this.f = Array.from({ length: n }, () => new OneEuro(minCutoff, beta, dCutoff)); }
  reset() { this.f.forEach((f) => f.reset()); }
  filter(arr, tSec) { return arr.map((v, i) => this.f[i].filter(v, tSec)); }
}
