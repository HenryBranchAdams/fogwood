import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOGWOOD_PERSISTENCE,
  FOGWOOD_PERSISTENCE_KEY,
} from '../app/fogwood-persistence.ts';

test('Fogwood retains the legacy tldraw storage identity without destructive migration', () => {
  assert.equal(FOGWOOD_PERSISTENCE_KEY, 'open-surface-local');
  assert.deepEqual(FOGWOOD_PERSISTENCE, {
    boundary: 'device-local',
    brand: 'Fogwood',
    key: 'open-surface-local',
    storage_identity: 'retained-legacy-key',
    renamed_from: 'Open Surface',
    migration: {
      strategy: 'retain-key',
      reason: 'preserve existing device-local tldraw documents',
      deletes_legacy_data: false,
      dual_writes: false,
    },
  });
  assert.equal(Object.isFrozen(FOGWOOD_PERSISTENCE), true);
  assert.equal(Object.isFrozen(FOGWOOD_PERSISTENCE.migration), true);
});
