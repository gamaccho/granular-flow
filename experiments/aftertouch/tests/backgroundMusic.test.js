import test from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundMusic } from '../src/client/backgroundMusic.js';

// Model a mobile session where resume alone cannot unlock audio, but starting
// a buffer synchronously during the first gesture does. No real server needed.
function setup(t, response) {
  let gesture = false;
  let starts = 0;
  let startedInGesture = false;
  class Audio {
    constructor() { this.state = 'suspended'; this.sampleRate = 32000; this.currentTime = 0; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {} }; }
    createBuffer() { return { duration: 0.128 }; }
    createBufferSource() { return { connect() {}, disconnect() {}, stop() {}, start() { starts++; if (gesture) startedInGesture = true; } }; }
    resume() { if (gesture && startedInGesture) this.state = 'running'; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration: 207 }); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  t.mock.method(globalThis, 'fetch', async () => response);
  const old = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Audio } });
  t.after(() => { if (old) Object.defineProperty(globalThis, 'window', old); else delete globalThis.window; });
  return { unlock(music) { gesture = true; music.resume(true); gesture = false; }, starts: () => starts };
}

test('first finger gesture synchronously starts the decoded BGM and resumes audio', async (t) => {
  const mock = setup(t, { ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  const music = new BackgroundMusic('/bgm.mp3');
  await music.load();
  assert.equal(music.snapshot().playing, false);
  mock.unlock(music);
  assert.equal(music.snapshot().playing, true);
  assert.equal(music.snapshot().loop, true);
  assert.equal(mock.starts(), 2); // Initial autoplay attempt and first-gesture start.
  music.dispose();
});

test('first gesture during download primes audio and decoded BGM starts without another touch', async (t) => {
  let downloaded;
  const data = new Promise((resolve) => { downloaded = resolve; });
  const mock = setup(t, { ok: true, arrayBuffer: () => data });
  const music = new BackgroundMusic('/bgm.mp3');
  const loading = music.load();
  mock.unlock(music);
  assert.equal(music.snapshot().state, 'running');
  assert.equal(music.snapshot().status, 'loading');
  assert.ok(music.primer);
  downloaded(new ArrayBuffer(1));
  await loading;
  assert.equal(music.snapshot().playing, true);
  assert.equal(music.primer, null);
  assert.equal(mock.starts(), 2);
  music.dispose();
});
