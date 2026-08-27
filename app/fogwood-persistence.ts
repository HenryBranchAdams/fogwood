/**
 * Fogwood intentionally retains Open Surface's original tldraw persistence key.
 * The key is a storage identity, not visible product branding. Renaming it would
 * strand existing device-local IndexedDB documents unless a full, verified
 * tldraw snapshot migration were performed.
 */
export const FOGWOOD_PERSISTENCE_KEY = 'open-surface-local' as const;

export const FOGWOOD_PERSISTENCE = Object.freeze({
  boundary: 'device-local' as const,
  brand: 'Fogwood' as const,
  key: FOGWOOD_PERSISTENCE_KEY,
  storage_identity: 'retained-legacy-key' as const,
  renamed_from: 'Open Surface' as const,
  migration: Object.freeze({
    strategy: 'retain-key' as const,
    reason: 'preserve existing device-local tldraw documents' as const,
    deletes_legacy_data: false,
    dual_writes: false,
  }),
});
