import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureTracker } from '../src/input/gestureTracker.js';
import { classifyGesture, resolveShoalGesture, smoothValue } from '../shared/mood.js';

test('straight motion has time weighted speed, zero jitter, and total path length', () => {
  let now = 0;
  const tracker = new GestureTracker(800, () => now);
  for (now = 0; now <= 600; now += 100) tracker.record(now / 2, 0);
  const m = tracker.snapshot(600);
  assert.equal(m.speed, 0.5);
  assert.equal(m.strokeLength, 300);
  assert.equal(m.dwellRatio, 0);
  assert.equal(m.jitter, 0);
  assert.equal(m.curvature, 0);
  assert.equal(m.duration, 600);
});

test('stationary sampling includes dwell and trims window with boundary interpolation', () => {
  const tracker = new GestureTracker();
  tracker.record(0, 0, 0);
  tracker.record(120, 0, 200);
  tracker.record(120, 0, 800);
  const m = tracker.snapshot(800);
  assert.equal(m.duration, 600);
  assert.equal(m.speed, 0);
  assert.equal(m.dwellRatio, 1);
  tracker.reset();
  tracker.record(0, 0, 0);
  tracker.record(100, 0, 500);
  tracker.record(150, 0, 750);
  assert.equal(tracker.snapshot(750).strokeLength, 120);
});

test('jitter is signed angle standard deviation and curvature includes smooth turning', () => {
  const tracker = new GestureTracker();
  [[0, 0], [30, 0], [30, 30], [60, 30], [60, 60]].forEach(([x, y], i) => tracker.record(x, y, i * 100));
  const m = tracker.snapshot(400);
  assert.ok(m.jitter > 1);
  assert.ok(Math.abs(m.curvature - Math.PI / 2) < 0.0001);
});

test('debouncing, duplicate timestamps, invalid data, and stale input', () => {
  const tracker = new GestureTracker(1);
  for (let i = 0; i < 8; i += 1) tracker.record(i, 0, i * 20);
  assert.equal(tracker.shouldEvaluate(140), true);
  tracker.getMetrics(140);
  assert.equal(tracker.shouldEvaluate(939), false);
  assert.equal(tracker.shouldEvaluate(940), true);
  tracker.record(NaN, 1, 200);
  tracker.record(50, 10, 100);
  assert.equal(tracker.history.length, 8);
  tracker.record(8, 3, 140);
  assert.equal(tracker.history.length, 8);
  assert.equal(tracker.snapshot(1000).speed, 0);
});

test('four gesture qualities map correctly and interpolation does not jump or overshoot', () => {
  assert.equal(classifyGesture({ speed: 2, dwellRatio: 0 }).choice, 'aggressive');
  assert.equal(classifyGesture({ speed: 0.3, curvature: 0.5, dwellRatio: 0 }).choice, 'playful');
  assert.equal(classifyGesture({ speed: 0, dwellRatio: 1 }).choice, 'hesitant');
  assert.equal(classifyGesture({ speed: 0.2, dwellRatio: 0 }).choice, 'tender');
  const next = smoothValue(0.4, 2.5, 1 / 60);
  assert.ok(next > 0.4 && next < 0.5);
  assert.equal(smoothValue(0.4, 2.5, 10), 2.5);
});

test('sparse sampling can trigger inference without bypassing debounce or accepting a lone point', () => {
  const tracker = new GestureTracker();
  tracker.record(0, 0, 0);
  assert.equal(tracker.shouldEvaluate(500), false);
  tracker.record(60, 0, 100);
  assert.equal(tracker.shouldEvaluate(100), false);
  tracker.record(120, 0, 400);
  assert.equal(tracker.shouldEvaluate(400), true);
  assert.equal(tracker.getMetrics(400).sampleCount, 3);
  tracker.record(180, 0, 800);
  assert.equal(tracker.shouldEvaluate(800), false);
  tracker.record(240, 0, 1200);
  assert.equal(tracker.shouldEvaluate(1200), true);
});

test('slow repeated curves trigger playful independently of sampling rate, then expire', () => {
  for (const interval of [16, 40, 80]) {
    const tracker = new GestureTracker();
    for (let t = 0; t <= 2400; t += interval) {
      const angle = t / 1440 * Math.PI * 2;
      tracker.record(100 + 26 * Math.cos(angle), 100 + 26 * Math.sin(angle), t);
    }
    assert.ok(tracker.snapshot(2400).speed < 0.12);
    assert.equal(tracker.hasPlayfulCurves(2400), true);
    assert.equal(tracker.hasPlayfulCurves(2600), true);
    assert.equal(tracker.hasPlayfulCurves(4300), false);
    tracker.reset();
    assert.equal(tracker.hasPlayfulCurves(2400), false);
  }
});

test('straight strokes, tiny jitter and reversals do not count as playful curves', () => {
  for (const position of [
    (i) => [i * 2, 0],
    (i) => [Math.sin(i) * 0.8, Math.cos(i) * 0.8],
    (i) => [i % 2 ? 10 : 0, 0],
  ]) {
    const tracker = new GestureTracker();
    for (let i = 0; i <= 60; i += 1) tracker.record(...position(i), i * 40);
    assert.equal(tracker.hasPlayfulCurves(2400), false);
  }
});

test('a fast swipe interrupts the slow-curve playful hold', () => {
  const tracker = new GestureTracker();
  for (let t = 0; t <= 2400; t += 40) tracker.record(26 * Math.cos(t / 1440 * Math.PI * 2), 26 * Math.sin(t / 1440 * Math.PI * 2), t);
  assert.equal(tracker.hasPlayfulCurves(2400), true);
  tracker.record(900, 0, 2440);
  assert.equal(tracker.hasPlayfulCurves(2440), false);
});


test('very slow curves no longer trigger and old curves cannot renew during a straight stroke', () => {
  const verySlow = new GestureTracker();
  const deliberate = new GestureTracker();
  for (let t = 0; t <= 2400; t += 40) {
    const angle = t / 1440 * Math.PI * 2;
    verySlow.record(14 * Math.cos(angle), 14 * Math.sin(angle), t);
    deliberate.record(26 * Math.cos(angle), 26 * Math.sin(angle), t);
  }
  assert.equal(verySlow.hasPlayfulCurves(2400), false);
  assert.equal(deliberate.hasPlayfulCurves(2400), true);
  // Continue along the circle's final tangent: movement alone must not extend it.
  for (let t = 2440; t <= 3800; t += 40) {
    deliberate.record(26, (t - 2400) * 0.08, t);
    deliberate.hasPlayfulCurves(t);
  }
  assert.equal(deliberate.hasPlayfulCurves(3800), false);
});


test('shoal gate rejects a short curve from both legacy classification and Jev', () => {
  const tracker = new GestureTracker();
  for (let i = 0; i <= 8; i += 1) tracker.record(20 * Math.cos(i * 0.2), 20 * Math.sin(i * 0.2), i * 25);
  const legacy = classifyGesture(tracker.snapshot(200));
  assert.equal(legacy.choice, 'playful');
  assert.equal(resolveShoalGesture(legacy, tracker, 200).choice, 'tender');
  assert.equal(resolveShoalGesture({ choice: 'playful', confidence: 0.9, source: 'jev' }, tracker, 200).choice, 'tender');
});

test('shoal gate admits sustained curves but leaves still and sharp gestures available', () => {
  const tracker = new GestureTracker();
  for (let t = 0; t <= 2400; t += 40) tracker.record(26 * Math.cos(t / 1440 * Math.PI * 2), 26 * Math.sin(t / 1440 * Math.PI * 2), t);
  assert.equal(resolveShoalGesture({ choice: 'tender', source: 'jev' }, tracker, 2400).choice, 'playful');
  tracker.record(900, 0, 2440);
  assert.equal(resolveShoalGesture({ choice: 'playful', source: 'jev' }, tracker, 2440).choice, 'aggressive');
  tracker.reset();
  tracker.record(0, 0, 3000); tracker.record(0, 0, 3600);
  assert.equal(resolveShoalGesture({ choice: 'playful', source: 'jev' }, tracker, 3600).choice, 'hesitant');
});


test('shoal requires three distinct substantial curves within the time window', () => {
  const tracker = new GestureTracker();
  let x = 0, y = 0, heading = 0, time = 0;
  tracker.record(x, y, time);
  for (let curve = 1; curve <= 3; curve += 1) {
    const direction = curve % 2 ? 1 : -1;
    for (let step = 0; step < 18; step += 1) {
      heading += direction * 2.5 / 18;
      x += Math.cos(heading) * 3.1;
      y += Math.sin(heading) * 3.1;
      time += 28;
      tracker.record(x, y, time);
    }
    assert.equal(tracker.hasPlayfulCurves(time), curve === 3, `${curve} curves`);
    assert.equal(resolveShoalGesture({ choice: 'playful', source: 'jev' }, tracker, time).choice === 'playful', curve === 3);
  }
  assert.equal(tracker.hasPlayfulCurves(time + 1800), false);
});
