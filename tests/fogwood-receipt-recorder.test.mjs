import assert from 'node:assert/strict';
import test from 'node:test';

import { createFogwoodReceiptRecorder, validateRecipePackageAlignment } from '../app/fogwood-receipt-recorder.ts';
import { readBazaar } from '../app/fogwood-bazaar.ts';
import { createReceiptLedger } from '../app/fogwood-receipts.ts';
import { getRecipe } from '../app/fogwood-runtime.ts';

function setup() {
  let stored = null;
  let id = 0;
  const writes = [];
  const ledger = createReceiptLedger({
    storage: {
      read: () => stored,
      write: (value) => {
        stored = value;
        writes.push(value);
      },
    },
    clock: () => `2026-08-27T12:00:0${id}.000Z`,
    idSource: () => `receipt:${id++}`,
  });
  return { ledger, recorder: createFogwoodReceiptRecorder({ ledger }), writes };
}

const genericProposal = Object.freeze({
  base_revision: 'revision:before',
  summary: 'Add one bounded note',
  actions: [{ type: 'add_blocks', blocks: [{ kind: 'text', body: 'Review me' }] }],
});

const recipeProposal = Object.freeze({
  base_revision: 'revision:before',
  summary: 'Review Evidence Map',
  actions: [{ type: 'insert_recipe', recipe_id: 'evidence-research-map', version: 1 }],
});

test('generic proposal lifecycle writes one exact append-only receipt per accepted transition', () => {
  const { ledger, recorder, writes } = setup();
  const staged = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(staged.ok, true);
  assert.equal(staged.receipts.length, 1);
  assert.equal(staged.receipts[0].event, 'proposal-staged');

  const applied = recorder.recordProposalLifecycle({
    type: 'proposal-applied',
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
    result_revision: 'revision:after',
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.receipts[0].event, 'proposal-applied');
  assert.equal(applied.receipts[0].result_revision, 'revision:after');
  assert.equal(writes.length, 2);
  assert.deepEqual(ledger.list({ newest_first: false }).receipts.map((receipt) => receipt.event), [
    'proposal-staged',
    'proposal-applied',
  ]);
});

test('recipe lifecycle commits proposal and exact runtime/package evidence atomically in action order', () => {
  const { ledger, recorder, writes } = setup();
  const staged = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: recipeProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(staged.ok, true);
  assert.equal(writes.length, 1);
  assert.deepEqual(staged.receipts.map((receipt) => receipt.event), ['proposal-staged', 'recipe-staged']);
  const recipeReceipt = staged.receipts[1];
  assert.equal(recipeReceipt.recipe.id, 'evidence-research-map');
  assert.match(recipeReceipt.recipe.hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(recipeReceipt.package.id, 'fogwood.evidence-research-map');
  assert.match(recipeReceipt.package.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(recipeReceipt.proposal, staged.receipts[0].proposal);

  const inserted = recorder.recordProposalLifecycle({
    type: 'proposal-applied',
    proposal: recipeProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
    result_revision: 'revision:after',
  });
  assert.equal(inserted.ok, true);
  assert.equal(writes.length, 2);
  assert.deepEqual(inserted.receipts.map((receipt) => receipt.event), ['proposal-applied', 'recipe-inserted']);
  assert.equal(inserted.receipts[1].result_revision, 'revision:after');
  assert.equal(ledger.list().total, 4);
});

test('composition.v2 recipe lifecycle pins format content and exact package identity', () => {
  const { recorder, writes } = setup();
  const proposal = {
    base_revision: 'revision:before',
    summary: 'Stage Fungi Cities Research World',
    actions: [{ type: 'insert_recipe', recipe_id: 'fogwood.fungi-cities-research-world', version: 2 }],
  };
  const staged = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(staged.ok, true);
  assert.equal(writes.length, 1);
  const recipe = staged.receipts.find((receipt) => receipt.event === 'recipe-staged');
  assert.ok(recipe);
  assert.deepEqual(recipe.recipe, {
    id: 'fogwood.fungi-cities-research-world',
    version: 2,
    hash: recipe.recipe.hash,
  });
  assert.match(recipe.recipe.hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(recipe.package, {
    id: 'fogwood.fungi-cities-research-world',
    version: 2,
    content_hash: recipe.package.content_hash,
  });
  assert.match(recipe.package.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(ledgerEventCount(staged.receipts, 'recipe-staged'), 1);
});

function ledgerEventCount(receipts, event) {
  return receipts.filter((receipt) => receipt.event === event).length;
}

test('Compare receipt evidence pins the aligned 12-block package rather than the retired preview', () => {
  const { recorder } = setup();
  const proposal = {
    base_revision: 'revision:before',
    summary: 'Review Compare & Decide',
    actions: [{ type: 'insert_recipe', recipe_id: 'compare-and-decide', version: 1 }],
  };
  const result = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(result.ok, true);
  const recipe = result.receipts.find((receipt) => receipt.event === 'recipe-staged');
  assert.equal(recipe.recipe.id, 'compare-and-decide');
  assert.equal(recipe.package.id, 'fogwood.compare-decision');
  assert.equal(recipe.package.content_hash, 'sha256:60225ee7de4b53151218f604c6d8c8dccd78a9bb6c28872ea702fc973f54ec7d');
});

test('Compare alignment includes the exact typed graph and deterministic expected results', () => {
  const runtime = getRecipe('compare-and-decide', 1);
  const packageRead = readBazaar({ id: 'fogwood.compare-decision', version: 1, include: ['recipes'] });
  assert.equal(packageRead.ok, true);
  const packaged = packageRead.sections.recipes[0].content;
  assert.equal(validateRecipePackageAlignment(runtime, packaged), true);
  const staleGraph = structuredClone(packaged);
  staleGraph.instrument_projection.instances[0].input_values.value = 0.5;
  assert.equal(validateRecipePackageAlignment(runtime, staleGraph), false);
  const staleExpected = structuredClone(packaged);
  staleExpected.instrument_projection.expected.beta_score = 79;
  assert.equal(validateRecipePackageAlignment(runtime, staleExpected), false);
});

test('reject and snapshot evidence stay local, while unknown recipe evidence fails before any write', () => {
  const { ledger, recorder, writes } = setup();
  const rejected = recorder.recordProposalLifecycle({
    type: 'proposal-rejected',
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.receipts[0].event, 'proposal-rejected');

  const snapshot = recorder.recordSnapshot({
    source_revision: 'revision:before',
    artifact: { format: 'image/svg+xml', hash: `sha256:${'ab'.repeat(32)}` },
  });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.receipts[0].event, 'snapshot-exported');
  assert.equal(
    snapshot.receipts[0].qualification_boundary,
    'device-local SVG bytes were created and pinned; a separate page-owned download attempt may follow; this receipt does not prove a download request or file persistence',
  );

  const before = writes.length;
  const unknown = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: { ...recipeProposal, actions: [{ type: 'insert_recipe', recipe_id: 'unknown-recipe', version: 1 }] },
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 'RECIPE_EVIDENCE_ERROR');
  assert.equal(writes.length, before);
  assert.equal(ledger.list().total, 2);
});
