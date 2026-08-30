import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FOGWOOD_LEGACY_PERSISTENCE_KEY,
  FOGWOOD_PERSISTENCE,
  FOGWOOD_PERSISTENCE_KEY,
  persistenceKeyFromSearch,
} from '../app/fogwood-persistence.ts';

test('Fogwood starts blank under a new storage identity while preserving the legacy canvas as an opt-in archive', () => {
  assert.equal(FOGWOOD_PERSISTENCE_KEY, 'fogwood-local-v2');
  assert.equal(FOGWOOD_LEGACY_PERSISTENCE_KEY, 'open-surface-local');
  assert.deepEqual(FOGWOOD_PERSISTENCE, {
    boundary: 'device-local',
    brand: 'Fogwood',
    key: 'fogwood-local-v2',
    storage_identity: 'blank-first-v2',
    renamed_from: 'Open Surface',
    migration: {
      strategy: 'archive-and-opt-in',
      legacy_key: 'open-surface-local',
      legacy_query: 'legacy=1',
      reason: 'make the public product blank-first without deleting or rewriting earlier device-local canvases',
      deletes_legacy_data: false,
      dual_writes: false,
    },
  });
  assert.equal(persistenceKeyFromSearch(''), FOGWOOD_PERSISTENCE_KEY);
  assert.equal(persistenceKeyFromSearch('?foo=bar'), FOGWOOD_PERSISTENCE_KEY);
  assert.equal(persistenceKeyFromSearch('?legacy=1'), FOGWOOD_LEGACY_PERSISTENCE_KEY);
  assert.equal(persistenceKeyFromSearch('?legacy=0'), FOGWOOD_PERSISTENCE_KEY);
  assert.equal(Object.isFrozen(FOGWOOD_PERSISTENCE), true);
  assert.equal(Object.isFrozen(FOGWOOD_PERSISTENCE.migration), true);
});

test('the accepted persistence decision matches the blank-first implementation and untouched legacy archive', async () => {
  const adr = await readFile(new URL('../docs/adr/0008-blank-first-with-legacy-archive.md', import.meta.url), 'utf8');
  const amended = await readFile(new URL('../docs/adr/0005-prepared-plan-autophagy.md', import.meta.url), 'utf8');

  assert.match(adr, /status: accepted/);
  assert.match(adr, /fogwood-local-v2/);
  assert.match(adr, /open-surface-local/);
  assert.match(adr, /\?legacy=1/);
  assert.match(adr, /never delete or rewrite/);
  assert.match(adr, /never copy or dual-write/);
  assert.match(amended, /ADR 0008 amends the\s+storage-identity clause/);
});
