import test from 'node:test';
import assert from 'node:assert/strict';
import { JevClient } from '../src/client/jevClient.js';

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
