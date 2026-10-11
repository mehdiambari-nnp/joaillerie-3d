// Copie les fichiers WASM de MediaPipe vers public/ (hébergement local, pas de CDN à l'exécution).
import fs from 'node:fs';
import path from 'node:path';
const src = path.resolve('node_modules/@mediapipe/tasks-vision/wasm');
const dst = path.resolve('public/mediapipe/wasm');
if (!fs.existsSync(src)) { console.log('[copy-wasm] tasks-vision absent, ignoré'); process.exit(0); }
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log('[copy-wasm] OK ->', dst);
