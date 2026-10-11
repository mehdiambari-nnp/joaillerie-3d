// Re-télécharge le modèle officiel hand_landmarker.task si le fichier est absent/corrompu.
// Une copie de secours est versionnée dans public/mediapipe/ (7,8 Mo, licence Apache-2.0 de MediaPipe).
import fs from 'node:fs';
const dst = 'public/mediapipe/hand_landmarker.task';
const url = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
if (fs.existsSync(dst) && fs.statSync(dst).size > 7_000_000) { console.log('[fetch-models] déjà présent'); process.exit(0); }
const r = await fetch(url);
if (!r.ok) throw new Error('Téléchargement impossible: ' + r.status);
fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
console.log('[fetch-models] OK');
