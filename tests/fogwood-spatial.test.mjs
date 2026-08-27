import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPATIAL_GOLDEN_FIXTURES,
  planRelationships,
  planSpatialMoves,
  resolveSpatialScope,
  isStableSemanticId,
  relationshipSemanticId,
  stableSemanticId,
  validateRelationships,
  validateSpatialAction,
} from '../app/fogwood-spatial.ts';

test('spatial plan is a deterministic public seam', () => {
  const context = {
    page_id: 'page:main',
    items: [
      { id: 'shape:a', semantic_id: 'idea:a', type: 'geo', x: 0, y: 0, w: 80, h: 60, parent_id: 'page:main' },
      { id: 'shape:b', semantic_id: 'idea:b', type: 'geo', x: 0, y: 0, w: 80, h: 60, parent_id: 'page:main' },
    ],
    selection_semantic_ids: ['idea:a', 'idea:b'],
  };
  const action = {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'scatter', scope: { kind: 'selection' }, region: { x: 0, y: 0, w: 500, h: 300 }, seed: 'golden' }],
  };
  const first = planSpatialMoves(context, action);
  const second = planSpatialMoves(context, action);
  assert.deepEqual(first, second);
  assert.equal(first.moves.length, 2);
});

test('orbit uses lexical semantic-ID order regardless of scope order', () => {
  const context = {
    page_id: 'page:main',
    items: [
      { id: 'shape:a', semantic_id: 'idea:a', type: 'geo', x: 0, y: 0, w: 80, h: 60, parent_id: 'page:main' },
      { id: 'shape:b', semantic_id: 'idea:b', type: 'geo', x: 0, y: 0, w: 80, h: 60, parent_id: 'page:main' },
    ],
  };
  const plan = planSpatialMoves(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:b', 'idea:a'] }, center: { x: 500, y: 500 }, radius: 100 }],
  });
  const bySemanticId = new Map(plan.moves.map((move) => [move.semantic_id, move.after]));
  assert.ok((bySemanticId.get('idea:a')?.y ?? Infinity) < (bySemanticId.get('idea:b')?.y ?? -Infinity));
});

test('annotation plans keep the created note footprint inside bounded coordinates', () => {
  const context = {
    page_id: 'page:main',
    items: [{ id: 'shape:a', semantic_id: 'idea:a', type: 'geo', x: 99_950, y: 0, w: 20, h: 40, parent_id: 'page:main' }],
  };
  const result = validateSpatialAction(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'annotate', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, text: 'Near the edge', offset: { x: 0, y: 0 } }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INVALID_BOUNDS');
});

test('annotation safety bound accounts for native note text growth', () => {
  const context = {
    page_id: 'page:main',
    items: [{ id: 'shape:a', semantic_id: 'idea:a', type: 'geo', x: 0, y: 99_800, w: 20, h: 40, parent_id: 'page:main' }],
  };
  const result = validateSpatialAction(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'annotate', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, text: 'x'.repeat(500), offset: { x: 0, y: 0 } }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INVALID_BOUNDS');
});

test('stable semantic IDs remain lexical for arbitrary prefixes', () => {
  assert.equal(isStableSemanticId(stableSemanticId('_/--', 'fixture')), true);
  assert.equal(isStableSemanticId(stableSemanticId('annotation', 'fixture')), true);
});

test('legacy compatibility IDs cannot anchor spatial lineage', () => {
  const context = {
    page_id: 'page:main',
    items: [{ id: 'shape:legacy', semantic_id: 'shape:legacy', type: 'geo', x: 0, y: 0, w: 80, h: 40, parent_id: 'page:main', meta: { semantic_id_source: 'legacy-shape-id' } }],
  };
  const result = validateSpatialAction(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'mutate', scope: { kind: 'explicit', semantic_ids: ['shape:legacy'] }, offset: { x: 100, y: 0 } }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INVALID_SCOPE');
});

test('relationship arrow IDs remain bounded at the relationship ID limit', () => {
  const relationshipId = `edge:${'x'.repeat(175)}`;
  const arrowId = relationshipSemanticId(relationshipId);
  assert.equal(arrowId, relationshipId.length <= 166 ? `relationship:${relationshipId}` : arrowId);
  assert.equal(arrowId.length <= 180, true);
  assert.equal(isStableSemanticId(arrowId), true);
});

function contextFor(count = 4) {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `shape:${index + 1}`,
    semantic_id: `idea:${index + 1}`,
    type: 'geo',
    x: index * 120,
    y: index * 10,
    w: 60,
    h: 40,
    rotation: 0,
    parent_id: 'page:main',
    meta: index < 2 ? { region_id: 'region:alpha' } : {},
  }));
  return {
    page_id: 'page:main',
    items,
    selection_semantic_ids: ['idea:1', 'idea:2'],
    regions: [{ id: 'region:alpha', x: 0, y: 0, w: 220, h: 100 }],
  };
}

test('all eight move kinds produce bounded deterministic plans', () => {
  assert.deepEqual(SPATIAL_GOLDEN_FIXTURES.map((fixture) => fixture.kind), [
    'scatter', 'cluster', 'branch', 'orbit', 'montage', 'trace', 'annotate', 'mutate',
  ]);
  const cases = [
    { kind: 'scatter', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2'] }, region: { x: 0, y: 0, w: 500, h: 300 }, seed: 'golden' },
    { kind: 'cluster', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2'] }, anchor: { x: 300, y: 220 } },
    { kind: 'branch', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2', 'idea:3'] }, anchor: { x: 300, y: 220 }, links: [{ parent_semantic_id: 'idea:1', child_semantic_id: 'idea:2' }, { parent_semantic_id: 'idea:1', child_semantic_id: 'idea:3' }] },
    { kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2'] }, center: { x: 400, y: 400 }, radius: 160 },
    { kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2', 'idea:3'] }, anchor: { x: 300, y: 220 }, columns: 2 },
    { kind: 'trace', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2'] }, path: [{ x: 500, y: 500 }, { x: 800, y: 500 }] },
    { kind: 'annotate', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, text: 'A bounded annotation' },
    { kind: 'mutate', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, offset: { x: 150, y: 80 }, patches: { text: 'Variant' } },
  ];
  for (const move of cases) {
    const action = { type: 'apply_spatial_moves', moves: [move] };
    const first = validateSpatialAction(contextFor(), action);
    const second = validateSpatialAction(contextFor(), action);
    assert.equal(first.ok, true, move.kind);
    assert.deepEqual(first, second, move.kind);
    if (move.kind === 'annotate' || move.kind === 'mutate') assert.equal(first.plan.creates.length, 1);
    else assert.equal(first.plan.moves.length, move.scope.semantic_ids.length);
  }
});

test('selection and region scopes resolve to immutable semantic IDs', () => {
  const context = contextFor();
  assert.deepEqual(resolveSpatialScope(context, { kind: 'selection' }), ['idea:1', 'idea:2']);
  assert.deepEqual(resolveSpatialScope(context, { kind: 'region', region_id: 'region:alpha' }), ['idea:1', 'idea:2']);
  const staged = validateSpatialAction(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'montage', scope: { kind: 'selection' }, anchor: { x: 700, y: 700 }, columns: 2 }],
  });
  assert.equal(staged.ok, true);
  assert.deepEqual(staged.plan.resolved_scopes[0], { move_index: 0, scope: 'selection', semantic_ids: ['idea:1', 'idea:2'] });
});

test('selection overflow and malformed explicit scopes fail closed', () => {
  const context = {
    ...contextFor(129),
    selection_semantic_ids: Array.from({ length: 128 }, (_, index) => `idea:${index + 1}`),
    selection_complete: false,
    selection_total: 129,
  };
  const overflow = validateSpatialAction(context, {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'montage', scope: { kind: 'selection' }, anchor: { x: 500, y: 500 }, columns: 8 }],
  });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.errors[0].code, 'INVALID_TARGET_COUNT');

  const malformed = validateSpatialAction(contextFor(), {
    type: 'apply_spatial_moves',
    moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:1', 42] }, anchor: { x: 500, y: 500 } }],
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors[0].code, 'INVALID_SCOPE');
});

test('sparse move arrays return a structured refusal', () => {
  const moves = new Array(1);
  const result = validateSpatialAction(contextFor(), { type: 'apply_spatial_moves', moves });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INVALID_MOVE_COUNT');
});

test('bounded spatial validation rejects cycles, multiple parents, unknown, oversized, locked, nested, and duplicate targets', () => {
  const context = contextFor(3);
  const invalid = (move) => validateSpatialAction(context, { type: 'apply_spatial_moves', moves: [move] });
  assert.equal(invalid({ kind: 'branch', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2'] }, links: [{ parent_semantic_id: 'idea:1', child_semantic_id: 'idea:2' }, { parent_semantic_id: 'idea:2', child_semantic_id: 'idea:1' }] }).errors[0].code, 'BRANCH_CYCLE');
  assert.equal(invalid({ kind: 'branch', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:2', 'idea:3'] }, links: [{ parent_semantic_id: 'idea:1', child_semantic_id: 'idea:3' }, { parent_semantic_id: 'idea:2', child_semantic_id: 'idea:3' }] }).errors[0].code, 'BRANCH_MULTIPLE_PARENTS');
  assert.equal(invalid({ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:nope'] }, center: { x: 0, y: 0 }, radius: 50 }).errors[0].code, 'UNKNOWN_TARGET');
  assert.equal(invalid({ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, center: { x: 0, y: 0 }, radius: 50 }).ok, true);
  assert.equal(validateSpatialAction(context, { type: 'apply_spatial_moves', moves: Array.from({ length: 9 }, () => ({ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, center: { x: 0, y: 0 }, radius: 50 })) }).errors[0].code, 'INVALID_MOVE_COUNT');
  assert.equal(invalid({ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:1', 'idea:1'] }, anchor: { x: 500, y: 500 } }).errors[0].code, 'DUPLICATE_TARGET');
  const locked = { ...context, items: context.items.map((item) => item.semantic_id === 'idea:1' ? { ...item, is_locked: true } : item) };
  assert.equal(validateSpatialAction(locked, { type: 'apply_spatial_moves', moves: [{ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, center: { x: 500, y: 500 }, radius: 80 }] }).errors[0].code, 'LOCKED_TARGET');
  const nested = { ...context, items: context.items.map((item) => item.semantic_id === 'idea:1' ? { ...item, parent_id: 'group:1' } : item) };
  assert.equal(validateSpatialAction(nested, { type: 'apply_spatial_moves', moves: [{ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:1'] }, center: { x: 500, y: 500 }, radius: 80 }] }).errors[0].code, 'NESTED_TARGET');
});

test('typed relationship planning is bounded, allowlisted, visible-ready metadata', () => {
  const context = contextFor(2);
  const plan = planRelationships(context, [{ id: 'edge:1', kind: 'supports', source_semantic_id: 'idea:1', target_semantic_id: 'idea:2', label: 'evidence' }]);
  assert.deepEqual(plan.relationships, [{ id: 'edge:1', kind: 'supports', source_semantic_id: 'idea:1', target_semantic_id: 'idea:2', label: 'evidence' }]);
  assert.equal(validateRelationships(context, { type: 'add_relationships', relationships: [{ id: 'edge:1', kind: 'supports', source_semantic_id: 'idea:1', target_semantic_id: 'idea:2' }, { id: 'edge:1', kind: 'causes', source_semantic_id: 'idea:1', target_semantic_id: 'idea:2' }] }).errors[0].code, 'DUPLICATE_RELATIONSHIP_ID');
  assert.equal(validateRelationships(context, { type: 'add_relationships', relationships: [{ id: 'edge:self', kind: 'supports', source_semantic_id: 'idea:1', target_semantic_id: 'idea:1' }] }).errors[0].code, 'SELF_RELATIONSHIP');
  assert.equal(validateRelationships(context, { type: 'add_relationships', relationships: [{ id: 'edge:bad', kind: 'unknown', source_semantic_id: 'idea:1', target_semantic_id: 'idea:2' }] }).errors[0].code, 'INVALID_RELATIONSHIP');
});
