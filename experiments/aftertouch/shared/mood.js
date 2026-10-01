export const MODES = Object.freeze({
  hesitant: { turbulence: 0.2, decay: 0.98, paletteBlend: 0, attraction: -0.5, label: 'Hesitant', note: 'ためらいは、淡い青へ。' },
  aggressive: { turbulence: 2.5, decay: 0.85, paletteBlend: 1, attraction: 3, label: 'Aggressive', note: '鋭い動きは、深い紅へ。' },
  tender: { turbulence: 0.4, decay: 0.95, paletteBlend: 2, attraction: 1, label: 'Tender', note: 'ゆっくり触れると、琥珀がほどけます。' },
  playful: { turbulence: 1.2, decay: 0.92, paletteBlend: 3, attraction: 0.5, label: 'Playful', note: '曲線を描くと、紫の軌道が生まれます。' },
});

export function classifyGesture(metrics) {
  const { speed = 0, jitter = 0, dwellRatio = 1, curvature = 0 } = metrics;
  let choice = 'tender';
  let confidence = 0.6;
  if (speed > 0.95 || (speed > 0.5 && jitter > 0.95)) {
    choice = 'aggressive';
    confidence = Math.min(0.9, 0.6 + speed * 0.12);
  } else if (speed > 0.12 && (curvature > 0.14 || jitter > 0.3) && dwellRatio < 0.55) {
    choice = 'playful';
    confidence = 0.72;
  } else if (dwellRatio > 0.65 || (speed < 0.1 && jitter > 0.4)) {
    choice = 'hesitant';
    confidence = 0.65;
  }
  return { choice, confidence, source: 'heuristic' };
}

export function isMood(value) {
  return value && Object.hasOwn(MODES, value.choice) && Number.isFinite(value.confidence)
    && value.confidence >= 0 && value.confidence <= 1;
}

export function resolveShoalGesture(result, tracker, now) {
  const local = classifyGesture(tracker.snapshot(now));
  const curves = tracker.hasPlayfulCurves(now);
  if (local.choice === 'aggressive') return local;
  if (curves) return { choice: 'playful', confidence: 0.78, source: 'heuristic' };
  // Apply the same curve gate to the short-window classifier and remote Jev.
  // Otherwise either route can bypass the stricter sustained-curve check.
  if (result.choice === 'playful') return { ...local, choice: local.choice === 'playful' ? 'tender' : local.choice };
  return result;
}

export function smoothValue(current, target, deltaTime) {
  return current + (target - current) * Math.min(1, Math.max(0, deltaTime) * 2.5);
}
