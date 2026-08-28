import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FOGWOOD_SEEDED_COMPOSITION,
  planSeededComposition,
} from '../app/fogwood-seeded-composition.ts';

function item(overrides = {}) {
  const semanticId = overrides.semantic_id ?? 'idea:alpha';
  return {
    id: overrides.id ?? `shape:${semanticId.replaceAll(':', '-')}`,
    type: 'geo',
    x: 100,
    y: 120,
    w: 240,
    h: 120,
    rotation: 0,
    parent_id: 'page:main',
    is_locked: false,
    semantic_id: semanticId,
    meta: { semantic_id_source: 'stable' },
    props: { color: 'blue', fill: 'solid' },
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    current_revision: 'rev:seeded-source',
    page_id: 'page:main',
    selection_semantic_ids: ['idea:gamma', 'idea:alpha', 'idea:beta'],
    selection_complete: true,
    selection_total: 3,
    items: [
      item(),
      item({ id: 'shape:beta', semantic_id: 'idea:beta', type: 'note', x: 390, y: 280, w: 220, h: 200, props: { color: 'yellow' } }),
      item({ id: 'shape:gamma', semantic_id: 'idea:gamma', type: 'text', x: 690, y: 160, w: 260, h: 90, props: { color: 'violet' }, meta: { semantic_id_source: 'stable', variant_id: 'variant:prior' } }),
      item({ id: 'shape:obstacle', semantic_id: 'place:obstacle', x: 460, y: 680, w: 520, h: 260, props: { color: 'grey', fill: 'semi' } }),
    ],
    ...overrides,
  };
}

const selectionRequest = {
  type: 'seeded_composition',
  scope: { kind: 'selection' },
  seed: 'mushroom-city',
  wildness: 0.72,
};

test('same seed, algorithm version, and input state reproduce an immutable plan independent of record order', () => {
  const before = structuredClone(context());
  const first = planSeededComposition(context(), selectionRequest);
  const reordered = context({
    items: [...context().items].reverse(),
    selection_semantic_ids: ['idea:beta', 'idea:gamma', 'idea:alpha'],
  });
  const second = planSeededComposition(reordered, selectionRequest);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(second.plan, first.plan);
  assert.deepEqual(context(), before);
  assert.equal(Object.isFrozen(first.plan), true);
  assert.equal(Object.isFrozen(first.plan.normalized_action.lineage), true);
  assert.equal(first.plan.normalized_action.grammar, 'remix');
  assert.equal(first.plan.normalized_action.algorithm_version, 1);
  assert.equal(first.plan.normalized_action.source_revision, 'rev:seeded-source');
  assert.deepEqual(first.plan.normalized_action.target_semantic_ids, ['idea:alpha', 'idea:beta', 'idea:gamma']);
  assert.deepEqual(first.plan.normalized_action.lineage.map((entry) => entry.source_semantic_id), ['idea:alpha', 'idea:beta', 'idea:gamma']);
  assert.equal(first.plan.normalized_action.lineage[2].parent_variant_id, 'variant:prior');
  assert.equal(first.plan.normalized_action.ops.length <= 24, true);
  assert.equal(first.plan.normalized_action.ops.filter((op) => op.op === 'variant').length, 3);
  assert.equal(first.plan.normalized_action.ops.some((op) => op.op === 'resize'), true);
  assert.equal(first.plan.normalized_action.ops.some((op) => op.op === 'update' && typeof op.rotation === 'number'), true);
  assert.equal(first.plan.normalized_action.ops.some((op) => op.op === 'update' && typeof op.color === 'string'), true);
});

test('different seeds change only bounded generative choices while keeping exact sources and authority fixed', () => {
  const first = planSeededComposition(context(), { ...selectionRequest, seed: 'alpha' });
  const second = planSeededComposition(context(), { ...selectionRequest, seed: 'beta' });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notDeepEqual(second.plan.normalized_action.ops, first.plan.normalized_action.ops);
  assert.deepEqual(second.plan.normalized_action.lineage.map((entry) => entry.variant_semantic_id), first.plan.normalized_action.lineage.map((entry) => entry.variant_semantic_id));
  assert.deepEqual(second.plan.normalized_action.target_semantic_ids, first.plan.normalized_action.target_semantic_ids);
  assert.deepEqual(second.plan.normalized_action.lineage.map((entry) => entry.source_semantic_id), first.plan.normalized_action.lineage.map((entry) => entry.source_semantic_id));
  assert.equal(second.plan.normalized_action.source_revision, first.plan.normalized_action.source_revision);
});

test('wildness zero creates visibly offset preserved variants without style, scale, or rotation departure', () => {
  const result = planSeededComposition(context(), {
    type: 'seeded_composition',
    scope: { kind: 'explicit', semantic_ids: ['idea:alpha', 'idea:beta'] },
    seed: 42,
    wildness: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.normalized_action.wildness, 0);
  assert.equal(result.plan.normalized_action.layout.branch_count, 1);
  assert.deepEqual(result.plan.normalized_action.ops.map((op) => op.op), ['variant', 'variant']);
  for (const op of result.plan.normalized_action.ops) {
    assert.equal(op.offset_x === 0 && op.offset_y === 0, false);
    assert.equal(Math.abs(op.offset_x) <= 5_000, true);
    assert.equal(Math.abs(op.offset_y) <= 5_000, true);
  }
});

test('manual source geometry is never overwritten and changing it changes the reproducible variant lineage', () => {
  const original = context();
  const moved = context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, x: entry.x + 37 } : entry) });
  const first = planSeededComposition(original, selectionRequest);
  const second = planSeededComposition(moved, selectionRequest);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(original.items[0], context().items[0]);
  assert.notEqual(second.plan.normalized_action.source_fingerprint, first.plan.normalized_action.source_fingerprint);
  assert.notDeepEqual(second.plan.normalized_action.lineage, first.plan.normalized_action.lineage);
  assert.equal(first.plan.normalized_action.ops.some((op) => op.op === 'delete'), false);
});

test('the source fingerprint covers exact clone content and metadata, not only visible geometry', () => {
  const original = planSeededComposition(context(), selectionRequest);
  const changedText = planSeededComposition(context({
    items: context().items.map((entry) => entry.semantic_id === 'idea:alpha'
      ? { ...entry, props: { ...entry.props, text: 'Changed without a revision update' } }
      : entry),
  }), selectionRequest);
  const changedMeta = planSeededComposition(context({
    items: context().items.map((entry) => entry.semantic_id === 'idea:alpha'
      ? { ...entry, meta: { ...entry.meta, custom_provenance: 'changed' } }
      : entry),
  }), selectionRequest);
  assert.equal(original.ok, true);
  assert.equal(changedText.ok, true);
  assert.equal(changedMeta.ok, true);
  assert.notEqual(changedText.plan.normalized_action.source_fingerprint, original.plan.normalized_action.source_fingerprint);
  assert.notEqual(changedMeta.plan.normalized_action.source_fingerprint, original.plan.normalized_action.source_fingerprint);
});

test('duplicate native ids fail before maps can alias two semantic sources', () => {
  const duplicate = context({
    selection_semantic_ids: ['idea:alpha', 'idea:beta'],
    selection_total: 2,
    items: [
      item({ id: 'shape:shared', semantic_id: 'idea:alpha' }),
      item({ id: 'shape:shared', semantic_id: 'idea:beta', x: 500 }),
    ],
  });
  const result = planSeededComposition(duplicate, selectionRequest);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'DUPLICATE_ITEM_ID');
});

test('source geometry below the native resize floor is refused instead of scaling beyond twenty percent', () => {
  const tiny = context({
    selection_semantic_ids: ['idea:tiny'],
    selection_total: 1,
    items: [item({ id: 'shape:tiny', semantic_id: 'idea:tiny', w: 1, h: 100 })],
  });
  const result = planSeededComposition(tiny, { ...selectionRequest, wildness: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INVALID_INPUT_STATE');
});

test('rotated obstacles and generated variants retain disjoint bounded footprints', () => {
  const rotated = context({
    items: [
      item(),
      item({ id: 'shape:beta', semantic_id: 'idea:beta', x: 390, y: 280 }),
      item({
        id: 'shape:rotated-obstacle',
        semantic_id: 'place:rotated-obstacle',
        x: -500,
        y: -200,
        w: 900,
        h: 140,
        rotation: Math.PI / 4,
        is_locked: true,
      }),
    ],
    selection_semantic_ids: ['idea:alpha', 'idea:beta'],
    selection_total: 2,
  });
  const result = planSeededComposition(rotated, { ...selectionRequest, seed: 'rotated-obstacle', wildness: 1 });
  assert.equal(result.ok, true);

  const aabb = ({ x, y, w, h, rotation = 0 }) => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const points = [[0, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => ({
      x: x + px * cos - py * sin,
      y: y + px * sin + py * cos,
    }));
    return {
      minX: Math.min(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
  };
  const overlaps = (left, right) => left.minX < right.maxX && left.maxX > right.minX && left.minY < right.maxY && left.maxY > right.minY;
  const sources = new Map(rotated.items.map((entry) => [entry.id, entry]));
  const generated = [];
  let current;
  for (const op of result.plan.normalized_action.ops) {
    if (op.op === 'variant') {
      const source = sources.get(op.id);
      current = { x: source.x + op.offset_x, y: source.y + op.offset_y, w: source.w, h: source.h, rotation: 0 };
      generated.push(current);
    } else if (op.op === 'resize') {
      current.w = op.w;
      current.h = op.h;
    } else if (op.op === 'update' && typeof op.rotation === 'number') {
      current.rotation = op.rotation;
    }
  }
  const obstacle = aabb(rotated.items[2]);
  const generatedBounds = generated.map(aabb);
  assert.equal(generatedBounds.every((bounds) => !overlaps(bounds, obstacle)), true);
  assert.equal(generatedBounds.every((bounds, index) => generatedBounds.slice(index + 1).every((other) => !overlaps(bounds, other))), true);
});

test('scope, seed, wildness, type, locks, ancestry, rotation, and footprint fail closed before planning', () => {
  const invalid = [
    planSeededComposition(context(), { ...selectionRequest, seed: '' }),
    planSeededComposition(context(), { ...selectionRequest, seed: 1.5 }),
    planSeededComposition(context(), { ...selectionRequest, seed: 'x'.repeat(97) }),
    planSeededComposition(context(), { ...selectionRequest, wildness: -0.01 }),
    planSeededComposition(context(), { ...selectionRequest, wildness: 1.01 }),
    planSeededComposition(context({ selection_complete: false }), selectionRequest),
    planSeededComposition(context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, is_locked: true } : entry) }), selectionRequest),
    planSeededComposition(context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, parent_id: 'frame:one' } : entry).concat(item({ id: 'frame:one', semantic_id: 'frame:one', type: 'frame', x: 0, y: 0, w: 500, h: 500 })) }), selectionRequest),
    planSeededComposition(context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, rotation: 0.2 } : entry) }), selectionRequest),
    planSeededComposition(context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, type: 'arrow' } : entry) }), selectionRequest),
    planSeededComposition(context({ items: context().items.map((entry) => entry.semantic_id === 'idea:alpha' ? { ...entry, meta: { semantic_id_source: 'legacy-shape-id' } } : entry) }), selectionRequest),
  ];
  for (const result of invalid) assert.equal(result.ok, false);
  assert.equal(invalid[0].errors[0].code, 'INVALID_SEED');
  assert.equal(invalid[3].errors[0].code, 'INVALID_WILDNESS');
  assert.equal(invalid[5].errors[0].code, 'INCOMPLETE_SELECTION');
  assert.equal(invalid[6].errors[0].code, 'LOCKED_TARGET');
  assert.equal(invalid[7].errors[0].code, 'NESTED_TARGET');
  assert.equal(invalid[8].errors[0].code, 'ROTATED_TARGET');
  assert.equal(invalid[9].errors[0].code, 'UNSUPPORTED_TARGET');
  assert.equal(invalid[10].errors[0].code, 'UNSTABLE_TARGET');
});

test('target, context, and open-space budgets remain finite under adversarial input', () => {
  let oversizedScopeTraversed = false;
  const oversizedScope = [];
  oversizedScope.length = 1_000_000;
  Object.defineProperty(oversizedScope, 0, {
    get() {
      oversizedScopeTraversed = true;
      throw new Error('must not traverse an oversized scope');
    },
  });
  const oversizedScopeResult = planSeededComposition(context(), {
    ...selectionRequest,
    scope: { kind: 'explicit', semantic_ids: oversizedScope },
  });
  assert.equal(oversizedScopeResult.ok, false);
  assert.equal(oversizedScopeResult.errors[0].code, 'INVALID_TARGET_COUNT');
  assert.equal(oversizedScopeTraversed, false);

  let oversizedSelectionTraversed = false;
  const oversizedSelection = [];
  oversizedSelection.length = 1_000_000;
  Object.defineProperty(oversizedSelection, 0, {
    get() {
      oversizedSelectionTraversed = true;
      throw new Error('must not traverse an oversized selection');
    },
  });
  const oversizedSelectionResult = planSeededComposition(context({
    selection_semantic_ids: oversizedSelection,
    selection_total: oversizedSelection.length,
  }), selectionRequest);
  assert.equal(oversizedSelectionResult.ok, false);
  assert.equal(oversizedSelectionResult.errors[0].code, 'INVALID_TARGET_COUNT');
  assert.equal(oversizedSelectionTraversed, false);

  const nineTargets = Array.from({ length: 9 }, (_, index) => item({ id: `shape:${index}`, semantic_id: `idea:${index}`, x: index * 80 }));
  const tooManyTargets = planSeededComposition(context({
    items: nineTargets,
    selection_semantic_ids: nineTargets.map((entry) => entry.semantic_id),
    selection_total: nineTargets.length,
  }), selectionRequest);
  assert.equal(tooManyTargets.ok, false);
  assert.equal(tooManyTargets.errors[0].code, 'INVALID_TARGET_COUNT');

  const oversizedItems = Array.from({ length: 5_001 }, (_, index) => item({ id: `shape:many-${index}`, semantic_id: `many:${index}`, x: index % 100, y: index % 100 }));
  const tooManyItems = planSeededComposition(context({ items: oversizedItems }), selectionRequest);
  assert.equal(tooManyItems.ok, false);
  assert.equal(tooManyItems.errors[0].code, 'INVALID_INPUT_STATE');

  const sealedPage = context({
    selection_semantic_ids: ['idea:alpha'],
    selection_total: 1,
    items: [
      item(),
      item({ id: 'shape:far-left', semantic_id: 'obstacle:left', x: -100_000, y: 0, w: 100, h: 100 }),
      item({ id: 'shape:far-right', semantic_id: 'obstacle:right', x: 99_900, y: 0, w: 100, h: 100 }),
      item({ id: 'shape:far-top', semantic_id: 'obstacle:top', x: 0, y: -100_000, w: 100, h: 100 }),
      item({ id: 'shape:far-bottom', semantic_id: 'obstacle:bottom', x: 0, y: 99_900, w: 100, h: 100 }),
    ],
  });
  const unavailable = planSeededComposition(sealedPage, selectionRequest);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.errors[0].code, 'OPEN_SPACE_UNAVAILABLE');
});

test('seed text is inert data and the compiler never delegates randomness to Math.random', async () => {
  for (const seed of ['admin', 'unlock', 'javascript:alert(1)', 'remote-provider', 'fetch']) {
    const result = planSeededComposition(context(), { ...selectionRequest, seed });
    assert.equal(result.ok, true);
    assert.equal(result.plan.normalized_action.seed, seed);
  }
  assert.equal(FOGWOOD_SEEDED_COMPOSITION.prng, 'xorshift32-v1');
  const source = await readFile(new URL('../app/fogwood-seeded-composition.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('Math.random'), false);
});
