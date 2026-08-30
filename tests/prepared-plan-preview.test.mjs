import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreparedCanvasPreview,
  projectPreviewPolygon,
} from '../app/review/prepared-plan-preview.ts';

test('prepared preview projects every visual category from retained lowerings without mutation', () => {
  const canvasPlans = [{
    normalized_action: { type: 'canvas_ops', ops: [] },
    adds: [{ kind: 'frame', label: 'Question field', semantic_id: 'region:q', role: 'semantic-region', x: 10, y: 20, w: 300, h: 180 }],
    updates: [],
    moves: [{ ids: ['shape:a'], changes: [{ id: 'shape:a', before: { x: 1, y: 2, rotation: 0 }, after: { x: 90, y: 120, rotation: 0.2 } }] }],
    removes: ['shape:a'],
    steps: [{ kind: 'connect', op: { semantic_id: 'relation:supports', text: 'supports' }, bounds: { x: 40, y: 60, w: 200, h: 80 } }],
  }];
  const materials = [{ semantic_id: 'material:tower', label: 'Fungal tower', mime_type: 'image/png', content_hash: `sha256:${'a'.repeat(64)}`, x: 400, y: 50, w: 240, h: 180 }];
  const currentItems = [{ id: 'shape:a', type: 'geo', text: 'Old idea', x: 1, y: 2, w: 80, h: 40, rotation: 0 }];
  const before = JSON.stringify({ canvasPlans, materials, currentItems });

  const preview = buildPreparedCanvasPreview({ canvasPlans, materials, currentItems });

  assert.equal(preview.schema, 'fogwood.prepared-canvas-preview.v1');
  assert.deepEqual(preview.additions[0].bounds, { x: 10, y: 20, w: 300, h: 180 });
  assert.deepEqual(preview.moves[0].after, { x: 90, y: 120, w: 80, h: 40, rotation: 0.2 });
  assert.equal(preview.removals[0].label, 'Old idea');
  assert.deepEqual(preview.relationships[0].bounds, { x: 40, y: 60, w: 200, h: 80 });
  assert.equal(preview.regions[0].semantic_id, 'region:q');
  assert.equal(preview.materials[0].content_hash, `sha256:${'a'.repeat(64)}`);
  assert.equal(JSON.stringify({ canvasPlans, materials, currentItems }), before);
});

test('prepared preview remains bounded and data-only when a removed target is absent', () => {
  const preview = buildPreparedCanvasPreview({
    canvasPlans: [{ normalized_action: { type: 'canvas_ops', ops: [] }, adds: [], updates: [], moves: [], steps: [], removes: ['shape:missing'] }],
    materials: [],
    currentItems: [],
  });
  assert.deepEqual(preview.removals[0].bounds, { x: 0, y: 0, w: 1, h: 1 });
  assert.doesNotMatch(JSON.stringify(preview), /data:|javascript:|<script/i);
});

test('prepared preview renders connectors as relationships with exact endpoint centers', () => {
  const canvasPlans = [{
    normalized_action: { type: 'canvas_ops', ops: [] },
    adds: [
      { kind: 'rectangle', semantic_id: 'node:new', label: 'New node', x: 200, y: 100, w: 80, h: 40 },
      { kind: 'connector', semantic_id: 'relation:new', label: 'supports', x: 0, y: 0, w: 1, h: 1 },
    ],
    updates: [], moves: [], removes: [],
    steps: [
      { kind: 'create', pending_id: 'pending:node:new', op: { op: 'create', semantic_id: 'node:new', kind: 'rectangle', x: 200, y: 100, w: 80, h: 40, color: 'violet', fill: 'semi' }, bounds: { x: 200, y: 100, w: 80, h: 40 } },
      { kind: 'connect', pending_id: 'pending:relation:new', op: { op: 'connect', semantic_id: 'relation:new', from_id: 'shape:old', to_id: 'pending:node:new', relationship_kind: 'supports', color: 'green', text: 'supports' }, from: { id: 'shape:old', type: 'geo' }, to: { id: 'pending:node:new', type: 'geo' }, bounds: { x: 0, y: 0, w: 999, h: 999 } },
    ],
  }];
  const preview = buildPreparedCanvasPreview({
    canvasPlans,
    currentItems: [{ id: 'shape:old', type: 'geo', x: 10, y: 20, w: 40, h: 20 }],
    materials: [],
  });

  assert.equal(preview.additions.length, 1);
  assert.equal(preview.additions[0].semantic_id, 'node:new');
  assert.equal(preview.additions[0].color, 'violet');
  assert.equal(preview.additions[0].fill, 'semi');
  assert.deepEqual(preview.relationships[0].from_center, { x: 30, y: 30 });
  assert.deepEqual(preview.relationships[0].to_center, { x: 240, y: 120 });
  assert.deepEqual(preview.relationships[0].bounds, { x: 30, y: 30, w: 210, h: 90 });
  assert.equal(preview.relationships[0].relationship_kind, 'supports');
  assert.equal(preview.relationships[0].color, 'green');
});

test('prepared preview derives draw and variant endpoint centers from prepared steps', () => {
  const canvasPlans = [{
    normalized_action: { type: 'canvas_ops', ops: [] }, adds: [], updates: [], moves: [], removes: [],
    steps: [
      { kind: 'draw', pending_id: 'pending:path', op: { op: 'draw', semantic_id: 'path', points: [{ x: 100, y: 100 }, { x: 140, y: 120 }] }, bounds: { x: 100, y: 100, w: 40, h: 20 } },
      { kind: 'variant', pending_id: 'pending:variant', op: { op: 'variant', id: 'shape:source', semantic_id: 'variant', offset_x: 50, offset_y: 25 }, source: { id: 'shape:source', type: 'geo', semantic_id: 'source', transform_fingerprint: 'x', parent_id: 'page' }, local_position: { x: 250, y: 225 }, bounds: { x: 250, y: 225, w: 60, h: 30 }, lineage: { variant_id: 'variant', lineage_source_id: 'source' } },
      { kind: 'connect', pending_id: 'pending:link', op: { op: 'connect', semantic_id: 'link', from_id: 'pending:path', to_id: 'pending:variant' }, from: { id: 'pending:path', type: 'draw' }, to: { id: 'pending:variant', type: 'geo' }, bounds: { x: 0, y: 0, w: 1, h: 1 } },
    ],
  }];
  const preview = buildPreparedCanvasPreview({ canvasPlans, currentItems: [{ id: 'shape:source', type: 'geo', x: 200, y: 200, w: 60, h: 30 }], materials: [] });
  assert.deepEqual(preview.relationships[0].from_center, { x: 120, y: 110 });
  assert.deepEqual(preview.relationships[0].to_center, { x: 280, y: 240 });
});

test('prepared preview retains exact draw points so a trace is never reduced to a bounding-box card', () => {
  const points = [{ x: 10, y: 20 }, { x: 80, y: 55 }, { x: 150, y: 15 }];
  const preview = buildPreparedCanvasPreview({
    canvasPlans: [{
      normalized_action: { type: 'canvas_ops', ops: [] },
      adds: [{ kind: 'draw', semantic_id: 'trace:one', label: 'Freehand path', x: 10, y: 15, w: 140, h: 40 }],
      updates: [], moves: [], removes: [],
      steps: [{ kind: 'draw', pending_id: 'pending:trace:one', op: { op: 'draw', semantic_id: 'trace:one', points, color: 'violet', size: 'l' }, bounds: { x: 10, y: 15, w: 140, h: 40 } }],
    }],
    currentItems: [],
    materials: [],
  });

  assert.deepEqual(preview.additions[0].points, points);
  assert.equal(preview.additions[0].color, 'violet');
});

test('prepared preview projects a nested rotated resize from frozen page-space corners, never an AABB rotation', () => {
  // These corners are deliberately not a top-left rotation of the AABB: they
  // come from a child whose parent is rotated in page space.
  const beforeCorners = [
    { x: 211.2, y: 104.4 },
    { x: 283.6, y: 143.8 },
    { x: 258.1, y: 190.7 },
    { x: 185.7, y: 151.3 },
  ];
  const afterCorners = [
    { x: 211.2, y: 104.4 },
    { x: 319.8, y: 163.5 },
    { x: 281.6, y: 233.8 },
    { x: 173, y: 174.7 },
  ];
  const canvasPlans = [{
    normalized_action: { type: 'canvas_ops', ops: [] }, adds: [], updates: [], moves: [], removes: [],
    steps: [{
      kind: 'resize',
      op: { op: 'resize', id: 'shape:nested', w: 120, h: 80 },
      target: { id: 'shape:nested' },
      scale: { x: 1.5, y: 2 },
      before: { origin: beforeCorners[0], bounds: { x: 185.7, y: 104.4, w: 97.9, h: 86.3 }, corners: beforeCorners, rotation: 0.5 },
      after: { origin: afterCorners[0], bounds: { x: 173, y: 104.4, w: 146.8, h: 129.4 }, corners: afterCorners, rotation: 0.5 },
    }],
  }];

  const preview = buildPreparedCanvasPreview({ canvasPlans, currentItems: [], materials: [] });

  assert.deepEqual(preview.moves[0].before_corners, beforeCorners);
  assert.deepEqual(preview.moves[0].after_corners, afterCorners);
  const projected = projectPreviewPolygon(afterCorners, (point) => ({ x: point.x * 1.25 - 40, y: point.y * 0.8 + 16 }));
  for (let index = 0; index < afterCorners.length; index += 1) {
    assert.ok(Math.abs(projected[index].x - (afterCorners[index].x * 1.25 - 40)) < 1e-10);
    assert.ok(Math.abs(projected[index].y - (afterCorners[index].y * 0.8 + 16)) < 1e-10);
  }
});

test('prepared preview keeps a rotated preserved variant as its exact frozen polygon', () => {
  const sourceCorners = [
    { x: 510, y: 180 },
    { x: 580, y: 220 },
    { x: 550, y: 272 },
    { x: 480, y: 232 },
  ];
  const variantCorners = sourceCorners.map((point) => ({ x: point.x + 86, y: point.y - 34 }));
  const canvasPlans = [{
    normalized_action: { type: 'canvas_ops', ops: [] }, updates: [], moves: [], removes: [],
    adds: [{ kind: 'variant', semantic_id: 'idea:moonlit-variant', label: 'Variant of city district', x: 566, y: 146, w: 100, h: 92, role: 'variant', rotation: 0.52 }],
    steps: [{
      kind: 'variant',
      pending_id: 'pending:idea:moonlit-variant',
      op: { op: 'variant', id: 'shape:district', semantic_id: 'idea:moonlit-variant', offset_x: 86, offset_y: -34 },
      source: { id: 'shape:district', type: 'geo', semantic_id: 'idea:district', transform_fingerprint: 'nested', parent_id: 'shape:world' },
      local_position: { x: 146, y: 20 },
      bounds: { x: 566, y: 146, w: 100, h: 92 },
      geometry: { origin: variantCorners[0], bounds: { x: 566, y: 146, w: 100, h: 92 }, corners: variantCorners, rotation: 0.52 },
      lineage: { variant_id: 'idea:moonlit-variant', lineage_source_id: 'idea:district' },
    }],
  }];

  const preview = buildPreparedCanvasPreview({ canvasPlans, currentItems: [], materials: [] });

  assert.deepEqual(preview.additions[0].corners, variantCorners);
  assert.deepEqual(preview.additions[0].bounds, { x: 566, y: 146, w: 100, h: 92, rotation: 0.52 });
  assert.notDeepEqual(preview.additions[0].corners, [
    { x: 566, y: 146 }, { x: 666, y: 146 }, { x: 666, y: 238 }, { x: 566, y: 238 },
  ]);
});
