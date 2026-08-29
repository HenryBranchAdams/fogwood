import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import {
  TLDRAW_EXAMPLE_CATALOG,
  TLDRAW_EXAMPLE_SOURCE,
  searchTldrawExamples,
} from '../app/fogwood-tldraw-capabilities.ts';
import { getFullSurfaceRoute } from '../app/fogwood-capability-compiler.ts';
import {
  CAPABILITY_REGISTRY,
  PROPOSAL_INPUT_SCHEMA,
  searchCapabilities,
  validateProposal,
} from '../app/fogwood-runtime.ts';
import { FOGWOOD_CANVAS_PROTOCOL, planCanvasOps } from '../app/fogwood-canvas-ops.ts';

test('the public shell has no unreachable product modules or retired control-plane CSS', async () => {
  const appFiles = await readdir(new URL('../app/', import.meta.url));
  for (const file of ['bazaar-panel.tsx', 'fogwood-demo.ts', 'fogwood-snapshot.ts']) {
    assert.equal(appFiles.includes(file), false, `${file} remains reachable only as dead product code`);
  }

  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  for (const selector of [
    '.chat-is-open',
    '.chat-toggle',
    '.canvas-actions',
    '.surface-export-status',
    '.snapshot-toggle',
    '.bazaar-',
    '.empty-invitation',
    '.guided-',
    '.prompt-examples',
    '.copy-feedback',
    '.starter-divider',
    '.empty-footnote',
    '.legacy-starter',
    '.agent-',
    '.message-',
    '.receipt-summary',
    '.proposal-slot',
    '.workflow-',
    '.native-chat-handoff',
    '.site-tools-recovery',
    '.proposal-revision',
    '.proposal-instrument-',
  ]) {
    assert.equal(css.includes(selector), false, `retired selector family remains: ${selector}`);
  }

  assert.match(css, /\.surface-block/);
  assert.match(css, /\.proposal-seeded-evidence/);
  assert.match(css, /\.proposal-material-diff/);
  assert.match(css, /prefers-reduced-motion/);
});

test('the acceptance manifest names the autophagy kernel and its three-tool public boundary', async () => {
  const acceptance = await readFile(new URL('../acceptance.md', import.meta.url), 'utf8');
  assert.match(acceptance, /autophagy/i);
  assert.match(acceptance, /FogwoodSurface/);
  assert.match(acceptance, /PreparedCanvasPlan/);
  assert.match(acceptance, /fogwood-receipts-local:v1/);
  assert.match(acceptance, /fogwood-inspect/);
  assert.match(acceptance, /fogwood-capabilities/);
  assert.match(acceptance, /fogwood-propose/);

  const publicTools = [...acceptance.matchAll(/`(fogwood-(?:inspect|capabilities|propose))`/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(publicTools)].sort(), ['fogwood-capabilities', 'fogwood-inspect', 'fogwood-propose']);
});

test('the public shell is a blank tldraw surface without product-gallery chrome', async () => {
  const source = await readFile(new URL('../app/surface-app.tsx', import.meta.url), 'utf8');
  const toolsSource = await readFile(new URL('../app/surface-tools.ts', import.meta.url), 'utf8');

  assert.match(source, /<Tldraw\b/);
  assert.match(source, /surface-mark/);
  assert.doesNotMatch(source, /BazaarPanel|empty-invitation|agent-sidebar|ChatGPT surface chat|Export SVG/);
  assert.deepEqual(
    [...toolsSource.matchAll(/name: '(fogwood-[a-z-]+)'/g)].map((match) => match[1]),
    ['fogwood-inspect', 'fogwood-capabilities', 'fogwood-propose'],
  );
  assert.doesNotMatch(toolsSource, /FOGWOOD_BAZAAR_TOOL/);
});

test('all official examples are indexed as callable routes with a pinned source', () => {
  assert.equal(TLDRAW_EXAMPLE_SOURCE.repository, 'https://github.com/tldraw/tldraw');
  assert.match(TLDRAW_EXAMPLE_SOURCE.commit, /^[0-9a-f]{40}$/);
  assert.equal(TLDRAW_EXAMPLE_CATALOG.length, 213);
  assert.equal(new Set(TLDRAW_EXAMPLE_CATALOG.map((entry) => entry.id)).size, 213);
  assert.deepEqual(
    [...new Set(TLDRAW_EXAMPLE_CATALOG.map((entry) => entry.category))].sort(),
    ['collaboration', 'configuration', 'data/assets', 'editor-api', 'events', 'getting-started', 'layout', 'shapes/tools', 'ui', 'use-cases', 'users'],
  );

  const align = searchTldrawExamples({ query: 'align-and-distribute', limit: 10 });
  assert.equal(align.results.length, 1);
  assert.equal(align.results[0].status, 'callable');
  assert.equal(getFullSurfaceRoute(align.results[0].id).next_step.kind, 'propose');

  const multiplayer = searchTldrawExamples({ query: 'sync-demo', limit: 10 });
  assert.equal(multiplayer.results.length, 1);
  assert.equal(multiplayer.results[0].status, 'callable');
  assert.equal(getFullSurfaceRoute(multiplayer.results[0].id).next_step.kind, 'host');

  const capabilityIds = new Set(CAPABILITY_REGISTRY.map((entry) => entry.id));
  for (const entry of TLDRAW_EXAMPLE_CATALOG) {
    assert.equal(entry.status, 'callable');
    assert.equal(getFullSurfaceRoute(entry.id).callable, true);
    for (const id of entry.mapped_capability_ids) assert.equal(capabilityIds.has(id), true, `${entry.id} maps to missing ${id}`);
  }
});

test('route fidelity and live authority stay explicit even though all examples are callable', () => {
  assert.equal(TLDRAW_EXAMPLE_CATALOG.every((entry) => entry.status === 'callable'), true);
  assert.equal(searchTldrawExamples({ query: 'image annotator' }).results[0].status, 'callable');
  assert.equal(searchTldrawExamples({ query: 'custom tool' }).results[0].status, 'callable');
  assert.equal(getFullSurfaceRoute('tldraw-example.shapes.tools.custom-tool').fidelity, 'bounded-native-equivalent');
  assert.equal(getFullSurfaceRoute('tldraw-example.collaboration.sync-demo').fidelity, 'host-mediated');
});

test('canvas_ops can create, arrange, and group new native matter by semantic reference in one proposal', () => {
  const context = { current_revision: 'rev-compose', page_id: 'page:main', items: [] };
  const result = validateProposal({
    base_revision: context.current_revision,
    summary: 'Compose two native ideas',
    actions: [{
      type: 'canvas_ops',
      ops: [
        { op: 'create', semantic_id: 'idea:a', kind: 'cloud', x: 20, y: 40, w: 180, h: 120, text: 'First idea', color: 'violet', fill: 'semi' },
        { op: 'create', semantic_id: 'idea:b', kind: 'ellipse', x: 400, y: 90, w: 160, h: 100, text: 'Second idea', color: 'green', fill: 'solid' },
        { op: 'stack', ids: ['semantic:idea:a', 'semantic:idea:b'], axis: 'horizontal', gap: 48 },
        { op: 'group', ids: ['semantic:idea:a', 'semantic:idea:b'], semantic_id: 'cluster:ideas' },
      ],
    }],
  }, context);

  assert.equal(result.ok, true);
  assert.equal(result.diff.adds.shapes, 3);
  assert.equal(result.diff.moves.some((move) => move.ids.includes('pending:idea:b')), true);
  assert.deepEqual(result.proposal.actions[0].ops[2].ids, ['pending:idea:a', 'pending:idea:b']);
  assert.deepEqual(result.proposal.actions[0].ops[3].ids, ['pending:idea:a', 'pending:idea:b']);
});

test('Canvas Protocol plans one native bound connector from exact endpoint references', () => {
  const pageId = 'page:main';
  const items = [
    { id: 'shape:a', type: 'geo', kind: 'rectangle', x: 20, y: 30, w: 160, h: 100, rotation: 0, parent_id: pageId, is_locked: false, semantic_id: 'idea:a' },
    { id: 'shape:b', type: 'note', x: 360, y: 90, w: 180, h: 120, rotation: 0, parent_id: pageId, is_locked: false, semantic_id: 'idea:b' },
  ];
  const result = planCanvasOps(items, [{
    op: 'connect',
    semantic_id: 'connector:a-b',
    from_id: 'semantic:idea:a',
    to_id: 'semantic:idea:b',
    text: 'influences',
    color: 'violet',
  }], pageId);

  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.normalized_action.ops, [{
    op: 'connect',
    semantic_id: 'connector:a-b',
    from_id: 'shape:a',
    to_id: 'shape:b',
    text: 'influences',
    color: 'violet',
  }]);
  assert.deepEqual(result.plan.steps[0], {
    kind: 'connect',
    op: result.plan.normalized_action.ops[0],
    pending_id: 'pending:connector:a-b',
    from: { id: 'shape:a', type: 'geo', semantic_id: 'idea:a' },
    to: { id: 'shape:b', type: 'note', semantic_id: 'idea:b' },
    bounds: { x: 100, y: 80, w: 350, h: 70 },
  });
  assert.deepEqual(result.plan.adds.map((item) => [item.kind, item.semantic_id]), [['connector', 'connector:a-b']]);
});

test('Canvas Protocol bound connectors resolve earlier semantic creates and reject unsafe endpoints', () => {
  const pageId = 'page:main';
  const samePlan = planCanvasOps([], [
    { op: 'create', semantic_id: 'idea:a', kind: 'rectangle', x: 20, y: 20, w: 100, h: 80 },
    { op: 'create', semantic_id: 'idea:b', kind: 'ellipse', x: 260, y: 20, w: 100, h: 80 },
    { op: 'connect', semantic_id: 'connector:a-b', from_id: 'semantic:idea:a', to_id: 'semantic:idea:b' },
  ], pageId);
  assert.equal(samePlan.ok, true);
  assert.deepEqual(samePlan.plan.normalized_action.ops[2], {
    op: 'connect', semantic_id: 'connector:a-b', from_id: 'pending:idea:a', to_id: 'pending:idea:b',
  });

  const base = { id: 'shape:a', type: 'geo', x: 0, y: 0, w: 100, h: 80, rotation: 0, parent_id: pageId, semantic_id: 'idea:a' };
  const unsafe = [
    [base],
    [base, { ...base, id: 'shape:arrow', type: 'arrow', semantic_id: 'arrow:a', x: 200 }],
    [base, { ...base, id: 'shape:group', type: 'group', semantic_id: 'group:a', x: 200 }],
    [{ ...base, is_locked: true }, { ...base, id: 'shape:b', semantic_id: 'idea:b', x: 200 }],
    [base, { ...base, id: 'shape:nested', semantic_id: 'nested', parent_id: 'shape:frame', x: 200 }],
  ];
  const ops = [
    { op: 'connect', semantic_id: 'connector:self', from_id: 'shape:a', to_id: 'shape:a' },
    { op: 'connect', semantic_id: 'connector:arrow', from_id: 'shape:a', to_id: 'shape:arrow' },
    { op: 'connect', semantic_id: 'connector:group', from_id: 'shape:a', to_id: 'shape:group' },
    { op: 'connect', semantic_id: 'connector:locked', from_id: 'shape:a', to_id: 'shape:b' },
    { op: 'connect', semantic_id: 'connector:nested', from_id: 'shape:a', to_id: 'shape:nested' },
  ];
  const expected = ['SELF_CONNECTOR', 'UNSUPPORTED_CONNECT_TARGET', 'UNSUPPORTED_CONNECT_TARGET', 'LOCKED_TARGET', 'NESTED_TARGET'];
  unsafe.forEach((items, index) => {
    const result = planCanvasOps(items, [ops[index]], pageId);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === expected[index]), true, JSON.stringify(result));
  });
});

test('Canvas Protocol plans a preserved variant and can mutate it later in the same action', () => {
  const pageId = 'page:main';
  const source = {
    id: 'shape:source', type: 'geo', kind: 'rectangle', x: 80, y: 120, w: 180, h: 100,
    rotation: 0, opacity: 0.8, parent_id: pageId, is_locked: false, semantic_id: 'idea:source',
    meta: { semantic_id_source: 'stable', role: 'idea' }, props: { color: 'blue', fill: 'semi' }, text: 'Source',
  };
  const result = planCanvasOps([source], [
    { op: 'variant', id: 'semantic:idea:source', semantic_id: 'idea:variant', offset_x: 48, offset_y: 64 },
    { op: 'update', id: 'semantic:idea:variant', text: 'Mutated branch', color: 'violet' },
  ], pageId);

  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.normalized_action.ops[0], {
    op: 'variant', id: 'shape:source', semantic_id: 'idea:variant', offset_x: 48, offset_y: 64,
  });
  assert.deepEqual(result.plan.steps[0], {
    kind: 'variant',
    op: result.plan.normalized_action.ops[0],
    pending_id: 'pending:idea:variant',
    source: { id: 'shape:source', type: 'geo', semantic_id: 'idea:source' },
    bounds: { x: 128, y: 184, w: 180, h: 100 },
    lineage: { variant_id: 'idea:variant', lineage_source_id: 'idea:source' },
  });
  assert.equal(result.plan.adds[0].kind, 'variant');
  assert.deepEqual(result.plan.updates[0].ids, ['pending:idea:variant']);
});

test('Canvas Protocol variants reject sources that cannot be safely cloned', () => {
  const pageId = 'page:main';
  const base = { id: 'shape:source', type: 'geo', x: 99_980, y: 0, w: 100, h: 80, rotation: 0, parent_id: pageId, semantic_id: 'source', meta: { semantic_id_source: 'stable' } };
  const cases = [
    { item: { ...base, semantic_id: undefined }, code: 'UNSTABLE_VARIANT_SOURCE' },
    { item: { ...base, type: 'surface-block' }, code: 'UNSUPPORTED_VARIANT_TARGET' },
    { item: { ...base, type: 'arrow' }, code: 'UNSUPPORTED_VARIANT_TARGET' },
    { item: { ...base, type: 'group' }, code: 'UNSUPPORTED_VARIANT_TARGET' },
    { item: { ...base, is_locked: true }, code: 'LOCKED_TARGET' },
    { item: { ...base, parent_id: 'shape:frame' }, code: 'NESTED_TARGET' },
    { item: { ...base, rotation: Math.PI / 4 }, code: 'ROTATED_VARIANT_TARGET' },
    { item: base, code: 'FOOTPRINT_LIMIT' },
  ];
  cases.forEach(({ item, code }, index) => {
    const result = planCanvasOps([item], [{
      op: 'variant', id: item.id, semantic_id: `variant:${index}`, offset_x: 80, offset_y: 0,
    }], pageId);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === code), true, JSON.stringify(result));
  });
});

test('Canvas Protocol refuses variant lineage rooted in a legacy fallback id', () => {
  const result = planCanvasOps([{
    id: 'shape:legacy', type: 'geo', x: 80, y: 120, w: 180, h: 100,
    rotation: 0, parent_id: 'page:main', semantic_id: 'shape:legacy',
    meta: { semantic_id_source: 'legacy-shape-id' },
  }], [{
    op: 'variant', id: 'shape:legacy', semantic_id: 'idea:variant', offset_x: 48, offset_y: 48,
  }], 'page:main');

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'UNSTABLE_VARIANT_SOURCE'), true, JSON.stringify(result));
});

test('Canvas Protocol makes binding collateral explicit by refusing bound deletion and grouping', () => {
  const pageId = 'page:main';
  const items = [
    { id: 'shape:a', type: 'geo', x: 0, y: 0, w: 100, h: 80, rotation: 0, parent_id: pageId, semantic_id: 'a', binding_count: 1 },
    { id: 'shape:b', type: 'geo', x: 200, y: 0, w: 100, h: 80, rotation: 0, parent_id: pageId, semantic_id: 'b' },
  ];
  const deletion = planCanvasOps(items, [{ op: 'delete', ids: ['shape:a'] }], pageId);
  assert.equal(deletion.ok, false);
  assert.equal(deletion.errors.some((error) => error.code === 'BOUND_DELETE_TARGET'), true);
  const grouping = planCanvasOps(items, [{ op: 'group', ids: ['shape:a', 'shape:b'], semantic_id: 'group:ab' }], pageId);
  assert.equal(grouping.ok, false);
  assert.equal(grouping.errors.some((error) => error.code === 'BOUND_STRUCTURE_TARGET'), true);
});

test('variant proposal diff previews preservation lineage before Apply', () => {
  const context = {
    current_revision: 'rev-variant',
    page_id: 'page:main',
    items: [{
      id: 'shape:source', type: 'geo', kind: 'rectangle', x: 80, y: 120, w: 180, h: 100,
      rotation: 0, opacity: 1, parent_id: 'page:main', is_locked: false,
      semantic_id: 'idea:source', meta: { semantic_id: 'idea:source', semantic_id_source: 'stable', role: 'idea' }, props: { color: 'blue', fill: 'semi' },
    }],
  };
  const result = validateProposal({
    base_revision: context.current_revision,
    summary: 'Preserve one variant',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'variant', id: 'shape:source', semantic_id: 'idea:variant' }] }],
  }, context);
  assert.equal(result.ok, true);
  assert.deepEqual(result.diff.adds.specs, [{
    type: 'shape', kind: 'variant', label: 'Variant of idea:source', x: 128, y: 168, w: 180, h: 100,
    semantic_id: 'idea:variant', role: 'variant', variant_id: 'idea:variant', lineage_source_id: 'idea:source',
  }]);
  assert.deepEqual(result.diff.removes.ids, []);
});

test('Canvas Protocol resource and deletion boundaries fail closed before stage', () => {
  const sparse = new Array(FOGWOOD_CANVAS_PROTOCOL.max_ops);
  sparse[0] = { op: 'draw', semantic_id: 'sketch:a', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
  const sparseResult = planCanvasOps([], sparse, 'page:main');
  assert.equal(sparseResult.ok, false);
  assert.equal(sparseResult.errors.some((error) => error.code === 'SPARSE_CANVAS_OPS'), true);

  const tooManyPoints = planCanvasOps([], [{
    op: 'draw',
    semantic_id: 'sketch:large',
    points: Array.from({ length: FOGWOOD_CANVAS_PROTOCOL.max_draw_points + 1 }, (_, index) => ({ x: index, y: index })),
  }], 'page:main');
  assert.equal(tooManyPoints.ok, false);
  assert.equal(tooManyPoints.errors.some((error) => error.code === 'INVALID_DRAW_POINTS'), true);

  const guardedOversizedPoints = new Array(FOGWOOD_CANVAS_PROTOCOL.max_draw_points + 1);
  Object.defineProperty(guardedOversizedPoints, 0, {
    get() {
      throw new Error('oversized draw points were traversed before the collection bound');
    },
  });
  assert.doesNotThrow(() => planCanvasOps([], [{
    op: 'draw',
    semantic_id: 'sketch:guarded-overflow',
    points: guardedOversizedPoints,
  }], 'page:main'));

  const nonLeaf = planCanvasOps([
    { id: 'shape:frame', type: 'frame', x: 0, y: 0, w: 300, h: 200, parent_id: 'page:main', is_locked: false, semantic_id: 'frame:one' },
    { id: 'shape:child', type: 'geo', x: 20, y: 20, w: 80, h: 60, parent_id: 'shape:frame', is_locked: false, semantic_id: 'child:one' },
  ], [{ op: 'delete', ids: ['shape:frame'] }], 'page:main');
  assert.equal(nonLeaf.ok, false);
  assert.equal(nonLeaf.errors.some((error) => error.code === 'NON_LEAF_DELETE_TARGET'), true);

  const duplicateSemanticIds = planCanvasOps([
    { id: 'shape:a', type: 'geo', x: 0, y: 0, w: 100, h: 100, parent_id: 'page:main', semantic_id: 'idea:same' },
    { id: 'shape:b', type: 'geo', x: 200, y: 0, w: 100, h: 100, parent_id: 'page:main', semantic_id: 'idea:same' },
  ], [{ op: 'update', id: 'shape:a', x: 40 }], 'page:main');
  assert.equal(duplicateSemanticIds.ok, false);
  assert.equal(duplicateSemanticIds.errors.some((error) => error.code === 'DUPLICATE_SEMANTIC_ID'), true);

  const wideItems = Array.from({ length: FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op }, (_, index) => ({
    id: `shape:wide-${index}`,
    type: 'geo',
    x: 0,
    y: 0,
    w: 5_000,
    h: 5_000,
    parent_id: 'page:main',
  }));
  for (const op of [
    { op: 'stack', ids: wideItems.map((item) => item.id), axis: 'horizontal', gap: 10_000 },
    { op: 'pack', ids: wideItems.map((item) => item.id), gap: 10_000 },
  ]) {
    const overflow = planCanvasOps(wideItems, [op], 'page:main');
    assert.equal(overflow.ok, false);
    assert.equal(overflow.errors.some((error) => error.code === 'LAYOUT_COORDINATE_LIMIT'), true);
  }

  const float16Overflow = planCanvasOps([], [{
    op: 'draw',
    semantic_id: 'sketch:float16-overflow',
    points: [{ x: 0, y: 0 }, { x: 100_000, y: 0 }],
  }], 'page:main');
  assert.equal(float16Overflow.ok, false);
  assert.equal(float16Overflow.errors.some((error) => error.code === 'DRAW_DELTA_LIMIT'), true);

  const maxFiniteDelta = planCanvasOps([], [{
    op: 'draw',
    semantic_id: 'sketch:max-finite-delta',
    points: [{ x: 0, y: 0 }, { x: FOGWOOD_CANVAS_PROTOCOL.max_draw_delta, y: 0 }],
  }], 'page:main');
  assert.equal(maxFiniteDelta.ok, true);
});

test('Canvas Protocol rejects final footprints outside the bounded page', () => {
  const pageId = 'page:main';
  const base = {
    id: 'shape:edge', type: 'geo', kind: 'rectangle', x: 99_990, y: 40,
    w: 100, h: 100, rotation: 0, opacity: 1, parent_id: pageId,
    semantic_id: 'edge', props: { color: 'black', fill: 'none' },
  };
  const cases = [
    planCanvasOps([], [{ op: 'create', semantic_id: 'edge:create', kind: 'rectangle', x: 100_000, y: 100_000, w: 5_000, h: 5_000 }], pageId),
    planCanvasOps([base], [{ op: 'update', id: base.id, x: 100_000 }], pageId),
    planCanvasOps([base], [{ op: 'resize', id: base.id, w: 5_000, h: 100 }], pageId),
    planCanvasOps([
      base,
      { ...base, id: 'shape:other', semantic_id: 'other', x: 99_800 },
    ], [{ op: 'stack', ids: ['shape:edge', 'shape:other'], axis: 'horizontal', gap: 500 }], pageId),
    planCanvasOps([
      base,
      { ...base, id: 'shape:other', semantic_id: 'other', x: 99_800 },
    ], [{ op: 'group', ids: ['shape:edge', 'shape:other'], semantic_id: 'edge:group' }], pageId),
  ];
  for (const result of cases) {
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === 'FOOTPRINT_LIMIT'), true, JSON.stringify(result));
  }
});

test('Canvas Protocol refuses indirect mutation of locked descendants', () => {
  const pageId = 'page:main';
  const group = { id: 'shape:group', type: 'group', x: 0, y: 0, w: 300, h: 200, rotation: 0, opacity: 1, parent_id: pageId, semantic_id: 'group', props: {} };
  const lockedChild = { id: 'shape:locked-child', type: 'geo', kind: 'rectangle', x: 10, y: 10, w: 100, h: 80, rotation: 0, opacity: 1, parent_id: group.id, semantic_id: 'locked-child', is_locked: true, props: {} };
  const sibling = { id: 'shape:sibling', type: 'geo', kind: 'rectangle', x: 400, y: 0, w: 100, h: 80, rotation: 0, opacity: 1, parent_id: pageId, semantic_id: 'sibling', props: {} };
  const items = [group, lockedChild, sibling];
  const ops = [
    [{ op: 'update', id: group.id, x: 20 }],
    [{ op: 'resize', id: group.id, w: 400, h: 300 }],
    [{ op: 'align', ids: [group.id, sibling.id], axis: 'top' }],
    [{ op: 'reorder', ids: [group.id], position: 'front' }],
    [{ op: 'ungroup', ids: [group.id] }],
  ];
  for (const operation of ops) {
    const result = planCanvasOps(items, operation, pageId);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === 'LOCKED_DESCENDANT'), true);
  }
});

test('Canvas Protocol rejects unsupported resize targets and a missing page scope', () => {
  const pageId = 'page:main';
  const note = { id: 'shape:note', type: 'note', x: 0, y: 0, w: 200, h: 120, rotation: 0, opacity: 1, parent_id: pageId, semantic_id: 'note', props: {} };
  const group = { ...note, id: 'shape:group', type: 'group', semantic_id: 'group' };
  for (const item of [note, group]) {
    const result = planCanvasOps([item], [{ op: 'resize', id: item.id, w: 400, h: 300 }], pageId);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === 'UNSUPPORTED_RESIZE_TARGET'), true);
  }
  const missingPage = planCanvasOps([note], [{ op: 'update', id: note.id, x: 10 }]);
  assert.equal(missingPage.ok, false);
  assert.equal(missingPage.errors[0].code, 'INVALID_PAGE_ID');
});

test('Canvas Protocol refuses grouping rotated targets whose derived bounds are ambiguous', () => {
  const pageId = 'page:main';
  const items = [
    { id: 'shape:a', type: 'geo', x: 0, y: 0, w: 100, h: 80, rotation: Math.PI / 4, parent_id: pageId, semantic_id: 'a' },
    { id: 'shape:b', type: 'geo', x: 200, y: 0, w: 100, h: 80, rotation: 0, parent_id: pageId, semantic_id: 'b' },
  ];
  const result = planCanvasOps(items, [{ op: 'group', ids: ['shape:a', 'shape:b'], semantic_id: 'group:ab' }], pageId);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'ROTATED_LAYOUT_TARGET'), true);
});

test('Canvas Protocol refuses rotation changes when inspected bounds cannot recover local geometry', () => {
  const pageId = 'page:main';
  const inspectedAabb = {
    id: 'shape:rotated-edge',
    type: 'geo',
    kind: 'rectangle',
    x: 99_820,
    y: 0,
    w: Math.SQRT1_2 * 250,
    h: Math.SQRT1_2 * 250,
    rotation: Math.PI / 4,
    parent_id: pageId,
    semantic_id: 'rotated-edge',
  };
  const result = planCanvasOps(
    [inspectedAabb],
    [{ op: 'update', id: inspectedAabb.id, rotation: 0 }],
    pageId,
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'ROTATED_UPDATE_TARGET'), true);
});

test('capability search exposes example references and the bounded composable canvas action', () => {
  const example = searchCapabilities({ kind: 'example', query: 'image annotator', page_size: 20 });
  assert.deepEqual(example.results.map((entry) => entry.id), ['tldraw-example.use-cases.image-annotator']);
  assert.equal(example.results[0].status, 'callable');
  assert.deepEqual(example.results[0].mapped_capability_ids, []);
  assert.equal(example.results[0].route.family, 'local_material_artifact');
  assert.equal(example.results[0].route.callable, true);

  const canvasOps = searchCapabilities({ kind: 'action', query: 'align distribute draw group reorder', page_size: 20 });
  assert.equal(canvasOps.results.some((entry) => entry.id === 'canvas_ops'), true);

  const actionItems = PROPOSAL_INPUT_SCHEMA.properties.actions.items.oneOf;
  assert.equal(actionItems.some((schema) => schema.properties.type.const === 'canvas_ops'), true);
});

test('canvas_ops mixes bounded drawing and layout commands but fails closed on malformed or locked targets', () => {
  const context = {
    current_revision: 'rev-canvas-ops',
    page_id: 'page:main',
    items: [
      { id: 'shape:a', type: 'geo', kind: 'rectangle', x: 20, y: 30, w: 100, h: 80, rotation: 0, parent_id: 'page:main', is_locked: false, props: { color: 'black', fill: 'none' } },
      { id: 'shape:b', type: 'geo', kind: 'ellipse', x: 240, y: 80, w: 120, h: 90, rotation: 0, parent_id: 'page:main', is_locked: false, props: { color: 'blue', fill: 'semi' } },
    ],
  };
  const valid = validateProposal({
    base_revision: context.current_revision,
    summary: 'Sketch and arrange two ideas',
    actions: [{
      type: 'canvas_ops',
      ops: [
        { op: 'draw', semantic_id: 'sketch:thread', points: [{ x: 20, y: 20 }, { x: 80, y: 60 }, { x: 160, y: 40 }], color: 'red' },
        { op: 'align', ids: ['shape:a', 'shape:b'], axis: 'top' },
        { op: 'reorder', ids: ['shape:a'], position: 'front' },
      ],
    }],
  }, context);
  assert.equal(valid.ok, true);
  assert.equal(valid.proposal.actions[0].ops.length, 3);
  assert.equal(valid.diff.adds.shapes, 1);
  assert.equal(valid.diff.moves[0].changes.some((change) => change.id === 'shape:b'), true);

  const malformed = validateProposal({
    base_revision: context.current_revision,
    summary: 'Bad path',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'draw', semantic_id: 'sketch:bad', points: [{ x: 0, y: 0 }] }] }],
  }, context);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors.some((error) => error.code === 'INVALID_DRAW_POINTS'), true);

  const locked = validateProposal({
    base_revision: context.current_revision,
    summary: 'Do not move locked matter',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'align', ids: ['shape:a', 'shape:b'], axis: 'left' }] }],
  }, { ...context, items: context.items.map((item) => item.id === 'shape:b' ? { ...item, is_locked: true } : item) });
  assert.equal(locked.ok, false);
  assert.equal(locked.errors.some((error) => error.code === 'LOCKED_TARGET'), true);
});
