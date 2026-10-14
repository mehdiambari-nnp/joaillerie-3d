// Reflet très discret de la bague sur le sol (surface satinée) : miroir plan à faible intensité, flou et fondu radial.
// Ordinateur uniquement (une seconde vue de la scène). Le reflet n'est recalculé que pendant le mouvement ou après un changement :
// pendant le cumul d'images à l'arrêt, la texture précédente est réutilisée (même caméra).
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

const SHADER = {
  name: 'FloorReflection',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: 0.14 }, uTexel: { value: 1 / 768 } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vPlane;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vPlane = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uStrength; uniform float uTexel; varying vec4 vUv; varying vec2 vPlane;
    void main(){
      vec2 uv = vUv.xy / vUv.w;
      float r = length(vPlane);
      float fade = 1.0 - smoothstep(0.08, 0.46, r);                 // fondu radial : le reflet disparaît loin de la bague
      if (fade <= 0.001) discard;
      float blur = uTexel * (1.5 + 7.0 * smoothstep(0.0, 0.4, r));   // plus flou en s'éloignant (surface satinée)
      vec4 acc = vec4(0.0);
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) acc += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * blur);
      acc /= 25.0;
      gl_FragColor = vec4(acc.rgb / max(acc.a, 1e-4), acc.a * fade * uStrength);
    }`,
};

export class Reflection {
  constructor(viewer, shadowMesh) {
    this.v = viewer; this.shadow = shadowMesh; this.dirty = true;
    this.mesh = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: 768, textureHeight: 768, clipBias: 0.003, shader: SHADER, multisample: 0 });
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = -3;
    this.mesh.material.transparent = true; this.mesh.material.depthWrite = false;
    this.mesh.raycast = () => {};
    const orig = this.mesh.onBeforeRender;
    this.mesh.onBeforeRender = (renderer, scene, camera, ...rest) => {
      if (!this.dirty) return; // même caméra qu'à l'image précédente : on garde la texture
      const hide = [];
      for (const o of [this.shadow]) if (o.visible) { o.visible = false; hide.push(o); }
      this.v.root?.traverse((o) => { if (o.userData.highlight && o.visible) { o.visible = false; hide.push(o); } });
      try { orig.call(this.mesh, renderer, scene, camera, ...rest); } finally { for (const o of hide) o.visible = true; }
      this.dirty = false;
    };
  }

  /** Cale le plan sous la bague (même niveau que l'ombre, légèrement dessous). */
  place(center, floorY, size) {
    this.mesh.position.set(center.x, floorY - 0.02, center.z);
    this.mesh.scale.setScalar(size);
    this.dirty = true;
  }

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.getRenderTarget().dispose(); }
}
