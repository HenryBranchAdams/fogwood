import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEditorChangeCapture,
  createFogwoodChangeLedger,
  FOGWOOD_CHANGE_LIMITS,
} from '../app/runtime/change-ledger.ts';

function memoryStorage() {
  let value = null;
  return { read: () => value, write: (next) => { value = next; }, value: () => value };
}

test('change ledger persists bounded, paginated identities and expires old cursors', () => {
  const storage = memoryStorage();
  const ledger = createFogwoodChangeLedger(storage, 'page:a');
  const ids = Array.from({ length: 80 }, (_, index) => `shape:${index}`);
  ledger.append({ resulting_revision: 'r1', origin: 'human', kind: 'update', record_ids: ids, semantic_ids: ids, relationship_ids: [] });
  const first = ledger.read({ since_sequence: 0, page_size: 1 });
  assert.equal(first.status, 'OK');
  assert.equal(first.changes[0].record_ids.length, FOGWOOD_CHANGE_LIMITS.max_ids_per_entry);
  assert.equal(first.changes[0].identities_complete, false);
  assert.equal(createFogwoodChangeLedger(storage, 'page:a').latestSequence(), 1);

  for (let index = 0; index < FOGWOOD_CHANGE_LIMITS.max_entries + 4; index += 1) {
    ledger.append({ resulting_revision: `r${index + 2}`, origin: 'human', kind: 'update', record_ids: [`shape:${index}`], semantic_ids: [], relationship_ids: [] });
  }
  assert.equal(ledger.read({ since_sequence: 0 }).status, 'CHANGE_CURSOR_EXPIRED');
  assert.ok(new TextEncoder().encode(storage.value()).byteLength <= FOGWOOD_CHANGE_LIMITS.max_bytes);
  const recent = ledger.read({ since_sequence: ledger.latestSequence() - 3, page_size: 2 });
  assert.equal(recent.status, 'OK');
  assert.equal(recent.changes.length, 2);
  assert.equal(recent.next_cursor, recent.changes[1].sequence);
});

test('store capture distinguishes human, plan, undo, redo, and ignores ephemeral records', () => {
  const storage = memoryStorage();
  const ledger = createFogwoodChangeLedger(storage, 'page:a');
  let listener;
  let disposed = false;
  let revision = 'r0';
  const capture = createEditorChangeCapture({
    store: { listen: (next, filters) => { assert.deepEqual(filters, { scope: 'document' }); listener = next; return () => { disposed = true; }; } },
    getLedger: () => ledger,
    getRevision: () => revision,
  });
  const shape = (id, semanticId) => ({ id, typeName: 'shape', type: 'geo', meta: { fogwood: { semantic_id: semanticId } } });
  const emit = (nextRevision, changes, source = 'user') => { revision = nextRevision; listener({ source, changes }); };

  emit('r1', { added: { 'shape:a': shape('shape:a', 'idea:a') }, updated: {}, removed: {} });
  capture.runWithOrigin(`fogwood:sha256:${'a'.repeat(64)}`, () => emit('r2', { added: { 'shape:b': shape('shape:b', 'idea:b') }, updated: {}, removed: {} }));
  emit('r1', { added: {}, updated: { 'shape:a': [shape('shape:a', 'idea:a'), shape('shape:a', 'idea:a')] }, removed: {} });
  emit('r2', { added: {}, updated: { 'shape:a': [shape('shape:a', 'idea:a'), shape('shape:a', 'idea:a')] }, removed: {} });
  emit('r2', { added: {}, updated: { 'instance:1': [{ id: 'instance:1', typeName: 'instance' }, { id: 'instance:1', typeName: 'instance' }] }, removed: {} });

  const changes = ledger.read({ since_sequence: 0 }).changes;
  assert.deepEqual(changes.map((change) => change.origin), ['human', `fogwood:sha256:${'a'.repeat(64)}`, 'system:undo', 'system:redo']);
  assert.deepEqual(changes.map((change) => change.semantic_ids), [['idea:a'], ['idea:b'], ['idea:a'], ['idea:a']]);
  capture.dispose();
  assert.equal(disposed, true);
});

test('unknown, future, and expired cursors require a full inspect recovery', () => {
  const ledger = createFogwoodChangeLedger(memoryStorage(), 'page:a');
  assert.equal(ledger.read({ since_sequence: 1 }).status, 'CHANGE_CURSOR_EXPIRED');
  ledger.append({ resulting_revision: 'r1', origin: 'human', kind: 'create', record_ids: ['shape:a'], semantic_ids: ['idea:a'], relationship_ids: [] });
  assert.equal(ledger.read({ since_sequence: 2 }).status, 'CHANGE_CURSOR_EXPIRED');
  assert.equal(ledger.read({ since_sequence: 1 }).status, 'OK');
});
