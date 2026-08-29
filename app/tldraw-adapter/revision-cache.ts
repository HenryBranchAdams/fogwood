export type RevisionStoreDiff = unknown;

export type RevisionStore = {
  history: {
    get: () => number;
    getDiffSince: (epoch: number) => unknown;
  };
  listen: (
    listener: (entry: { changes?: RevisionStoreDiff }) => void,
    filters: { scope: 'document' },
  ) => () => void;
};

export type ContentRevisionCacheStats = Readonly<{
  generation: number;
  computations: number;
  last_duration_ms: number;
  page_id: string;
  cached: boolean;
}>;

/**
 * Cache only the deterministic revision string. Editor state and proposal
 * authority remain live. Public store history closes the same-turn gap before
 * deferred listeners flush; the listener supplies normal invalidation and a
 * cleanup seam.
 */
export function createContentRevisionCache(input: {
  store: RevisionStore;
  getPageId: () => string;
  compute: () => string;
  isRelevant: (diff: RevisionStoreDiff) => boolean;
}) {
  let pageId = input.getPageId();
  let observedEpoch = input.store.history.get();
  let generation = 0;
  let computations = 0;
  let lastDurationMs = 0;
  let cached: string | undefined;
  let disposed = false;
  const processed = new WeakSet<object>();

  const invalidate = () => {
    generation += 1;
    cached = undefined;
  };

  const processDiff = (diff: unknown) => {
    if (diff && typeof diff === 'object') {
      if (processed.has(diff)) return;
      processed.add(diff);
    }
    if (input.isRelevant(diff)) invalidate();
  };

  const disposeListener = input.store.listen((entry) => {
    if (disposed || entry.changes === undefined) return;
    processDiff(entry.changes);
    observedEpoch = input.store.history.get();
  }, { scope: 'document' });

  return {
    get() {
      const nextPageId = input.getPageId();
      if (nextPageId !== pageId) {
        pageId = nextPageId;
        invalidate();
      }

      const currentEpoch = input.store.history.get();
      if (currentEpoch !== observedEpoch) {
        const diffs = input.store.history.getDiffSince(observedEpoch);
        if (!Array.isArray(diffs)) invalidate();
        else for (const diff of diffs) processDiff(diff);
        observedEpoch = currentEpoch;
      }

      if (cached === undefined) {
        const started = typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now();
        cached = input.compute();
        const ended = typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now();
        lastDurationMs = Math.max(0, ended - started);
        computations += 1;
      }
      return cached;
    },
    invalidate,
    stats(): ContentRevisionCacheStats {
      return Object.freeze({ generation, computations, last_duration_ms: lastDurationMs, page_id: pageId, cached: cached !== undefined });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeListener();
      cached = undefined;
    },
  };
}
