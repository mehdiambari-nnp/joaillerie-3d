// AR « sur une surface » : Quick Look (iOS, USDZ) ou WebXR via <model-viewer> (Android).
// iOS n'expose pas WebXR : on n'en dépend jamais (voir brief §2.4).
import QRCode from 'qrcode';
import { exportARGLB, exportARUSDZ } from '../export/exporters.js';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isMobile = () => isIOS() || isAndroid();
export const isChromeIOS = () => isIOS() && /CriOS/.test(navigator.userAgent);

let mvLoaded = null;
async function ensureModelViewer() {
  mvLoaded ||= import('@google/model-viewer');
  await mvLoaded;
}

/** Prépare les fichiers AR (asynchrone : un 2ᵉ appui est ensuite nécessaire sur iOS, geste utilisateur oblige). */
export async function prepareAR(app, scaleMode) {
  const prepared = {};
  if (isIOS()) {
    const usdz = await exportARUSDZ(app, scaleMode);
    prepared.usdzUrl = URL.createObjectURL(usdz);
  } else {
    const glb = await exportARGLB(app, scaleMode);
    prepared.glbUrl = URL.createObjectURL(glb);
    await ensureModelViewer();
  }
  return prepared;
}

/** Construit l'élément d'ouverture AR selon la plateforme. Retourne un nœud DOM à insérer. */
export function buildARLauncher(prepared, { label, scaleMode }) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-launch';
  if (prepared.usdzUrl) {
    // Quick Look : <a rel="ar"> avec une image enfant est requis par Safari.
    const a = document.createElement('a');
    a.rel = 'ar';
    a.href = prepared.usdzUrl;
    a.download = 'bague.usdz';
    a.className = 'btn primary big';
    const img = document.createElement('img');
    img.alt = ''; img.width = 1; img.height = 1;
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
    img.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
    a.append(img, document.createTextNode(label));
    wrap.append(a);
  } else if (prepared.glbUrl) {
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', prepared.glbUrl);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer');
    mv.setAttribute('ar-placement', 'floor');
    if (scaleMode === 'real') mv.setAttribute('ar-scale', 'fixed');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('shadow-intensity', '1');
    mv.setAttribute('environment-image', 'neutral');
    mv.style.cssText = 'width:100%;height:240px;background:transparent;--poster-color:transparent';
    const btn = document.createElement('button');
    btn.slot = 'ar-button';
    btn.className = 'btn primary big';
    btn.textContent = label;
    mv.append(btn);
    wrap.append(mv);
  }
  return wrap;
}

export async function qrDataUrl(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#1d1b18', light: '#ffffff' } });
}
