// Environnements d'éclairage procéduraux (aucun téléchargement : hors-ligne, iOS-friendly).
// En bijouterie, l'environnement fait l'essentiel du rendu : ce sont les reflets qui donnent l'éclat.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const ENVIRONMENTS = [
  { id: 'studio', name: 'Studio' },
  { id: 'softbox', name: 'Softbox' },
  { id: 'daylight', name: 'Lumière du jour' },
];

function light(w, h, intensity, color = 0xffffff) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
  return m;
}

function buildSoftbox() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 30), new THREE.MeshBasicMaterial({ color: 0x0e0e10, side: THREE.BackSide }));
  s.add(room);
  const top = light(14, 10, 14); top.position.set(0, 9.9, 0); top.rotation.x = Math.PI / 2; s.add(top);
  const left = light(6, 14, 9, 0xfff3e0); left.position.set(-14.9, 3, 2); left.rotation.y = Math.PI / 2; s.add(left);
  const right = light(4, 14, 7, 0xe0eeff); right.position.set(14.9, 2, -4); right.rotation.y = -Math.PI / 2; s.add(right);
  const back = light(18, 3, 5); back.position.set(0, 1, -14.9); s.add(back);
  const front = light(10, 4, 3); front.position.set(0, -2, 14.9); front.rotation.y = Math.PI; s.add(front);
  return s;
}

function buildDaylight() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 48, 32);
  const colors = [];
  const p = geo.attributes.position;
  const top = new THREE.Color(0.55, 0.75, 1.4), hor = new THREE.Color(1.6, 1.5, 1.35), bot = new THREE.Color(0.25, 0.22, 0.2);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 40;
    const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.min(1, -y * 2));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = light(8, 8, 40, 0xfff0d8); sun.position.set(16, 22, 12); sun.lookAt(0, 0, 0); s.add(sun);
  return s;
}

/** Retourne une texture d'environnement PMREM pour l'id demandé. */
export function createEnvironment(renderer, id) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let tex;
  if (id === 'softbox') tex = pmrem.fromScene(buildSoftbox(), 0.02).texture;
  else if (id === 'daylight') tex = pmrem.fromScene(buildDaylight(), 0.02).texture;
  else tex = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();
  return tex;
}
