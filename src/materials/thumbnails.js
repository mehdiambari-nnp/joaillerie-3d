// Génère les « billes » (vignettes de matériaux) avec un moteur WebGL temporaire :
// un seul contexte persistant sur iOS (limite mémoire) → ce moteur est détruit juste après.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { METALS, FINISHES, DEFAULT_METAL } from './library.js';
import { createMaterial } from './factory.js';

/** Retourne { metals:{id:url}, finishes:{id:url}, gems:{id:url} }. */
export function renderThumbnails(size = 112) {
  const out = { metals: {}, finishes: {}, gems: {} };
  let renderer;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch { return out; }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  cam.position.set(0, 0.15, 5.4);
  cam.lookAt(0, 0, 0);

  // fond neutre dégradé derrière les pierres (la transmission échantillonne le fond)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = bgCanvas.height = 64;
  const g = bgCanvas.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#c9c5bd'); gr.addColorStop(1, '#8d897f');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const bg = new THREE.CanvasTexture(bgCanvas);
  bg.colorSpace = THREE.SRGBColorSpace;

  const sphere = new THREE.SphereGeometry(1, 48, 32);

  const shoot = (mesh, mat, withBg) => {
    scene.background = withBg ? bg : null;
    mesh.material = mat;
    scene.add(mesh);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, cam);
    const url = canvas().toDataURL('image/png');
    scene.remove(mesh);
    mat.dispose();
    return url;
  };
  const canvas = () => renderer.domElement;
  const ball = new THREE.Mesh(sphere);
  ball.rotation.x = 0.4;

  for (const m of METALS) out.metals[m.id] = shoot(ball, createMaterial('metal', { m: m.id, f: 'polish' }), false);
  for (const f of FINISHES) out.finishes[f.id] = shoot(ball, createMaterial('metal', { m: DEFAULT_METAL.m, f: f.id }), false);
  // pierres : pastilles SVG (gemicon.js), plus de vignettes 3D (le catalogue compte une cinquantaine de pierres)
  env.dispose(); pmrem.dispose(); sphere.dispose(); bg.dispose();
  renderer.forceContextLoss(); renderer.dispose();
  return out;
}
