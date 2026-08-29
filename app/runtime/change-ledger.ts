export const FOGWOOD_CHANGE_LEDGER_SCHEMA = 'fogwood.change-ledger.v1' as const;
export const FOGWOOD_CHANGE_STORAGE_KEY = 'fogwood-change-ledger-v1';
export const FOGWOOD_CHANGE_LIMITS = Object.freeze({
  max_entries: 256,
  max_bytes: 512 * 1024,
  max_ids_per_entry: 64,
  max_pages: 8,
});

export type FogwoodChangeOrigin = 'human' | `fogwood:${string}` | 'system:undo' | 'system:redo' | 'system:migration';
export type FogwoodChangeKind = 'create' | 'update' | 'delete' | 'binding' | 'asset' | 'page';
export type FogwoodChange = Readonly<{
  sequence: number;
  resulting_revision: string;
  origin: FogwoodChangeOrigin;
  kind: FogwoodChangeKind;
  record_ids: readonly string[];
  semantic_ids: readonly string[];
  relationship_ids?: readonly string[];
  identities_complete: boolean;
}>;

type StoredPage = { next_sequence: number; entries: FogwoodChange[] };
type StoredLedger = { schema: typeof FOGWOOD_CHANGE_LEDGER_SCHEMA; pages: Record<string, StoredPage> };
export type ChangeStorage = { read: () => string | null; write?: (value: string) => void };

const EMPTY = (): StoredLedger => ({ schema: FOGWOOD_CHANGE_LEDGER_SCHEMA, pages: {} });
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

function parseStorage(storage: ChangeStorage): StoredLedger {
  try {
    const raw = storage.read();
    if (!raw || byteLength(raw) > FOGWOOD_CHANGE_LIMITS.max_bytes) return EMPTY();
    const parsed = JSON.parse(raw) as StoredLedger;
    if (parsed?.schema !== FOGWOOD_CHANGE_LEDGER_SCHEMA || !parsed.pages || typeof parsed.pages !== 'object' || Array.isArray(parsed.pages)) return EMPTY();
    for (const [pageId, page] of Object.entries(parsed.pages)) {
      if (!pageId || !page || typeof page !== 'object' || !Number.isSafeInteger(page.next_sequence) || page.next_sequence < 1 || !Array.isArray(page.entries)) delete parsed.pages[pageId];
    }
    return parsed;
  } catch {
    return EMPTY();
  }
}

function boundedUnique(values: readonly string[]) {
  const unique = [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0).map((value) => value.slice(0, 180)))];
  return { values: unique.slice(0, FOGWOOD_CHANGE_LIMITS.max_ids_per_entry), complete: unique.length <= FOGWOOD_CHANGE_LIMITS.max_ids_per_entry };
}

export function createFogwoodChangeLedger(storage: ChangeStorage, pageId: string) {
  const stored = parseStorage(storage);
  const page = stored.pages[pageId] ?? { next_sequence: 1, entries: [] };
  stored.pages[pageId] = page;

  function persist() {
    if (!storage.write) return;
    const orderedPages = Object.entries(stored.pages).slice(-FOGWOOD_CHANGE_LIMITS.max_pages);
    stored.pages = Object.fromEntries(orderedPages);
    while (page.entries.length > FOGWOOD_CHANGE_LIMITS.max_entries) page.entries.shift();
    let serialized = JSON.stringify(stored);
    while (page.entries.length > 0 && byteLength(serialized) > FOGWOOD_CHANGE_LIMITS.max_bytes) {
      page.entries.shift();
      serialized = JSON.stringify(stored);
    }
    try { storage.write(serialized); } catch { /* Evidence retention cannot affect canvas authority. */ }
  }

  return {
    append(draft: Omit<FogwoodChange, 'sequence' | 'identities_complete'>) {
      const records = boundedUnique(draft.record_ids);
      const semantics = boundedUnique(draft.semantic_ids);
      const relationships = boundedUnique(draft.relationship_ids ?? []);
      const entry: FogwoodChange = Object.freeze({
        sequence: page.next_sequence++,
        resulting_revision: draft.resulting_revision.slice(0, 120),
        origin: draft.origin,
        kind: draft.kind,
        record_ids: Object.freeze(records.values),
        semantic_ids: Object.freeze(semantics.values),
        ...(relationships.values.length > 0 ? { relationship_ids: Object.freeze(relationships.values) } : {}),
        identities_complete: records.complete && semantics.complete && relationships.complete,
      });
      page.entries.push(entry);
      persist();
      return entry;
    },
    read(input: { since_sequence: number; page_size?: number; cursor?: number }) {
      const latest = page.next_sequence - 1;
      const first = page.entries[0]?.sequence ?? page.next_sequence;
      const start = input.cursor ?? input.since_sequence;
      if (!Number.isSafeInteger(start) || start < 0 || start > latest || (start < first - 1 && latest > 0)) {
        return { status: 'CHANGE_CURSOR_EXPIRED' as const, change_sequence: latest, recovery: 'Run a full fogwood-inspect without since_sequence, then acknowledge its change_sequence.' };
      }
      const limit = Math.max(1, Math.min(128, Math.trunc(input.page_size ?? 128)));
      const changes = page.entries.filter((entry) => entry.sequence > start).slice(0, limit);
      const last = changes.at(-1)?.sequence ?? start;
      return {
        status: 'OK' as const,
        change_sequence: latest,
        changes,
        attention: {
          auto_acknowledged_sequences: changes.filter((entry) => entry.origin.startsWith('fogwood:')).map((entry) => entry.sequence),
          wake_worthy_sequences: changes.filter((entry) => !entry.origin.startsWith('fogwood:')).map((entry) => entry.sequence),
        },
        ...(last < latest ? { next_cursor: last } : {}),
      };
    },
    latestSequence() { return page.next_sequence - 1; },
  };
}

type ChangeRecord = { id?: unknown; typeName?: unknown; type?: unknown; parentId?: unknown; meta?: unknown; fromId?: unknown; toId?: unknown };
type StoreEntry = { source?: unknown; changes?: { added?: Record<string, ChangeRecord>; updated?: Record<string, [ChangeRecord, ChangeRecord]>; removed?: Record<string, ChangeRecord> } };

function recordEvidence(records: readonly ChangeRecord[]) {
  const recordIds: string[] = [];
  const semanticIds: string[] = [];
  const relationshipIds: string[] = [];
  for (const record of records) {
    if (typeof record.id === 'string') recordIds.push(record.id);
    const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {};
    const fogwood = meta.fogwood && typeof meta.fogwood === 'object' ? meta.fogwood as Record<string, unknown> : {};
    if (typeof fogwood.semantic_id === 'string') semanticIds.push(fogwood.semantic_id);
    if (typeof fogwood.relationship_id === 'string') relationshipIds.push(fogwood.relationship_id);
  }
  return { recordIds, semanticIds, relationshipIds };
}

/** Attach a bounded evidence observer to public tldraw Store.listen. */
export function createEditorChangeCapture(input: {
  store: { listen?: (listener: (entry: StoreEntry) => void, filters?: { scope: 'document' }) => (() => void) };
  getLedger: () => ReturnType<typeof createFogwoodChangeLedger>;
  getRevision: () => string;
  getCurrentPageId?: () => string;
  getCurrentRecordIds?: () => ReadonlySet<string>;
}) {
  let activeOrigin: FogwoodChangeOrigin | undefined;
  const claimedRevisions = new Map<string, FogwoodChangeOrigin>();
  const taggedDuringRun = new Set<string>();
  const revisions = [input.getRevision()];
  let revisionCursor = 0;
  const listener = (entry: StoreEntry) => {
    const changes = entry.changes;
    if (!changes) return;
    const allChangedRecords = [
      ...Object.values(changes.added ?? {}),
      ...Object.values(changes.updated ?? {}).flatMap((pair) => pair),
      ...Object.values(changes.removed ?? {}),
    ];
    const changedById = new Map(allChangedRecords.flatMap((record) => typeof record.id === 'string' ? [[record.id, record] as const] : []));
    const currentIds = input.getCurrentRecordIds?.();
    const pageId = input.getCurrentPageId?.();
    const relevant = (record: ChangeRecord) => {
      if (!currentIds || !pageId) return true;
      if (typeof record.id === 'string' && currentIds.has(record.id)) return true;
      if (record.typeName === 'page') return record.id === pageId;
      if (record.typeName === 'binding') return (typeof record.fromId === 'string' && currentIds.has(record.fromId)) || (typeof record.toId === 'string' && currentIds.has(record.toId));
      if (record.typeName !== 'shape') return false;
      const visited = new Set<string>();
      let parentId = typeof record.parentId === 'string' ? record.parentId : undefined;
      while (parentId && !visited.has(parentId)) {
        if (parentId === pageId || currentIds.has(parentId)) return true;
        visited.add(parentId);
        const parent = changedById.get(parentId);
        parentId = parent && typeof parent.parentId === 'string' ? parent.parentId : undefined;
      }
      return false;
    };
    const resultingRevision = input.getRevision();
    if (resultingRevision === revisions[revisionCursor]) return;
    let origin: FogwoodChangeOrigin;
    if (activeOrigin) {
      origin = activeOrigin;
      taggedDuringRun.add(resultingRevision);
    }
    else if (claimedRevisions.has(resultingRevision)) {
      origin = claimedRevisions.get(resultingRevision)!;
      queueMicrotask(() => claimedRevisions.delete(resultingRevision));
    }
    else if (revisionCursor > 0 && resultingRevision === revisions[revisionCursor - 1]) { origin = 'system:undo'; revisionCursor -= 1; }
    else if (revisionCursor + 1 < revisions.length && resultingRevision === revisions[revisionCursor + 1]) { origin = 'system:redo'; revisionCursor += 1; }
    else {
      origin = entry.source === 'remote' ? 'system:migration' : 'human';
      revisions.splice(revisionCursor + 1);
      revisions.push(resultingRevision);
      revisionCursor = revisions.length - 1;
    }
    if (activeOrigin) {
      revisions.splice(revisionCursor + 1);
      revisions.push(resultingRevision);
      revisionCursor = revisions.length - 1;
    }
    const groups: Array<{ kind: FogwoodChangeKind; records: ChangeRecord[] }> = [];
    const collect = (kind: FogwoodChangeKind, records: ChangeRecord[]) => { if (records.length) groups.push({ kind, records }); };
    const added = Object.values(changes.added ?? {}).filter(relevant);
    const updated = Object.values(changes.updated ?? {}).map((pair) => pair[1]).filter(relevant);
    const removed = Object.values(changes.removed ?? {}).filter(relevant);
    for (const [kind, records] of [['create', added], ['update', updated], ['delete', removed]] as const) {
      collect(kind, records.filter((record) => record.typeName === 'shape'));
      collect('binding', records.filter((record) => record.typeName === 'binding'));
      collect('asset', records.filter((record) => record.typeName === 'asset'));
      collect('page', records.filter((record) => record.typeName === 'page'));
    }
    for (const group of groups) {
      const evidence = recordEvidence(group.records);
      input.getLedger().append({ resulting_revision: resultingRevision, origin, kind: group.kind, record_ids: evidence.recordIds, semantic_ids: evidence.semanticIds, relationship_ids: evidence.relationshipIds });
    }
  };
  const dispose = input.store.listen?.(listener, { scope: 'document' }) ?? (() => {});
  return {
    runWithOrigin<T>(origin: FogwoodChangeOrigin, operation: () => T) {
      const previous = activeOrigin;
      const beforeRevision = input.getRevision();
      activeOrigin = origin;
      try {
        const result = operation();
        const afterRevision = input.getRevision();
        if (afterRevision !== beforeRevision && !taggedDuringRun.has(afterRevision)) {
          claimedRevisions.set(afterRevision, origin);
          while (claimedRevisions.size > 8) claimedRevisions.delete(claimedRevisions.keys().next().value!);
        }
        return result;
      } finally {
        activeOrigin = previous;
        taggedDuringRun.clear();
      }
    },
    dispose,
  };
}
