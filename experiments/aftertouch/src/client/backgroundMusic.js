// The shipped buffer already overlaps the end and beginning by six seconds.
// A native buffer loop is sample accurate and keeps going without JS timers.
export class BackgroundMusic {
  constructor(url, { onChange = () => {} } = {}) {
    this.url = url;
    this.onChange = onChange;
    this.context = null;
    this.source = null;
    this.buffer = null;
    this.muted = false;
    this.disposed = false;
    this.status = 'loading';
    this.abort = new AbortController();
  }

  async load() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      this.context = new Audio({ sampleRate: 32000 });
      this.gain = this.context.createGain();
      this.gain.gain.value = 0.8;
      this.gain.connect(this.context.destination);
      this.context.onstatechange = () => this.notify();
      // Do not await resume: a blocked autoplay promise may stay pending until
      // the first gesture, while fetch/decode and the artwork must keep moving.
      this.resume();
      const response = await fetch(this.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`BGM HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      if (this.disposed) return;
      this.buffer = await this.context.decodeAudioData(data);
      if (this.disposed) return;
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = true;
      this.source.connect(this.gain);
      this.source.start();
      this.status = 'ready';
      this.resume();
      this.notify();
    } catch (error) {
      if (this.disposed) return;
      this.status = 'error';
      this.notify();
      void this.context?.close().catch(() => {});
      // Audio failure is independent of the visual rendering loop.
    }
  }

  resume() {
    if (!this.context || this.disposed || this.muted || this.status === 'error') return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    void this.context.resume().then(() => this.notify()).catch(() => this.notify());
  }

  toggle() {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.context.currentTime, 0.08);
    if (!this.muted) this.resume();
    this.notify();
  }

  snapshot() {
    return {
      status: this.status, state: this.context?.state ?? 'unavailable', muted: this.muted,
      playing: this.status === 'ready' && this.context?.state === 'running' && !this.muted,
      loop: this.source?.loop ?? false, duration: this.buffer?.duration ?? 0,
    };
  }

  notify() { if (!this.disposed) this.onChange(this.snapshot()); }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.context) this.context.onstatechange = null;
    this.source?.stop();
    void this.context?.close().catch(() => {});
    this.source = null;
    this.buffer = null;
  }
}
