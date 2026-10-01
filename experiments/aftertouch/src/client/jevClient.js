import { classifyGesture, isMood } from '../../shared/mood.js';

export function normalizeApiBase(value = '') {
  const message = 'apiBase must be an HTTPS origin without credentials, path, query or fragment.';
  if (typeof value !== 'string') throw new TypeError(message);
  const base = value.trim();
  if (!base) return '';
  let url;
  try { url = new URL(base); } catch { throw new TypeError(message); }
  if (!/^https:\/\/[^/?#\\\s@]+\/?$/i.test(base) || url.protocol !== 'https:'
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError(message);
  }
  return url.origin;
}

export class JevClient {
  constructor({ fetchImpl = globalThis.fetch.bind(globalThis), now = () => performance.now(), timeoutMs, staticPreview = false, apiBase = '' } = {}) {
    this.apiBase = normalizeApiBase(apiBase);
    this.fetch = fetchImpl;
    this.now = now;
    this.timeoutMs = timeoutMs ?? (this.apiBase ? 1500 : 300);
    this.lastRequest = -Infinity;
    this.blockedUntil = 0;
    this.requests = [];
    this.controller = null;
    const preview = staticPreview && !this.apiBase;
    this.enabled = !preview;
    this.provider = preview ? 'preview' : 'checking';
  }

  async checkHealth() {
    if (this.provider === 'preview') return this.provider;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await this.fetch(`${this.apiBase}/api/health`, { signal: controller.signal, credentials: 'omit' });
      const data = await response.json();
      if (!response.ok || !['jev', 'mock', 'heuristic'].includes(data.provider)) throw new Error('health');
      this.provider = data.provider;
      this.enabled = data.provider !== 'heuristic';
    } catch {
      this.provider = 'offline';
    } finally {
      clearTimeout(timeout);
    }
    return this.provider;
  }

  async evaluate(metrics) {
    const fallback = (reason) => ({ ...classifyGesture(metrics), reason });
    const started = this.now();
    if (!this.enabled) return fallback(this.provider === 'preview' ? 'static_preview' : 'not_configured');
    // 800ms is the hard debounce. 2100ms sustains the proxy's 30/min budget.
    this.requests = this.requests.filter((time) => started - time < 60000);
    if (this.controller || started - this.lastRequest < 2100 || started < this.blockedUntil || this.requests.length >= 30) {
      return fallback('cooldown');
    }
    this.lastRequest = started;
    this.requests.push(started);
    const controller = new AbortController();
    this.controller = controller;
    let timeout;
    try {
      // Race protects the deadline even with a transport that ignores abort.
      const request = (async () => {
        const response = await this.fetch(`${this.apiBase}/api/infer-mood`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metrics),
          signal: controller.signal,
          credentials: 'omit',
        });
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After'));
          this.blockedUntil = this.now() + (Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, retryAfter) * 1000 : 60000);
          return fallback('rate_limited');
        }
        if (!response.ok) return fallback('proxy_error');
        const result = await response.json();
        if (!isMood(result) || !['jev', 'heuristic', 'mock'].includes(result.source)) return fallback('invalid_response');
        if (result.reason === 'not_configured') this.enabled = false;
        return { ...result, latencyMs: Math.round(this.now() - started) };
      })();
      return await Promise.race([
        request,
        new Promise((resolve) => { timeout = setTimeout(() => { controller.abort(); resolve(fallback('timeout')); }, this.timeoutMs); }),
      ]);
    } catch {
      return fallback(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = null;
    }
  }

  dispose() {
    this.controller?.abort();
  }
}
