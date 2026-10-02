// Simulation-time scheduling pauses with the artwork; no timers or particle loops.
export class IdleVariation {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.shape = [1, 0, 0, 0]; // diameter, cone balance, waist depth, waist height
    this.light = [1, 0, 0, 0]; // brightness, grouping strength, phase, height bias
    this.targetShape = [...this.shape];
    this.targetLight = [...this.light];
    this.idleTime = 0;
    this.nextChange = 3;
  }
  update(dt, touching) {
    if (touching) {
      this.idleTime = 0;
      this.nextChange = 3;
    } else {
      this.idleTime += dt;
      if (this.idleTime >= this.nextChange) {
        const r = this.random;
        this.targetShape = [0.82 + r() * 0.28, -0.16 + r() * 0.32, r() * 0.28, -0.45 + r() * 0.9];
        this.targetLight = [0.85 + r() * 0.4, 0.15 + r() * 0.5, r() * Math.PI * 2, -0.24 + r() * 0.48];
        this.nextChange = this.idleTime + 4 + r() * 3;
      }
    }
    // Hold the current envelope while touching, avoiding a competing auto-motion.
    if (!touching) {
      const blend = 1 - Math.exp(-dt * 0.65);
      for (let i = 0; i < 4; i++) {
        this.shape[i] += (this.targetShape[i] - this.shape[i]) * blend;
        this.light[i] += (this.targetLight[i] - this.light[i]) * blend;
      }
    }
  }
}
