const WINDOW_MS = 600;
// Require sustained, deliberate curves rather than a single bend.
const CURVE_WINDOW_MS = 1680;
const CURVE_MIN_SPEED = 0.075;
const CURVE_HOLD_MS = 400;
// The previous 4.5-radian gate represented two substantial bends. Count three
// 2.25-radian arcs now; do not combine unfinished arcs across direction changes.
const CURVE_TURN_RADIANS = 2.25;
const REQUIRED_CURVES = 3;
const STILL_SPEED = 0.04; // CSS pixels per millisecond
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;

export class GestureTracker {
  constructor(debounceMs = 800, now = () => performance.now()) {
    this.history = [];
    this.curveHistory = [];
    this.playfulUntil = -Infinity;
    this.lastCurveTrigger = -Infinity;
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
    // Spatially spaced samples keep slow curves independent of input/frame rate.
    const lastCurve = this.curveHistory.at(-1);
    if (!lastCurve || Math.hypot(x - lastCurve.x, y - lastCurve.y) >= 3) this.curveHistory.push({ x, y, t });
    while (this.curveHistory.length && this.curveHistory[0].t < t - CURVE_WINDOW_MS) this.curveHistory.shift();
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

  hasPlayfulCurves(t = this.now()) {
    const points = this.curveHistory.filter((point) => point.t >= t - CURVE_WINDOW_MS);
    let length = 0;
    let curves = 0;
    let curveTurn = 0;
    let curveDirection = 0;
    let bends = 0;
    let angle = null;
    let lastBendTime = -Infinity;
    for (let i = 1; i < points.length; i += 1) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.hypot(dx, dy);
      const nextAngle = Math.atan2(dy, dx);
      if (angle !== null) {
        const signedTurn = Math.atan2(Math.sin(nextAngle - angle), Math.cos(nextAngle - angle));
        const turn = Math.abs(signedTurn);
        // Exclude back-and-forth reversals and tiny tracking noise.
        if (turn > 0.06 && turn < 1.8) {
          const direction = Math.sign(signedTurn);
          if (direction !== curveDirection) curveTurn = 0;
          curveDirection = direction;
          curveTurn += turn;
          if (curveTurn >= CURVE_TURN_RADIANS) { curves += 1; curveTurn -= CURVE_TURN_RADIANS; }
          bends += 1;
          lastBendTime = points[i].t;
        } else if (turn >= 1.8) {
          curveTurn = 0;
          curveDirection = 0;
        }
      }
      angle = nextAngle;
    }
    const speed = this.snapshot(t).speed;
    if (speed > 0.95) { this.playfulUntil = -Infinity; return false; }
    if (points.length >= 9 && t - lastBendTime < 200 && speed >= CURVE_MIN_SPEED
        && length >= 90 && bends >= 8 && curves >= REQUIRED_CURVES && lastBendTime > this.lastCurveTrigger) {
      // Old curves must not keep renewing Playful during a subsequent straight stroke.
      this.lastCurveTrigger = lastBendTime;
      this.playfulUntil = lastBendTime + CURVE_HOLD_MS;
    }
    return t < this.playfulUntil;
  }

  reset() {
    this.history.length = 0;
    this.curveHistory.length = 0;
    this.playfulUntil = -Infinity;
    this.lastCurveTrigger = -Infinity;
  }
}
