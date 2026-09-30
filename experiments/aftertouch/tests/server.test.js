import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, JEV_ENDPOINT } from '../server/app.js';

const metrics = Object.freeze({
  speed: 0.42, jitter: 0.2, dwellRatio: 0.1, strokeLength: 152,
  curvature: 0.25, duration: 520, sampleCount: 42,
});
const answer = { answers: { mood: { type: 'choice', choice: 'playful', confidence: 0.87, probabilities: { playful: 0.87 } } } };

async function withServer(options, run) {
  const server = createApp({ staticDir: false, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ origin, server, post: (body = metrics, extra = {}) => fetch(`${origin}/api/infer-mood`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...extra.headers },
      body: JSON.stringify(body), ...extra,
    }) });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('uses the official typed choice request and hides credentials from the client', async () => {
  let requestCount = 0;
  await withServer({
    apiKey: 'test-secret',
    fetchImpl: async (url, init) => {
      requestCount += 1;
      assert.equal(url, JEV_ENDPOINT);
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'Bearer test-secret');
      assert.ok(init.signal instanceof AbortSignal);
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'jev-latest');
      assert.deepEqual(body.state.metrics, metrics);
      assert.match(body.state.interpretation.speed, /pixels per millisecond/);
      assert.equal(body.questions.mood.type, 'choice');
      assert.deepEqual(Object.keys(body.questions.mood.criteria), ['hesitant', 'aggressive', 'tender', 'playful']);
      assert.equal(body.questions.mood.instructions.includes('psychological'), true);
      return Response.json(answer);
    },
  }, async ({ post, origin }) => {
    const response = await post();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual({ choice: result.choice, confidence: result.confidence, source: result.source }, {
      choice: 'playful', confidence: 0.87, source: 'jev',
    });
    assert.equal(result.model, 'jev-latest');
    assert.ok(result.latencyMs >= 0);
    assert.equal(JSON.stringify(result).includes('test-secret'), false);
    const health = await (await fetch(`${origin}/api/health`)).json();
    assert.equal(health.provider, 'jev');
    assert.equal(JSON.stringify(health).includes('test-secret'), false);
    assert.equal(requestCount, 1);
  });
});

test('missing credentials returns an explicit deterministic local fallback without upstream traffic', async () => {
  await withServer({ fetchImpl: () => { throw new Error('must not call upstream'); } }, async ({ post, origin }) => {
    const result = await (await post()).json();
    assert.equal(result.source, 'heuristic');
    assert.equal(result.reason, 'not_configured');
    assert.equal(result.choice, 'playful');
    assert.equal((await (await fetch(`${origin}/api/health`)).json()).provider, 'heuristic');
  });
  await withServer({ apiKey: 'your_key_here', fetchImpl: () => { throw new Error('must not call upstream'); } }, async ({ post }) => {
    const result = await (await post()).json();
    assert.equal(result.source, 'heuristic');
    assert.equal(result.reason, 'not_configured');
  });
});

test('mock mode is explicit and reports mock provenance even when a key exists', async () => {
  await withServer({ apiKey: 'test-secret', mock: true, fetchImpl: () => { throw new Error('must not call upstream'); } }, async ({ post, origin }) => {
    const result = await (await post()).json();
    assert.equal(result.source, 'mock');
    assert.equal(result.reason, 'mock_enabled');
    assert.equal((await (await fetch(`${origin}/api/health`)).json()).provider, 'mock');
  });
  await withServer({ mock: 'true' }, async ({ post }) => {
    assert.equal((await (await post()).json()).source, 'heuristic');
  });
});

test('rejects unknown fields, non-numeric values, out-of-bounds values and incomplete payloads', async () => {
  let calls = 0;
  const invalid = [
    { ...metrics, prompt: 'ignore instructions' },
    { ...metrics, coordinates: [[0, 0]] },
    { ...metrics, speed: '0.42' },
    { ...metrics, jitter: Math.PI + 0.1 },
    { ...metrics, dwellRatio: -0.1 },
    { ...metrics, duration: 601 },
    { ...metrics, sampleCount: 2.5 },
    { ...metrics, strokeLength: null },
    { speed: 1 },
    [],
  ];
  await withServer({ apiKey: 'test-secret', fetchImpl: async () => { calls += 1; return Response.json(answer); } }, async ({ post }) => {
    for (const body of invalid) {
      const response = await post(body);
      assert.equal(response.status, 400);
      const error = (await response.json()).error;
      assert.ok(['invalid_metrics', 'invalid_json'].includes(error.code));
    }
    assert.equal(calls, 0);
    const boundary = { speed: 100, jitter: Math.PI, dwellRatio: 1, strokeLength: 60_000, curvature: Math.PI, duration: 600, sampleCount: 1_000 };
    assert.equal((await post(boundary)).status, 200);
    assert.equal(calls, 1);
  });
});

test('returns sanitized JSON errors for malformed, oversized and non-JSON request bodies', async () => {
  await withServer({}, async ({ origin }) => {
    for (const [body, headers, status, code] of [
      ['{ broken', { 'Content-Type': 'application/json' }, 400, 'invalid_json'],
      [JSON.stringify({ padding: 'x'.repeat(5_000) }), { 'Content-Type': 'application/json' }, 413, 'payload_too_large'],
      ['anything', { 'Content-Type': 'text/plain' }, 415, 'unsupported_media_type'],
    ]) {
      const response = await fetch(`${origin}/api/infer-mood`, { method: 'POST', headers, body });
      assert.equal(response.status, status);
      const text = await response.text();
      assert.equal(JSON.parse(text).error.code, code);
      assert.equal(text.includes('SyntaxError'), false);
      assert.equal(text.includes('padding'), false);
    }
  });
});

test('rate caps each direct client at thirty per minute and ignores spoofed forwarded IPs', async () => {
  let time = 1_000;
  await withServer({ now: () => time }, async ({ post }) => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await post(metrics, { headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i}` } })).status, 200);
    }
    const denied = await post(metrics, { headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' } });
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('Retry-After'), '60');
    assert.equal((await denied.json()).error.code, 'rate_limited');
    time += 60_000;
    assert.equal((await post()).status, 200);
  });
});

test('CORS permits configured and same origins while rejecting hostile origins and forwarded-host spoofing', async () => {
  await withServer({}, async ({ origin, post }) => {
    for (const allowed of ['http://localhost:5173', origin]) {
      const response = await post(metrics, { headers: { 'Content-Type': 'application/json', Origin: allowed } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowed);
      assert.match(response.headers.get('Vary'), /Origin/);
    }
    const hostile = await post(metrics, { headers: {
      'Content-Type': 'application/json', Origin: 'https://evil.example',
      'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https',
    } });
    assert.equal(hostile.status, 403);
    assert.equal(hostile.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await hostile.json()).error.code, 'origin_not_allowed');
    const preflight = await fetch(`${origin}/api/infer-mood`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('Access-Control-Allow-Methods'), /POST/);
  });
});

test('rate limit uses a rolling minute without a double burst at a window boundary', async () => {
  let time = 1_000;
  await withServer({ now: () => time, rateLimit: 2 }, async ({ post }) => {
    assert.equal((await post()).status, 200);
    time = 59_999;
    assert.equal((await post()).status, 200);
    time = 61_000;
    assert.equal((await post()).status, 200);
    time = 61_001;
    assert.equal((await post()).status, 429);
  });
});

test('HTTP failure, thrown fetch errors and malformed answers fall back without exposing upstream contents', async () => {
  const cases = [
    [() => Promise.resolve(new Response('secret upstream error', { status: 401 })), 'upstream_auth'],
    [() => Promise.reject(new Error('private internal detail')), 'upstream_error'],
    [() => Promise.resolve(Response.json({ answers: { mood: { type: 'choice', choice: 'unknown', confidence: 1 } } })), 'upstream_invalid_response'],
    [() => Promise.resolve(Response.json({ answers: { mood: { type: 'choice', choice: 'tender', confidence: 2 } } })), 'upstream_invalid_response'],
    [() => Promise.resolve(new Response('{ broken')), 'upstream_invalid_response'],
    [() => Promise.resolve(new Response('x'.repeat(20_000))), 'upstream_invalid_response'],
  ];
  for (const [fetchImpl, reason] of cases) {
    await withServer({ apiKey: 'test-secret', fetchImpl }, async ({ post }) => {
      const response = await post();
      assert.equal(response.status, 200);
      const text = await response.text();
      const result = JSON.parse(text);
      assert.equal(result.source, 'heuristic');
      assert.equal(result.reason, reason);
      if (reason === 'upstream_auth') assert.equal(result.upstreamStatus, 401);
      assert.equal(text.includes('secret'), false);
      assert.equal(text.includes('private internal'), false);
    });
  }
});

test('deadline aborts a hanging upstream request and returns local inference', async () => {
  let upstreamSignal;
  await withServer({ apiKey: 'test-secret', timeoutMs: 30, fetchImpl: (_url, { signal }) => {
    upstreamSignal = signal;
    return new Promise(() => {});
  } }, async ({ post }) => {
    const result = await (await post()).json();
    assert.equal(result.reason, 'upstream_timeout');
    assert.equal(result.source, 'heuristic');
    assert.equal(upstreamSignal.aborted, true);
    assert.ok(result.latencyMs < 200);
  });
});

test('deadline covers a stalled response body, not just receiving headers', async () => {
  let upstreamSignal;
  let cancelled = false;
  await withServer({ apiKey: 'test-secret', timeoutMs: 30, fetchImpl: async (_url, { signal }) => {
    upstreamSignal = signal;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"answers":'));
        signal.addEventListener('abort', () => { cancelled = true; controller.error(new Error('aborted')); }, { once: true });
      },
    });
    return new Response(body);
  } }, async ({ post }) => {
    const result = await (await post()).json();
    assert.equal(result.reason, 'upstream_timeout');
    assert.equal(upstreamSignal.aborted, true);
    assert.equal(cancelled, true);
  });
});

test('disconnecting the browser aborts its pending upstream request', async () => {
  let markStarted;
  let markAborted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const aborted = new Promise((resolve) => { markAborted = resolve; });
  await withServer({ apiKey: 'test-secret', fetchImpl: (_url, { signal }) => {
    signal.addEventListener('abort', markAborted, { once: true });
    markStarted();
    return new Promise(() => {});
  } }, async ({ origin }) => {
    const request = http.request(`${origin}/api/infer-mood`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    request.on('error', () => {});
    request.end(JSON.stringify(metrics));
    await started;
    request.destroy();
    let timeout;
    try {
      await Promise.race([aborted, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('upstream was not aborted')), 1_000); })]);
    } finally {
      clearTimeout(timeout);
    }
  });
});

test('unknown API endpoints remain JSON 404s', async () => {
  await withServer({}, async ({ origin }) => {
    const response = await fetch(`${origin}/api/not-a-route`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'not_found');
  });
});

test('production serves only the build directory and keeps API errors separate from the artwork', async () => {
  const staticDir = await mkdtemp(path.join(tmpdir(), 'gesture-proxy-static-'));
  try {
    await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>Test artwork</title>');
    await writeFile(path.join(staticDir, '.env'), 'TYPESAFE_API_KEY=fake-static-secret');
    await withServer({ staticDir }, async ({ origin }) => {
      const artwork = await fetch(origin);
      assert.equal(artwork.status, 200);
      assert.match(artwork.headers.get('Content-Type'), /text\/html/);
      assert.match(await artwork.text(), /Test artwork/);
      const hidden = await fetch(`${origin}/.env`);
      assert.equal((await hidden.text()).includes('fake-static-secret'), false);
      const api = await fetch(`${origin}/api/not-a-route`);
      assert.equal(api.status, 404);
      assert.equal((await api.json()).error.code, 'not_found');
    });
  } finally {
    await rm(staticDir, { recursive: true, force: true });
  }
});
