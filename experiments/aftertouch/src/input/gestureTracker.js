const WINDOW_MS = 600;
const STILL_SPEED = 0.04; // CSS pixels per millisecond
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;

export class GestureTracker {
  constructor(debounceMs = 800, now = () => performance.now()) {
    this.history = [];
    this.now = now;
    this.lastTrigger = -Infinity;
    this.debounceMs = Math.max(800, debounceMs);
  }

  record(x, y, t = this.now()) {
    if (![x, y, t].every(Number.isFinite)) return;
    const previous = this.history.at(-1);
    if (previous && t < previous.t) return;
    if (previous && t === previous.t) {
      previous.x = x;
      previous.y = y;
      return;
    }
    this.history.push({ x, y, t });
    // Retain one boundary point to interpolate the entire sliding window.
    while (this.history.length > 2 && this.history[1].t <= t - WINDOW_MS) this.history.shift();
    if (this.history.length > 1000) this.history.splice(0, this.history.length - 1000);
  }

  shouldEvaluate(t = this.now()) {
    // A slow renderer may produce fewer than six samples in the 600ms window.
    // Wait for a short observed duration instead of requiring a frame count.
    return this.history.length >= 2 && t - this.history[0].t >= 120
      && t - this.lastTrigger >= this.debounceMs;
  }

  getMetrics(t = this.now()) {
    this.lastTrigger = t;
    return this.snapshot(t);
  }

  snapshot(t = this.now()) {
    const points = this.history;
    if (points.length < 2 || t - points.at(-1).t > WINDOW_MS) {
      return { speed: 0, jitter: 0, dwellRatio: 1, strokeLength: 0, curvature: 0, duration: 0, sampleCount: 2 };
    }
    const cutoff = t - WINDOW_MS;
    let length = 0;
    let dwell = 0;
    let duration = 0;
    let previousAngle = null;
    const turns = [];
    let sampleCount = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dt = b.t - a.t;
      const clippedDt = Math.max(0, b.t - Math.max(a.t, cutoff));
      if (!dt || !clippedDt) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      length += distance * clippedDt / dt;
      duration += clippedDt;
      sampleCount += 1;
      if (distance / dt < STILL_SPEED) dwell += clippedDt;
      if (distance > 0.5) {
        const angle = Math.atan2(dy, dx);
        if (previousAngle !== null) {
          const difference = angle - previousAngle;
          turns.push(Math.atan2(Math.sin(difference), Math.cos(difference)));
        }
        previousAngle = angle;
      }
    }
    // A still held pointer is sampled every frame, so dwell is time-weighted.
    const tail = clamp(t - points.at(-1).t, 0, WINDOW_MS - duration);
    duration += tail;
    dwell += tail;
    const mean = turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : 0;
    const jitter = turns.length ? Math.sqrt(turns.reduce((sum, turn) => sum + (turn - mean) ** 2, 0) / turns.length) : 0;
    const curvature = turns.length ? turns.reduce((sum, turn) => sum + Math.abs(turn), 0) / turns.length : 0;
    return {
      speed: round(clamp(duration ? length / duration : 0, 0, 100)),
      jitter: round(clamp(jitter, 0, Math.PI)),
      dwellRatio: round(clamp(duration ? dwell / duration : 1, 0, 1)),
      strokeLength: round(clamp(length, 0, 60000)),
      curvature: round(clamp(curvature, 0, Math.PI)),
      duration: round(clamp(duration, 0, WINDOW_MS)),
      sampleCount: clamp(sampleCount + 1, 2, 1000),
    };
  }

  reset() {
    this.history.length = 0;
  }
}
