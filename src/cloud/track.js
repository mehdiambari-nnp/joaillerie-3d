// Événements de suivi émis par l'interface (ouverture de l'écrin, essayage, photo). Découplé de Firebase : sans suivi actif, ils ne font rien.
export const emitTrack = (name) => { try { window.dispatchEvent(new CustomEvent('rc:track', { detail: name })); } catch { /* hors navigateur */ } };
