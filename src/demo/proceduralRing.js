// Bague de démonstration générée par code (jamais d'écran vide) : jonc + solitaire à 4 griffes + pavé de 10 pierres.
// Passe par le même pipeline d'import que les fichiers de l'utilisateur (export GLB puis import).
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function buildDemoRingGLB() {
  const scene = new THREE.Scene();
  const metal = new THREE.MeshStandardMaterial({ name: 'Métal', color: 0xd9b25a, metalness: 1, roughness: 0.2 });
  const diamond = new THREE.MeshStandardMaterial({ name: 'Diamond', color: 0xffffff });
  const add = (name, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(...pos); m.rotation.set(...rot); scene.add(m); return m;
  };
  const R = 9.2, tube = 1.15;
  const band = new THREE.TorusGeometry(R, tube, 24, 96); band.scale(1, 1, 2.1);
  add('Anneau', band, metal);

  // solitaire : pierre taille brillant simplifiée (Lathe → facettes planes à l'import)
  const prof = [[0, -2.1], [3.0, 0], [3.0, 0.25], [1.75, 1.4], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const cy = R + tube + 1.2;
  add('Pierre centrale', new THREE.LatheGeometry(prof, 16), diamond, [0, cy, 0]);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    add(`Griffe ${k + 1}`, new THREE.CylinderGeometry(0.22, 0.32, 2.7, 10), metal,
      [Math.cos(a) * 3.0, cy + 0.15, Math.sin(a) * 3.0], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
  }
  // pavé sur les épaules
  const oct = new THREE.OctahedronGeometry(0.8, 0); oct.scale(1, 0.7, 1);
  let n = 1;
  for (const side of [-1, 1]) {
    for (const deg of [20, 34, 48, 62, 76]) {
      const a = (deg * Math.PI) / 180;
      const r = R + tube + 0.15;
      add(`Pavé ${n++}`, oct.clone(), diamond, [side * Math.sin(a) * r, Math.cos(a) * r, 0], [0, 0, -side * a]);
    }
  }
  return new GLTFExporter().parseAsync(scene, { binary: true });
}
