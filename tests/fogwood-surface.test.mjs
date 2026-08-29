import assert from 'node:assert/strict';
import test from 'node:test';
import { createFogwoodSurface } from '../app/fogwood-surface.ts';

const proposal = {
  base_revision: 'rev:1',
  summary: 'Place one native idea',
  actions: [{ type: 'canvas_ops', ops: [] }],
};

const diff = {
  adds: { blocks: 0, shapes: 0, materials: 0, total: 0, specs: [], material_specs: [] },
  updates: [],
  moves: [],
  spatial_moves: [],
  spatial_creates: [],
  semantic_relationships: [],
  removes: { ids: [], total: 0, collateral_ids: [], descriptors: [] },
  seeded_compositions: [],
  counts: { before: 0, after: 0, adds: 0, updates: 0, moves: 0, removes: 0 },
  warnings: [],
};

function planFor(preparedMaterials = []) {
  return Object.freeze({
    schema: 'fogwood.prepared-canvas-plan.v1',
    plan_id: `sha256:${'1'.repeat(64)}`,
    page_id: 'page:main',
    proposal,
    diff,
    base_revision: 'rev:1',
    content_revision: 'rev:1',
    context_token: 'context:a',
    actions: Object.freeze(proposal.actions),
    operations: Object.freeze([]),
    lowerings: Object.freeze([]),
    prepared_materials: Object.freeze(preparedMaterials),
    seeded_evidence: Object.freeze([]),
    material_evidence: Object.freeze([]),
    preflight: Object.freeze({
      status: 'passed',
      page_id: 'page:main',
      content_revision: 'rev:1',
      target_count: 0,
      material_decode: 'complete',
      plan_lowering: 'complete',
    }),
    transaction: Object.freeze({
      contract_version: 1,
      authority: 'page-owned',
      atomic: true,
      editor_run: 'one',
      history: 'one-stopping-point',
      undo: 'one-step',
      apply: 'frozen-lowerings-only',
      reject: 'no-mutation',
    }),
    digest: 'digest:1',
  });
}

test('FogwoodSurface prepares before stage, keeps one pending plan, and exposes page decisions', () => {
  let revision = 'rev:1';
  let context = 'context:a';
  let prepared = 0;
  let applied = 0;
  const states = [];
  const surface = createFogwoodSurface({
    getRevision: () => revision,
    getContextToken: () => context,
    prepare: () => {
      prepared += 1;
      return planFor();
    },
    apply: (plan) => {
      assert.equal(plan.digest, 'digest:1');
      applied += 1;
      return { ok: true };
    },
  }, (state) => states.push(state));

  assert.deepEqual(surface.read(), { content_revision: 'rev:1', context_token: 'context:a' });
  assert.equal(surface.stage({ proposal, diff }).status, 'STAGED');
  assert.equal(prepared, 1);
  assert.equal(surface.getState().plan.digest, 'digest:1');
  assert.equal(surface.stage(proposal, diff).status, 'ALREADY_STAGED');
  assert.equal(prepared, 1);

  // Ephemeral context changes do not invalidate the content-bound plan.
  context = 'context:b';
  assert.equal(surface.decide('apply').status, 'APPLIED');
  assert.equal(applied, 1);
  assert.equal(surface.getState(), null);
  assert.equal(states.at(-1), null);
});

test('FogwoodSurface refuses stale content at decision and reject is a no-op', () => {
  let revision = 'rev:1';
  let applied = 0;
  const surface = createFogwoodSurface({
    getRevision: () => revision,
    prepare: () => planFor(),
    apply: () => {
      applied += 1;
      return { ok: true };
    },
  });

  assert.equal(surface.stage(proposal, diff).status, 'STAGED');
  revision = 'rev:2';
  assert.equal(surface.apply().status, 'STALE_STATE');
  assert.equal(applied, 0);
  assert.equal(surface.reject().status, 'REJECTED');
  assert.equal(surface.getState(), null);

  const staleAtStage = createFogwoodSurface({
    getRevision: () => 'rev:2',
    prepare: () => planFor(),
    apply: () => ({ ok: true }),
  });
  assert.equal(staleAtStage.stage(proposal, diff).status, 'STALE_STATE');
  assert.equal(staleAtStage.getState(), null);
});

test('FogwoodSurface fails closed on an unknown page decision without discarding review state', () => {
  const surface = createFogwoodSurface({
    getRevision: () => 'rev:1',
    prepare: () => planFor(),
    apply: () => ({ ok: true }),
  });

  assert.equal(surface.stage(proposal, diff).status, 'STAGED');
  const pending = surface.getState();
  const result = surface.decide({});
  assert.equal(result.status, 'ERROR');
  assert.equal(result.state, pending);
  assert.equal(surface.getState(), pending);
});

test('FogwoodSurface retains prepared material identity inside the frozen plan', () => {
  const material = Object.freeze({ semantic_id: 'material:one' });
  let captured;
  const surface = createFogwoodSurface({
    getRevision: () => 'rev:1',
    prepare: () => planFor([material]),
    apply: (plan) => {
      captured = plan.prepared_materials[0];
      return { ok: true };
    },
  });
  assert.equal(surface.stage(proposal, diff).status, 'STAGED');
  assert.equal(surface.apply().status, 'APPLIED');
  assert.equal(captured, material);
});
