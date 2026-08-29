import assert from 'node:assert/strict';
import test from 'node:test';

import { planCanvasOps } from '../app/fogwood-canvas-ops.ts';

import {
  applyTransform,
  createTransformProjection,
  invertTransform,
  multiplyTransforms,
  pagePointToParentLocal,
  TRANSFORM_EPSILON,
} from '../app/tldraw-adapter/transform-projection.ts';

function near(actual, expected, epsilon = TRANSFORM_EPSILON) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('pure transforms round-trip negative points through nested rotation', () => {
  const parent = { a: 0, b: 1, c: -1, d: 0, e: -120, f: 80 };
  const local = { a: Math.cos(0.3), b: Math.sin(0.3), c: -Math.sin(0.3), d: Math.cos(0.3), e: 35, f: -22 };
  const page = multiplyTransforms(parent, local);
  const point = { x: -14.25, y: 91.5 };
  const pagePoint = applyTransform(page, point);
  const roundTrip = applyTransform(invertTransform(page), pagePoint);
  near(roundTrip.x, point.x);
  near(roundTrip.y, point.y);
});

test('transform projection exposes exact corners, page bounds, parent conversion, and stable fingerprint', () => {
  const parent = { a: 0, b: 1, c: -1, d: 0, e: 300, f: -40 };
  const local = { a: 1, b: 0, c: 0, d: 1, e: 50, f: 20 };
  const input = {
    parent_id: 'shape:frame',
    parent_to_page: parent,
    local_to_page: multiplyTransforms(parent, local),
    local_bounds: { x: 0, y: 0, w: 120, h: 60 },
    locked_ancestor: false,
  };
  const first = createTransformProjection(input);
  const second = createTransformProjection(structuredClone(input));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.page_corners, [
    { x: 280, y: 10 },
    { x: 280, y: 130 },
    { x: 220, y: 130 },
    { x: 220, y: 10 },
  ]);
  assert.deepEqual(first.page_bounds, { x: 220, y: 10, w: 60, h: 120 });
  assert.deepEqual(first.local_transform, local);
  const localPoint = pagePointToParentLocal(first, { x: 250, y: 70 });
  near(localPoint.x, 110);
  near(localPoint.y, 50);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.page_corners), true);
});

test('focus is inspectable routing context but does not alter geometric identity', () => {
  const base = {
    parent_id: 'shape:group',
    parent_to_page: { a: 0, b: 1, c: -1, d: 0, e: 300, f: -40 },
    local_to_page: { a: 0, b: 1, c: -1, d: 0, e: 280, f: 10 },
    local_bounds: { x: 0, y: 0, w: 120, h: 60 },
    locked_ancestor: false,
  };
  const unfocused = createTransformProjection(base);
  const focused = createTransformProjection({ ...base, focused_group_id: 'shape:group' });
  assert.equal(focused.focused_group_id, 'shape:group');
  assert.equal(focused.fingerprint, unfocused.fingerprint);
});

test('singular, non-finite, and numerically unbounded transforms fail closed', () => {
  for (const local_to_page of [
    { a: 1, b: 0, c: 1, d: 0, e: 0, f: 0 },
    { a: 1, b: 0, c: 0, d: 1, e: Number.NaN, f: 0 },
    { a: 1, b: 0, c: 0, d: 1, e: 2_000_000, f: 0 },
  ]) {
    assert.throws(() => createTransformProjection({
      parent_id: 'page:main',
      parent_to_page: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      local_to_page,
      local_bounds: { x: 0, y: 0, w: 100, h: 80 },
      locked_ancestor: false,
    }), /transform/i);
  }
});

test('non-rigid shear and scale matrices fail closed before transform planning', () => {
  for (const local_to_page of [
    { a: 1, b: 0, c: 0.25, d: 1, e: 20, f: 30 },
    { a: 2, b: 0, c: 0, d: 2, e: 20, f: 30 },
    { a: -1, b: 0, c: 0, d: 1, e: 20, f: 30 },
  ]) {
    assert.throws(() => createTransformProjection({
      parent_id: 'page:main',
      parent_to_page: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      local_to_page,
      local_bounds: { x: 0, y: 0, w: 100, h: 80 },
      locked_ancestor: false,
    }), /unsupported.*transform/i);
  }
});

test('resize refuses zero-sized source geometry without producing infinite scale', () => {
  const transform = createTransformProjection({
    parent_id: 'page:main',
    parent_to_page: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    local_to_page: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 30 },
    local_bounds: { x: 0, y: 0, w: 0, h: 80 },
    locked_ancestor: false,
  });
  const result = planCanvasOps([{
    id: 'shape:line',
    type: 'draw',
    x: 20,
    y: 30,
    w: 0,
    h: 80,
    parent_id: 'page:main',
    transform,
  }], [{ op: 'resize', id: 'shape:line', w: 100, h: 100 }], 'page:main');

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'UNSUPPORTED_SOURCE_DIMENSION'), true);
});
