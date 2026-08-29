import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY_REGISTRY,
  FOGWOOD_CONTEXT_VERSION,
  FOGWOOD_PARTICIPATION_CONTRACT,
  FOGWOOD_RETIRED_ACTION_TYPES,
  PROPOSAL_INPUT_SCHEMA,
  PROPOSAL_TOOL_INPUT_SCHEMA,
  buildContextProjection,
  buildProposalDiff,
  canonicalSerialize,
  computeContextToken,
  computePageRevision,
  deterministicHash,
  searchCapabilities,
  validateProposal,
} from '../app/fogwood-runtime.ts';
import { MATERIAL_LIMITS } from '../app/fogwood-materials.ts';

const emptyContext = {
  current_revision: 'fogwood-agent-runtime/1-base',
  page_id: 'page:main',
  items: [],
};

test('revision canonicalization is stable and excludes camera and selection by construction', () => {
  const shapes = [
    { id: 'shape:b', type: 'geo', props: { text: 'B', w: 100 }, x: 2 },
    { id: 'shape:a', type: 'geo', props: { w: 100, text: 'A' }, x: 1 },
  ];
  const bindings = [{ id: 'binding:1', toId: 'shape:b', fromId: 'shape:a', props: {} }];
  const first = computePageRevision('page:main', shapes, bindings);
  assert.equal(computePageRevision('page:main', [...shapes].reverse(), bindings), first);
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
    registry_version: '8',
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
  ]) assert.notEqual(computeContextToken(buildContextProjection({ ...base, ...change })), token);
  assert.deepEqual(buildContextProjection({ ...base, camera: { x: 100 }, viewport: { x: 1 } }), projection);
});

test('context selection digest is bounded and reports truncation explicitly', () => {
  const ids = Array.from({ length: 5_001 }, (_, index) => 'shape:' + index);
  const projection = buildContextProjection({
    page_id: 'page:main',
    selected_ids: ids,
    readonly: false,
    focused_group_id: null,
    editing_shape_id: null,
    ontology_version: 1,
    registry_version: '8',
  });
  assert.equal(projection.selected_ids.length, 5_000);
  assert.equal(projection.selected_ids_preview.length, 128);
  assert.deepEqual(projection.selection_completeness, { complete: false, truncated: true, total: 5_001, returned: 128, limit: 128 });
});

test('capability search is deterministic, bounded, and exposes no recipe runtime', () => {
  assert.equal(CAPABILITY_REGISTRY.some((entry) => entry.id === 'fogwood-inspect'), true);
  const first = searchCapabilities({ page_size: 3 });
  const second = searchCapabilities({ page_size: 3, cursor: first.next_cursor });
  assert.equal(first.results.length, 3);
  assert.equal(first.has_more, true);
  assert.equal(first.results.some((entry) => second.results.some((next) => next.id === entry.id)), false);
  assert.deepEqual(searchCapabilities({ kind: 'recipe', page_size: 20 }).results, []);
  assert.deepEqual(searchCapabilities({ kind: 'action', query: 'draw align group reorder', page_size: 20 }).results.map((entry) => entry.id), ['canvas_ops']);
  assert.equal(JSON.stringify(first).includes('function'), false);
});

test('public proposal schema has exactly the three active mutation representations', () => {
  const actionItems = PROPOSAL_INPUT_SCHEMA.properties.actions.items.oneOf;
  assert.equal(PROPOSAL_INPUT_SCHEMA.properties.actions.maxItems, 1);
  assert.deepEqual(actionItems.map((schema) => schema.properties?.type?.const), ['canvas_ops', 'seeded_composition', 'add_materials']);
  const materialAction = actionItems.find((schema) => schema.properties?.type?.const === 'add_materials');
  assert.deepEqual(materialAction.required, ['type', 'materials']);
  assert.equal(materialAction.properties.materials.type, 'array');
  assert.equal(materialAction.properties.materials.minItems, 1);
  assert.equal(materialAction.properties.materials.maxItems, 4);
  const materialVariants = materialAction.properties.materials.items.oneOf;
  assert.deepEqual(materialVariants.map((schema) => schema.properties.mime_type.const), ['image/png', 'image/jpeg', 'image/svg+xml']);
  assert.deepEqual(materialVariants.map((schema) => schema.properties.base64.maxLength), [
    Math.ceil(MATERIAL_LIMITS.max_raster_bytes / 3) * 4,
    Math.ceil(MATERIAL_LIMITS.max_raster_bytes / 3) * 4,
    Math.ceil(MATERIAL_LIMITS.max_svg_bytes / 3) * 4,
  ]);
  for (const schema of materialVariants) {
    assert.equal(schema.properties.semantic_id.pattern, '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$');
    assert.deepEqual(schema.required, ['semantic_id', 'mime_type', 'base64', 'x', 'y', 'w', 'h']);
  }
  const canvasAction = actionItems.find((schema) => schema.properties?.type?.const === 'canvas_ops');
  const ungroup = canvasAction.properties.ops.items.oneOf.find((schema) => schema.properties?.op?.const === 'ungroup');
  assert.equal(ungroup.properties.ids.maxItems, 32);
  assert.deepEqual(CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-propose').input_schema, PROPOSAL_TOOL_INPUT_SCHEMA);
  assert.deepEqual(searchCapabilities({ kind: 'action', page_size: 20 }).results.map((entry) => entry.id), ['canvas_ops', 'seeded_composition', 'add_materials']);
});

test('canvas protocol validation returns a compact native diff', () => {
  const proposal = {
    base_revision: emptyContext.current_revision,
    summary: 'Place a constellation',
    actions: [{
      type: 'canvas_ops',
      ops: [
        { op: 'create', semantic_id: 'idea:one', kind: 'ellipse', x: 100, y: 120, w: 180, h: 120, text: 'One' },
        { op: 'create', semantic_id: 'idea:two', kind: 'note', x: 420, y: 160, w: 180, h: 120, text: 'Two' },
        { op: 'connect', semantic_id: 'edge:one-two', from_id: 'semantic:idea:one', to_id: 'semantic:idea:two', text: 'supports' },
      ],
    }],
  };
  const result = validateProposal(proposal, emptyContext);
  assert.equal(result.ok, true);
  assert.equal(result.diff.counts.adds, 3);
  assert.equal(result.diff.adds.specs[2].semantic_id, 'edge:one-two');
  assert.deepEqual(result.diff.spatial_moves, []);
  assert.deepEqual(result.diff.semantic_relationships, []);
});

test('seeded composition normalizes reproducibly and commits lineage to its diff', () => {
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
    summary: 'Remix selected ideas',
    actions: [{ type: 'seeded_composition', scope: { kind: 'selection' }, seed: 'orchard', wildness: 0.6 }],
  }, context);
  assert.equal(result.ok, true);
  const action = result.proposal.actions[0];
  assert.equal(action.source_revision, context.current_revision);
  assert.deepEqual(action.target_semantic_ids, ['idea:a', 'idea:b']);
  assert.equal(action.lineage.length, 2);
  assert.equal(action.lineage[1].parent_variant_id, 'variant:parent');
  assert.equal(result.diff.seeded_compositions[0].source_fingerprint, action.source_fingerprint);
  assert.equal(result.diff.counts.adds, 2);
  assert.deepEqual(validateProposal(result.proposal, context).proposal, result.proposal);
  const tampered = structuredClone(result.proposal);
  tampered.actions[0].lineage[0].variant_semantic_id = 'variant:tampered';
  assert.equal(validateProposal(tampered, context).errors.some((error) => error.code === 'INVALID_SEEDED_PLAN'), true);
  assert.equal(validateProposal(result.proposal, { ...context, current_revision: 'rev:changed' }).errors[0].code, 'STALE_STATE');
});

test('seed is never part of capability safety or authority inputs', () => {
  const schema = CAPABILITY_REGISTRY.find((entry) => entry.id === 'fogwood-capabilities').input_schema;
  assert.equal(schema.oneOf.every((branch) => !Object.hasOwn(branch.properties, 'seed')), true);
  assert.equal(FOGWOOD_PARTICIPATION_CONTRACT.seed_only_after_capability_scope_safety_permissions_and_authority_are_fixed, true);
  assert.equal(FOGWOOD_PARTICIPATION_CONTRACT.seed_never_controls_facts_safety_permissions_semantic_identity_or_human_authority, true);
});

test('every retired action is rejected before any normalization or lowering', () => {
  for (const type of FOGWOOD_RETIRED_ACTION_TYPES) {
    const result = validateProposal({
      base_revision: emptyContext.current_revision,
      summary: 'Legacy request',
      actions: [{ type }],
    }, emptyContext);
    assert.equal(result.ok, false, type);
    assert.equal(result.errors[0].code, 'RETIRED_ACTION', type);
    assert.match(result.errors[0].message, /retired/i);
  }
});

test('diff projection is side-effect free and deterministic for active actions', () => {
  const proposal = {
    base_revision: emptyContext.current_revision,
    summary: 'Draw one mark',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'draw', semantic_id: 'mark:one', points: [{ x: 0, y: 0 }, { x: 40, y: 40 }] }] }],
  };
  const first = validateProposal(proposal, emptyContext);
  const second = buildProposalDiff(first.proposal.actions, emptyContext);
  assert.deepEqual(second, first.diff);
});
