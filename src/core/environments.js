// Environnements d'éclairage. En bijouterie, l'environnement fait l'essentiel du rendu :
// les reflets des métaux et l'éclat des pierres viennent de lui.
// - Procéduraux (hors-ligne) : « Atelier » (studio joaillerie à fort contraste), « Softbox », « Jour ».
// - HDRI réels 360° (CC0, Poly Haven) chargés à la demande depuis /hdr.
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export const ENVIRONMENTS = [
  { id: 'studio', name: 'Atelier', group: 'studio' },
  { id: 'softbox', name: 'Softbox', group: 'studio' },
  { id: 'daylight', name: 'Jour', group: 'studio' },
  { id: 'overpass', name: 'Ville, plein soleil', group: 'hdri', url: 'hdr/overpass.hdr', tint: [1.14, 1.0, 0.76] },
  { id: 'venice', name: 'Coucher de soleil', group: 'hdri', url: 'hdr/venice-sunset.hdr' },
  { id: 'quarry', name: 'Ciel couvert', group: 'hdri', url: 'hdr/quarry.hdr' },
  { id: 'spruit', name: 'Aube', group: 'hdri', url: 'hdr/spruit-sunrise.hdr' },
];

/** Panneau lumineux (valeurs > 1 : la scène est rendue en HDR dans le PMREM). */
function light(w, h, intensity, color = 0xffffff) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
  );
}

function gradientSphere(top, horizon, bottom, radius = 60) {
  const geo = new THREE.SphereGeometry(radius, 64, 40);
  const p = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / radius;
    if (y > 0) c.copy(horizon).lerp(top, Math.pow(y, 0.7));
    else c.copy(horizon).lerp(bottom, Math.min(1, Math.pow(-y, 0.6) * 1.6));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

/** Studio joaillerie : bandes de softbox autour de la bague + grand plafonnier + contre-jour + petits spots (éclats). */
function buildStudio() {
  const s = new THREE.Scene();
  s.add(gradientSphere(new THREE.Color(0.22, 0.22, 0.24), new THREE.Color(0.34, 0.33, 0.32), new THREE.Color(0.55, 0.53, 0.5)));
  const R = 30;
  // 8 bandes verticales à intervalles réguliers : reflets en rayures nettes sur les métaux courbes
  for (let i = 0; i < 8; i++) {
    const az = (i / 8) * Math.PI * 2 + 0.2;
    const w = i % 2 ? 4.5 : 8;
    const l = light(w, 34, i % 2 ? 7 : 16, i % 3 === 0 ? 0xfff1dc : i % 3 === 1 ? 0xffffff : 0xe8f1ff);
    l.position.set(Math.sin(az) * R, 4, Math.cos(az) * R);
    l.lookAt(0, 4, 0);
    s.add(l);
  }
  const top = light(30, 22, 14); top.position.set(0, 26, 0); top.rotation.x = Math.PI / 2; s.add(top);
  const floor = light(40, 40, 0.9, 0xfff8ee); floor.position.set(0, -26, 0); floor.rotation.x = Math.PI / 2; s.add(floor);
  // spots ponctuels : donnent le « feu » des pierres (réflexions brillantes et très petites)
  const pts = [[-12, 20, 14], [14, 18, 10], [2, 22, -12], [-18, 12, -10], [18, 9, 16], [-4, 14, 24], [10, 24, -4]];
  pts.forEach(([x, y, z], i) => { const l = light(1.4, 1.4, 90 + i * 10, i % 2 ? 0xffffff : 0xfff2e0); l.position.set(x, y, z); l.lookAt(0, 0, 0); s.add(l); });
  return s;
}

function buildSoftbox() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: 0x6c6c72, side: THREE.BackSide })));
  const top = light(28, 20, 12); top.position.set(0, 19.9, 0); top.rotation.x = Math.PI / 2; s.add(top);
  const left = light(12, 28, 8, 0xfff3e0); left.position.set(-29.9, 6, 4); left.rotation.y = Math.PI / 2; s.add(left);
  const right = light(8, 28, 6, 0xe0eeff); right.position.set(29.9, 4, -8); right.rotation.y = -Math.PI / 2; s.add(right);
  const back = light(36, 6, 5); back.position.set(0, 2, -29.9); s.add(back);
  const front = light(20, 8, 2.5); front.position.set(0, -4, 29.9); front.rotation.y = Math.PI; s.add(front);
  return s;
}

function buildDaylight() {
  const s = new THREE.Scene();
  s.add(gradientSphere(new THREE.Color(0.5, 0.72, 1.4), new THREE.Color(1.5, 1.42, 1.3), new THREE.Color(0.25, 0.22, 0.2), 40));
  const sun = light(8, 8, 45, 0xfff0d8); sun.position.set(16, 22, 12); sun.lookAt(0, 0, 0); s.add(sun);
  return s;
}

const cache = new Map(); // id -> { texture (PMREM pour l'éclairage), background (pour le fond 360°), equirect? }
const pending = new Map();

/**
 * Retourne { texture, background } pour un id. `texture` éclaire la scène ; `background` sert de fond 360°
 * (HDRI équirectangulaire net, ou cube PMREM pour les environnements procéduraux).
 */
export function getEnvironment(renderer, id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (pending.has(id)) return pending.get(id);
  const def = ENVIRONMENTS.find((e) => e.id === id) || ENVIRONMENTS[0];
  const pmrem = new THREE.PMREMGenerator(renderer);
  const job = (async () => {
    let out;
    if (def.url) {
      const equirect = await new RGBELoader().loadAsync(import.meta.env.BASE_URL + def.url);
      equirect.mapping = THREE.EquirectangularReflectionMapping;
      let rt;
      if (def.tint) {
        // balance des blancs chaude pour l'éclairage seulement (le fond 360° reste fidèle) : l'or n'est plus verdâtre
        // quand il reflète un ciel bleu
        const sc = new THREE.Scene();
        sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32).scale(1, 1, -1), new THREE.MeshBasicMaterial({ map: equirect, color: new THREE.Color(...def.tint) })));
        rt = pmrem.fromScene(sc, 0);
      } else rt = pmrem.fromEquirectangular(equirect);
      out = { texture: rt.texture, background: equirect, equirect: true };
    } else {
      const scene = def.id === 'softbox' ? buildSoftbox() : def.id === 'daylight' ? buildDaylight() : buildStudio();
      const rt = pmrem.fromScene(scene, 0.02);
      out = { texture: rt.texture, background: rt.texture, equirect: false };
    }
    pmrem.dispose();
    cache.set(id, out);
    pending.delete(id);
    return out;
  })().catch((e) => { pending.delete(id); pmrem.dispose(); throw e; });
  pending.set(id, job);
  return job;
}

export function disposeEnvironments() {
  for (const e of cache.values()) { e.texture.dispose(); if (e.equirect) e.background.dispose(); }
  cache.clear();
}
