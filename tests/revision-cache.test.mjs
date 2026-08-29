import assert from 'node:assert/strict';
import test from 'node:test';

import { createContentRevisionCache } from '../app/tldraw-adapter/revision-cache.ts';
import { computePageRevision } from '../app/fogwood-runtime.ts';

function createStore() {
  let epoch = 0;
  let resetAt = null;
  const diffs = [];
  const listeners = new Set();
  return {
    history: {
      get: () => epoch,
      getDiffSince: (from) => resetAt !== null && from < resetAt ? null : diffs.slice(from),
    },
    listen(listener, filters) {
      assert.deepEqual(filters, { scope: 'document' });
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    change(diff, { notify = true } = {}) {
      epoch += 1;
      diffs.push(diff);
      if (notify) for (const listener of listeners) listener({ changes: diff, source: 'user' });
    },
    resetHistory() {
      epoch += 1;
      resetAt = epoch;
      diffs.push({ reset: true });
    },
    listenerCount: () => listeners.size,
  };
}

test('content revision cache computes once per relevant generation and preserves exact deterministic values', () => {
  const store = createStore();
  let pageId = 'page:one';
  let canonical = 'revision:A';
  let computations = 0;
  const cache = createContentRevisionCache({
    store,
    getPageId: () => pageId,
    compute: () => { computations += 1; return canonical; },
    isRelevant: (diff) => Boolean(diff?.relevant),
  });

  assert.equal(cache.get(), 'revision:A');
  assert.equal(cache.get(), 'revision:A');
  assert.equal(computations, 1);
  assert.deepEqual(cache.stats(), { generation: 0, computations: 1, last_duration_ms: cache.stats().last_duration_ms, page_id: 'page:one', cached: true });

  store.change({ ephemeral: true }, { notify: false });
  assert.equal(cache.get(), 'revision:A');
  assert.equal(computations, 1);

  canonical = 'revision:B';
  store.change({ relevant: true });
  assert.equal(cache.get(), 'revision:B');
  assert.equal(cache.get(), 'revision:B');
  assert.equal(computations, 2);
  assert.equal(cache.stats().generation, 1);

  canonical = 'revision:A';
  store.change({ relevant: true });
  assert.equal(cache.get(), 'revision:A');
  assert.equal(computations, 3);
  assert.equal(cache.stats().generation, 2);

  pageId = 'page:two';
  canonical = 'revision:page-two';
  assert.equal(cache.get(), 'revision:page-two');
  assert.equal(computations, 4);
  assert.equal(cache.stats().generation, 3);

  cache.dispose();
  assert.equal(store.listenerCount(), 0);
});

test('content revision cache catches same-turn relevant history before a deferred listener and fails safe on reset', () => {
  const store = createStore();
  let canonical = 'revision:A';
  let computations = 0;
  const cache = createContentRevisionCache({
    store,
    getPageId: () => 'page:one',
    compute: () => { computations += 1; return canonical; },
    isRelevant: (diff) => Boolean(diff?.relevant),
  });

  assert.equal(cache.get(), 'revision:A');
  canonical = 'revision:B';
  store.change({ relevant: true }, { notify: false });
  assert.equal(cache.get(), 'revision:B');
  assert.equal(computations, 2);

  canonical = 'revision:C';
  store.resetHistory();
  assert.equal(cache.get(), 'revision:C');
  assert.equal(computations, 3);
  cache.dispose();
});

test('near-limit repeated reads perform one measured computation per generation', (t) => {
  const store = createStore();
  const items = Array.from({ length: 5_000 }, (_, index) => ({
    id: `shape:${index}`, typeName: 'shape', type: 'geo', parentId: 'page:limit', index: String(index).padStart(6, '0'),
    x: index, y: index % 97, rotation: 0, opacity: 1, isLocked: false, props: { geo: 'rectangle', w: 80, h: 48 }, meta: {},
  }));
  const golden = computePageRevision('page:limit', items, [], []);
  let computations = 0;
  const cache = createContentRevisionCache({
    store,
    getPageId: () => 'page:limit',
    compute: () => {
      computations += 1;
      return computePageRevision('page:limit', items, [], []);
    },
    isRelevant: (diff) => Boolean(diff?.relevant),
  });

  for (let index = 0; index < 100; index += 1) assert.equal(cache.get(), golden);
  assert.match(golden, /^fogwood-agent-runtime\/2-[0-9a-f]{16}$/);
  assert.equal(computations, 1);
  assert.equal(cache.stats().computations, 1);
  assert.equal(cache.stats().last_duration_ms >= 0, true);
  t.diagnostic(`5000 items; canonical computations=${cache.stats().computations}; measured canonical duration=${cache.stats().last_duration_ms.toFixed(3)}ms; repeated reads=100`);
  cache.dispose();
});
