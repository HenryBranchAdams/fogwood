import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECEIPT_LEDGER_SCHEMA_VERSION,
  RECEIPT_STORAGE_KEY,
  createReceiptLedger,
  createProposalStagedReceipt,
  createProposalAppliedReceipt,
  createProposalRejectedReceipt,
  createRecipeStagedReceipt,
  createRecipeInsertedReceipt,
  createSnapshotExportedReceipt,
  hashReceiptProposalEvidenceIdentity,
  hashReceiptSeededEvidence,
} from '../app/fogwood-receipts.ts';

function memoryStorage(initial = null) {
  let value = initial;
  const writes = [];
  return {
    adapter: {
      read: () => value,
      write: (next) => {
        writes.push(next);
        value = next;
      },
    },
    get value() {
      return value;
    },
    writes,
  };
}

const identities = {
  proposal: { id: 'proposal:1', version: 1, hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' },
  package: { id: 'evidence-map', version: '1.0.0', content_hash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222' },
  recipe: { id: 'evidence-research-map', version: 1, hash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333' },
};

function makeLedger(storage = memoryStorage(), overrides = {}) {
  let tick = 0;
  return {
    storage,
    ledger: createReceiptLedger({
      storage: storage.adapter,
      clock: () => `2026-08-27T12:00:0${tick++}.000Z`,
      idSource: () => `receipt:${tick}`,
      ...overrides,
    }),
  };
}

test('receipt constructors cover every event kind and preserve exact evidence fields', () => {
  const draftInputs = [
    createProposalStagedReceipt({
      ...identities,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local proposal evidence; human Apply or Reject remains required',
      warnings: ['normalized anchor'],
      loss: ['no remote publication'],
    }),
    createProposalAppliedReceipt({
      ...identities,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      result_revision: 'rev:result',
      outcome: 'applied',
      qualification_boundary: 'device-local apply evidence only',
    }),
    createProposalRejectedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'rejected',
      qualification_boundary: 'device-local rejection evidence only',
      reason: 'Human rejected the proposal.',
    }),
    createRecipeStagedReceipt({
      recipe: identities.recipe,
      package: identities.package,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local recipe proposal evidence only',
    }),
    createRecipeInsertedReceipt({
      recipe: identities.recipe,
      package: identities.package,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      result_revision: 'rev:result',
      outcome: 'inserted',
      qualification_boundary: 'device-local insertion evidence only',
    }),
    createSnapshotExportedReceipt({
      source_revision: 'rev:result',
      outcome: 'exported',
      qualification_boundary: 'device-local artifact export evidence only',
      artifact: { format: 'application/json', hash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444' },
    }),
  ];
  assert.deepEqual(draftInputs.map((draft) => draft.event), [
    'proposal-staged',
    'proposal-applied',
    'proposal-rejected',
    'recipe-staged',
    'recipe-inserted',
    'snapshot-exported',
  ]);
  assert.deepEqual(draftInputs[0].proposal, identities.proposal);
  assert.deepEqual(draftInputs[0].package, identities.package);
  assert.deepEqual(draftInputs[3].recipe, identities.recipe);
  const contentHashPackage = createRecipeStagedReceipt({
    recipe: { id: identities.recipe.id, version: identities.recipe.version, content_hash: identities.recipe.hash },
    package: { id: identities.package.id, version: identities.package.version, content_hash: identities.package.content_hash },
    source_revision: 'rev:source',
    base_revision: 'rev:base',
    outcome: 'staged',
    qualification_boundary: 'device-local recipe proposal evidence only',
  });
  assert.equal(contentHashPackage.package.content_hash, identities.package.content_hash);
  assert.equal(draftInputs[5].artifact.format, 'application/json');
  assert.equal(draftInputs[5].artifact.hash, 'sha256:4444444444444444444444444444444444444444444444444444444444444444');
});

test('append is schema-versioned, injected, append-only, ordered newest-first, and exact on round-trip', () => {
  const storage = memoryStorage();
  let now = 0;
  let nextId = 0;
  const ledger = createReceiptLedger({
    storage: storage.adapter,
    clock: () => `2026-08-27T12:00:0${now++}.000Z`,
    idSource: () => `receipt:${nextId++}`,
  });
  const first = ledger.append(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
  }));
  assert.equal(first.ok, true);
  const firstRecord = first.receipt;
  const firstStored = JSON.parse(storage.value);
  assert.equal(firstStored.schema_version, RECEIPT_LEDGER_SCHEMA_VERSION);
  assert.equal(firstStored.receipts.length, 1);
  assert.equal(firstRecord.schema_version, 1);
  assert.equal(firstRecord.authority, 'evidence-only');
  assert.equal(firstRecord.locality, 'device-local');
  assert.equal(firstRecord.source_revision, 'rev:1');
  assert.equal(firstRecord.base_revision, 'rev:1');
  const second = ledger.append(createProposalRejectedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'rejected',
    qualification_boundary: 'device-local evidence only',
  }));
  assert.equal(second.ok, true);
  assert.equal(second.receipt.receipt_id, 'receipt:1');
  assert.equal(second.receipt.recorded_at, '2026-08-27T12:00:01.000Z');
  assert.equal(second.receipt.sequence, 2);
  assert.deepEqual(JSON.parse(storage.value).receipts[0], firstRecord);
  assert.deepEqual(ledger.list({ limit: 1 }), {
    ok: true,
    receipts: [second.receipt],
    total: 2,
    has_more: true,
    next_cursor: '1',
  });
  assert.deepEqual(ledger.list({ limit: 10, cursor: '1' }), {
    ok: true,
    receipts: [firstRecord],
    total: 2,
    has_more: false,
  });
  assert.deepEqual(JSON.parse(storage.value).receipts, [firstRecord, second.receipt]);
  assert.equal(RECEIPT_STORAGE_KEY, 'fogwood-receipts-local:v1');
});

test('records and caller-owned inputs are deeply immutable', () => {
  const storage = memoryStorage();
  const { ledger } = makeLedger(storage);
  const draft = createRecipeStagedReceipt({
    recipe: identities.recipe,
    package: identities.package,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
    warnings: ['review'],
  });
  const appended = ledger.append(draft);
  assert.equal(appended.ok, true);
  assert.equal(Object.isFrozen(appended.receipt), true);
  assert.equal(Object.isFrozen(appended.receipt.recipe), true);
  assert.equal(Object.isFrozen(appended.receipt.warnings), true);
  assert.throws(() => {
    draft.warnings.push('caller mutation');
  }, TypeError);
  assert.throws(() => {
    appended.receipt.recipe.id = 'tampered';
  }, TypeError);
  assert.equal(ledger.list().receipts[0].recipe.id, identities.recipe.id);
});

test('malformed JSON, malformed records, unknown fields, and duplicate IDs fail visibly without mutation', () => {
  for (const initial of [
    '{not-json',
    JSON.stringify({ schema_version: 1, receipts: [{ schema_version: 1, event: 'proposal-staged' }] }),
    JSON.stringify({ schema_version: 1, receipts: [{ schema_version: 1, event: 'proposal-staged', receipt_id: 'r', recorded_at: 'x', sequence: 1, locality: 'remote', authority: 'evidence-only', source_revision: 's', base_revision: 'b', outcome: 'staged', qualification_boundary: 'x', warnings: [], loss: [], proposal: identities.proposal }] }),
  ]) {
    const storage = memoryStorage(initial);
    const { ledger } = makeLedger(storage);
    const before = storage.value;
    const read = ledger.list();
    assert.equal(read.ok, false);
    assert.match(read.status, /MALFORMED_STORAGE/);
    assert.equal(storage.value, before);
    assert.equal(storage.writes.length, 0);
    const append = ledger.append(createProposalStagedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:1',
      base_revision: 'rev:1',
      outcome: 'staged',
      qualification_boundary: 'device-local evidence only',
    }));
    assert.equal(append.ok, false);
    assert.match(append.status, /MALFORMED_STORAGE/);
    assert.equal(storage.writes.length, 0);
  }

  const duplicate = memoryStorage();
  const { ledger: duplicateLedger } = makeLedger(duplicate, { idSource: () => 'same-id' });
  const draft = createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
  });
  assert.equal(duplicateLedger.append(draft).ok, true);
  const before = duplicate.value;
  const rejected = duplicateLedger.append(draft);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 'DUPLICATE_RECEIPT_ID');
  assert.equal(duplicate.value, before);
  assert.equal(duplicate.writes.length, 1);
});

test('storage order and adapter failures are explicit and never create a synthetic receipt', () => {
  const valid = memoryStorage();
  let now = 0;
  let id = 0;
  const writer = createReceiptLedger({
    storage: valid.adapter,
    clock: () => `2026-08-27T12:01:0${now++}.000Z`,
    idSource: () => `ordered:${id++}`,
  });
  assert.equal(writer.append(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
  })).ok, true);
  const record = JSON.parse(valid.value).receipts[0];
  const unordered = memoryStorage(JSON.stringify({
    schema_version: 1,
    receipts: [{ ...record, sequence: 2 }, { ...record, receipt_id: 'ordered:1', sequence: 1 }],
  }));
  const badOrderLedger = createReceiptLedger({ storage: unordered.adapter, clock: () => 'later', idSource: () => 'never' });
  const before = unordered.value;
  const result = badOrderLedger.list();
  assert.equal(result.ok, false);
  assert.equal(result.status, 'MALFORMED_STORAGE');
  assert.equal(result.error.code, 'UNORDERED_RECEIPTS');
  assert.equal(unordered.value, before);
  assert.equal(unordered.writes.length, 0);

  const readFailureStorage = {
    adapter: { read: () => { throw new Error('read'); }, write: () => { throw new Error('write'); } },
  };
  const readFailure = createReceiptLedger({ storage: readFailureStorage.adapter, clock: () => 'later', idSource: () => 'never' });
  const failure = readFailure.append(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
  }));
  assert.equal(failure.ok, false);
  assert.equal(failure.status, 'STORAGE_ERROR');
  assert.equal(failure.error.code, 'READ_FAILED');
});

test('bounds are visible: reads cap pages, malformed input is rejected, and full ledgers never evict evidence', () => {
  const storage = memoryStorage();
  let id = 0;
  const { ledger } = makeLedger(storage, {
    idSource: () => `receipt:${id++}`,
    limits: { max_records: 2, max_serialized_bytes: 100000, max_warnings: 2, max_loss_entries: 2 },
  });
  const draft = () => createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
  });
  assert.equal(ledger.append(draft()).ok, true);
  assert.equal(ledger.append(draft()).ok, true);
  const before = storage.value;
  const full = ledger.append(draft());
  assert.equal(full.ok, false);
  assert.equal(full.status, 'LEDGER_FULL');
  assert.equal(full.error.code, 'MAX_RECORDS');
  assert.equal(storage.value, before);
  assert.equal(storage.writes.length, 2);

  const tooManyWarnings = ledger.validate(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:1',
    base_revision: 'rev:1',
    outcome: 'staged',
    qualification_boundary: 'device-local evidence only',
    warnings: ['a', 'b', 'c'],
  }));
  assert.equal(tooManyWarnings.ok, false);
  assert.equal(tooManyWarnings.status, 'INVALID_RECEIPT');
  assert.equal(tooManyWarnings.errors.some((error) => error.code === 'WARNINGS_LIMIT'), true);
});

test('event-specific revision, identity, artifact, and authority invariants are validated', () => {
  const { ledger } = makeLedger();
  const invalids = [
    { event: 'proposal-applied', source_revision: 's', base_revision: 'b', outcome: 'applied', qualification_boundary: 'device-local' },
    { event: 'proposal-rejected', source_revision: 's', base_revision: 'b', result_revision: 'r', outcome: 'rejected', qualification_boundary: 'device-local', proposal: identities.proposal },
    { event: 'snapshot-exported', source_revision: 's', outcome: 'exported', qualification_boundary: 'device-local' },
    { event: 'recipe-staged', source_revision: 's', base_revision: 'b', outcome: 'staged', qualification_boundary: 'device-local' },
    { event: 'proposal-staged', source_revision: 's', base_revision: 'b', outcome: 'staged', qualification_boundary: 'device-local', proposal: { id: 'p', version: 1, hash: '' } },
    { event: 'proposal-staged', source_revision: 's', base_revision: 'b', outcome: 'staged', qualification_boundary: 'device-local', proposal: identities.proposal, authority: 'can-apply' },
  ];
  for (const input of invalids) {
    const result = ledger.validate(input);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(result.status, 'INVALID_RECEIPT');
  }
  const valid = ledger.validate(createSnapshotExportedReceipt({
    source_revision: 's',
    outcome: 'exported',
    qualification_boundary: 'device-local',
    artifact: { format: 'application/json', hash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555' },
  }));
  assert.equal(valid.ok, true);
  assert.equal(valid.receipt.authority, 'evidence-only');
  assert.equal(valid.receipt.locality, 'device-local');
});

test('event constructors and validation preserve exact outcomes and event evidence', () => {
  const { ledger } = makeLedger();
  const validByEvent = [
    createProposalStagedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local',
    }),
    createProposalAppliedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      result_revision: 'rev:result',
      outcome: 'applied',
      qualification_boundary: 'device-local',
    }),
    createProposalRejectedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'rejected',
      qualification_boundary: 'device-local',
    }),
    createRecipeStagedReceipt({
      recipe: identities.recipe,
      package: identities.package,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local',
    }),
    createRecipeInsertedReceipt({
      recipe: identities.recipe,
      package: identities.package,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      result_revision: 'rev:result',
      outcome: 'inserted',
      qualification_boundary: 'device-local',
    }),
    createSnapshotExportedReceipt({
      source_revision: 'rev:result',
      outcome: 'exported',
      qualification_boundary: 'device-local',
      artifact: { format: 'application/json', hash: 'sha256:6666666666666666666666666666666666666666666666666666666666666666' },
    }),
  ];
  const expected = [
    ['proposal-staged', 'staged'],
    ['proposal-applied', 'applied'],
    ['proposal-rejected', 'rejected'],
    ['recipe-staged', 'staged'],
    ['recipe-inserted', 'inserted'],
    ['snapshot-exported', 'exported'],
  ];
  validByEvent.forEach((draft, index) => {
    assert.deepEqual([draft.event, draft.outcome], expected[index]);
    const result = ledger.validate(draft);
    assert.equal(result.ok, true, `${draft.event} should validate`);
  });

  const mismatchedOutcomes = validByEvent.map((draft) => ({
    ...draft,
    outcome: draft.outcome === 'staged' ? 'applied' : 'staged',
  }));
  mismatchedOutcomes.forEach((draft) => {
    const result = ledger.validate(draft);
    assert.equal(result.ok, false, draft.event);
    assert.equal(result.errors.some((error) => error.code === 'EVENT_OUTCOME_MISMATCH'), true, draft.event);
  });

  const missingRecipePackage = ledger.validate({
    event: 'recipe-staged',
    recipe: identities.recipe,
    source_revision: 'rev:source',
    base_revision: 'rev:base',
    outcome: 'staged',
    qualification_boundary: 'device-local',
  });
  assert.equal(missingRecipePackage.ok, false);
  assert.equal(missingRecipePackage.errors.some((error) => error.path === 'package'), true);

  const missingSnapshotRevision = ledger.validate({
    event: 'snapshot-exported',
    outcome: 'exported',
    qualification_boundary: 'device-local',
    artifact: { format: 'application/json', hash: 'sha256:7777777777777777777777777777777777777777777777777777777777777777' },
  });
  assert.equal(missingSnapshotRevision.ok, false);
  assert.equal(missingSnapshotRevision.errors.some((error) => error.path === 'source_revision'), true);
});

test('identity hashes are canonical and bounded across proposal, package, recipe, and artifact evidence', () => {
  const { ledger } = makeLedger();
  const invalidHashes = [
    { ...identities.proposal, hash: 'proposal-hash' },
    { ...identities.package, content_hash: 'sha256:ABC' },
    { ...identities.recipe, content_hash: 'sha256:8888888888888888888888888888888888888888888888888888888888888888x' },
  ];
  invalidHashes.forEach((identity) => {
    const result = ledger.validate({
      event: 'proposal-staged',
      proposal: identity,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === 'INVALID_IDENTITY_HASH'), true);
  });

  const packageAlias = ledger.validate({
    event: 'recipe-staged',
    recipe: { id: identities.recipe.id, version: identities.recipe.version, hash: identities.recipe.hash },
    package: { id: identities.package.id, version: identities.package.version, content_hash: identities.package.content_hash },
    source_revision: 'rev:source',
    base_revision: 'rev:base',
    outcome: 'staged',
    qualification_boundary: 'device-local',
  });
  assert.equal(packageAlias.ok, true);
});

test('seeded replay evidence is bounded and must match the digest bound into proposal identity', () => {
  const { ledger } = makeLedger();
  const evidence = [{
    grammar: 'remix',
    algorithm_version: 1,
    prng: 'xorshift32-v1',
    seed: 'ledger-seed',
    wildness: 0.4,
    source_revision: 'rev:seeded',
    source_fingerprint: `sha256:${'ab'.repeat(32)}`,
    layout: { kind: 'branch-cluster', open_side: 'right', branch_count: 1, open_gap: 120, rhythm: 1 },
    lineage: [{ source_semantic_id: 'idea:a', variant_semantic_id: 'variant:a', lineage_source_id: 'idea:a', branch_index: 0, depth: 0 }],
  }];
  const seededEvidenceHash = hashReceiptSeededEvidence(evidence);
  const proposal = {
    id: identities.proposal.id,
    version: identities.proposal.version,
    content_hash: identities.proposal.hash,
    seeded_evidence_hash: seededEvidenceHash,
    hash: hashReceiptProposalEvidenceIdentity({
      content_hash: identities.proposal.hash,
      seeded_evidence_hash: seededEvidenceHash,
    }),
  };
  const valid = ledger.validate(createProposalStagedReceipt({
    proposal,
    seeded_evidence: evidence,
    source_revision: 'rev:seeded',
    base_revision: 'rev:seeded',
    outcome: 'staged',
    qualification_boundary: 'device-local seeded proposal evidence',
  }));
  assert.equal(valid.ok, true);
  const tampered = ledger.validate(createProposalStagedReceipt({
    proposal,
    seeded_evidence: [{ ...evidence[0], wildness: 0.9 }],
    source_revision: 'rev:seeded',
    base_revision: 'rev:seeded',
    outcome: 'staged',
    qualification_boundary: 'device-local seeded proposal evidence',
  }));
  assert.equal(tampered.ok, false);
  assert.equal(tampered.errors.some((error) => error.code === 'SEEDED_EVIDENCE_HASH_MISMATCH'), true);

  const changedEvidence = [{ ...evidence[0], seed: 'changed-seed' }];
  const changedEvidenceHash = hashReceiptSeededEvidence(changedEvidence);
  const reboundSidecarOnly = ledger.validate(createProposalStagedReceipt({
    proposal: { ...proposal, seeded_evidence_hash: changedEvidenceHash },
    seeded_evidence: changedEvidence,
    source_revision: 'rev:seeded',
    base_revision: 'rev:seeded',
    outcome: 'staged',
    qualification_boundary: 'device-local seeded proposal evidence',
  }));
  assert.equal(reboundSidecarOnly.ok, false);
  assert.equal(reboundSidecarOnly.errors.some((error) => error.code === 'PROPOSAL_EVIDENCE_IDENTITY_MISMATCH'), true);

  const sparseEvidence = new Array(1);
  const sparseTopLevel = ledger.validate({
    event: 'proposal-staged',
    proposal: identities.proposal,
    seeded_evidence: sparseEvidence,
    source_revision: 'rev:seeded',
    base_revision: 'rev:seeded',
    outcome: 'staged',
    qualification_boundary: 'device-local seeded proposal evidence',
  });
  assert.equal(sparseTopLevel.ok, false);
  assert.equal(sparseTopLevel.errors.some((error) => error.code === 'INVALID_SEEDED_EVIDENCE'), true);

  const sparseLineage = [{ ...evidence[0], lineage: new Array(1) }];
  const sparseNested = ledger.validate({
    event: 'proposal-staged',
    proposal: identities.proposal,
    seeded_evidence: sparseLineage,
    source_revision: 'rev:seeded',
    base_revision: 'rev:seeded',
    outcome: 'staged',
    qualification_boundary: 'device-local seeded proposal evidence',
  });
  assert.equal(sparseNested.ok, false);
  assert.equal(sparseNested.errors.some((error) => error.code === 'INVALID_SEEDED_LINEAGE'), true);
});

test('constructor cloning rejects cycles and oversized inputs with controlled errors', () => {
  const cyclicWarnings = [];
  cyclicWarnings.push(cyclicWarnings);
  assert.throws(
    () => createProposalStagedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local',
      warnings: cyclicWarnings,
    }),
    (error) => error && error.code === 'CYCLIC_INPUT',
  );

  const oversizedWarnings = Array.from({ length: 5000 }, (_, index) => `warning-${index}`);
  assert.throws(
    () => createProposalStagedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:source',
      base_revision: 'rev:base',
      outcome: 'staged',
      qualification_boundary: 'device-local',
      warnings: oversizedWarnings,
    }),
    (error) => error && error.code === 'INPUT_ENTRY_LIMIT',
  );
});

test('append detects a synchronous adapter change before write and returns STORAGE_CONFLICT', () => {
  const external = memoryStorage();
  const externalLedger = makeLedger(external).ledger;
  assert.equal(externalLedger.append(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:external',
    base_revision: 'rev:external',
    outcome: 'staged',
    qualification_boundary: 'device-local',
  })).ok, true);

  let reads = 0;
  let value = null;
  const writes = [];
  const storage = {
    read() {
      reads += 1;
      if (reads === 1) return null;
      value = external.value;
      return value;
    },
    write(next) {
      writes.push(next);
      value = next;
    },
  };
  const ledger = createReceiptLedger({
    storage,
    clock: () => '2026-08-27T12:00:00.000Z',
    idSource: () => 'conflict:1',
  });
  const result = ledger.append(createProposalStagedReceipt({
    proposal: identities.proposal,
    source_revision: 'rev:local',
    base_revision: 'rev:local',
    outcome: 'staged',
    qualification_boundary: 'device-local',
  }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 'STORAGE_CONFLICT');
  assert.equal(result.error.code, 'STORAGE_CONFLICT');
  assert.equal(writes.length, 0);
  assert.equal(value, external.value);
});

test('appendMany validates and commits up to sixteen receipts atomically in one write', () => {
  const storage = memoryStorage();
  const { ledger } = makeLedger(storage);
  const drafts = [
    createProposalStagedReceipt({
      proposal: identities.proposal,
      source_revision: 'rev:batch',
      base_revision: 'rev:batch',
      outcome: 'staged',
      qualification_boundary: 'device-local',
    }),
    createRecipeStagedReceipt({
      recipe: identities.recipe,
      package: identities.package,
      source_revision: 'rev:batch',
      base_revision: 'rev:batch',
      outcome: 'staged',
      qualification_boundary: 'device-local',
    }),
  ];
  const appended = ledger.appendMany(drafts);
  assert.equal(appended.ok, true);
  assert.equal(appended.receipts.length, 2);
  assert.deepEqual(appended.receipts.map((receipt) => receipt.sequence), [1, 2]);
  assert.equal(storage.writes.length, 1);
  assert.equal(JSON.parse(storage.value).receipts.length, 2);

  const before = storage.value;
  const writesBefore = storage.writes.length;
  const invalid = ledger.appendMany([
    drafts[0],
    { ...drafts[1], package: undefined },
  ]);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 'INVALID_RECEIPT');
  assert.equal(storage.value, before);
  assert.equal(storage.writes.length, writesBefore);

  const tooMany = ledger.appendMany(Array.from({ length: 17 }, () => drafts[0]));
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.status, 'INVALID_RECEIPT');
  assert.equal(tooMany.error.code, 'BATCH_LIMIT');
  assert.equal(storage.value, before);
  assert.equal(storage.writes.length, writesBefore);

  const conflictStorage = {
    reads: 0,
    writes: 0,
    read() {
      this.reads += 1;
      return this.reads === 1 ? storage.value : `${storage.value}-changed`;
    },
    write() {
      this.writes += 1;
    },
  };
  const conflictLedger = createReceiptLedger({
    storage: conflictStorage,
    clock: () => '2026-08-27T12:00:00.000Z',
    idSource: () => 'batch-conflict:1',
  });
  const conflict = conflictLedger.appendMany([drafts[0]]);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, 'STORAGE_CONFLICT');
  assert.equal(conflictStorage.reads, 2);
  assert.equal(conflictStorage.writes, 0);
});
