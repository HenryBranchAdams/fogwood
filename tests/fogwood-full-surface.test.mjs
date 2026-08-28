import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOGWOOD_FULL_SURFACE_VERSION,
  FOGWOOD_FULL_SURFACE_ROUTE_IDENTITY,
  FULL_SURFACE_ADAPTERS,
  FULL_SURFACE_ROUTES,
  compileFullSurfaceRequest,
  getFullSurfaceRoute,
  routeFullSurfaceIntent,
} from '../app/fogwood-capability-compiler.ts';
import { TLDRAW_EXAMPLE_CATALOG } from '../app/fogwood-tldraw-capabilities.ts';

const FACTS = Object.freeze({
  current_revision: 'revision:surface',
  current_context_token: 'context:surface',
  page_item_count: 6,
  selection_count: 2,
  locked_selection_count: 0,
  locked_page_item_count: 0,
  readonly: false,
});

test('the full-surface compiler owns one exact callable route for every pinned example', () => {
  const catalogIds = TLDRAW_EXAMPLE_CATALOG.map((entry) => entry.id).sort();
  const routeIds = FULL_SURFACE_ROUTES.map((route) => route.example_id).sort();

  assert.equal(FOGWOOD_FULL_SURFACE_VERSION, 1);
  assert.equal(FULL_SURFACE_ROUTES.length, 213);
  assert.equal(new Set(routeIds).size, 213);
  assert.deepEqual(routeIds, catalogIds);
  assert.equal(FULL_SURFACE_ROUTES.every((route) => route.callable === true), true);
  assert.equal(FULL_SURFACE_ROUTES.every((route) => FULL_SURFACE_ADAPTERS.some((adapter) => adapter.id === route.adapter_id)), true);
  assert.equal(FULL_SURFACE_ROUTES.every((route) => route.lowering.seam !== 'none'), true);
  assert.equal(FULL_SURFACE_ROUTES.every((route) => route.lowering.qualified === true), true);
  assert.equal(FULL_SURFACE_ROUTES.some((route) => /reference-only|not-enabled/i.test(JSON.stringify(route))), false);
  assert.equal(Object.isFrozen(FULL_SURFACE_ROUTES), true);
  assert.equal(Object.isFrozen(FULL_SURFACE_ROUTES[0]), true);
  assert.deepEqual(
    Object.fromEntries(
      ['exact', 'bounded-native-equivalent', 'host-mediated'].map((fidelity) => [
        fidelity,
        FULL_SURFACE_ROUTES.filter((route) => route.fidelity === fidelity).length,
      ]),
    ),
    { exact: 3, 'bounded-native-equivalent': 180, 'host-mediated': 30 },
  );
  assert.equal(
    FULL_SURFACE_ROUTES.every((route) =>
      (route.fidelity === 'exact') === (route.lowering.qualification === 'exact-local-fixture')),
    true,
  );
  assert.deepEqual(FOGWOOD_FULL_SURFACE_ROUTE_IDENTITY, {
    source_commit: 'a30c9c8b9c16555d91625e8137826496326898cf',
    path_fingerprint: '667bfdca',
    route_matrix_fingerprint: 'ffacafa3',
  });
  assert.equal(Object.isFrozen(FOGWOOD_FULL_SURFACE_ROUTE_IDENTITY), true);
});

test('every source path can dynamically select its own exact route', () => {
  for (const route of FULL_SURFACE_ROUTES) {
    const requestPhrase = `${route.category} ${route.slug.replaceAll('-', ' ')}`;
    const result = routeFullSurfaceIntent(requestPhrase, { max_routes: 1 });
    assert.equal(result[0]?.example_id, route.example_id, requestPhrase);
  }
});

test('the eight authority-distinct adapter families partition all 213 routes', () => {
  const counts = Object.fromEntries(FULL_SURFACE_ADAPTERS.map((adapter) => [adapter.family, 0]));
  for (const route of FULL_SURFACE_ROUTES) counts[route.family] += 1;

  assert.deepEqual(counts, {
    native_canvas: 13,
    local_material_artifact: 9,
    editor_introspection: 4,
    control_plane: 70,
    extension_compound: 81,
    local_persistence: 6,
    collaboration_identity: 20,
    external_active: 10,
  });
  assert.equal(FULL_SURFACE_ADAPTERS.every((adapter) => adapter.arbitrary_code === false), true);
  assert.equal(FULL_SURFACE_ADAPTERS.every((adapter) => adapter.network === 'none'), true);
});

test('representative routes are callable through real local, host, and artifact paths', () => {
  const align = getFullSurfaceRoute('tldraw-example.editor-api.align-and-distribute-shapes');
  const inspect = getFullSurfaceRoute('tldraw-example.editor-api.selection-bounds');
  const comments = getFullSurfaceRoute('tldraw-example.collaboration.commenting');
  const embed = getFullSurfaceRoute('tldraw-example.configuration.custom-embed');

  assert.deepEqual(
    [align.family, align.execution_lane, align.fidelity, align.next_step.kind],
    ['native_canvas', 'page-proposal', 'exact', 'propose'],
  );
  assert.deepEqual(align.lowering, {
    seam: 'canvas_ops',
    authority: 'page-apply',
    capability_ids: ['layout.arrange'],
    operations: ['align', 'distribute'],
    qualified: true,
    qualification: 'exact-local-fixture',
  });
  assert.deepEqual(
    [inspect.family, inspect.execution_lane, inspect.fidelity, inspect.next_step.kind],
    ['editor_introspection', 'read-only', 'bounded-native-equivalent', 'inspect'],
  );
  assert.deepEqual(
    [comments.family, comments.execution_lane, comments.callable, comments.next_step.kind],
    ['collaboration_identity', 'host-capability', true, 'host'],
  );
  assert.deepEqual(
    [embed.family, embed.execution_lane, embed.callable, embed.next_step.kind],
    ['external_active', 'artifact-bridge', true, 'host'],
  );
  assert.match(embed.boundary, /sanitized|local artifact|active content/i);
});

test('open-ended intent resolves a deterministic mix of example routes instead of one template', () => {
  const intent = 'Align the selected shapes, export the canvas as an image, inspect selection bounds, and save a snapshot.';
  const first = routeFullSurfaceIntent(intent, { max_routes: 8 });
  const second = routeFullSurfaceIntent(intent, { max_routes: 8 });

  assert.deepEqual(second, first);
  assert.deepEqual(first.map((route) => route.example_id), [
    'tldraw-example.editor-api.align-and-distribute-shapes',
    'tldraw-example.data.assets.export-canvas-as-image',
    'tldraw-example.editor-api.selection-bounds',
    'tldraw-example.editor-api.snapshots',
  ]);
  assert.deepEqual([...new Set(first.map((route) => route.family))], [
    'native_canvas',
    'local_material_artifact',
    'editor_introspection',
    'local_persistence',
  ]);
});

test('the compiler composes explicit example routes and reports host work without pretending it ran', () => {
  const request = Object.freeze({
    intent: 'Create a connected board, export it, and make comments collaborative.',
    example_ids: Object.freeze([
      'tldraw-example.editor-api.create-arrow',
      'tldraw-example.data.assets.export-canvas-as-image',
      'tldraw-example.collaboration.commenting',
    ]),
    base_revision: 'revision:surface',
    context_token: 'context:surface',
    scope: 'selection',
    max_steps: 8,
  });

  const result = compileFullSurfaceRequest(request, FACTS, { observed_capability_ids: [] });

  assert.equal(result.schema, 'fogwood.surface-plan.v1');
  assert.equal(result.status, 'ready-with-host-requirements');
  assert.deepEqual(result.steps.map((step) => step.example_id), request.example_ids);
  assert.deepEqual(result.steps.map((step) => step.status), ['ready', 'ready', 'host-required']);
  assert.deepEqual(result.local_next_calls.map((step) => step.tool), ['fogwood-inspect']);
  assert.deepEqual(result.local_next_calls.map((step) => step.input), [{}]);
  assert.equal(result.local_next_calls.some((step) => Object.hasOwn(step, 'projection')), false);
  assert.deepEqual(result.proposal_contracts, [{
    example_id: 'tldraw-example.editor-api.create-arrow',
    tool: 'fogwood-propose',
    action_type: 'canvas_ops',
    allowed_operations: ['connect'],
    requires_compilation: true,
  }]);
  assert.equal(result.host_requirements.length, 1);
  assert.equal(result.host_requirements[0].example_id, 'tldraw-example.collaboration.commenting');
  assert.equal(result.page_mutated, false);
  assert.deepEqual(result.steps[0].lowering.operations, ['connect']);
});

test('the compiler rejects stale context, unknown routes, sparse ids, and oversized plans before adapters', () => {
  const base = {
    intent: 'Use exact capabilities.',
    example_ids: ['tldraw-example.editor-api.create-arrow'],
    base_revision: 'revision:surface',
    context_token: 'context:surface',
    scope: 'selection',
  };

  const stale = compileFullSurfaceRequest({ ...base, context_token: 'context:old' }, FACTS);
  assert.deepEqual(stale.errors.map((error) => error.code), ['STALE_CONTEXT']);

  const unknown = compileFullSurfaceRequest({ ...base, example_ids: ['tldraw-example.missing.nope'] }, FACTS);
  assert.deepEqual(unknown.errors.map((error) => error.code), ['UNKNOWN_EXAMPLE_ROUTE']);

  const sparse = new Array(1);
  const invalidSparse = compileFullSurfaceRequest({ ...base, example_ids: sparse }, FACTS);
  assert.deepEqual(invalidSparse.errors.map((error) => error.code), ['INVALID_EXAMPLE_IDS']);

  const oversized = compileFullSurfaceRequest({ ...base, example_ids: Array(25).fill(base.example_ids[0]) }, FACTS);
  assert.deepEqual(oversized.errors.map((error) => error.code), ['INVALID_EXAMPLE_IDS']);
});
