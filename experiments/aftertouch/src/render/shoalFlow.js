import * as THREE from 'three';
import { ParticleFlow } from './particleFlow.js';
import quadVertex from '../shaders/simulation.vert.glsl?raw';
import simulationFragment from '../shaders/shoal-simulation.frag.glsl?raw';
import particleVertex from '../shaders/shoal.vert.glsl?raw';
import particleFragment from '../shaders/particles.frag.glsl?raw';

const material = (vertexShader, fragmentShader, uniforms, options = {}) => new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms,
  depthTest: false, depthWrite: false, ...options,
});

export class ShoalFlow extends ParticleFlow {
  constructor(canvas) {
    super(canvas);
    this.spatialCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    this.viewProjection = new THREE.Matrix4();
    Object.assign(this.uniforms, {
      u_velocity: { value: null }, u_view_projection: { value: this.viewProjection },
      u_camera_position: { value: new THREE.Vector3() }, u_camera_right: { value: new THREE.Vector3() },
      u_camera_up: { value: new THREE.Vector3() }, u_to_viewer: { value: new THREE.Vector3() },
      u_projection_scale: { value: 1 },
    });
    this.states.forEach((target) => target.dispose());
    this.states = [0, 1].map(() => new THREE.WebGLRenderTarget(this.grid, this.grid, {
      count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false,
    }));
    this.simulation.dispose();
    this.particleMaterial.dispose();
    this.simulation = material(quadVertex, simulationFragment, this.uniforms);
    this.particleMaterial = material(particleVertex, particleFragment, this.uniforms, {
      blending: THREE.AdditiveBlending, transparent: true,
    });
    this.particles.material = this.particleMaterial;
    this.reset();
    this.resize();
  }

  reset() {
    if (!this.spatialCamera) return super.reset();
    const positions = new Float32Array(this.count * 4);
    const velocities = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i += 1) {
      const height = ((i * 0.754877666) % 1);
      const thickness = ((i * 0.569840296) % 1);
      const theta = i * 2.39996323;
      const radius = 0.30 + height * 0.37 + thickness * 0.12;
      positions.set([Math.cos(theta) * radius, (height * 2 - 1) * 0.98, Math.sin(theta) * radius, 1], i * 4);
      velocities.set([-Math.sin(theta) * 0.2, 0, Math.cos(theta) * 0.2, 1], i * 4);
    }
    const textures = [positions, velocities].map((data) => {
      const texture = new THREE.DataTexture(data, this.grid, this.grid, THREE.RGBAFormat, THREE.FloatType);
      texture.needsUpdate = true;
      return texture;
    });
    const copy = material(quadVertex, `precision highp float;
      uniform sampler2D initial_position; uniform sampler2D initial_velocity; in vec2 v_uv;
      layout(location = 0) out vec4 position_out; layout(location = 1) out vec4 velocity_out;
      void main(){ position_out=texture(initial_position,v_uv); velocity_out=texture(initial_velocity,v_uv); }`, {
      initial_position: { value: textures[0] }, initial_velocity: { value: textures[1] },
    });
    for (const target of this.states) this.pass(copy, target, true);
    copy.dispose();
    textures.forEach((texture) => texture.dispose());
    for (const target of this.trails) {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
    }
    this.renderer.setRenderTarget(null);
    this.stateIndex = 0;
    this.trailIndex = 0;
    this.time = 0;
    this.pointerEngaged = false;
  }

  resize() {
    super.resize();
    if (!this.spatialCamera) return;
    this.spatialCamera.aspect = this.uniforms.u_aspect.value;
    this.spatialCamera.updateProjectionMatrix();
    this.updateCamera();
  }

  updateCamera() {
    const camera = this.spatialCamera;
    const distance = Math.max(3.4, 2.0 / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    const azimuth = 0.31 + Math.sin(this.time * 0.12) * 0.14;
    camera.position.set(Math.sin(azimuth), 0.48, Math.cos(azimuth)).normalize().multiplyScalar(distance);
    camera.lookAt(0, 0.05, 0);
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.uniforms.u_camera_position.value.copy(camera.position);
    this.uniforms.u_camera_right.value.setFromMatrixColumn(camera.matrixWorld, 0);
    this.uniforms.u_camera_up.value.setFromMatrixColumn(camera.matrixWorld, 1);
    this.uniforms.u_to_viewer.value.copy(camera.position).normalize();
    this.uniforms.u_projection_scale.value = camera.projectionMatrix.elements[5];
  }

  pointerFromScreen(x, y) {
    return { x: (x / window.innerWidth * 2 - 1) * window.innerWidth / window.innerHeight, y: 1 - y / window.innerHeight * 2 };
  }

  render(deltaTime, values, pointer) {
    const dt = Math.min(deltaTime, 1 / 30);
    this.time += dt;
    this.updateCamera();
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
    u.u_state.value = this.states[this.stateIndex].textures[0];
    u.u_velocity.value = this.states[this.stateIndex].textures[1];
    this.pass(this.simulation, this.states[nextState]);
    this.stateIndex = nextState;
    u.u_state.value = this.states[this.stateIndex].textures[0];
    u.u_velocity.value = this.states[this.stateIndex].textures[1];
    const nextTrail = 1 - this.trailIndex;
    this.trailUniforms.u_trail.value = this.trails[this.trailIndex].texture;
    this.pass(this.trailMaterial, this.trails[nextTrail]);
    this.renderer.setRenderTarget(this.trails[nextTrail]);
    this.renderer.render(this.particleScene, this.camera);
    this.trailIndex = nextTrail;
    this.displayUniforms.u_trail.value = this.trails[this.trailIndex].texture;
    this.pass(this.displayMaterial, null);
    if (this.shaderError) throw new Error('立体描画シェーダーをコンパイルできませんでした。');
  }

  sampleMotion() {
    const size = 16;
    const positions = new Uint16Array(size * size * 4);
    const velocities = new Uint16Array(size * size * 4);
    const target = this.states[this.stateIndex];
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, positions, undefined, 0);
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, velocities, undefined, 1);
    const half = THREE.DataUtils.fromHalfFloat;
    const samples = [];
    for (let i = 0; i < positions.length; i += 4) samples.push({
      x: half(positions[i]), y: half(positions[i + 1]), z: half(positions[i + 2]),
      vx: half(velocities[i]), vy: half(velocities[i + 1]), vz: half(velocities[i + 2]),
    });
    return samples;
  }
}
