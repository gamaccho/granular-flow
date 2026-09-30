import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyGesture } from '../shared/mood.js';

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const DEFAULT_MODEL = 'jev-latest';
export const MOODS = Object.freeze(['hesitant', 'aggressive', 'tender', 'playful']);
const DEFAULT_STATIC_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
const MAX_UPSTREAM_BYTES = 16_384;
const MAX_RATE_CLIENTS = 4_096;
const METRIC_RULES = Object.freeze({
  speed: [0, 100],
  jitter: [0, Math.PI],
  dwellRatio: [0, 1],
  strokeLength: [0, 60_000],
  curvature: [0, Math.PI],
  duration: [0, 600],
  sampleCount: [2, 1_000],
});

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function validateMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'The request must be a JSON object of gesture metrics.';
  }
  const fields = Object.keys(value);
  if (fields.length !== Object.keys(METRIC_RULES).length || fields.some((key) => !Object.hasOwn(METRIC_RULES, key))) {
    return 'Only the seven documented gesture metric fields are accepted.';
  }
  for (const [field, [minimum, maximum]] of Object.entries(METRIC_RULES)) {
    const number = value[field];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < minimum || number > maximum) {
      return `${field} must be a finite number between ${minimum} and ${maximum}.`;
    }
    if (field === 'sampleCount' && !Number.isInteger(number)) {
      return 'sampleCount must be an integer.';
    }
  }
  return null;
}

export function buildJevRequest(metrics, model = DEFAULT_MODEL) {
  return {
    model,
    state: {
      metrics,
      interpretation: {
        speed: 'Mean pointer speed in CSS pixels per millisecond.',
        jitter: 'Standard deviation of signed wrapped changes in movement direction, in radians from zero to pi.',
        dwellRatio: 'Time-weighted fraction of gesture duration at speed below 0.04 CSS pixels per millisecond, from zero to one.',
        strokeLength: 'Total pointer travel in CSS pixels.',
        curvature: 'Mean absolute wrapped change of direction in radians from zero to pi along the stroke.',
        duration: 'Gesture duration in milliseconds.',
        sampleCount: 'Number of aggregated pointer samples.',
      },
    },
    questions: {
      mood: {
        type: 'choice',
        instructions: 'Classify the observable quality of this pointer gesture for an abstract artwork. Choose exactly one criterion. These labels describe movement, not the user\'s psychological state or intentions. Use all metrics together and return low confidence for ambiguous gestures.',
        criteria: {
          hesitant: 'Slow or interrupted movement with a high stationary fraction or uncertain changes of direction.',
          aggressive: 'Fast, forceful and sustained movement, usually with low stationary time.',
          tender: 'Slow, smooth and deliberate movement with gentle directional change.',
          playful: 'Lively, varied, curving or zigzag movement with frequent directional changes.',
        },
      },
    },
  };
}

async function readUpstreamJson(response) {
  const contentLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BYTES) {
    await response.body?.cancel?.();
    throw new Error('upstream_invalid_response');
  }
  if (!response.body?.getReader) {
    // A real fetch Response always streams; this path allows injectable test clients.
    return response.json();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPSTREAM_BYTES) {
        await reader.cancel();
        throw new Error('upstream_invalid_response');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function normalizeAnswer(data) {
  const answer = data?.answers?.mood;
  if (
    answer?.type !== 'choice' ||
    !MOODS.includes(answer.choice) ||
    typeof answer.confidence !== 'number' ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1
  ) {
    throw new Error('upstream_invalid_response');
  }
  return { choice: answer.choice, confidence: answer.confidence, source: 'jev' };
}

function makeRateLimiter({ now, limit, windowMs }) {
  const clients = new Map();
  let nextSweep = 0;
  return (req, res, next) => {
    const time = now();
    if (time >= nextSweep || clients.size >= MAX_RATE_CLIENTS) {
      for (const [ip, record] of clients) {
        if (record.lastRequestAt + windowMs <= time) clients.delete(ip);
      }
      nextSweep = time + Math.min(windowMs, 10_000);
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let record = clients.get(ip);
    if (!record) {
      if (clients.size >= MAX_RATE_CLIENTS) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1_000)));
        return sendError(res, 429, 'rate_limited', 'Please wait before sending another gesture.');
      }
      record = { timestamps: [], lastRequestAt: time };
      clients.set(ip, record);
    }
    record.timestamps = record.timestamps.filter((timestamp) => timestamp + windowMs > time);
    if (record.timestamps.length >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((record.timestamps[0] + windowMs - time) / 1_000))));
      return sendError(res, 429, 'rate_limited', 'Please wait before sending another gesture.');
    }
    record.timestamps.push(time);
    record.lastRequestAt = time;
    next();
  };
}

function parseOrigins(value) {
  const entries = Array.isArray(value) ? value : String(value).split(',');
  return new Set(entries.map((entry) => entry.trim()).filter(Boolean));
}

export function createApp({
  fetchImpl = globalThis.fetch,
  apiKey = '',
  mock = false,
  timeoutMs = 270,
  allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
  trustProxy = false,
  rateLimit = 30,
  rateWindowMs = 60_000,
  now = Date.now,
  staticDir = DEFAULT_STATIC_DIR,
  model = DEFAULT_MODEL,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 270) throw new Error('timeoutMs must be between 1 and 270.');
  if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 30) throw new Error('rateLimit must be an integer between 1 and 30.');
  if (!Number.isFinite(rateWindowMs) || rateWindowMs < 1) throw new Error('rateWindowMs must be positive.');
  const app = express();
  const origins = parseOrigins(allowedOrigins);
  const configuredKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const hasKey = configuredKey.length > 0 && configuredKey !== 'your_key_here';
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin) {
      res.vary('Origin');
      const sameOrigin = `${req.protocol}://${req.get('host')}`;
      if (origin !== sameOrigin && !origins.has(origin)) {
        return sendError(res, 403, 'origin_not_allowed', 'This origin is not allowed.');
      }
      res.set('Access-Control-Allow-Origin', origin);
    }
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '600');
      return res.sendStatus(204);
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      provider: mock === true ? 'mock' : hasKey ? 'jev' : 'heuristic',
      model,
      timeoutMs,
      rateLimit: { maxRequests: rateLimit, windowMs: rateWindowMs },
    });
  });

  app.post('/api/infer-mood',
    makeRateLimiter({ now, limit: rateLimit, windowMs: rateWindowMs }),
    (req, res, next) => {
      if (!req.is('application/json')) return sendError(res, 415, 'unsupported_media_type', 'Send gesture metrics as application/json.');
      next();
    },
    express.json({ limit: '4kb', strict: true, inflate: false }),
    async (req, res) => {
      const validationError = validateMetrics(req.body);
      if (validationError) return sendError(res, 400, 'invalid_metrics', validationError);
      const start = now();
      const local = classifyGesture(req.body);
      const elapsed = () => Math.max(0, Math.round(now() - start));
      if (mock === true) return res.json({ ...local, source: 'mock', reason: 'mock_enabled', latencyMs: elapsed() });
      if (!hasKey) return res.json({ ...local, source: 'heuristic', reason: 'not_configured', latencyMs: elapsed() });

      const controller = new AbortController();
      let deadline;
      let timedOut = false;
      let disconnected = false;
      let upstreamStatus;
      let rejectDisconnected;
      const disconnectedPromise = new Promise((_, reject) => { rejectDisconnected = reject; });
      const onDisconnect = () => {
        if (res.writableEnded) return;
        disconnected = true;
        controller.abort();
        rejectDisconnected(new Error('client_disconnected'));
      };
      req.once('aborted', onDisconnect);
      res.once('close', onDisconnect);
      const deadlinePromise = new Promise((_, reject) => {
        deadline = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error('upstream_timeout'));
        }, timeoutMs);
      });
      try {
        const upstream = (async () => {
          const response = await fetchImpl(JEV_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${configuredKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildJevRequest(req.body, model)),
            signal: controller.signal,
          });
          if (!response.ok) {
            upstreamStatus = response.status;
            await response.body?.cancel?.();
            throw new Error('upstream_error');
          }
          let data;
          try {
            data = await readUpstreamJson(response);
          } catch {
            throw new Error('upstream_invalid_response');
          }
          return normalizeAnswer(data);
        })();
        const answer = await Promise.race([upstream, deadlinePromise, disconnectedPromise]);
        if (!disconnected && !res.destroyed) res.json({ ...answer, latencyMs: elapsed(), model });
      } catch (error) {
        if (!disconnected && !res.destroyed) {
          const reason = timedOut ? 'upstream_timeout' : error?.message === 'upstream_invalid_response' ? 'upstream_invalid_response' : upstreamStatus === 401 || upstreamStatus === 403 ? 'upstream_auth' : 'upstream_error';
          const networkCode = error?.cause?.code;
          const knownNetworkCodes = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'];
          res.json({ ...local, source: 'heuristic', reason, latencyMs: elapsed(),
            ...(upstreamStatus ? { upstreamStatus } : {}),
            ...(knownNetworkCodes.includes(networkCode) ? { networkCode } : {}),
          });
        }
      } finally {
        clearTimeout(deadline);
        req.off('aborted', onDisconnect);
        res.off('close', onDisconnect);
      }
    },
  );

  app.use('/api', (_req, res) => sendError(res, 404, 'not_found', 'API endpoint not found.'));
  if (staticDir && existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: 'index.html' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') return sendError(res, 413, 'payload_too_large', 'The request body must not exceed 4 KB.');
    if (error?.type === 'entity.parse.failed') return sendError(res, 400, 'invalid_json', 'The request body is not valid JSON.');
    if (error?.type === 'encoding.unsupported' || error?.type === 'charset.unsupported') return sendError(res, 415, 'unsupported_media_type', 'Use UTF-8 JSON without compressed request encoding.');
    return sendError(res, 500, 'internal_error', 'The request could not be processed.');
  });
  return app;
}
