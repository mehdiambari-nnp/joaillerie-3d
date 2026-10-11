// Suivi de la main (MediaPipe HandLandmarker, WASM + modèle hébergés localement : aucun CDN à l'exécution).
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const abs = (p) => new URL(p, document.baseURI).href;

export class HandTracker {
  constructor() { this.landmarker = null; this.delegate = null; }

  async init(preferred = 'GPU') {
    const fileset = await FilesetResolver.forVisionTasks(abs('mediapipe/wasm'));
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: abs('mediapipe/hand_landmarker.task'), delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try { this.landmarker = await make(preferred); this.delegate = preferred; }
    catch (e) {
      if (preferred === 'CPU') throw e;
      // Le délégué GPU échoue sur certaines versions de Safari : repli automatique sur le CPU.
      this.landmarker = await make('CPU'); this.delegate = 'CPU';
    }
    return this.delegate;
  }

  /** Retourne { lm, wl, label, score } ou null. Peut lever si le GPU casse en cours de route. */
  detect(video, tMs) {
    if (!this.landmarker) return null;
    const r = this.landmarker.detectForVideo(video, tMs);
    if (!r.landmarks?.length) return null;
    const cat = (r.handedness ?? r.handednesses)?.[0]?.[0];
    return { lm: r.landmarks[0], wl: r.worldLandmarks[0], label: cat?.categoryName ?? 'Left', score: cat?.score ?? 0 };
  }

  async fallbackToCPU() { this.landmarker?.close(); return this.init('CPU'); }
  close() { this.landmarker?.close(); this.landmarker = null; }
}
