import test from 'node:test';
import assert from 'node:assert/strict';
import { IdleVariation } from '../src/render/idleVariation.js';

test('idle variation eases into bounded targets and holds throughout touch', () => {
  const variation = new IdleVariation(() => 0.7);
  for (let i = 0; i < 89; i++) variation.update(1 / 30, false);
  assert.deepEqual(variation.shape, [1, 0, 0, 0]);
  const before = [...variation.shape];
  variation.update(1 / 30, false);
  variation.update(1 / 30, false);
  assert.ok(variation.shape[2] > 0 && variation.shape[2] < 0.01);
  assert.ok(Math.abs(variation.shape[0] - before[0]) < 0.01);
  const held = [...variation.shape, ...variation.light];
  for (let i = 0; i < 300; i++) variation.update(1 / 30, true);
  assert.deepEqual([...variation.shape, ...variation.light], held);
  assert.equal(variation.idleTime, 0);
  variation.reset();
  assert.deepEqual(variation.light, [1, 0, 0, 0]);
});

test('idle scheduling draws fresh targets every four to seven seconds', () => {
  let draws = 0;
  const variation = new IdleVariation(() => { draws++; return 0.5; });
  for (let i = 0; i < 300; i++) variation.update(1 / 30, false);
  assert.equal(draws, 18);
  assert.ok(variation.targetShape[0] >= 0.82 && variation.targetShape[0] <= 1.1);
  assert.ok(variation.targetLight[0] >= 0.85 && variation.targetLight[0] <= 1.25);
  assert.ok(variation.shape.every(Number.isFinite));
});
