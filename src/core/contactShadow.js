// Ombre de contact : vue du dessous (caméra orthographique sous le sol) où chaque pièce s'assombrit d'autant plus qu'elle est
// proche du sol, puis double flou. Calculée UNE fois à chaque changement de la bague (pas à chaque image) : c'est une texture.
// Remplace le simple halo radial : l'ombre épouse la vraie forme de la bague et s'estompe avec la hauteur.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

const N = 512;

export class ContactShadow {
  /** @param {import('./viewer.js').Viewer} viewer @param {THREE.Mesh} mesh plan du sol qui reçoit l'ombre (halo de repli tant que rien n'est calculé) */
  constructor(viewer, mesh) {
    this.v = viewer; this.mesh = mesh; this.ready = false;
    const opt = { type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: false };
    this.rt = new THREE.WebGLRenderTarget(N, N, opt);
    this.rtBlur = new THREE.WebGLRenderTarget(N, N, opt);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.cam.rotation.x = Math.PI / 2; // regarde vers le haut, depuis le sol
    this.depthMat = new THREE.ShaderMaterial({
      uniforms: { uDark: { value: 1.1 } }, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uDark; void main(){ gl_FragColor = vec4(vec3(0.0), (1.0 - gl_FragCoord.z) * uDark); }',
    });
    this.h = new THREE.ShaderMaterial({ ...HorizontalBlurShader, uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms), depthTest: false });
    this.vt = new THREE.ShaderMaterial({ ...VerticalBlurShader, uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms), depthTest: false });
    this.quad = new FullScreenQuad(null);
  }

  _blur(amount) {
    const r = this.v.renderer;
    this.h.uniforms.tDiffuse.value = this.rt.texture; this.h.uniforms.h.value = amount / N;
    this.quad.material = this.h; r.setRenderTarget(this.rtBlur); r.clear(); this.quad.render(r);
    this.vt.uniforms.tDiffuse.value = this.rtBlur.texture; this.vt.uniforms.v.value = amount / N;
    this.quad.material = this.vt; r.setRenderTarget(this.rt); r.clear(); this.quad.render(r);
  }

  bake() {
    const v = this.v, root = v.root, r = v.renderer, scene = v.scene;
    if (!root || !v.box) return;
    const size = this.mesh.scale.x, height = Math.max(1e-3, v.box.max.y - v.box.min.y) * 1.15;
    this.cam.left = -size / 2; this.cam.right = size / 2; this.cam.top = size / 2; this.cam.bottom = -size / 2; this.cam.far = height;
    this.cam.position.copy(this.mesh.position); this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld(true);
    // seule la bague projette : le reste (sol, écrin d'intro, contours de sélection) est masqué le temps du calcul
    const hidden = [];
    for (const o of scene.children) if (o !== root && o.visible) { o.visible = false; hidden.push(o); }
    root.traverse((o) => { if (o.userData.highlight && o.visible) { o.visible = false; hidden.push(o); } });
    const prev = { target: r.getRenderTarget(), bg: scene.background, over: scene.overrideMaterial, auto: r.autoClear, tm: r.toneMapping, ca: r.getClearAlpha() };
    scene.background = null; scene.overrideMaterial = this.depthMat; r.autoClear = false; r.toneMapping = THREE.NoToneMapping;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, this.cam);
    this._blur(3.2); this._blur(1.3);
    r.setRenderTarget(prev.target); scene.background = prev.bg; scene.overrideMaterial = prev.over; r.autoClear = prev.auto; r.toneMapping = prev.tm;
    for (const o of hidden) o.visible = true;
    if (!this.ready) {
      this.ready = true;
      this.mesh.material.map = this.rt.texture; this.mesh.material.needsUpdate = true;
    }
    this.mesh.material.opacity = 0.92;
  }

  dispose() { this.rt.dispose(); this.rtBlur.dispose(); this.depthMat.dispose(); this.h.dispose(); this.vt.dispose(); this.quad.dispose(); }
}
