import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAPABILITY_REGISTRY,
  PROPOSAL_INPUT_SCHEMA,
  RECIPE_REGISTRY,
  computePageRevision,
  createProposalController,
  deterministicHash,
  searchCapabilities,
  validateProposal,
} from '../app/fogwood-runtime.ts';

const emptyContext = { current_revision: 'fogwood-agent-runtime/1-base', items: [] };

test('revision canonicalization is stable and excludes camera and selection by construction', () => {
  const shapes = [
    { id: 'shape:b', type: 'geo', props: { text: 'B', w: 100 }, x: 2 },
    { id: 'shape:a', type: 'geo', props: { w: 100, text: 'A' }, x: 1 },
  ];
  const bindings = [{ id: 'binding:1', toId: 'shape:b', fromId: 'shape:a', props: {} }];
  const first = computePageRevision('page:main', shapes, bindings);
  const second = computePageRevision('page:main', [...shapes].reverse(), [{ ...bindings[0], props: {}, fromId: 'shape:a' }]);
  assert.equal(first, second);
  // These ephemeral values never enter computePageRevision's shape/binding seam.
  assert.equal(computePageRevision('page:main', shapes, bindings), first);
  assert.match(deterministicHash('Fogwood'), /^[0-9a-f]{16}$/);
  assert.notEqual(first, computePageRevision('page:main', [...shapes, { id: 'shape:c', type: 'geo', props: {}, x: 3 }], bindings));
});

test('capability search is deterministic, bounded, and paginated', () => {
  assert.equal(CAPABILITY_REGISTRY.some((entry) => entry.id === 'fogwood-inspect'), true);
  const first = searchCapabilities({ page_size: 3 });
  assert.equal(first.results.length, 3);
  assert.equal(first.has_more, true);
  const second = searchCapabilities({ page_size: 3, cursor: first.next_cursor });
  assert.equal(second.results[0].id, CAPABILITY_REGISTRY[3].id);
  const recipes = searchCapabilities({ kind: 'recipe', query: 'architecture', page_size: 20 });
  assert.deepEqual(recipes.results.map((entry) => entry.id), ['static-architecture-map']);
  assert.equal(JSON.stringify(first).includes('function'), false);
});

test('immutable recipes are versioned and their expected counts match their operations', () => {
  assert.deepEqual(RECIPE_REGISTRY.map((recipe) => recipe.id), [
    'evidence-research-map',
    'meeting-to-plan-wall',
    'static-architecture-map',
    'compare-and-decide',
  ]);
  for (const recipe of RECIPE_REGISTRY) {
    const expandedCount = recipe.operations.reduce((count, operation) => count + (operation.blocks?.length ?? operation.shapes?.length ?? 0), 0);
    assert.equal(recipe.version, 1);
    assert.equal(recipe.status, 'immutable');
    assert.equal(recipe.expected_count, expandedCount);
    assert.equal(recipe.provenance.recipe_id, recipe.id);
    assert.equal(recipe.provenance.recipe_version, 1);
  }
  assert.equal(RECIPE_REGISTRY.find((recipe) => recipe.id === 'evidence-research-map').operations.some((operation) => operation.shapes?.some((shape) => shape.kind === 'arrow')), true);
  assert.equal(RECIPE_REGISTRY.find((recipe) => recipe.id === 'meeting-to-plan-wall').operations.some((operation) => operation.shapes?.some((shape) => shape.kind === 'arrow')), true);
  const compare = RECIPE_REGISTRY.find((recipe) => recipe.id === 'compare-and-decide');
  assert.deepEqual(compare.instrument, { kind: 'compare-and-decide', version: 1 });
  const compareBlocks = compare.operations.flatMap((operation) => operation.blocks ?? []);
  assert.equal(compareBlocks.filter((block) => block.kind === 'slider').length, 6);
  assert.equal(compareBlocks.filter((block) => block.kind === 'metric').length, 3);
  assert.equal(compareBlocks.filter((block) => block.kind === 'chart').length, 1);
  assert.equal(compareBlocks.find((block) => block.title === 'Alpha weighted score').value, '74.00');
  assert.equal(compareBlocks.find((block) => block.title === 'Beta weighted score').value, '78.00');
  assert.equal(compareBlocks.find((block) => block.title === 'Recommendation').value, 'Beta');
  const invalid = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Unknown recipe',
    actions: [{ type: 'insert_recipe', recipe_id: 'missing', version: 1 }],
  }, emptyContext);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.some((error) => error.code === 'UNKNOWN_RECIPE'), true);
});

test('proposal validation normalizes bounded values and returns a structured diff', () => {
  const result = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Add a bounded block',
    rationale: 'Review the normalized dimensions.',
    actions: [{
      type: 'add_blocks',
      blocks: [{ kind: 'heading', x: 999999, w: 99999, title: 'Research' }],
    }],
  }, emptyContext);
  assert.equal(result.ok, true);
  assert.equal(result.diff.adds.blocks, 1);
  assert.equal(result.diff.counts.after, 1);
  assert.equal(result.diff.warnings.length > 0, true);
  assert.equal(result.proposal.actions[0].blocks[0].x, 100000);
  assert.equal(result.proposal.actions[0].blocks[0].w, 1400);
  assert.equal(result.diff.adds.specs[0].label, 'Research');
});

test('proposal validation rejects stale, malformed, conflicting, and no-op requests atomically', () => {
  const stale = validateProposal({
    base_revision: 'old',
    summary: 'Stale',
    actions: [{ type: 'add_blocks', blocks: [{ kind: 'panel' }] }],
  }, emptyContext);
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, 'STALE_STATE');

  const item = { id: 'shape:1', type: 'surface-block', x: 10, y: 20, w: 200, h: 100, rotation: 0, is_locked: false };
  const context = { current_revision: 'rev-1', items: [item] };
  const malformed = validateProposal({
    base_revision: 'rev-1',
    summary: 'Bad fields',
    actions: [{ type: 'add_blocks', blocks: [{ kind: 'panel', execute: 'no' }] }],
  }, context);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors.some((error) => error.code === 'UNKNOWN_FIELD'), true);

  const conflict = validateProposal({
    base_revision: 'rev-1',
    summary: 'Conflict',
    actions: [
      { type: 'place_items', placements: [{ id: 'shape:1', x: 30, y: 20 }] },
      { type: 'remove_items', ids: ['shape:1'] },
    ],
  }, context);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors.some((error) => error.code === 'CONFLICTING_TARGET'), true);

  const noOp = validateProposal({
    base_revision: 'rev-1',
    summary: 'No op',
    actions: [{ type: 'place_items', placements: [{ id: 'shape:1', x: 10, y: 20 }] }],
  }, context);
  assert.equal(noOp.ok, false);
  assert.equal(noOp.errors.some((error) => error.code === 'NO_OP'), true);

  const clearWithAnotherAction = validateProposal({
    base_revision: 'rev-1',
    summary: 'Clear and add',
    actions: [
      { type: 'clear_surface', confirmation: 'clear the surface' },
      { type: 'add_blocks', blocks: [{ kind: 'panel' }] },
    ],
  }, context);
  assert.equal(clearWithAnotherAction.ok, false);
  assert.equal(clearWithAnotherAction.errors.some((error) => error.code === 'CLEAR_MUST_BE_ALONE'), true);

  const clear = validateProposal({
    base_revision: 'rev-1',
    summary: 'Clear page',
    actions: [{ type: 'clear_surface', confirmation: 'clear the surface' }],
  }, context);
  assert.equal(clear.ok, true);
  assert.equal(clear.diff.counts.removes, 1);
  assert.equal(clear.diff.counts.after, 0);
});

test('strict native-shape and placement fields reject malformed numeric and text values', () => {
  const malformedShape = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Bad shape',
    actions: [{ type: 'add_shapes', shapes: [{ kind: 'arrow', x: {}, text: 42 }] }],
  }, emptyContext);
  assert.equal(malformedShape.ok, false);
  assert.equal(malformedShape.errors.some((error) => error.code === 'INVALID_NUMBER'), true);
  assert.equal(malformedShape.errors.some((error) => error.code === 'INVALID_TEXT'), true);

  const malformedPlacement = validateProposal({
    base_revision: 'rev-1',
    summary: 'Bad placement',
    actions: [{ type: 'place_items', placements: [{ id: 'shape:1', x: 30, y: 40, rotation: {} }] }],
  }, { current_revision: 'rev-1', items: [{ id: 'shape:1', type: 'geo', x: 10, y: 20, w: 100, h: 100 }] });
  assert.equal(malformedPlacement.ok, false);
  assert.equal(malformedPlacement.errors.some((error) => error.code === 'INVALID_NUMBER'), true);
});

test('locked ancestors make update, place, remove, and clear proposals atomic', () => {
  const lockedTree = {
    current_revision: 'rev-locked',
    items: [
      { id: 'frame:1', type: 'frame', x: 0, y: 0, w: 300, h: 300, parent_id: 'page:main', is_locked: true },
      { id: 'shape:child', type: 'geo', x: 20, y: 20, w: 80, h: 80, parent_id: 'frame:1', is_locked: false },
    ],
  };
  const update = validateProposal({ base_revision: 'rev-locked', summary: 'Update child', actions: [{ type: 'place_items', placements: [{ id: 'shape:child', x: 30, y: 30 }] }] }, lockedTree);
  assert.equal(update.ok, false);
  assert.equal(update.errors.some((error) => error.code === 'LOCKED_TARGET'), true);
  const remove = validateProposal({ base_revision: 'rev-locked', summary: 'Remove frame', actions: [{ type: 'remove_items', ids: ['frame:1'] }] }, lockedTree);
  assert.equal(remove.ok, false);
  assert.equal(remove.errors.some((error) => error.code === 'LOCKED_TARGET'), true);
  const clear = validateProposal({ base_revision: 'rev-locked', summary: 'Clear page', actions: [{ type: 'clear_surface', confirmation: 'clear the surface' }] }, lockedTree);
  assert.equal(clear.ok, false);
  assert.equal(clear.errors.some((error) => error.code === 'LOCKED_TARGET'), true);

  const unlockedTree = {
    current_revision: 'rev-tree',
    items: [
      { id: 'frame:1', type: 'frame', x: 0, y: 0, w: 300, h: 300, parent_id: 'page:main', is_locked: false },
      { id: 'shape:child', type: 'geo', x: 20, y: 20, w: 80, h: 80, parent_id: 'frame:1', is_locked: false },
      { id: 'shape:grandchild', type: 'note', x: 30, y: 30, w: 70, h: 70, parent_id: 'shape:child', is_locked: false },
    ],
  };
  const removal = validateProposal({ base_revision: 'rev-tree', summary: 'Remove frame', actions: [{ type: 'remove_items', ids: ['frame:1'] }] }, unlockedTree);
  assert.equal(removal.ok, true);
  assert.deepEqual(removal.diff.removes.ids, ['frame:1', 'shape:child', 'shape:grandchild']);
  assert.deepEqual(removal.diff.removes.collateral_ids, ['shape:child', 'shape:grandchild']);
  assert.equal(removal.diff.counts.removes, 3);
  assert.equal(removal.diff.removes.descriptors.length, 3);
});

test('proposal schema exposes all strict action variants and bounded nested values', () => {
  const actionItems = PROPOSAL_INPUT_SCHEMA.properties.actions.items.oneOf;
  assert.equal(actionItems.length, 7);
  assert.deepEqual(actionItems.map((schema) => schema.properties.type.const), ['add_blocks', 'add_shapes', 'update_blocks', 'place_items', 'remove_items', 'clear_surface', 'insert_recipe']);
  const blockSchema = actionItems[0].properties.blocks.items;
  assert.equal(blockSchema.properties.items.items.additionalProperties, false);
  assert.equal(blockSchema.properties.series.items.additionalProperties, false);
  assert.equal(blockSchema.properties.rows.items.items.type, 'string');
  assert.deepEqual(CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-propose').input_schema, PROPOSAL_INPUT_SCHEMA);
  assert.equal(CAPABILITY_REGISTRY.find((entry) => entry.id === 'primitive.surface-block').input_schema.type, 'string');
  const injectedInstrument = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Inject instrument',
    actions: [{ type: 'add_blocks', blocks: [{ kind: 'slider', instrument: { formulas: { value: 'nope' } } }] }],
  }, emptyContext);
  assert.equal(injectedInstrument.ok, false);
  assert.equal(injectedInstrument.errors.some((error) => error.code === 'UNKNOWN_FIELD'), true);
});

test('structured diff includes bounded before/after changes and collateral descriptors', () => {
  const context = {
    current_revision: 'rev-diff',
    items: [{ id: 'block:1', type: 'surface-block', kind: 'panel', x: 10, y: 20, w: 200, h: 100, rotation: 0, parent_id: 'page:main', props: { title: 'Old title', body: 'Old body', data: {} } }],
  };
  const result = validateProposal({
    base_revision: 'rev-diff',
    summary: 'Revise panel',
    actions: [
      { type: 'update_blocks', updates: [{ id: 'block:1', title: 'New title' }] },
      { type: 'place_items', placements: [{ id: 'block:1', x: 30, y: 40, rotation: 0.5 }] },
    ],
  }, context);
  assert.equal(result.ok, false);
  // Target conflicts are intentional; validate each diff family independently.
  const update = validateProposal({ base_revision: 'rev-diff', summary: 'Revise panel', actions: [{ type: 'update_blocks', updates: [{ id: 'block:1', title: 'New title' }] }] }, context);
  assert.equal(update.ok, true);
  assert.equal(update.diff.updates[0].changes[0].fields.title.before, 'Old title');
  assert.equal(update.diff.updates[0].changes[0].fields.title.after, 'New title');
  const move = validateProposal({ base_revision: 'rev-diff', summary: 'Move panel', actions: [{ type: 'place_items', placements: [{ id: 'block:1', x: 30, y: 40, rotation: 0.5 }] }] }, context);
  assert.equal(move.ok, true);
  assert.deepEqual(move.diff.moves[0].changes[0].before, { x: 10, y: 20, rotation: 0 });
  assert.deepEqual(move.diff.moves[0].changes[0].after, { x: 30, y: 40, rotation: 0.5 });
});

test('proposal controller rechecks stage/apply revisions and keeps reject a no-op', () => {
  let revision = 'rev-1';
  let applyCalls = 0;
  const changes = [];
  const controller = createProposalController({
    getRevision: () => revision,
    apply: () => {
      applyCalls += 1;
      return { ok: true };
    },
  }, (state) => changes.push(state));
  const proposal = { base_revision: 'rev-1', summary: 'One transaction', actions: [] };
  const diff = { adds: { blocks: 0, shapes: 0, total: 0 }, updates: [], moves: [], removes: { ids: [], total: 0 }, recipe_expansions: [], counts: { before: 0, after: 0, adds: 0, updates: 0, moves: 0, removes: 0 }, warnings: [] };
  assert.equal(controller.stage(proposal, diff).status, 'STAGED');
  assert.equal(controller.apply().status, 'APPLIED');
  assert.equal(applyCalls, 1);
  assert.equal(changes.at(-1), null);

  assert.equal(controller.stage(proposal, diff).status, 'STAGED');
  revision = 'rev-2';
  assert.equal(controller.apply().status, 'STALE_STATE');
  assert.equal(applyCalls, 1);
  assert.equal(controller.reject().status, 'REJECTED');
  assert.equal(applyCalls, 1);
});
