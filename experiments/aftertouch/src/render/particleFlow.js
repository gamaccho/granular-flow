import * as THREE from 'three';
import quadVertex from '../shaders/simulation.vert.glsl?raw';
import simulationFragment from '../shaders/simulation.frag.glsl?raw';
import particleVertex from '../shaders/particles.vert.glsl?raw';
import particleFragment from '../shaders/particles.frag.glsl?raw';
import trailFragment from '../shaders/trail.frag.glsl?raw';
import displayFragment from '../shaders/display.frag.glsl?raw';

const makeMaterial = (vertexShader, fragmentShader, uniforms, options = {}) => new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms,
  depthTest: false, depthWrite: false, ...options,
});

export class ParticleFlow {
  constructor(canvas) {
    const context = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('この作品にはWebGL 2対応のブラウザーが必要です。');
    if (!context.getExtension('EXT_color_buffer_float')) throw new Error('この端末ではGPUシミュレーションに必要な浮動小数点描画を利用できません。');
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.debug.checkShaderErrors = true;
    this.shaderError = false;
    this.renderer.debug.onShaderError = () => { this.shaderError = true; console.error('AFTERTOUCH: shader compilation failed'); };
    this.isMobile = matchMedia('(pointer: coarse)').matches;
    this.grid = this.isMobile ? 192 : 256;
    this.count = this.grid * this.grid;
    this.quality = this.isMobile ? 1.2 : 1.5;
    this.camera = new THREE.Camera();
    this.quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.quadGeometry);
    this.quad.frustumCulled = false;
    this.passScene = new THREE.Scene();
    this.passScene.add(this.quad);
    this.uniforms = {
      u_state: { value: null }, u_time: { value: 0 }, u_dt: { value: 1 / 60 },
      u_turbulence: { value: 0.4 }, u_decay: { value: 0.95 }, u_particle_attraction: { value: 1 },
      u_palette_blend: { value: 2 }, u_pointer: { value: new THREE.Vector2() },
      u_pointer_previous: { value: new THREE.Vector2() },
      u_pointer_velocity: { value: new THREE.Vector2() }, u_active: { value: 0 },
      u_aspect: { value: 1 }, u_pixel_ratio: { value: 1 }, u_density: { value: 65536 / this.count },
      u_resolution: { value: new THREE.Vector2() },
    };
    const stateOptions = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false };
    this.states = [new THREE.WebGLRenderTarget(this.grid, this.grid, stateOptions), new THREE.WebGLRenderTarget(this.grid, this.grid, stateOptions)];
    const trailOptions = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
    this.trails = [new THREE.WebGLRenderTarget(1, 1, trailOptions), new THREE.WebGLRenderTarget(1, 1, trailOptions)];
    this.simulation = makeMaterial(quadVertex, simulationFragment, this.uniforms);
    this.trailUniforms = { u_trail: { value: null }, u_decay: this.uniforms.u_decay, u_dt: this.uniforms.u_dt, u_texel: { value: new THREE.Vector2() } };
    this.trailMaterial = makeMaterial(quadVertex, trailFragment, this.trailUniforms);
    this.displayUniforms = { u_trail: { value: null }, u_resolution: { value: new THREE.Vector2() }, u_time: this.uniforms.u_time };
    this.displayMaterial = makeMaterial(quadVertex, displayFragment, this.displayUniforms);
    // Narrow instanced ribbons give long fibers without large square point sprites.
    const geometry = new THREE.InstancedBufferGeometry();
    const uv = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i += 1) {
      uv[i * 2] = (i % this.grid + 0.5) / this.grid;
      uv[i * 2 + 1] = (Math.floor(i / this.grid) + 0.5) / this.grid;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0,
    ]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('a_uv', new THREE.InstancedBufferAttribute(uv, 2));
    geometry.instanceCount = this.count;
    this.particleMaterial = makeMaterial(particleVertex, particleFragment, this.uniforms, { blending: THREE.AdditiveBlending, transparent: true });
    this.particles = new THREE.Mesh(geometry, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.particleScene = new THREE.Scene();
    this.particleScene.add(this.particles);
    this.stateIndex = 0;
    this.trailIndex = 0;
    this.time = 0;
    this.pointerEngaged = false;
    this.resize();
    this.reset();
  }

  pass(material, target, clear = false) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear();
    this.renderer.render(this.passScene, this.camera);
  }

  reset() {
    const data = new Float32Array(this.count * 4);
    // A seeded annulus with fine folded filaments, never a CPU particle loop per frame.
    for (let i = 0; i < this.count; i += 1) {
      const seed = ((i * 16807) % 2147483647) / 2147483647;
      const theta = i * 2.39996323;
      const radius = 0.47 + 0.21 * ((i * 0.61803398875) % 1) + 0.025 * Math.sin(theta * 3);
      data[i * 4] = Math.cos(theta) * radius;
      data[i * 4 + 1] = Math.sin(theta) * radius / 1.17;
      data[i * 4 + 2] = -Math.sin(theta) * (0.08 + seed * 0.02);
      data[i * 4 + 3] = Math.cos(theta) * (0.08 + seed * 0.02);
    }
    const texture = new THREE.DataTexture(data, this.grid, this.grid, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    const copy = makeMaterial(quadVertex, 'precision highp float; uniform sampler2D u_initial; in vec2 v_uv; out vec4 out_color; void main(){out_color=texture(u_initial,v_uv);}', { u_initial: { value: texture } });
    for (const target of this.states) this.pass(copy, target, true);
    copy.dispose();
    texture.dispose();
    for (const target of this.trails) {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
    }
    this.renderer.setRenderTarget(null);
    this.time = 0;
    this.pointerEngaged = false;
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality, Math.sqrt(1800000 / (width * height)));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.uniforms.u_aspect.value = width / height;
    this.uniforms.u_pixel_ratio.value = ratio;
    this.uniforms.u_resolution.value.set(width, height);
    this.displayUniforms.u_resolution.value.set(width, height);
    for (const trail of this.trails) trail.setSize(Math.round(width * ratio), Math.round(height * ratio));
    this.trailUniforms.u_texel.value.set(1 / Math.round(width * ratio), 1 / Math.round(height * ratio));
  }

  pointerFromScreen(x, y) {
    const aspect = window.innerWidth / window.innerHeight;
    const scale = aspect < 1 ? aspect * 1.55 : 1.22;
    return {
      x: (x / window.innerWidth * 2 - 1) * aspect / scale,
      y: (1 - y / window.innerHeight * 2) / scale,
    };
  }

  render(deltaTime, values, pointer) {
    const dt = Math.min(deltaTime, 1 / 30);
    this.time += dt;
    const u = this.uniforms;
    u.u_time.value = this.time;
    u.u_dt.value = dt;
    u.u_turbulence.value = values.turbulence;
    u.u_decay.value = values.decay;
    u.u_palette_blend.value = values.paletteBlend;
    u.u_particle_attraction.value = values.attraction;
    if (this.pointerEngaged && pointer.inside) u.u_pointer_previous.value.copy(u.u_pointer.value);
    else u.u_pointer_previous.value.set(pointer.x, pointer.y);
    u.u_pointer.value.set(pointer.x, pointer.y);
    this.pointerEngaged = pointer.inside;
    u.u_pointer_velocity.value.set(pointer.vx, pointer.vy);
    u.u_active.value = pointer.active;
    const nextState = 1 - this.stateIndex;
    u.u_state.value = this.states[this.stateIndex].texture;
    this.pass(this.simulation, this.states[nextState]);
    this.stateIndex = nextState;
    u.u_state.value = this.states[this.stateIndex].texture;
    const nextTrail = 1 - this.trailIndex;
    this.trailUniforms.u_trail.value = this.trails[this.trailIndex].texture;
    this.pass(this.trailMaterial, this.trails[nextTrail]);
    this.renderer.setRenderTarget(this.trails[nextTrail]);
    this.renderer.render(this.particleScene, this.camera);
    this.trailIndex = nextTrail;
    this.displayUniforms.u_trail.value = this.trails[this.trailIndex].texture;
    this.pass(this.displayMaterial, null);
    if (this.shaderError) throw new Error('描画シェーダーをコンパイルできませんでした。ブラウザーを更新してお試しください。');
  }

  reduceQuality() {
    if (this.quality <= 0.75) return false;
    this.quality = Math.max(0.75, this.quality - 0.25);
    this.resize();
    return true;
  }

  sampleMotion() {
    // On-demand debug readback only; no GPU readback or CPU particle loop in frame().
    const size = 16;
    const pixels = new Uint16Array(size * size * 4);
    this.renderer.readRenderTargetPixels(this.states[this.stateIndex], 0, 0, size, size, pixels);
    const samples = [];
    for (let i = 0; i < pixels.length; i += 4) samples.push({
      x: THREE.DataUtils.fromHalfFloat(pixels[i]),
      y: THREE.DataUtils.fromHalfFloat(pixels[i + 1]),
      vx: THREE.DataUtils.fromHalfFloat(pixels[i + 2]),
      vy: THREE.DataUtils.fromHalfFloat(pixels[i + 3]),
    });
    return samples;
  }

  dispose() {
    this.states.forEach((target) => target.dispose());
    this.trails.forEach((target) => target.dispose());
    [this.simulation, this.trailMaterial, this.displayMaterial, this.particleMaterial].forEach((material) => material.dispose());
    this.quadGeometry.dispose();
    this.particles.geometry.dispose();
    this.renderer.dispose();
  }
}
