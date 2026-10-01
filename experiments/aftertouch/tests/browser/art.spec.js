import { test, expect } from '@playwright/test';

test('spatial shoal has moving depth, responds to brushing, and recovers after reset and resize', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  test.skip(!process.env.AFTERTOUCH_PREVIEW_URL, 'Requires the built offline Pages preview.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('?view=shoal&debug=1', process.env.AFTERTOUCH_PREVIEW_URL).href);
  await expect(page.locator('.edition span')).toHaveText('02 / SHOAL');
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(5);
  const before = await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion());
  const validDepth = (samples) => {
    expect(samples.every((sample) => Object.values(sample).every(Number.isFinite))).toBe(true);
    expect(Math.max(...samples.map((s) => s.z)) - Math.min(...samples.map((s) => s.z))).toBeGreaterThan(0.6);
  };
  validDepth(before);
  const frame = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames)).toBeGreaterThan(frame + 3);
  const moving = await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion());
  expect(moving.some((s, i) => Math.abs(s.z - before[i].z) > 0.001)).toBe(true);
  const viewport = page.viewportSize();
  const span = Math.min(viewport.width * 0.25, viewport.height * 0.22);
  await page.mouse.move(viewport.width / 2 - span, viewport.height / 2);
  const primed = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames)).toBeGreaterThan(primed);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 + span, viewport.height / 2);
  const brushed = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames)).toBeGreaterThan(brushed);
  const motion = await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion());
  expect(Math.max(...motion.map((s) => Math.hypot(s.vx, s.vy, s.vz)))).toBeGreaterThan(0.4);
  await page.mouse.up();
  await page.locator('#pause').click();
  const stopped = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBe(stopped);
  await page.screenshot({ path: testInfo.outputPath('spatial-shoal.png') });
  await page.locator('#reset').click();
  validDepth(await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion()));
  await page.setViewportSize({ width: 780, height: 600 });
  await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBeGreaterThan(0.1);
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('fiber ribbons gain strong GPU motion in both swipe directions', async ({ page }, testInfo) => {
  test.skip(!process.env.AFTERTOUCH_PREVIEW_URL, 'Requires the built offline Pages preview.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('?debug=1', process.env.AFTERTOUCH_PREVIEW_URL).href);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(5);
  const idle = await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion());
  expect(idle.every((sample) => Object.values(sample).every(Number.isFinite))).toBe(true);
  expect(Math.max(...idle.map((sample) => Math.hypot(sample.vx, sample.vy)))).toBeLessThan(0.6);
  const viewport = page.viewportSize();
  const swipe = async (start, end) => {
    const direction = Math.sign(end - start);
    await page.mouse.move(viewport.width * start, viewport.height * 0.5);
    const primedAt = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames);
    await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames)).toBeGreaterThan(primedAt);
    await page.mouse.down();
    // Readback stalls a software GPU. Complete a fast native stroke first,
    // then inspect its result once instead of slowing every movement sample.
    await page.mouse.move(viewport.width * end, viewport.height * 0.5);
    const movedAt = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames);
    await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().frames)).toBeGreaterThan(movedAt);
    const motion = await page.evaluate(() => window.__AFTERTOUCH__.sampleMotion());
    const peak = Math.max(...motion.map((sample) => sample.vx * direction));
    console.log(`GPU swipe ${direction > 0 ? 'right' : 'left'} peak: ${peak}`);
    console.log(JSON.stringify(await page.evaluate(() => window.__AFTERTOUCH__.snapshot())));
    return peak;
  };
  expect(await swipe(0.18, 0.82)).toBeGreaterThan(0.8);
  await page.mouse.up();
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', '再生');
  await page.screenshot({ path: testInfo.outputPath('fibers-swipe-right.png') });
  await page.locator('#reset').click();
  await page.locator('#pause').click();
  expect(await swipe(0.82, 0.18)).toBeGreaterThan(0.8);
  await page.mouse.up();
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('connected Pages uses the external proxy and displays a returned Jev decision', async ({ page }, testInfo) => {
  test.skip(!process.env.AFTERTOUCH_CONNECTED_URL, 'Requires the connected Pages build.');
  const apiBase = process.env.AFTERTOUCH_EXPECTED_API_BASE;
  const requests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Intercept both APIs: CI checks the real build without using API credits.
  await page.route('**/api/health', async (route) => {
    requests.push(route.request());
    await route.fulfill({ json: { provider: 'jev' } });
  });
  await page.route('**/api/infer-mood', async (route) => {
    requests.push(route.request());
    await route.fulfill({ json: { choice: 'playful', confidence: 0.9, source: 'jev', latencyMs: 95 } });
  });
  await page.goto(new URL('?debug=1', process.env.AFTERTOUCH_CONNECTED_URL).href);
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('.edition span')).toHaveText('01 / JEV');
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(5);
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width * 0.55, viewport.height * 0.55);
  await page.mouse.down();
  await expect(page.locator('#connection')).toContainText('Jev ·');
  await expect(page.locator('#mode-label')).toHaveText('Playful');
  const inference = requests.find((request) => request.method() === 'POST');
  expect(requests[0].url()).toBe(`${apiBase}/api/health`);
  expect(inference.url()).toBe(`${apiBase}/api/infer-mood`);
  expect(Object.keys(inference.postDataJSON()).sort()).toEqual([
    'curvature', 'duration', 'dwellRatio', 'jitter', 'sampleCount', 'speed', 'strokeLength',
  ]);
  await page.mouse.up();
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(viewport.width * 0.5, viewport.height * 0.5);
  await expect(page.locator('#intro')).toHaveClass(/has-touched/);
  await page.screenshot({ path: testInfo.outputPath('pages-connected.png') });
  expect(errors).toEqual([]);
});

test('static Pages preview loads assets under a subdirectory and responds without API requests', async ({ page }, testInfo) => {
  test.skip(!process.env.AFTERTOUCH_PREVIEW_URL, 'Requires the built Pages preview.');
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`); });
  page.on('request', (request) => { if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url()); });
  await page.goto(new URL('?debug=1', process.env.AFTERTOUCH_PREVIEW_URL).href);
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#connection')).toHaveText('公開テスト · ローカル判定（Jevなし）');
  await expect(page.locator('.edition span')).toHaveText('01 / PREVIEW');
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(5);
  const viewport = page.viewportSize();
  // Touch PointerEvents use the same input handlers on the mobile viewport.
  const type = testInfo.project.name === 'mobile' ? 'touch' : 'mouse';
  const fire = async (eventType, x) => page.locator('#art').dispatchEvent(eventType, {
    pointerId: 1, pointerType: type, isPrimary: true, buttons: 1,
    clientX: viewport.width * x, clientY: viewport.height * 0.55,
  });
  // Native down/up obtains pointer capture; moves exercise sustained gestures.
  await page.mouse.move(viewport.width * 0.2, viewport.height * 0.55);
  await page.mouse.down();
  for (let i = 0; i < 8; i += 1) {
    await fire('pointermove', i % 2 ? 0.2 : 0.8);
    await page.waitForTimeout(25);
  }
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().mood)).toBe('aggressive');
  await page.mouse.up();
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(viewport.width * 0.5, viewport.height * 0.5);
  await expect(page.locator('#intro')).toHaveClass(/has-touched/);
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', '再生');
  const stopped = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBe(stopped);
  await page.locator('#reset').click();
  await expect(page.locator('#mode-label')).toHaveText('Tender');
  await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBeGreaterThan(0.1);
  await page.screenshot({ path: testInfo.outputPath('pages-preview.png') });
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('GPU artwork renders, gestures respond, pause freezes, reset and resize recover', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/api/health', (route) => route.fulfill({ json: { provider: 'heuristic' } }));
  await page.goto('/?debug=1');
  await expect(page.locator('#error')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(4);
  await expect(page.locator('#connection')).toContainText('キー未設定');
  await page.waitForTimeout(900);
  await page.screenshot({ path: testInfo.outputPath('artwork.png') });
  const viewport = page.viewportSize();
  const y = viewport.height * 0.48;
  // Real browser PointerEvents with timestamps and continuous frame sampling.
  await page.mouse.move(viewport.width * 0.25, y);
  await page.mouse.down();
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.move(viewport.width * (i % 2 ? 0.2 : 0.8), y);
    await page.waitForTimeout(25);
  }
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().mood)).toBe('aggressive');
  await page.waitForTimeout(800);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().mood)).toBe('hesitant');
  await page.mouse.up();
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', '再生');
  const stopped = await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBe(stopped);
  await page.locator('#reset').click();
  await expect(page.locator('#mode-label')).toHaveText('Tender');
  await page.locator('#pause').click();
  await page.setViewportSize({ width: 780, height: 600 });
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().simulationTime)).toBeGreaterThan(0.1);
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Jev path uses aggregate features, applies remote mode and falls back on a slow response', async ({ page }) => {
  const requests = [];
  let slow = false;
  await page.route('**/api/health', (route) => route.fulfill({ json: { provider: 'jev' } }));
  await page.route('**/api/infer-mood', async (route) => {
    requests.push({ time: performance.now(), metrics: route.request().postDataJSON() });
    if (slow) await new Promise((resolve) => setTimeout(resolve, 550));
    try { await route.fulfill({ json: { choice: 'playful', confidence: 0.9, source: 'jev' } }); } catch { /* timeout abort */ }
  });
  await page.goto('/?debug=1');
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(3);
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width * 0.55, viewport.height * 0.55);
  await page.mouse.down();
  await expect(page.locator('#connection')).toContainText('Jev ·');
  await expect(page.locator('#mode-label')).toHaveText('Playful');
  expect(requests[0].metrics).toEqual(expect.objectContaining({ speed: expect.any(Number), strokeLength: expect.any(Number), jitter: expect.any(Number), curvature: expect.any(Number) }));
  expect(Object.keys(requests[0].metrics)).toHaveLength(7);
  slow = true;
  await page.waitForTimeout(3500);
  await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__.snapshot().source)).toBe('heuristic');
  expect(requests.length).toBeGreaterThan(1);
  for (let i = 1; i < requests.length; i += 1) expect(requests[i].time - requests[i - 1].time).toBeGreaterThanOrEqual(800);
  await page.mouse.up();
  await expect(page.locator('#error')).toBeHidden();
});

test('touch releases the gesture; unsupported WebGL is explained', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') {
    await page.route('**/api/health', (route) => route.fulfill({ json: { provider: 'heuristic' } }));
    await page.goto('/?debug=1');
    await expect.poll(() => page.evaluate(() => window.__AFTERTOUCH__?.snapshot().frames)).toBeGreaterThan(2);
    await page.touchscreen.tap(195, 400);
    await expect(page.locator('#intro')).toHaveClass(/has-touched/);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__AFTERTOUCH__.snapshot().metrics.speed)).toBe(0);
  }
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
  });
  await page.goto('/');
  await expect(page.locator('#error')).toContainText('WebGL 2');
});

test('real Vite proxy and artwork run together without an API key', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One real stack smoke test is sufficient.');
  const response = await page.request.get('/api/health');
  const health = await response.json();
  test.skip(health.provider === 'jev', 'Never spend real API credits in automated browser tests.');
  expect(response.status()).toBe(200);
  const inference = await page.request.post('/api/infer-mood', { data: { speed: 0.2, jitter: 0.05, dwellRatio: 0.1, strokeLength: 120, curvature: 0.08, duration: 600, sampleCount: 20 } });
  expect(inference.status()).toBe(200);
  expect(await inference.json()).toEqual(expect.objectContaining({ source: health.provider, choice: 'tender' }));
  await page.goto('/');
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#connection')).toContainText('キー未設定');
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath('preview.png') });
});
