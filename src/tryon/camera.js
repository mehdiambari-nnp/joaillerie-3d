// Accès caméra (iOS Safari / Chrome iOS) : HTTPS, geste utilisateur, playsinline, choix de l'objectif principal.
export class CameraError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

let stream = null;

async function openStream(constraints) {
  return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
}

/** Démarre la caméra et la branche sur <video>. facing: 'environment' | 'user'. */
export async function startCamera(video, facing = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported', 'getUserMedia indisponible (HTTPS requis).');
  stopCamera(video);
  try {
    stream = await openStream({ facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } });
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw new CameraError('denied', e.message);
    if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') throw new CameraError('nocam', e.message);
    throw new CameraError('error', e.message);
  }
  // Appareils multi-objectifs : on évite l'ultra grand-angle (champ de vision différent, perspective déformée).
  try {
    const label = stream.getVideoTracks()[0]?.label || '';
    if (/ultra|ultra-large|ultra wide/i.test(label)) {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const better = devs.find((d) => /back|arri|rear|environment/i.test(d.label) && !/ultra|tele|télé/i.test(d.label));
      if (better) {
        stream.getTracks().forEach((t) => t.stop());
        stream = await openStream({ deviceId: { exact: better.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } });
      }
    }
  } catch { /* on garde le flux obtenu */ }
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
  return { width: video.videoWidth, height: video.videoHeight, facing: settings.facingMode || facing, label: stream.getVideoTracks()[0]?.label };
}

export function stopCamera(video) {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video) video.srcObject = null;
}
