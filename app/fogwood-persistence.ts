/**
 * The public Fogwood surface is blank-first. Earlier Open Surface / Fogwood
 * documents remain untouched under their original device-local identity and
 * can be reopened explicitly with `?legacy=1`.
 */
export const FOGWOOD_PERSISTENCE_KEY = 'fogwood-local-v2' as const;
export const FOGWOOD_LEGACY_PERSISTENCE_KEY = 'open-surface-local' as const;

export function persistenceKeyFromSearch(search: string) {
  try {
    return new URLSearchParams(search).get('legacy') === '1'
      ? FOGWOOD_LEGACY_PERSISTENCE_KEY
      : FOGWOOD_PERSISTENCE_KEY;
  } catch {
    return FOGWOOD_PERSISTENCE_KEY;
  }
}

export const FOGWOOD_PERSISTENCE = Object.freeze({
  boundary: 'device-local' as const,
  brand: 'Fogwood' as const,
  key: FOGWOOD_PERSISTENCE_KEY,
  storage_identity: 'blank-first-v2' as const,
  renamed_from: 'Open Surface' as const,
  migration: Object.freeze({
    strategy: 'archive-and-opt-in' as const,
    legacy_key: FOGWOOD_LEGACY_PERSISTENCE_KEY,
    legacy_query: 'legacy=1' as const,
    reason: 'make the public product blank-first without deleting or rewriting earlier device-local canvases' as const,
    deletes_legacy_data: false,
    dual_writes: false,
  }),
});
