import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOGWOOD_RETIRED_ACTION_TYPES,
  validateProposal,
} from '../app/fogwood-runtime.ts';
import {
  FOGWOOD_CANVAS_PROTOCOL,
  planCanvasOps,
} from '../app/fogwood-canvas-ops.ts';

const pageId = 'page:main';
const baseItems = [
  {
    id: 'shape:source',
    type: 'geo',
    kind: 'rectangle',
    x: 80,
    y: 120,
    w: 180,
    h: 100,
    rotation: 0,
    parent_id: pageId,
    is_locked: false,
    semantic_id: 'idea:source',
    meta: { semantic_id_source: 'stable', role: 'idea' },
    props: { color: 'blue', fill: 'semi' },
  },
  {
    id: 'shape:counter',
    type: 'note',
    kind: 'note',
    x: 420,
    y: 180,
    w: 180,
    h: 120,
    rotation: 0,
    parent_id: pageId,
    is_locked: false,
    semantic_id: 'idea:counter',
    meta: { semantic_id_source: 'stable', role: 'counterargument' },
    props: { color: 'yellow', fill: 'solid' },
  },
];

function context(items = baseItems, revision = 'rev:spatial') {
  return { current_revision: revision, page_id: pageId, items };
}

test('the active spatial bridge is Canvas Protocol, and every legacy action fails before stage', () => {
  for (const type of FOGWOOD_RETIRED_ACTION_TYPES) {
    const result = validateProposal({
      base_revision: 'rev:spatial',
      summary: 'Legacy spatial request',
      actions: [{ type }],
    }, context());
    assert.equal(result.ok, false, type);
    assert.equal(result.errors[0].code, 'RETIRED_ACTION', type);
    assert.match(result.errors[0].message, /canvas_ops|seeded_composition|add_materials/);
  }
});

test('Canvas Protocol composes native matter, a bound connector, a preserved variant, and layout deterministically', () => {
  const ops = [
    { op: 'create', semantic_id: 'idea:new', kind: 'cloud', x: 20, y: 40, w: 160, h: 100, text: 'New possibility', color: 'violet', fill: 'semi' },
    { op: 'connect', semantic_id: 'edge:new-source', from_id: 'semantic:idea:new', to_id: 'semantic:idea:source', text: 'echoes' },
    { op: 'variant', id: 'semantic:idea:source', semantic_id: 'idea:source:variant', offset_x: 80, offset_y: 60 },
    { op: 'update', id: 'semantic:idea:source:variant', text: 'A mutation' },
    { op: 'stack', ids: ['semantic:idea:new', 'semantic:idea:counter'], axis: 'horizontal', gap: 48 },
  ];
  const first = planCanvasOps(baseItems, ops, pageId);
  const second = planCanvasOps(baseItems, ops, pageId);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(second, first);
  assert.equal(first.plan.steps.some((step) => step.kind === 'connect'), true);
  assert.equal(first.plan.steps.some((step) => step.kind === 'variant'), true);
  assert.equal(first.plan.steps.some((step) => step.kind === 'arrange'), true);
  assert.deepEqual(first.plan.adds.map((addition) => addition.semantic_id), [
    'idea:new',
    'edge:new-source',
    'idea:source:variant',
  ]);
  assert.equal(first.plan.updates[0].ids[0], 'pending:idea:source:variant');
});

test('Canvas Protocol preserves spatial meaning in a compact staged diff and responds to manual geometry', () => {
  const initial = context();
  const first = validateProposal({
    base_revision: initial.current_revision,
    summary: 'Place an evidence mark',
    actions: [{
      type: 'canvas_ops',
      ops: [{ op: 'update', id: 'semantic:idea:source', x: 220, y: 260 }],
    }],
  }, initial);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(first.diff.updates[0].changes[0].fields, {
    x: { before: 80, after: 220 },
    y: { before: 120, after: 260 },
  });

  const editedItems = structuredClone(baseItems);
  editedItems[0].x = 700;
  const editedRevision = 'rev:manual-edit';
  const stale = validateProposal({ ...first.proposal, base_revision: initial.current_revision }, context(editedItems, editedRevision));
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, 'STALE_STATE');
  const next = validateProposal({
    base_revision: editedRevision,
    summary: 'Respond to the hand-placed source',
    actions: [{
      type: 'canvas_ops',
      ops: [{ op: 'update', id: 'semantic:idea:source', x: 760 }],
    }],
  }, context(editedItems, editedRevision));
  assert.equal(next.ok, true, JSON.stringify(next));
  assert.equal(next.diff.updates[0].changes[0].fields.x.before, 700);
  assert.equal(next.diff.updates[0].changes[0].fields.x.after, 760);
});

test('Canvas Protocol is bounded and refuses unsafe or ambiguous structure before any page mutation', () => {
  const tooManyOps = Array.from({ length: FOGWOOD_CANVAS_PROTOCOL.max_ops + 1 }, () => ({
    op: 'create', semantic_id: 'too-many', kind: 'rectangle', x: 0, y: 0,
  }));
  const oversized = planCanvasOps([], tooManyOps, pageId);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.errors.some((error) => /count|limit/i.test(error.code + error.message)), true);

  const locked = planCanvasOps([{ ...baseItems[0], is_locked: true }], [{
    op: 'update', id: 'semantic:idea:source', x: 400,
  }], pageId);
  assert.equal(locked.ok, false);
  assert.equal(locked.errors.some((error) => error.code === 'LOCKED_TARGET'), true);

  const unsafeConnector = planCanvasOps(baseItems, [{
    op: 'connect', semantic_id: 'edge:missing', from_id: 'semantic:idea:source', to_id: 'semantic:missing',
  }], pageId);
  assert.equal(unsafeConnector.ok, false);
  assert.equal(unsafeConnector.errors.some((error) => /TARGET|REFERENCE|ENDPOINT/i.test(error.code)), true);
});
