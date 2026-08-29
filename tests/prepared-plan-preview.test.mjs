import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreparedCanvasPreview } from '../app/review/prepared-plan-preview.ts';

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
