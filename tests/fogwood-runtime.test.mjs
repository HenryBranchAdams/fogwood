import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAPABILITY_REGISTRY,
  FOGWOOD_CONTEXT_VERSION,
  FOGWOOD_PARTICIPATION_CONTRACT,
  PROPOSAL_INPUT_SCHEMA,
  PROPOSAL_TOOL_INPUT_SCHEMA,
  RECIPE_REGISTRY,
  buildContextProjection,
  canonicalSerialize,
  computeContextToken,
  computePageRevision,
  createProposalController,
  deterministicHash,
  searchCapabilities,
  validateProposal,
} from '../app/fogwood-runtime.ts';
import { createCompareInstrumentScope } from '../app/fogwood-instrument-adapter.ts';

const emptyContext = { current_revision: 'fogwood-agent-runtime/1-base', items: [] };

const compareShapeIds = {
  'compare:weight:cost': 'shape:weight-cost',
  'compare:weight:impact': 'shape:weight-impact',
  'compare:score-input:alpha-cost': 'shape:alpha-cost',
  'compare:score-input:alpha-impact': 'shape:alpha-impact',
  'compare:score-input:beta-cost': 'shape:beta-cost',
  'compare:score-input:beta-impact': 'shape:beta-impact',
  'compare:score:alpha': 'shape:score-alpha',
  'compare:score:beta': 'shape:score-beta',
  'compare:recommendation': 'shape:recommendation',
  'compare:chart': 'shape:chart',
};

function compareContext() {
  const scope = createCompareInstrumentScope('compare-and-decide:runtime', compareShapeIds);
  return {
    scope,
    context: {
      current_revision: 'rev-compare-runtime',
      items: scope.blocks.map((block) => ({
        id: block.shape_id,
        type: 'surface-block',
        kind: block.kind,
        x: 0,
        y: 0,
        w: 280,
        h: 150,
        parent_id: 'page:main',
        is_locked: false,
        props: {
          kind: block.kind,
          title: {
            'shape:weight-cost': 'Cost weight',
            'shape:weight-impact': 'Impact weight',
            'shape:alpha-cost': 'Alpha cost score',
            'shape:alpha-impact': 'Alpha impact score',
            'shape:beta-cost': 'Beta cost score',
            'shape:beta-impact': 'Beta impact score',
            'shape:score-alpha': 'Alpha weighted score',
            'shape:score-beta': 'Beta weighted score',
            'shape:recommendation': 'Recommendation',
            'shape:chart': 'Weighted scores',
          }[block.shape_id],
          value: block.value,
          data: JSON.parse(block.data),
        },
        meta: { recipe_instance_id: 'compare-and-decide:runtime' },
      })),
    },
  };
}

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

test('bounded context projection hashes ephemeral semantic state separately from content revision', () => {
  const base = {
    page_id: 'page:main',
    selected_ids: ['shape:a', 'shape:b'],
    current_tool_id: 'select',
    current_tool_path: 'select.idle',
    readonly: false,
    focused_group_id: null,
    editing_shape_id: null,
    ontology_version: 1,
    registry_version: '4',
  };
  const projection = buildContextProjection(base);
  assert.equal(projection.schema, FOGWOOD_CONTEXT_VERSION);
  assert.deepEqual(projection.selected_ids, ['shape:a', 'shape:b']);
  assert.equal(computeContextToken(projection), deterministicHash(canonicalSerialize(projection)));
  const token = computeContextToken(projection);
  for (const change of [
    { selected_ids: ['shape:b', 'shape:a'] },
    { current_tool_id: 'draw' },
    { current_tool_path: 'root.draw.drawing' },
    { readonly: true },
    { focused_group_id: 'group:one' },
    { editing_shape_id: 'shape:a' },
  ]) {
    assert.notEqual(computeContextToken(buildContextProjection({ ...base, ...change })), token);
  }
  const withEphemeralExcluded = buildContextProjection({ ...base, camera: { x: 100, y: 200, z: 2 }, viewport: { x: 1, y: 2, w: 3, h: 4 }, hover: 'shape:a', extensions: ['future'] });
  assert.deepEqual(withEphemeralExcluded, projection);
});

test('context selection digest is bounded to 5000 IDs and previews 128 with completeness', () => {
  const ids = Array.from({ length: 5_001 }, (_, index) => `shape:${index}`);
  const projection = buildContextProjection({
    page_id: 'page:main',
    selected_ids: ids,
    readonly: false,
    focused_group_id: null,
    editing_shape_id: null,
    ontology_version: 1,
    registry_version: '4',
  });
  assert.equal(projection.selected_ids.length, 5_000);
  assert.equal(projection.selected_ids_preview.length, 128);
  assert.deepEqual(projection.selection_completeness, { complete: false, truncated: true, total: 5_001, returned: 128, limit: 128 });
  assert.deepEqual(projection.selected_ids_digest_completeness, { complete: false, truncated: true, total: 5_001, returned: 5_000, limit: 5_000 });
});

test('capability search is deterministic, bounded, and paginated', () => {
  assert.equal(CAPABILITY_REGISTRY.some((entry) => entry.id === 'fogwood-inspect'), true);
  const first = searchCapabilities({ page_size: 3 });
  assert.equal(first.results.length, 3);
  assert.equal(first.has_more, true);
  const second = searchCapabilities({ page_size: 3, cursor: first.next_cursor });
  assert.equal(first.results.some((entry) => second.results.some((next) => next.id === entry.id)), false);
  const recipes = searchCapabilities({ kind: 'recipe', query: 'architecture', page_size: 20 });
  assert.deepEqual(recipes.results, []);
  const protocol = searchCapabilities({ kind: 'action', query: 'draw align group reorder', page_size: 20 });
  assert.deepEqual(protocol.results.map((entry) => entry.id), ['canvas_ops']);
  assert.equal(JSON.stringify(first).includes('function'), false);
});

test('the existing capability tool exposes bounded planning and full-surface routing without adding another tool', () => {
  const tool = CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-capabilities');
  const branches = tool.input_schema.oneOf;
  assert.deepEqual(branches.map((branch) => branch.properties.mode.const), ['search', 'available', 'plan', 'route']);
  const available = branches.find((branch) => branch.properties.mode.const === 'available');
  const plan = branches.find((branch) => branch.properties.mode.const === 'plan');
  const route = branches.find((branch) => branch.properties.mode.const === 'route');
  assert.deepEqual(Object.keys(available.properties), ['mode', 'base_revision', 'context_token']);
  assert.deepEqual(available.required, ['mode', 'base_revision', 'context_token']);
  assert.deepEqual(plan.properties.scope.enum, ['new', 'selection', 'page']);
  assert.deepEqual(route.properties.scope.enum, ['new', 'selection', 'page']);
  assert.equal(route.properties.example_ids.maxItems, 24);
  assert.deepEqual(plan.properties.desired_effects.items.enum, [
    'matter.created',
    'matter.variant.created',
    'mark.drawn',
    'matter.edited',
    'matter.deleted',
    'geometry.arranged',
    'connector-arrow.created',
    'structure.grouped',
    'layer.order.changed',
  ]);
  assert.equal(plan.properties.intent.maxLength, 500);
  assert.equal(plan.properties.base_revision.maxLength, 120);
  assert.deepEqual(plan.properties.planned_item_count, {
    type: 'integer',
    minimum: 0,
    maximum: 24,
  });
  assert.deepEqual(plan.properties.context_token, { type: 'string', minLength: 1, maxLength: 64 });
  assert.equal(PROPOSAL_INPUT_SCHEMA.properties.context_token, undefined);
  assert.deepEqual(PROPOSAL_TOOL_INPUT_SCHEMA.properties.context_token, { type: 'string', minLength: 1, maxLength: 64 });
});

test('capability search returns canonical ontology manifests rather than only example names', () => {
  const result = searchCapabilities({ kind: 'capability', query: 'arrange geometry', page_size: 10 });
  assert.deepEqual(result.results.map((entry) => entry.id), ['layout.arrange']);
  assert.equal(result.results[0].manifest.schema, 'fogwood.capability.v1');
  assert.deepEqual(result.results[0].manifest.effects, ['geometry.arranged']);
  assert.deepEqual(result.results[0].manifest.adapter.operations, ['align', 'distribute', 'stack', 'pack']);
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
  assert.deepEqual(result.diff.instrument_changes, []);
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

test('public proposal schema exposes compact Canvas Protocol, seeded remix, and safe local materials', () => {
  const actionItems = PROPOSAL_INPUT_SCHEMA.properties.actions.items.oneOf;
  assert.equal(PROPOSAL_INPUT_SCHEMA.properties.actions.maxItems, 1);
  assert.deepEqual(actionItems.map((schema) => schema.properties.type.const), ['canvas_ops', 'seeded_composition', 'add_materials']);
  assert.deepEqual(CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-propose').input_schema, PROPOSAL_TOOL_INPUT_SCHEMA);
  assert.equal(searchCapabilities({ kind: 'action', page_size: 20 }).results.every((entry) => ['canvas_ops', 'seeded_composition', 'add_materials'].includes(entry.id)), true);
  assert.equal(CAPABILITY_REGISTRY.find((entry) => entry.id === 'primitive.surface-block').input_schema.type, 'string');
  const injectedInstrument = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Inject instrument',
    actions: [{ type: 'add_blocks', blocks: [{ kind: 'slider', instrument: { formulas: { value: 'nope' } } }] }],
  }, emptyContext);
  assert.equal(injectedInstrument.ok, false);
  assert.equal(injectedInstrument.errors.some((error) => error.code === 'UNKNOWN_FIELD'), true);
});

test('seeded composition resolves selection into a reproducible reviewed proposal with explicit lineage', () => {
  const context = {
    current_revision: 'rev:seeded-runtime',
    page_id: 'page:main',
    selection_semantic_ids: ['idea:b', 'idea:a'],
    selection_complete: true,
    selection_total: 2,
    items: [
      { id: 'shape:a', type: 'geo', x: 100, y: 120, w: 240, h: 120, rotation: 0, parent_id: 'page:main', is_locked: false, semantic_id: 'idea:a', meta: { semantic_id_source: 'stable' }, props: { color: 'blue', fill: 'solid' } },
      { id: 'shape:b', type: 'note', x: 410, y: 300, w: 220, h: 200, rotation: 0, parent_id: 'page:main', is_locked: false, semantic_id: 'idea:b', meta: { semantic_id_source: 'stable', variant_id: 'variant:parent' }, props: { color: 'yellow' } },
    ],
  };
  const result = validateProposal({
    base_revision: context.current_revision,
    summary: 'Remix the selected ideas',
    actions: [{ type: 'seeded_composition', scope: { kind: 'selection' }, seed: 'orchard', wildness: 0.6 }],
  }, context);
  assert.equal(result.ok, true);
  const action = result.proposal.actions[0];
  assert.equal(action.type, 'seeded_composition');
  assert.equal(action.grammar, 'remix');
  assert.equal(action.algorithm_version, 1);
  assert.equal(action.source_revision, context.current_revision);
  assert.equal(action.source_scope, 'selection');
  assert.deepEqual(action.target_semantic_ids, ['idea:a', 'idea:b']);
  assert.equal(action.lineage.length, 2);
  assert.equal(action.lineage[1].parent_variant_id, 'variant:parent');
  assert.equal(action.ops.filter((op) => op.op === 'variant').length, 2);
  assert.equal(result.diff.seeded_compositions.length, 1);
  assert.deepEqual(result.diff.seeded_compositions[0].lineage, action.lineage);
  assert.equal(result.diff.counts.adds, 2);

  const reappliedValidation = validateProposal(result.proposal, context);
  assert.equal(reappliedValidation.ok, true);
  assert.deepEqual(reappliedValidation.proposal, result.proposal);

  const tampered = structuredClone(result.proposal);
  tampered.actions[0].lineage[0].variant_semantic_id = 'variant:tampered';
  const refusedTamper = validateProposal(tampered, context);
  assert.equal(refusedTamper.ok, false);
  assert.equal(refusedTamper.errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);

  const tamperedScope = structuredClone(result.proposal);
  tamperedScope.actions[0].source_scope = 'authority-by-seed';
  const refusedScope = validateProposal(tamperedScope, context);
  assert.equal(refusedScope.ok, false);
  assert.equal(refusedScope.errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);

  const changedValidScope = structuredClone(result.proposal);
  changedValidScope.actions[0].source_scope = 'explicit';
  const refusedValidScopeMutation = validateProposal(changedValidScope, context);
  assert.equal(refusedValidScopeMutation.ok, false);
  assert.equal(refusedValidScopeMutation.errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);

  const explicit = validateProposal({
    base_revision: context.current_revision,
    summary: 'Remix the explicit ideas',
    actions: [{ type: 'seeded_composition', scope: { kind: 'explicit', semantic_ids: ['idea:a', 'idea:b'] }, seed: 'orchard', wildness: 0.6 }],
  }, context);
  assert.equal(explicit.ok, true);
  const changedExplicitScope = structuredClone(explicit.proposal);
  changedExplicitScope.actions[0].source_scope = 'selection';
  const refusedExplicitScopeMutation = validateProposal(changedExplicitScope, context);
  assert.equal(refusedExplicitScopeMutation.ok, false);
  assert.equal(refusedExplicitScopeMutation.errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);

  const changedCloneContent = {
    ...context,
    items: context.items.map((item) => item.semantic_id === 'idea:a'
      ? { ...item, props: { ...item.props, text: 'changed without revision' } }
      : item),
  };
  const refusedChangedCloneContent = validateProposal(result.proposal, changedCloneContent);
  assert.equal(refusedChangedCloneContent.ok, false);
  assert.equal(refusedChangedCloneContent.errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);

  const changedContext = { ...context, current_revision: 'rev:changed' };
  const stale = validateProposal(result.proposal, changedContext);
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, 'STALE_STATE');
});

test('seed is discoverable for composition but absent from capability qualification and authority inputs', () => {
  const capabilitySchema = CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-capabilities').input_schema;
  assert.equal(capabilitySchema.oneOf.every((branch) => !Object.hasOwn(branch.properties, 'seed')), true);
  assert.equal(FOGWOOD_PARTICIPATION_CONTRACT.seed_only_after_capability_scope_safety_permissions_and_authority_are_fixed, true);
  assert.equal(FOGWOOD_PARTICIPATION_CONTRACT.seed_never_controls_facts_safety_permissions_semantic_identity_or_human_authority, true);
  assert.deepEqual(searchCapabilities({ kind: 'action', query: 'seed remix', page_size: 20 }).results.map((entry) => entry.id), ['seeded_composition']);
});

test('set_instrument_inputs stages one same-scope scenario with exact deterministic instrument diff', () => {
  const { context } = compareContext();
  const result = validateProposal({
    base_revision: context.current_revision,
    summary: 'Shift the decision weights',
    actions: [{
      type: 'set_instrument_inputs',
      changes: [
        { id: compareShapeIds['compare:weight:cost'], value: 0.8 },
        { id: compareShapeIds['compare:weight:impact'], value: 0.2 },
      ],
    }],
  }, context);
  assert.equal(result.ok, true);
  assert.deepEqual(result.proposal.actions, [{
    type: 'set_instrument_inputs',
    changes: [
      { id: compareShapeIds['compare:weight:cost'], value: 0.8 },
      { id: compareShapeIds['compare:weight:impact'], value: 0.2 },
    ],
  }]);
  assert.equal(result.diff.instrument_changes.length, 1);
  assert.equal(result.diff.instrument_changes[0].recipe_instance_id, 'compare-and-decide:runtime');
  assert.deepEqual(result.diff.instrument_changes[0].controls, [
    { id: 'shape:weight-cost', label: 'Cost weight', before: 0.4, after: 0.8 },
    { id: 'shape:weight-impact', label: 'Impact weight', before: 0.6, after: 0.2 },
  ]);
  assert.deepEqual(result.diff.instrument_changes[0].derived, [
    { id: 'shape:chart', label: 'Weighted scores', before: { kind: 'chart', series: [{ label: 'Alpha', value: 74 }, { label: 'Beta', value: 78 }] }, after: { kind: 'chart', series: [{ label: 'Alpha', value: 88 }, { label: 'Beta', value: 76 }] } },
    { id: 'shape:recommendation', label: 'Recommendation', before: 'Beta', after: 'Alpha' },
    { id: 'shape:score-alpha', label: 'Alpha weighted score', before: 74, after: 88 },
    { id: 'shape:score-beta', label: 'Beta weighted score', before: 78, after: 76 },
  ]);
});

test('set_instrument_inputs rejects invalid, locked, mixed-scope, and no-op targets atomically', () => {
  const { context } = compareContext();
  const valid = (changes, extra = {}) => validateProposal({
    base_revision: context.current_revision,
    summary: 'Scenario',
    actions: [{ type: 'set_instrument_inputs', changes }],
  }, { ...context, ...extra });
  assert.equal(valid([]).ok, false);
  assert.equal(valid([{ id: 'shape:weight-cost', value: 0.8 }, { id: 'shape:weight-cost', value: 0.2 }]).ok, false);
  assert.equal(valid([{ id: 'shape:weight-cost', value: Number.NaN }]).ok, false);
  assert.equal(valid([{ id: 'shape:weight-cost', value: 2 }]).ok, false);
  assert.equal(valid([{ id: 'shape:score-alpha', value: 88 }]).ok, false);
  assert.equal(valid([{ id: 'shape:weight-cost', value: 0.4 }]).ok, false);
  assert.equal(valid([{ id: 'shape:weight-cost', value: 0.8 }], {
    items: context.items.map((item) => item.id === 'shape:weight-cost' ? { ...item, is_locked: true } : item),
  }).ok, false);
  const lockedDerived = valid([
    { id: 'shape:weight-cost', value: 0.8 },
    { id: 'shape:weight-impact', value: 0.2 },
  ], {
    items: context.items.map((item) => item.id === 'shape:score-alpha' ? { ...item, is_locked: true } : item),
  });
  assert.equal(lockedDerived.ok, false);
  assert.equal(lockedDerived.errors.some((error) => error.code === 'LOCKED_PATCH_TARGET'), true);
  assert.equal(valid([{ id: 'shape:weight-cost', value: 0.8 }, { id: 'shape:other-scope', value: 0.2 }]).ok, false);
});

test('proposal validation uses the raw page instrument payload and rejects malformed ranges before stage', () => {
  const { context } = compareContext();
  const instrumentShapes = context.items.map((item) => {
    const data = structuredClone(item.props.data);
    if (item.id === compareShapeIds['compare:weight:cost']) {
      data.min = 'bad';
      data.max = 'bad';
    }
    return {
      id: item.id,
      type: item.type,
      parent_id: item.parent_id,
      is_locked: item.is_locked,
      props: { kind: item.kind, value: item.props.value, data: JSON.stringify(data) },
    };
  });
  const result = validateProposal({
    base_revision: context.current_revision,
    summary: 'Reject malformed raw control data',
    actions: [{ type: 'set_instrument_inputs', changes: [{ id: compareShapeIds['compare:weight:cost'], value: 0.8 }] }],
  }, { ...context, instrument_shapes: instrumentShapes });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'INVALID_DECLARED_RANGE'), true);
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
  const replacement = { ...proposal, summary: 'Do not replace the pending review' };
  const replacementResult = controller.stage(replacement, diff);
  assert.equal(replacementResult.status, 'ERROR');
  assert.match(replacementResult.message, /already awaiting review/i);
  assert.equal(controller.getState().proposal.summary, proposal.summary);
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
