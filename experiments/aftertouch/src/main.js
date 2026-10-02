import './style.css';
import { BackgroundMusic } from './client/backgroundMusic.js';
import { GestureTracker } from './input/gestureTracker.js';
import { JevClient } from './client/jevClient.js';
import { ParticleFlow } from './render/particleFlow.js';
import { ShoalFlow } from './render/shoalFlow.js';
import { MODES, classifyGesture, resolveShoalGesture, smoothValue } from '../shared/mood.js';

const canvas = document.querySelector('#art');
const spatial = new URLSearchParams(location.search).get('view') === 'shoal';
const Flow = spatial ? ShoalFlow : ParticleFlow;
const musicButton = document.querySelector('#music');
const music = spatial ? new BackgroundMusic(`${import.meta.env.BASE_URL}audio/deep-sea-loop.mp3`, {
  onChange: ({ status, playing, muted }) => {
    musicButton.dataset.playing = String(playing);
    musicButton.setAttribute('aria-label', playing ? 'BGMをミュート' : 'BGMを再生');
    musicButton.setAttribute('aria-pressed', String(muted));
    musicButton.title = status === 'error' ? 'BGMを読み込めませんでした' : status === 'loading' ? 'BGM読み込み中' : playing ? 'BGMをミュート' : 'BGMを再生';
    musicButton.disabled = status === 'error';
    document.querySelector('#music-icon').setAttribute('d', playing ? 'M8 5v14M16 5v14' : 'M9 18V5l10-2v13M9 8l10-2M9 18c0 2-5 3-5 0s5-2 5 0M19 16c0 2-5 3-5 0s5-2 5 0');
  },
}) : null;
musicButton.hidden = !music;
musicButton.addEventListener('click', () => {
  if (!music) return;
  if (!music.snapshot().playing && !music.muted) music.resume(true);
  else music.toggle();
});
// Capture touch before decoding completes, so iPhone can unlock the context
// even when the first gesture happens during the download.
const unlockMusic = (event) => {
  if (!event.isTrusted || event.target.closest?.('#music')) return;
  music?.resume(true);
};
document.addEventListener('pointerdown', unlockMusic, { capture: true, passive: true });
document.addEventListener('pointerup', unlockMusic, { capture: true, passive: true });
document.addEventListener('touchstart', unlockMusic, { capture: true, passive: true });
document.addEventListener('click', unlockMusic, { capture: true, passive: true });
document.addEventListener('touchend', unlockMusic, { capture: true, passive: true });
document.addEventListener('keydown', unlockMusic, { capture: true });
if (music) void music.load();

const errorPanel = document.querySelector('#error');
const connection = document.querySelector('#connection');
const tracker = new GestureTracker();
const client = new JevClient({
  staticPreview: import.meta.env.VITE_STATIC_PREVIEW === true,
  apiBase: import.meta.env.VITE_JEV_API_BASE ?? '',
});
if (client.provider === 'preview') document.querySelector('.edition span').textContent = '001 / PREVIEW';
else if (client.apiBase) document.querySelector('.edition span').textContent = '001 / JEV';
if (spatial) {
  document.querySelector('h1').innerHTML = 'AFTERTOUCH 002<span class="title-dot">.</span>';
  document.querySelector('.edition').firstChild.textContent = 'SPATIAL STUDY';
  document.querySelector('.edition span').textContent = '002 / SHOAL';
  document.querySelector('#intro p').innerHTML = '立体の流れに、触れる。<br /><span>Reach into the turning shoal.</span>';
}
const colors = { hesitant: '#8ec9ed', aggressive: '#f56751', tender: '#eab073', playful: '#b88bff' };
const values = { ...MODES.tender };
let target = MODES.tender;
let mood = 'tender';
let source = 'heuristic';
let connectionReason = null;
let flow;
let paused = false;
let animationId;
let lastFrame = performance.now();
let lastSample = 0;
let lastLocal = 0;
let remoteAt = -Infinity;
let lastContact = -Infinity;
let generation = 0;
let pointerId = null;
let previousPointerTime = 0;
let fps = 60;
let slowFrames = 0;
let qualityFrames = 0;
const pointer = { x: 0, y: 0, vx: 0, vy: 0, active: 0, clientX: 0, clientY: 0, inside: false };

function showError(message) {
  errorPanel.textContent = message;
  errorPanel.hidden = false;
}

function showMood(result) {
  if (spatial) result = resolveShoalGesture(result, tracker, performance.now());
  source = result.source;
  if (result.source === 'jev' || result.source === 'mock') connectionReason = null;
  else if (result.reason && result.reason !== 'cooldown') connectionReason = result.reason;
  if (mood !== result.choice) {
    mood = result.choice;
    target = MODES[mood];
    document.querySelector('#mode-label').textContent = target.label;
    document.querySelector('#mode-note').textContent = spatial && mood === 'playful' ? '曲線を描くと、虹色の流れが生まれます。' : target.note;
    document.querySelector('#mode-dot').style.background = colors[mood];
    document.querySelector('#mode-dot').style.boxShadow = `0 0 12px ${colors[mood]}88`;
  }
  document.querySelector('#confidence').textContent = result.source === 'jev' ? `${Math.round(result.confidence * 100)}%` : result.source === 'mock' ? 'MOCK' : 'LOCAL';
  connection.dataset.source = source;
  if (result.source === 'jev') connection.textContent = `Jev · ジェスチャー判定 · ${result.latencyMs ?? '—'}ms`;
  else if (result.source === 'mock') connection.textContent = 'モック接続 · ジェスチャー判定';
  else if (client.provider === 'preview') connection.textContent = '公開テスト · ローカル判定（Jevなし）';
  else if (client.provider === 'heuristic' || !client.enabled) connection.textContent = 'ローカル判定 · Jevキー未設定';
  else if (connectionReason === 'upstream_auth') connection.textContent = 'ローカル判定 · Jevキーの認証に失敗';
  else if (connectionReason === 'timeout' || connectionReason === 'upstream_timeout') connection.textContent = 'ローカル判定 · Jev応答の期限を超過';
  else if (connectionReason === 'rate_limited') connection.textContent = 'ローカル判定 · 接続の再開を待機';
  else if (client.provider === 'offline') connection.textContent = 'ローカル判定 · プロキシに未接続';
  else if (['upstream_error', 'upstream_invalid_response', 'network', 'proxy_error', 'invalid_response'].includes(connectionReason)) connection.textContent = 'ローカル判定 · Jevへの接続に失敗';
  else connection.textContent = 'ローカル判定 · 次のJev応答を待機';
}

function contact(event) {
  if (paused || !flow || (pointerId !== null && pointerId !== event.pointerId)) return;
  const now = performance.now();
  const position = flow.pointerFromScreen(event.clientX, event.clientY);
  const dt = Math.max((now - previousPointerTime) / 1000, 1 / 240);
  if (pointer.inside) {
    const vx = (position.x - pointer.x) / dt;
    const vy = (position.y - pointer.y) / dt;
    // Limit speed as a vector so diagonal swipes keep their actual direction.
    const gain = Math.min(1, 8 / Math.max(Math.hypot(vx, vy), 0.001));
    pointer.vx = vx * gain;
    pointer.vy = vy * gain;
  }
  pointer.x = position.x;
  pointer.y = position.y;
  pointer.clientX = event.clientX;
  pointer.clientY = event.clientY;
  pointer.inside = true;
  pointer.active = 1;
  previousPointerTime = now;
  lastContact = now;
  tracker.record(event.clientX, event.clientY, now);
  document.querySelector('#intro').classList.add('has-touched');
}

function release() {
  pointer.inside = false;
  pointerId = null;
  generation += 1;
  remoteAt = -Infinity;
  tracker.reset();
  client.dispose();
}

canvas.addEventListener('pointerdown', (event) => {
  if (pointerId !== null || !event.isPrimary) return;
  tracker.reset();
  generation += 1;
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  contact(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (!event.isPrimary || (event.pointerType !== 'mouse' && pointerId === null)) return;
  contact(event);
});
canvas.addEventListener('pointerup', (event) => {
  if (pointerId !== event.pointerId) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  release();
});
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', () => { if (pointerId !== null) release(); });
canvas.addEventListener('pointerleave', () => { if (pointerId === null) release(); });

function togglePause() {
  paused = !paused;
  release();
  pointer.active = 0;
  document.querySelector('#pause-icon').setAttribute('d', paused ? 'M8 5l11 7-11 7Z' : 'M8 5v14M16 5v14');
  document.querySelector('#pause').setAttribute('aria-label', paused ? '再生' : '一時停止');
  document.querySelector('#pause').setAttribute('title', paused ? '再生（Space）' : '一時停止（Space）');
  lastFrame = performance.now();
}

function reset() {
  if (!flow) return;
  release();
  pointer.active = 0;
  flow.reset();
  target = MODES.tender;
  showMood({ choice: 'tender', confidence: 0.6, source: 'heuristic' });
  if (paused) flow.render(1 / 60, values, pointer);
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else connection.textContent = '全画面表示はこのブラウザーでは利用できません';
  } catch {
    connection.textContent = '全画面表示を開始できませんでした';
  }
}
document.querySelector('#pause').addEventListener('click', togglePause);
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#fullscreen').addEventListener('click', fullscreen);
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLButtonElement || event.repeat) return;
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key.toLowerCase() === 'f') void fullscreen();
});

const debug = new URLSearchParams(location.search).has('debug');
const debugPanel = document.querySelector('#debug');
debugPanel.hidden = !debug;
if (debug) window.__AFTERTOUCH__ = {
  snapshot: () => ({ view: spatial ? 'shoal' : 'flow', mood, source, paused, fps: Math.round(fps), particles: flow?.count, quality: flow?.quality, frames: qualityFrames, simulationTime: flow?.time, pointer: { x: pointer.x, y: pointer.y, vx: pointer.vx, vy: pointer.vy, active: pointer.active, inside: pointer.inside }, values: { turbulence: values.turbulence, decay: values.decay, paletteBlend: values.paletteBlend, attraction: values.attraction }, metrics: tracker.snapshot() }),
  sampleMotion: () => flow?.sampleMotion(),
  audio: () => music?.snapshot() ?? null,
};

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  animationId = requestAnimationFrame(frame);
  if (paused || document.hidden) return;
  fps += ((1 / Math.max(dt, 0.001)) - fps) * 0.03;
  qualityFrames += 1;
  if (qualityFrames > 180 && dt > 0.025) slowFrames += 1;
  else slowFrames = Math.max(0, slowFrames - 0.5);
  if (slowFrames > 100) { flow.reduceQuality(); slowFrames = 0; }
  pointer.vx *= Math.exp(-dt * 5);
  pointer.vy *= Math.exp(-dt * 5);
  if (!pointer.inside) pointer.active *= Math.exp(-dt * 3.5);
  if (pointer.inside) {
    if (now - lastSample >= 30) { tracker.record(pointer.clientX, pointer.clientY, now); lastSample = now; }
    const metrics = tracker.snapshot(now);
    if (now - lastLocal >= 80) {
      if ((spatial && tracker.hasPlayfulCurves(now)) || now - remoteAt > 1900) showMood(classifyGesture(metrics));
      lastLocal = now;
    }
    if (tracker.shouldEvaluate(now)) {
      const metricsForRequest = tracker.getMetrics(now);
      const requestGeneration = generation;
      void client.evaluate(metricsForRequest).then((result) => {
        if (generation !== requestGeneration || paused || document.hidden) return;
        if (result.source === 'jev' || result.source === 'mock') {
          remoteAt = performance.now();
          showMood(result);
        } else if (result.reason !== 'cooldown' && performance.now() - remoteAt > 1900) showMood(result);
      });
    }
  } else if (now - lastContact > 4000 && mood !== 'tender') showMood({ choice: 'tender', confidence: 0.6, source: 'heuristic' });
  for (const property of ['turbulence', 'decay', 'paletteBlend', 'attraction']) values[property] = smoothValue(values[property], target[property], dt);
  try {
    flow.render(dt, values, pointer);
  } catch (error) {
    cancelAnimationFrame(animationId);
    showError(error.message);
  }
  if (debug && qualityFrames % 20 === 0) debugPanel.textContent = `${Math.round(fps)} fps · ${flow.count.toLocaleString()} particles\n${source} / ${mood}\n${flow.quality.toFixed(2)} max DPR\nGPU state + feedback trails`;
}

window.addEventListener('resize', () => {
  flow?.resize();
  tracker.reset();
  generation += 1;
  if (flow && paused) flow.render(1 / 60, values, pointer);
});
document.addEventListener('visibilitychange', () => { release(); lastFrame = performance.now(); });
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  cancelAnimationFrame(animationId);
  client.dispose();
  showError('GPU描画が中断されました。復帰を待っています。');
});
canvas.addEventListener('webglcontextrestored', () => {
  try {
    flow?.dispose();
    flow = new Flow(canvas);
    errorPanel.hidden = true;
    lastFrame = performance.now();
    animationId = requestAnimationFrame(frame);
  } catch (error) { showError(error.message); }
});
window.addEventListener('pagehide', () => { cancelAnimationFrame(animationId); client.dispose(); flow?.dispose(); music?.dispose(); });

try {
  flow = new Flow(canvas);
  showMood({ choice: 'tender', confidence: 0.6, source: 'heuristic' });
  animationId = requestAnimationFrame(frame);
} catch (error) { showError(error.message); }
void client.checkHealth().then(() => showMood({ choice: mood, confidence: 0.6, source: 'heuristic' }));
