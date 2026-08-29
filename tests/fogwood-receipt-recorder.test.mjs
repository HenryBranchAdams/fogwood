import assert from 'node:assert/strict';
import test from 'node:test';

import { createFogwoodReceiptRecorder } from '../app/fogwood-receipt-recorder.ts';
import {
  createProposalRejectedReceipt,
  createReceiptLedger,
  hashReceiptProposalEvidenceIdentity,
  hashReceiptSeededEvidence,
} from '../app/fogwood-receipts.ts';
import { validateProposal } from '../app/fogwood-runtime.ts';

function setup(initial = null) {
  let stored = initial;
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
    clock: () => `2026-08-27T12:00:${String(id).padStart(2, '0')}.000Z`,
    idSource: () => `receipt:${id++}`,
  });
  return {
    ledger,
    recorder: createFogwoodReceiptRecorder({ ledger }),
    writes,
    readStored: () => stored,
  };
}

const genericProposal = Object.freeze({
  base_revision: 'revision:before',
  summary: 'Add one bounded note',
  actions: [{
    type: 'canvas_ops',
    ops: [{ op: 'create', semantic_id: 'idea:one', kind: 'note', x: 20, y: 30, w: 160, h: 100, text: 'Review me' }],
  }],
});

test('generic proposal lifecycle writes exactly one receipt per accepted transition', () => {
  const { ledger, recorder, writes } = setup();
  const planId = `sha256:${'a'.repeat(64)}`;
  const staged = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    plan_id: planId,
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(staged.ok, true);
  assert.deepEqual(staged.receipts.map((receipt) => receipt.event), ['proposal-staged']);
  assert.equal(staged.receipts[0].plan_id, planId);

  const applied = recorder.recordProposalLifecycle({
    type: 'proposal-applied',
    plan_id: planId,
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
    result_revision: 'revision:after',
  });
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.receipts.map((receipt) => receipt.event), ['proposal-applied']);
  assert.equal(applied.receipts[0].result_revision, 'revision:after');
  assert.equal(applied.receipts[0].plan_id, planId);

  const rejected = recorder.recordProposalLifecycle({
    type: 'proposal-rejected',
    plan_id: planId,
    proposal: genericProposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(rejected.ok, true);
  assert.deepEqual(rejected.receipts.map((receipt) => receipt.event), ['proposal-rejected']);
  assert.equal(rejected.receipts[0].plan_id, planId);
  assert.equal(writes.length, 3);
  assert.deepEqual(ledger.list({ newest_first: false }).receipts.map((receipt) => receipt.event), [
    'proposal-staged',
    'proposal-applied',
    'proposal-rejected',
  ]);
});

test('seeded lifecycle receipts retain and bind replay and lineage evidence', () => {
  const context = {
    current_revision: 'revision:seeded',
    page_id: 'page:main',
    selection_semantic_ids: ['idea:a'],
    selection_complete: true,
    selection_total: 1,
    items: [{
      id: 'shape:a', type: 'geo', x: 40, y: 60, w: 180, h: 100, rotation: 0,
      parent_id: 'page:main', is_locked: false, semantic_id: 'idea:a',
      meta: { semantic_id_source: 'stable' }, props: { color: 'blue', fill: 'solid' },
    }],
  };
  const validated = validateProposal({
    base_revision: context.current_revision,
    summary: 'Seed a preserved variant',
    actions: [{ type: 'seeded_composition', scope: { kind: 'selection' }, seed: 'receipt-seed', wildness: 0.65 }],
  }, context);
  assert.equal(validated.ok, true);
  const { recorder } = setup();
  const result = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: validated.proposal,
    source_revision: context.current_revision,
    base_revision: context.current_revision,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.receipts.map((receipt) => receipt.event), ['proposal-staged']);
  const receipt = result.receipts[0];
  assert.equal(receipt.seeded_evidence.length, 1);
  assert.deepEqual(receipt.seeded_evidence[0], {
    grammar: 'remix',
    algorithm_version: 1,
    prng: 'xorshift32-v1',
    seed: 'receipt-seed',
    wildness: 0.65,
    source_revision: 'revision:seeded',
    source_fingerprint: validated.proposal.actions[0].source_fingerprint,
    layout: validated.proposal.actions[0].layout,
    lineage: validated.proposal.actions[0].lineage,
  });
  assert.equal(receipt.proposal.seeded_evidence_hash, hashReceiptSeededEvidence(receipt.seeded_evidence));
  assert.match(receipt.proposal.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(receipt.proposal.hash, receipt.proposal.content_hash);
  assert.equal(receipt.proposal.hash, hashReceiptProposalEvidenceIdentity({
    content_hash: receipt.proposal.content_hash,
    seeded_evidence_hash: receipt.proposal.seeded_evidence_hash,
  }));
});

test('snapshot evidence remains available as an independent local receipt seam', () => {
  const { recorder } = setup();
  const result = recorder.recordSnapshot({
    source_revision: 'revision:before',
    artifact: { format: 'image/svg+xml', hash: `sha256:${'ab'.repeat(32)}` },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.receipts.map((receipt) => receipt.event), ['snapshot-exported']);
  assert.equal(result.receipts[0].qualification_boundary, 'device-local SVG bytes were created and pinned; a separate page-owned download attempt may follow; this receipt does not prove a download request or file persistence');
});

test('serialized v1 ledgers with recipe and snapshot events remain readable, appendable, and sequence-stable', () => {
  const hash = `sha256:${'cd'.repeat(32)}`;
  const legacy = JSON.stringify({
    schema_version: 1,
    receipts: [
      {
        schema_version: 1,
        receipt_id: 'legacy:recipe',
        sequence: 7,
        recorded_at: '2026-08-27T11:00:00.000Z',
        authority: 'evidence-only',
        locality: 'device-local',
        event: 'recipe-staged',
        recipe: { id: 'legacy.recipe', version: 1, hash },
        package: { id: 'fogwood.legacy.recipe', version: 1, content_hash: hash },
        source_revision: 'revision:legacy',
        base_revision: 'revision:legacy',
        outcome: 'staged',
        qualification_boundary: 'legacy local recipe evidence',
        warnings: [],
        loss: [],
      },
      {
        schema_version: 1,
        receipt_id: 'legacy:snapshot',
        sequence: 8,
        recorded_at: '2026-08-27T11:01:00.000Z',
        authority: 'evidence-only',
        locality: 'device-local',
        event: 'snapshot-exported',
        source_revision: 'revision:legacy',
        artifact: { format: 'image/svg+xml', hash },
        outcome: 'exported',
        qualification_boundary: 'legacy local snapshot evidence',
        warnings: [],
        loss: [],
      },
    ],
  });
  const { ledger, writes, readStored } = setup(legacy);
  const before = ledger.list({ newest_first: false });
  assert.equal(before.ok, true);
  assert.deepEqual(before.receipts.map((receipt) => [receipt.event, receipt.sequence]), [
    ['recipe-staged', 7],
    ['snapshot-exported', 8],
  ]);
  const append = ledger.append(createProposalRejectedReceipt({
    proposal: { id: 'proposal:legacy-followup', version: 1, hash },
    source_revision: 'revision:legacy',
    base_revision: 'revision:legacy',
    outcome: 'rejected',
    qualification_boundary: 'follow-up local evidence',
  }));
  assert.equal(append.ok, true);
  assert.equal(append.receipt.sequence, 9);
  assert.equal(writes.length, 1);
  const persisted = JSON.parse(readStored());
  assert.deepEqual(persisted.receipts.slice(0, 2).map((receipt) => receipt.receipt_id), ['legacy:recipe', 'legacy:snapshot']);
  assert.equal(persisted.receipts[2].event, 'proposal-rejected');
  assert.equal(ledger.list({ newest_first: false }).total, 3);
});
