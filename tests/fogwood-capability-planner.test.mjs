import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOGWOOD_CAPABILITY_EFFECTS,
  FOGWOOD_CAPABILITY_ONTOLOGY,
  listCapabilityAvailability,
  planCapabilities,
} from '../app/fogwood-capability-planner.ts';

test('compound intent becomes one deterministic explainable capability plan', () => {
  const request = {
    intent: 'Create two labeled ideas, align them, draw a labeled arrow, and bring idea A to front.',
    base_revision: 'revision:one',
    context_token: 'context:one',
    scope: 'new',
    desired_effects: [
    'matter.created',
    'geometry.arranged',
      'connector-arrow.created',
      'layer.order.changed',
    ],
    planned_item_count: 2,
    max_steps: 6,
  };
  const facts = {
    current_revision: 'revision:one',
    current_context_token: 'context:one',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  };
  const requestBefore = structuredClone(request);
  const factsBefore = structuredClone(facts);

  const first = planCapabilities(request, facts);
  const second = planCapabilities(request, facts);

  assert.equal(first.status, 'ready');
  assert.equal(first.ontology_version, 2);
  assert.deepEqual(
    first.steps.map((step) => step.capability_id),
    [
      'matter.native.create',
      'layout.arrange',
      'connector-arrow.create',
      'layer.reorder',
    ],
  );
  assert.deepEqual(first.supporting_example_ids, [
    'tldraw-example.editor-api.align-and-distribute-shapes',
    'tldraw-example.editor-api.z-order',
  ]);
  assert.deepEqual(first.steps[1], {
    capability_id: 'layout.arrange',
    title: 'Arrange native matter',
    effects: ['geometry.arranged'],
    preconditions: {
      minimum_targets: 2,
      planned_matter_satisfies_target_minimum: true,
    },
    adapter_id: 'canvas-ops.v1',
    action_type: 'canvas_ops',
    operations: ['align', 'distribute', 'stack', 'pack'],
    qualification: 'adapter-fixture-tested',
    supporting_example_ids: ['tldraw-example.editor-api.align-and-distribute-shapes'],
    reason: 'Selected for requested effect geometry.arranged.',
    execution_policy: {
      authority: 'page-apply',
      locality: 'device-local',
      network: 'none',
      arbitrary_code: false,
      purity: 'mutation',
      determinism: 'deterministic',
      idempotency: 'revision-keyed',
      speculation: 'never',
    },
  });
  assert.equal(first.next_call.tool, 'fogwood-propose');
  assert.equal(first.next_call.action_type, 'canvas_ops');
  assert.equal(first.steps.every((step) => step.execution_policy.speculation === 'never'), true);
  assert.equal(FOGWOOD_CAPABILITY_ONTOLOGY.every((capability) => capability.kind === 'Capability'), true);
  assert.deepEqual(second, first);
  assert.deepEqual(request, requestBefore);
  assert.deepEqual(facts, factsBefore);
});

test('real request trace selects one exact bound-connector capability', () => {
  const result = planCapabilities({
    intent: 'Connect these selected ideas.',
    base_revision: 'revision:connect',
    context_token: 'context:connect',
    scope: 'selection',
  }, {
    current_revision: 'revision:connect',
    current_context_token: 'context:connect',
    page_item_count: 2,
    selection_count: 2,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.steps.map((step) => step.capability_id), ['connector-arrow.create']);
  assert.deepEqual(result.steps[0].operations, ['connect']);
  assert.deepEqual(result.supporting_example_ids, []);
  assert.match(result.steps[0].title, /bound/i);
});

test('real request trace gives preserved variants precedence over generic creation', () => {
  const result = planCapabilities({
    intent: 'Make a preserved variant of this selected idea.',
    base_revision: 'revision:variant',
    context_token: 'context:variant',
    scope: 'selection',
  }, {
    current_revision: 'revision:variant',
    current_context_token: 'context:variant',
    page_item_count: 1,
    selection_count: 1,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.steps.map((step) => step.capability_id), ['matter.variant.create']);
  assert.deepEqual(result.steps[0].effects, ['matter.variant.created']);
  assert.deepEqual(result.steps[0].operations, ['variant']);
  assert.deepEqual(result.supporting_example_ids, []);
});

test('contextual target maxima keep connector and variant availability exact', () => {
  const twoSelected = listCapabilityAvailability({
    page_item_count: 3,
    selection_count: 2,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });
  const connector = twoSelected.find((entry) => entry.id === 'connector-arrow.create');
  const variant = twoSelected.find((entry) => entry.id === 'matter.variant.create');
  assert.equal(connector.availability, 'available');
  assert.equal(connector.limits.max_targets, 2);
  assert.equal(variant.availability, 'blocked');
  assert.equal(variant.reasons.some((reason) => reason.code === 'SELECTION_LIMIT'), true);

  const oneSelected = listCapabilityAvailability({
    page_item_count: 3,
    selection_count: 1,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });
  assert.equal(oneSelected.find((entry) => entry.id === 'connector-arrow.create').availability, 'blocked');
  assert.equal(oneSelected.find((entry) => entry.id === 'matter.variant.create').availability, 'available');
});

test('sparse desired effects are refused instead of silently changing planner meaning', () => {
  const desiredEffects = new Array(1);
  const result = planCapabilities({
    intent: 'Create something.',
    base_revision: 'revision:sparse',
    context_token: 'context:sparse',
    scope: 'new',
    desired_effects: desiredEffects,
  }, {
    current_revision: 'revision:sparse',
    current_context_token: 'context:sparse',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.deepEqual(result.errors.map((error) => error.code), ['INVALID_DESIRED_EFFECT']);
});

test('capability manifests are deeply immutable data rather than mutable runtime configuration', () => {
  assert.throws(
    () => FOGWOOD_CAPABILITY_ONTOLOGY[0].intent.keywords.push('mutated'),
    TypeError,
  );
  assert.throws(
    () => FOGWOOD_CAPABILITY_ONTOLOGY[0].effects.push('geometry.arranged'),
    TypeError,
  );
});

test('native edit advertises only the update primitive that is valid across supported selected matter', () => {
  const edit = FOGWOOD_CAPABILITY_ONTOLOGY.find((entry) => entry.id === 'matter.native.edit');
  assert.deepEqual(edit.adapter.operations, ['update']);
  assert.equal(edit.intent.use_when.includes('dimensions'), false);
});

test('planner refuses stale revisions before selecting capabilities', () => {
  const result = planCapabilities({
    intent: 'Arrange these notes.',
    base_revision: 'revision:old',
    context_token: 'context:old',
    scope: 'selection',
  }, {
    current_revision: 'revision:new',
    current_context_token: 'context:new',
    page_item_count: 3,
    selection_count: 3,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.deepEqual({ status: result.status, codes: result.errors.map((error) => error.code) }, {
    status: 'refused',
    codes: ['STALE_STATE'],
  });
});

test('planner blocks capabilities whose live target preconditions are unmet', () => {
  const result = planCapabilities({
    intent: 'Align the selected note.',
    base_revision: 'revision:targets',
    context_token: 'context:targets',
    scope: 'selection',
    desired_effects: ['geometry.arranged'],
  }, {
    current_revision: 'revision:targets',
    current_context_token: 'context:targets',
    page_item_count: 1,
    selection_count: 1,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.deepEqual({ status: result.status, errors: result.errors }, {
    status: 'blocked',
    errors: [{
      code: 'MINIMUM_TARGETS_UNMET',
      capability_id: 'layout.arrange',
      message: 'layout.arrange requires at least 2 target(s) in this scope or planned native matter.',
    }],
  });
});

test('planner asks for clarification instead of inventing an unqualified capability', () => {
  const result = planCapabilities({
    intent: 'Start a multiplayer voice conference.',
    base_revision: 'revision:unknown',
    context_token: 'context:unknown',
    scope: 'page',
  }, {
    current_revision: 'revision:unknown',
    current_context_token: 'context:unknown',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.deepEqual({ status: result.status, codes: result.errors.map((error) => error.code) }, {
    status: 'needs-clarification',
    codes: ['NO_MATCHING_CAPABILITY'],
  });
});

test('existing nouns do not invent a creation step for an arrange-only intent', () => {
  const result = planCapabilities({
    intent: 'Arrange these two ideas.',
    base_revision: 'revision:existing',
    context_token: 'context:existing',
    scope: 'selection',
  }, {
    current_revision: 'revision:existing',
    current_context_token: 'context:existing',
    page_item_count: 2,
    selection_count: 2,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.steps.map((step) => step.capability_id), ['layout.arrange']);
});

test('page planning blocks locked matter and scopes above the adapter target limit', () => {
  const locked = planCapabilities({
    intent: 'Arrange the page.',
    base_revision: 'revision:locked-page',
    context_token: 'context:locked-page',
    scope: 'page',
    desired_effects: ['geometry.arranged'],
  }, {
    current_revision: 'revision:locked-page',
    current_context_token: 'context:locked-page',
    page_item_count: 2,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 1,
  });
  assert.deepEqual({ status: locked.status, codes: locked.errors.map((error) => error.code) }, {
    status: 'blocked',
    codes: ['LOCKED_PAGE_SCOPE'],
  });

  const oversized = planCapabilities({
    intent: 'Arrange the page.',
    base_revision: 'revision:large-page',
    context_token: 'context:large-page',
    scope: 'page',
    desired_effects: ['geometry.arranged'],
  }, {
    current_revision: 'revision:large-page',
    current_context_token: 'context:large-page',
    page_item_count: 65,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });
  assert.deepEqual({ status: oversized.status, codes: oversized.errors.map((error) => error.code) }, {
    status: 'blocked',
    codes: ['TARGET_SCOPE_LIMIT'],
  });
});

test('new-scope target capabilities require an explicit planned item count', () => {
  const result = planCapabilities({
    intent: 'Create and arrange ideas.',
    base_revision: 'revision:planned-count',
    context_token: 'context:planned-count',
    scope: 'new',
    desired_effects: ['matter.created', 'geometry.arranged'],
  }, {
    current_revision: 'revision:planned-count',
    current_context_token: 'context:planned-count',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
  });

  assert.deepEqual({ status: result.status, codes: result.errors.map((error) => error.code) }, {
    status: 'blocked',
    codes: ['PLANNED_TARGET_COUNT_REQUIRED'],
  });
});

test('context-bound planning requires the inspected token and fails closed when it is stale', () => {
  const facts = {
    current_revision: 'revision:context',
    current_context_token: 'context:current',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  };
  const missing = planCapabilities({
    intent: 'Create a note.',
    base_revision: facts.current_revision,
    scope: 'new',
    planned_item_count: 1,
  }, facts);
  assert.deepEqual(missing.errors.map((error) => error.code), ['INVALID_CONTEXT_TOKEN']);

  const stale = planCapabilities({
    intent: 'Create a note.',
    base_revision: facts.current_revision,
    context_token: 'context:old',
    scope: 'new',
    planned_item_count: 1,
  }, facts);
  assert.equal(stale.status, 'refused');
  assert.equal(stale.errors[0].code, 'STALE_CONTEXT');
  assert.match(stale.errors[0].message, /inspect/i);
  assert.match(stale.errors[0].recovery, /fogwood-inspect/i);
});

test('availability returns every versioned manifest with bounded current-context reasons', () => {
  const blank = listCapabilityAvailability({
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.deepEqual(blank.map((entry) => [entry.id, entry.availability]), [
    ['matter.native.create', 'available'],
    ['matter.variant.create', 'blocked'],
    ['matter.native.draw', 'available'],
    ['matter.native.edit', 'blocked'],
    ['layout.arrange', 'blocked'],
    ['connector-arrow.create', 'blocked'],
    ['structure.group', 'blocked'],
    ['layer.reorder', 'blocked'],
    ['matter.native.delete', 'blocked'],
  ]);
  assert.equal(blank.every((entry) => [1, 2].includes(entry.version) && entry.schema === 'fogwood.capability.v1'), true);
  assert.equal(blank.find((entry) => entry.id === 'connector-arrow.create').version, 2);
  assert.equal(blank.find((entry) => entry.id === 'matter.native.edit').reasons[0].code, 'SELECTION_REQUIRED');

  const one = listCapabilityAvailability({
    page_item_count: 3,
    selection_count: 1,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.deepEqual(one.filter((entry) => entry.availability === 'available').map((entry) => entry.id), [
    'matter.native.create',
    'matter.variant.create',
    'matter.native.draw',
    'matter.native.edit',
    'layer.reorder',
    'matter.native.delete',
  ]);

  const many = listCapabilityAvailability({
    page_item_count: 4,
    selection_count: 2,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.deepEqual(many.filter((entry) => entry.availability === 'available').map((entry) => entry.id), [
    'matter.native.create',
    'matter.native.draw',
    'matter.native.edit',
    'layout.arrange',
    'connector-arrow.create',
    'structure.group',
    'layer.reorder',
    'matter.native.delete',
  ]);
  const locked = listCapabilityAvailability({
    page_item_count: 4,
    selection_count: 1,
    locked_selection_count: 1,
    locked_page_item_count: 1,
    readonly: false,
  });
  assert.equal(locked.find((entry) => entry.id === 'matter.native.edit').availability, 'blocked');
  assert.equal(locked.find((entry) => entry.id === 'matter.native.edit').reasons[0].code, 'LOCKED_SELECTION');
  const readonly = listCapabilityAvailability({
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: true,
  });
  assert.equal(readonly.every((entry) => entry.availability === 'blocked'), true);
  assert.equal(readonly[0].reasons[0].code, 'READONLY');
  const oversized = listCapabilityAvailability({
    page_item_count: 70,
    selection_count: 65,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.equal(oversized.find((entry) => entry.id === 'matter.native.edit').reasons[0].code, 'SELECTION_LIMIT');
  assert.equal(FOGWOOD_CAPABILITY_EFFECTS.includes('matter.deleted'), true);
  assert.equal(FOGWOOD_CAPABILITY_EFFECTS.includes('relationship.visible'), false);
});

test('new item planning uses the 24-operation budget while live selection and page targets stay at 64', () => {
  const tooMany = planCapabilities({
    intent: 'Create a note.',
    base_revision: 'revision:count',
    context_token: 'context:count',
    scope: 'new',
    planned_item_count: 25,
  }, {
    current_revision: 'revision:count',
    current_context_token: 'context:count',
    page_item_count: 0,
    selection_count: 0,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.equal(tooMany.errors[0].code, 'INVALID_PLANNED_ITEM_COUNT');
  const selection = planCapabilities({
    intent: 'Edit the selection.',
    base_revision: 'revision:selection-limit',
    context_token: 'context:selection-limit',
    scope: 'selection',
    desired_effects: ['matter.edited'],
  }, {
    current_revision: 'revision:selection-limit',
    current_context_token: 'context:selection-limit',
    page_item_count: 100,
    selection_count: 65,
    locked_selection_count: 0,
    locked_page_item_count: 0,
    readonly: false,
  });
  assert.equal(selection.errors[0].code, 'TARGET_SCOPE_LIMIT');
});
