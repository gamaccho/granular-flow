// The shipped buffer already overlaps the end and beginning by six seconds.
// A native buffer loop is sample accurate and keeps going without JS timers.
export class BackgroundMusic {
  constructor(url, { onChange = () => {} } = {}) {
    this.url = url;
    this.onChange = onChange;
    this.context = null;
    this.source = null;
    this.primer = null;
    this.buffer = null;
    this.requested = false;
    this.disposed = false;
    this.status = 'loading';
    this.abort = new AbortController();
  }

  async load() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      // Use the device output rate. Forcing 32 kHz can conflict with iOS
      // audio-route changes when screen recording starts. decodeAudioData
      // resamples the 32 kHz asset to the context rate automatically.
      this.context = new Audio();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0.8;
      this.gain.connect(this.context.destination);
      this.context.onstatechange = () => this.notify();
      const response = await fetch(this.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`BGM HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      if (this.disposed) return;
      this.buffer = await this.context.decodeAudioData(data);
      if (this.disposed) return;
      this.status = 'ready';
      if (this.requested) {
        this.startSource();
        this.stopPrimer();
        this.resume();
      }
      this.notify();
    } catch (error) {
      if (this.disposed) return;
      this.status = 'error';
      this.notify();
      void this.context?.close().catch(() => {});
      // Audio failure is independent of the visual rendering loop.
    }
  }

  startSource() {
    this.source?.stop();
    this.source?.disconnect();
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    this.source.connect(this.gain);
    this.source.start();
  }

  stopPrimer() {
    this.primer?.stop();
    this.primer?.disconnect();
    this.primer = null;
  }

  start() {
    if (this.disposed || this.status === 'error') return;
    this.requested = true;
    this.resume(true);
    this.notify();
  }

  resume(fromGesture = false) {
    if (!this.context || this.disposed || !this.requested || this.status === 'error') return;
    // Call start and resume synchronously inside the gesture, without waiting
    // for decode or a promise. Some mobile WebKit sessions require both.
    if (fromGesture && (!this.source || this.context.state !== 'running')) {
      if (this.buffer) this.startSource();
      else if (!this.primer) {
        this.primer = this.context.createBufferSource();
        this.primer.buffer = this.context.createBuffer(1, 4096, this.context.sampleRate);
        this.primer.loop = true;
        this.primer.connect(this.context.destination);
        this.primer.start();
      }
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    void this.context.resume().then(() => this.notify()).catch(() => this.notify());
  }

  snapshot() {
    return {
      status: this.status, state: this.context?.state ?? 'unavailable', requested: this.requested,
      playing: this.status === 'ready' && this.context?.state === 'running' && !!this.source,
      loop: this.source?.loop ?? false, duration: this.buffer?.duration ?? 0,
    };
  }

  notify() { if (!this.disposed) this.onChange(this.snapshot()); }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.context) this.context.onstatechange = null;
    this.source?.stop();
    this.stopPrimer();
    void this.context?.close().catch(() => {});
    this.source = null;
    this.buffer = null;
  }
}
