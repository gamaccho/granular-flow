import test from 'node:test';
import assert from 'node:assert/strict';
import { JevClient, normalizeApiBase } from '../src/client/jevClient.js';

const metrics = { speed: 0.2, jitter: 0, dwellRatio: 0, strokeLength: 120, curvature: 0, duration: 600, sampleCount: 20 };
test('static Pages preview classifies gestures without any API request', async () => {
  let count = 0;
  const client = new JevClient({ staticPreview: true, fetchImpl: async () => { count += 1; throw new Error('No API on Pages'); } });
  assert.equal(await client.checkHealth(), 'preview');
  assert.equal(client.enabled, false);
  for (const speed of [0.05, 0.2, 2]) {
    const result = await client.evaluate({ ...metrics, speed });
    assert.equal(result.source, 'heuristic');
    assert.equal(result.reason, 'static_preview');
  }
  assert.equal(count, 0);
});
test('typed result is applied; cooldown prevents exceeding 30 requests/min', async () => {
  let now = 0;
  let count = 0;
  const client = new JevClient({ now: () => now, fetchImpl: async () => { count += 1; return Response.json({ choice: 'playful', confidence: 0.9, source: 'jev' }); } });
  assert.equal((await client.evaluate(metrics)).source, 'jev');
  for (now = 800; now < 60000; now += 800) await client.evaluate(metrics);
  assert.ok(count <= 30);
});
test('deadline aborts a stalled transport and returns a local result', async () => {
  let signal;
  const client = new JevClient({ timeoutMs: 20, fetchImpl: async (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  const started = performance.now();
  const result = await client.evaluate(metrics);
  assert.equal(result.reason, 'timeout');
  assert.equal(result.source, 'heuristic');
  assert.ok(signal.aborted);
  assert.ok(performance.now() - started < 200);
});
test('429 respects retry-after, malformed result and failures fallback', async () => {
  let now = 0;
  let count = 0;
  const client = new JevClient({ now: () => now, fetchImpl: async () => { count += 1; return new Response('{}', { status: 429, headers: { 'Retry-After': '10' } }); } });
  assert.equal((await client.evaluate(metrics)).reason, 'rate_limited');
  now = 3000;
  assert.equal((await client.evaluate(metrics)).reason, 'cooldown');
  assert.equal(count, 1);
  const invalid = new JevClient({ fetchImpl: async () => Response.json({ choice: 'unknown', confidence: 2, source: 'jev' }) });
  assert.equal((await invalid.evaluate(metrics)).reason, 'invalid_response');
  const network = new JevClient({ fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await network.evaluate(metrics)).reason, 'network');
});
test('missing key health disables inference requests', async () => {
  let count = 0;
  const client = new JevClient({ fetchImpl: async () => { count += 1; return Response.json({ provider: 'heuristic' }); } });
  await client.checkHealth();
  assert.equal((await client.evaluate(metrics)).reason, 'not_configured');
  assert.equal(count, 1);
});

test('configured Pages client uses the public HTTPS origin for both APIs and sends only metrics', async () => {
  const calls = [];
  const client = new JevClient({
    apiBase: 'https://aftertouch-proxy.example/',
    staticPreview: true,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.endsWith('/health')
        ? { provider: 'jev' }
        : { choice: 'playful', confidence: 0.9, source: 'jev' });
    },
  });
  assert.equal(client.provider, 'checking');
  assert.equal(client.enabled, true);
  assert.equal(client.timeoutMs, 1500);
  assert.equal(await client.checkHealth(), 'jev');
  assert.equal((await client.evaluate(metrics)).source, 'jev');
  assert.deepEqual(calls.map((call) => call.url), [
    'https://aftertouch-proxy.example/api/health',
    'https://aftertouch-proxy.example/api/infer-mood',
  ]);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(calls[1].options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[1].options.body), metrics);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[1].options.credentials, 'omit');
});

test('empty base preserves same-origin endpoints and the 300ms local default', async () => {
  const calls = [];
  const client = new JevClient({ apiBase: '', fetchImpl: async (url) => {
    calls.push(url);
    return Response.json(url.endsWith('/health')
      ? { provider: 'jev' }
      : { choice: 'tender', confidence: 0.8, source: 'jev' });
  } });
  assert.equal(client.apiBase, '');
  assert.equal(client.timeoutMs, 300);
  await client.checkHealth();
  await client.evaluate(metrics);
  assert.deepEqual(calls, ['/api/health', '/api/infer-mood']);
  assert.equal(new JevClient({ fetchImpl: async () => {} }).timeoutMs, 300);
});

test('external deadline allows a response that exceeds the existing local deadline', async () => {
  const signals = [];
  const delayed = async (_url, options) => {
    signals.push(options.signal);
    await new Promise((resolve) => setTimeout(resolve, 380));
    return Response.json({ choice: 'playful', confidence: 0.9, source: 'jev' });
  };
  const local = new JevClient({ fetchImpl: delayed });
  const external = new JevClient({ apiBase: 'https://aftertouch-proxy.example', fetchImpl: delayed });
  const [localResult, externalResult] = await Promise.all([local.evaluate(metrics), external.evaluate(metrics)]);
  assert.equal(localResult.reason, 'timeout');
  assert.equal(localResult.source, 'heuristic');
  assert.equal(externalResult.source, 'jev');
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
});

test('only HTTPS origins are accepted; credentials, paths, queries and fragments are rejected', () => {
  assert.equal(normalizeApiBase('https://aftertouch-proxy.example'), 'https://aftertouch-proxy.example');
  assert.equal(normalizeApiBase(' https://aftertouch-proxy.example/ '), 'https://aftertouch-proxy.example');
  assert.equal(normalizeApiBase(''), '');
  for (const value of [
    'http://aftertouch-proxy.example', 'ftp://aftertouch-proxy.example',
    'https://user:password@aftertouch-proxy.example', 'https://@aftertouch-proxy.example',
    'https://aftertouch-proxy.example/api', 'https://aftertouch-proxy.example/.',
    'https://aftertouch-proxy.example?key=unsafe', 'https://aftertouch-proxy.example?',
    'https://aftertouch-proxy.example#section', 'https://aftertouch-proxy.example#',
    'https://aftertouch-proxy.example\\', 'https://aftertouch-\nproxy.example',
    'not a URL', 123, null, {},
  ]) {
    assert.throws(() => new JevClient({ apiBase: value, staticPreview: true }), /HTTPS origin/);
  }
});
