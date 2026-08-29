/**
 * Browser-safe, DOM-free, device-local evidence receipts for Fogwood.
 *
 * Receipts are evidence about a proposal or export. They do not grant Apply,
 * Reject, or any other authority. The page/controller remains the authority
 * for canvas mutations; this module only validates and appends records to an
 * injected storage adapter.
 */

import {
  canonicalSerialize,
  sha256Hex,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-identities.ts';

export const RECEIPT_SCHEMA_VERSION = 1 as const;
export const RECEIPT_LEDGER_SCHEMA_VERSION = 1 as const;
export const RECEIPT_STORAGE_KEY = 'fogwood-receipts-local:v1' as const;
export const RECEIPT_BATCH_LIMIT = 16 as const;
export const RECEIPT_MATERIAL_EVIDENCE_LIMIT = 32 as const;
export const RECEIPT_SEEDED_EVIDENCE_LIMIT = 4 as const;
export const RECEIPT_SEEDED_LINEAGE_LIMIT = 8 as const;
/** Alias that makes the storage boundary easy to discover from app code. */
export const FOGWOOD_RECEIPTS_STORAGE_KEY = RECEIPT_STORAGE_KEY;

export const RECEIPT_EVENTS = [
  'proposal-staged',
  'proposal-applied',
  'proposal-rejected',
  'recipe-staged',
  'recipe-inserted',
  'snapshot-exported',
] as const;

export type ReceiptEvent = (typeof RECEIPT_EVENTS)[number];
export type ReceiptVersion = string | number;
export type ReceiptOutcome = 'staged' | 'applied' | 'rejected' | 'inserted' | 'exported';
export type ReceiptAuthority = 'evidence-only';
export type ReceiptLocality = 'device-local';

export type ReceiptIdentity = {
  id: string;
  version: ReceiptVersion;
  /** Short alias accepted for proposal/recipe identities. */
  hash?: string;
  /** Canonical Bazaar package spelling; accepted for every identity. */
  content_hash?: string;
  /** Binds separately projected material evidence to this proposal identity. */
  material_evidence_hash?: string;
  /** Binds explicit reproducibility and lineage evidence to this proposal identity. */
  seeded_evidence_hash?: string;
};

export type ReceiptArtifact = {
  format: string;
  hash: string;
};

export type ReceiptMaterialEvidence = {
  semantic_id: string;
  content_hash: string;
  byte_length: number;
  mime_type: 'image/png' | 'image/jpeg' | 'image/svg+xml';
  width: number;
  height: number;
  source_status: 'original' | 'sanitized';
  decode_qualified: true;
  x: number;
  y: number;
  w: number;
  h: number;
  originating_capability: string;
  qualification_boundary: string;
  prompt_summary: string;
};

export type ReceiptSeededCompositionEvidence = {
  grammar: 'remix';
  algorithm_version: 1;
  prng: 'xorshift32-v1';
  seed: string | number;
  wildness: number;
  source_revision: string;
  source_fingerprint: string;
  layout: {
    kind: 'branch-cluster';
    open_side: 'right' | 'bottom' | 'left' | 'top';
    branch_count: number;
    open_gap: number;
    rhythm: number;
  };
  lineage: readonly {
    source_semantic_id: string;
    variant_semantic_id: string;
    lineage_source_id: string;
    parent_variant_id?: string;
    branch_index: number;
    depth: number;
  }[];
};

export type ReceiptDraft = {
  event: ReceiptEvent;
  plan_id?: string;
  source_revision?: string;
  base_revision?: string;
  result_revision?: string;
  proposal?: ReceiptIdentity;
  package?: ReceiptIdentity;
  recipe?: ReceiptIdentity;
  material_evidence?: readonly ReceiptMaterialEvidence[];
  seeded_evidence?: readonly ReceiptSeededCompositionEvidence[];
  outcome: ReceiptOutcome;
  locality?: ReceiptLocality;
  qualification_boundary: string;
  warnings?: readonly string[];
  loss?: readonly string[];
  artifact?: ReceiptArtifact;
  reason?: string;
};

export type Receipt = Readonly<{
  schema_version: typeof RECEIPT_SCHEMA_VERSION;
  receipt_id: string;
  sequence: number;
  recorded_at: string;
  authority: ReceiptAuthority;
  locality: ReceiptLocality;
  event: ReceiptEvent;
  plan_id?: string;
  source_revision?: string;
  base_revision?: string;
  result_revision?: string;
  proposal?: Readonly<ReceiptIdentity>;
  package?: Readonly<ReceiptIdentity>;
  recipe?: Readonly<ReceiptIdentity>;
  material_evidence?: readonly ReceiptMaterialEvidence[];
  seeded_evidence?: readonly ReceiptSeededCompositionEvidence[];
  outcome: ReceiptOutcome;
  qualification_boundary: string;
  warnings: readonly string[];
  loss: readonly string[];
  artifact?: Readonly<ReceiptArtifact>;
  reason?: string;
}>;

export type ReceiptLedgerStorage = {
  schema_version: typeof RECEIPT_LEDGER_SCHEMA_VERSION;
  receipts: Receipt[];
};

export type ReceiptStorageAdapter = {
  /** Return the serialized ledger, or null/undefined when it has not been created. */
  read: () => string | null | undefined;
  /** Persist one complete serialized ledger. Implementations must not silently evict data. */
  write: (serialized: string) => void;
};

export type ReceiptClock = () => string | Date | number;
export type ReceiptIdSource = () => string;

export type ReceiptLedgerLimits = {
  max_records: number;
  max_serialized_bytes: number;
  max_read: number;
  max_warnings: number;
  max_loss_entries: number;
  max_string_length: number;
  max_revision_length: number;
  max_identity_length: number;
  max_hash_length: number;
  max_clone_depth: number;
  max_clone_entries: number;
};

export const DEFAULT_RECEIPT_LIMITS: Readonly<ReceiptLedgerLimits> = Object.freeze({
  max_records: 256,
  max_serialized_bytes: 512_000,
  max_read: 64,
  max_warnings: 16,
  max_loss_entries: 16,
  max_string_length: 500,
  max_revision_length: 180,
  max_identity_length: 180,
  max_hash_length: 256,
  max_clone_depth: 32,
  max_clone_entries: 4096,
});

export type ReceiptLedgerOptions = {
  storage: ReceiptStorageAdapter;
  clock?: ReceiptClock;
  idSource?: ReceiptIdSource;
  limits?: Partial<ReceiptLedgerLimits> & {
    maxRecords?: number;
    maxBytes?: number;
    maxDepth?: number;
    maxEntries?: number;
    max_depth?: number;
    max_entries?: number;
  };
};

export type ReceiptValidationError = {
  code: string;
  message: string;
  path?: string | undefined;
};

export type NormalizedReceiptDraft = Readonly<
  ReceiptDraft & {
    locality: ReceiptLocality;
    warnings: readonly string[];
    loss: readonly string[];
    authority: ReceiptAuthority;
  }
>;

export type ReceiptValidationResult =
  | {
      ok: true;
      receipt: NormalizedReceiptDraft;
    }
  | { ok: false; status: 'INVALID_RECEIPT'; errors: ReceiptValidationError[] };

export type ReceiptLedgerError = {
  code: string;
  message: string;
  path?: string | undefined;
};

export type ReceiptLedgerFailureStatus =
  | 'INVALID_RECEIPT'
  | 'MALFORMED_STORAGE'
  | 'STORAGE_ERROR'
  | 'LEDGER_FULL'
  | 'DUPLICATE_RECEIPT_ID'
  | 'INVALID_READ'
  | 'STORAGE_CONFLICT';

export type ReceiptAppendResult =
  | { ok: true; receipt: Receipt; total: number }
  | {
      ok: false;
      status: ReceiptLedgerFailureStatus;
      error: ReceiptLedgerError;
      errors?: ReceiptValidationError[];
    };

export type ReceiptAppendManyResult =
  | { ok: true; receipts: readonly Receipt[]; total: number }
  | {
      ok: false;
      status: ReceiptLedgerFailureStatus;
      error: ReceiptLedgerError;
      errors?: ReceiptValidationError[];
    };

export type ReceiptBatchAppendResult = ReceiptAppendManyResult;

export type ReceiptListInput = {
  limit?: number;
  cursor?: string;
  newest_first?: boolean;
};

export type ReceiptListResult =
  | {
      ok: true;
      receipts: readonly Receipt[];
      total: number;
      has_more: boolean;
      next_cursor?: string;
    }
  | {
      ok: false;
      status: ReceiptLedgerFailureStatus;
      error: ReceiptLedgerError;
    };

export type ReceiptValidateStoredResult =
  | { ok: true; receipts: readonly Receipt[] }
  | { ok: false; status: ReceiptLedgerFailureStatus; error: ReceiptLedgerError };

const GENERATED_KEYS = ['schema_version', 'receipt_id', 'sequence', 'recorded_at', 'authority'] as const;
const DRAFT_KEYS = [
  'event',
  'plan_id',
  'source_revision',
  'base_revision',
  'result_revision',
  'proposal',
  'package',
  'recipe',
  'material_evidence',
  'seeded_evidence',
  'outcome',
  'locality',
  'qualification_boundary',
  'warnings',
  'loss',
  'artifact',
  'reason',
] as const;
const RECORD_KEYS = [...GENERATED_KEYS, 'locality', ...DRAFT_KEYS.filter((key) => key !== 'locality')] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const PREPARED_PLAN_ID = /^sha256:[0-9a-f]{64}$/u;

export type ReceiptConstructionErrorCode =
  | 'CYCLIC_INPUT'
  | 'INPUT_DEPTH_LIMIT'
  | 'INPUT_ENTRY_LIMIT'
  | 'UNCLONEABLE_INPUT';

/** A constructor input could not be copied inside the bounded receipt seam. */
export class ReceiptConstructionError extends TypeError {
  readonly code: ReceiptConstructionErrorCode;
  readonly path: string | undefined;

  constructor(code: ReceiptConstructionErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'ReceiptConstructionError';
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type TraversalState = {
  active: WeakSet<object>;
  seen: WeakSet<object>;
  entries: number;
  maxDepth: number;
  maxEntries: number;
};

function traversalState(limits: ReceiptLedgerLimits): TraversalState {
  return {
    active: new WeakSet<object>(),
    seen: new WeakSet<object>(),
    entries: 0,
    maxDepth: limits.max_clone_depth,
    maxEntries: limits.max_clone_entries,
  };
}

function checkTraversalBudget(state: TraversalState, depth: number, path: string) {
  if (depth > state.maxDepth) {
    throw new ReceiptConstructionError('INPUT_DEPTH_LIMIT', 'Receipt input exceeds the bounded clone depth.', path);
  }
  state.entries += 1;
  if (state.entries > state.maxEntries) {
    throw new ReceiptConstructionError('INPUT_ENTRY_LIMIT', 'Receipt input exceeds the bounded clone entry limit.', path);
  }
}

function defineClonedProperty(target: object, key: string, value: unknown, path: string) {
  try {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  } catch {
    throw new ReceiptConstructionError('UNCLONEABLE_INPUT', 'Receipt input contains a property that cannot be copied.', path);
  }
}

function cloneUnknown(value: unknown, state: TraversalState, depth: number, path: string): unknown {
  checkTraversalBudget(state, depth, path);
  if (value === null || typeof value !== 'object') return value;
  if (state.active.has(value)) {
    throw new ReceiptConstructionError('CYCLIC_INPUT', 'Receipt input contains a cyclic reference.', path);
  }
  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      const clone: unknown[] = [];
      for (const key of Object.keys(value)) {
        defineClonedProperty(clone, key, cloneUnknown(Reflect.get(value, key), state, depth + 1, `${path}.${key}`), `${path}.${key}`);
      }
      return clone;
    }
    if (!isRecord(value)) {
      throw new ReceiptConstructionError('UNCLONEABLE_INPUT', 'Receipt input must contain plain objects or arrays.', path);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ReceiptConstructionError('UNCLONEABLE_INPUT', 'Receipt input must contain plain objects or arrays.', path);
    }
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineClonedProperty(clone, key, cloneUnknown(Reflect.get(value, key), state, depth + 1, `${path}.${key}`), `${path}.${key}`);
    }
    return clone;
  } catch (error) {
    if (error instanceof ReceiptConstructionError) throw error;
    throw new ReceiptConstructionError('UNCLONEABLE_INPUT', 'Receipt input could not be copied safely.', path);
  } finally {
    state.active.delete(value);
  }
}

function freezeUnknown(value: unknown, state: TraversalState, depth: number, path: string): void {
  if (value === null || typeof value !== 'object') return;
  if (state.seen.has(value)) return;
  checkTraversalBudget(state, depth, path);
  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      for (const key of Object.keys(value)) freezeUnknown(Reflect.get(value, key), state, depth + 1, `${path}.${key}`);
    } else if (isRecord(value)) {
      for (const key of Object.keys(value)) freezeUnknown(Reflect.get(value, key), state, depth + 1, `${path}.${key}`);
    }
    Object.freeze(value);
    state.seen.add(value);
  } catch (error) {
    if (error instanceof ReceiptConstructionError) throw error;
    throw new ReceiptConstructionError('UNCLONEABLE_INPUT', 'Receipt value could not be frozen safely.', path);
  } finally {
    state.active.delete(value);
  }
}

function deepFreeze<T>(value: T, limits: ReceiptLedgerLimits = DEFAULT_RECEIPT_LIMITS): T {
  freezeUnknown(value, traversalState(limits), 0, '$');
  return value;
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function addError(errors: ReceiptValidationError[], code: string, message: string, path?: string) {
  errors.push({ code, message, ...(path ? { path } : {}) });
}

function normalizeLimits(input: ReceiptLedgerOptions['limits']): ReceiptLedgerLimits {
  const source = input ?? {};
  const {
    maxRecords,
    maxBytes,
    maxDepth,
    maxEntries,
    max_depth,
    max_entries,
    ...namedLimits
  } = source;
  const values: ReceiptLedgerLimits = {
    ...DEFAULT_RECEIPT_LIMITS,
    ...namedLimits,
    ...(maxRecords === undefined ? {} : { max_records: maxRecords }),
    ...(maxBytes === undefined ? {} : { max_serialized_bytes: maxBytes }),
    ...(maxDepth === undefined && max_depth === undefined ? {} : { max_clone_depth: maxDepth ?? max_depth }),
    ...(maxEntries === undefined && max_entries === undefined ? {} : { max_clone_entries: maxEntries ?? max_entries }),
  };
  // The constructor fails visibly for invalid bounds instead of silently
  // changing the caller's requested storage policy.
  for (const [key, value] of Object.entries(values)) {
    if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1) {
      throw new TypeError(`Receipt limit ${key} must be a positive integer.`);
    }
  }
  return values;
}

function normalizeClockValue(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }
  if (isFiniteNumber(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }
  return typeof value === 'string' && value.length > 0 && value.length <= 100 ? value : undefined;
}

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function normalizeVersion(value: unknown, path: string, errors: ReceiptValidationError[]): ReceiptVersion | undefined {
  if (isFiniteNumber(value) && value >= 0 && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && boundedString(value, 80)) return value;
  addError(errors, 'INVALID_IDENTITY_VERSION', 'Identity version must be a bounded string or non-negative integer.', `${path}.version`);
  return undefined;
}

function canonicalHash(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isReceiptEvent(value: unknown): value is ReceiptEvent {
  return typeof value === 'string' && RECEIPT_EVENTS.some((event) => event === value);
}

function isReceiptOutcome(value: unknown): value is ReceiptOutcome {
  return value === 'staged' || value === 'applied' || value === 'rejected' || value === 'inserted' || value === 'exported';
}

function expectedOutcome(event: ReceiptEvent): ReceiptOutcome {
  switch (event) {
    case 'proposal-staged':
    case 'recipe-staged':
      return 'staged';
    case 'proposal-applied':
      return 'applied';
    case 'proposal-rejected':
      return 'rejected';
    case 'recipe-inserted':
      return 'inserted';
    case 'snapshot-exported':
      return 'exported';
  }
}

function normalizeIdentity(
  value: unknown,
  path: string,
  limits: ReceiptLedgerLimits,
  errors: ReceiptValidationError[],
): ReceiptIdentity | undefined {
  if (!isRecord(value)) {
    addError(errors, 'INVALID_IDENTITY', 'Identity must include id, version, and hash.', path);
    return undefined;
  }
  if (!hasOnlyKeys(value, ['id', 'version', 'hash', 'content_hash', 'material_evidence_hash', 'seeded_evidence_hash'])) addError(errors, 'UNKNOWN_FIELD', 'Identity contains an unknown field.', path);
  const id = boundedString(value.id, limits.max_identity_length) ? value.id : undefined;
  if (id === undefined) addError(errors, 'INVALID_IDENTITY_ID', 'Identity id must be a bounded non-empty string.', `${path}.id`);
  const version = normalizeVersion(value.version, path, errors);
  const hash = canonicalHash(value.hash, limits.max_hash_length) ? value.hash : undefined;
  const contentHash = canonicalHash(value.content_hash, limits.max_hash_length) ? value.content_hash : undefined;
  const materialEvidenceHash = canonicalHash(value.material_evidence_hash, limits.max_hash_length) ? value.material_evidence_hash : undefined;
  const seededEvidenceHash = canonicalHash(value.seeded_evidence_hash, limits.max_hash_length) ? value.seeded_evidence_hash : undefined;
  if (hash === undefined && contentHash === undefined) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity must include a bounded non-empty hash or content_hash.', `${path}.hash`);
  if (value.hash !== undefined && !canonicalHash(value.hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.hash`);
  if (value.content_hash !== undefined && !canonicalHash(value.content_hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity content_hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.content_hash`);
  if (value.material_evidence_hash !== undefined && !canonicalHash(value.material_evidence_hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity material_evidence_hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.material_evidence_hash`);
  if (value.seeded_evidence_hash !== undefined && !canonicalHash(value.seeded_evidence_hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity seeded_evidence_hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.seeded_evidence_hash`);
  const seededEvidenceEnvelope = path === 'proposal' && seededEvidenceHash !== undefined;
  if (hash !== undefined && contentHash !== undefined && hash !== contentHash && !seededEvidenceEnvelope) addError(errors, 'IDENTITY_HASH_MISMATCH', 'hash and content_hash must match when both are supplied.', path);
  if (id === undefined || version === undefined || errors.some((error) => error.path === path || error.path?.startsWith(`${path}.`))) return undefined;
  return {
    id,
    version,
    ...(hash === undefined ? {} : { hash }),
    ...(contentHash === undefined ? {} : { content_hash: contentHash }),
    ...(materialEvidenceHash === undefined ? {} : { material_evidence_hash: materialEvidenceHash }),
    ...(seededEvidenceHash === undefined ? {} : { seeded_evidence_hash: seededEvidenceHash }),
  };
}

export function hashReceiptMaterialEvidence(value: readonly ReceiptMaterialEvidence[]) {
  return `sha256:${sha256Hex(canonicalSerialize(value))}`;
}

export function hashReceiptSeededEvidence(value: readonly ReceiptSeededCompositionEvidence[]) {
  return `sha256:${sha256Hex(canonicalSerialize(value))}`;
}

/** Bind the exact proposal-content identity to its separately reviewable seeded evidence. */
export function hashReceiptProposalEvidenceIdentity(value: Readonly<{
  content_hash: string;
  seeded_evidence_hash: string;
}>) {
  return `sha256:${sha256Hex(canonicalSerialize({
    schema: 'fogwood.receipt-proposal-evidence.v1',
    content_hash: value.content_hash,
    seeded_evidence_hash: value.seeded_evidence_hash,
  }))}`;
}

function normalizeArtifact(
  value: unknown,
  path: string,
  limits: ReceiptLedgerLimits,
  errors: ReceiptValidationError[],
): ReceiptArtifact | undefined {
  if (!isRecord(value)) {
    addError(errors, 'INVALID_ARTIFACT', 'Artifact must include format and hash.', path);
    return undefined;
  }
  if (!hasOnlyKeys(value, ['format', 'hash'])) addError(errors, 'UNKNOWN_FIELD', 'Artifact contains an unknown field.', path);
  const format = boundedString(value.format, limits.max_identity_length) ? value.format : undefined;
  const hash = canonicalHash(value.hash, limits.max_hash_length) ? value.hash : undefined;
  if (format === undefined) addError(errors, 'INVALID_ARTIFACT_FORMAT', 'Artifact format must be a bounded non-empty string.', `${path}.format`);
  if (hash === undefined) addError(errors, 'INVALID_ARTIFACT_HASH', 'Artifact hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.hash`);
  if (format === undefined || hash === undefined || errors.some((error) => error.path === path || error.path?.startsWith(`${path}.`))) return undefined;
  return { format, hash };
}

function normalizeStringList(
  value: unknown,
  path: string,
  limit: number,
  maxLength: number,
  errors: ReceiptValidationError[],
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_LIST', `${path} must be an array of bounded strings.`, path);
    return [];
  }
  if (value.length > limit) addError(errors, path === 'warnings' ? 'WARNINGS_LIMIT' : 'LOSS_LIMIT', `${path} exceeds its configured bound.`, path);
  const normalized: string[] = [];
  value.forEach((entry, index) => {
    if (!boundedString(entry, maxLength)) {
      addError(errors, 'INVALID_LIST_ENTRY', `${path} entries must be bounded non-empty strings.`, `${path}[${index}]`);
      return;
    }
    normalized.push(entry);
  });
  return normalized.slice(0, limit);
}

function normalizeMaterialEvidence(
  value: unknown,
  path: string,
  limits: ReceiptLedgerLimits,
  errors: ReceiptValidationError[],
): ReceiptMaterialEvidence[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'material_evidence must be a bounded array.', path);
    return undefined;
  }
  if (value.length > RECEIPT_MATERIAL_EVIDENCE_LIMIT) addError(errors, 'MATERIAL_EVIDENCE_LIMIT', 'material_evidence exceeds its configured bound.', path);
  const normalized: ReceiptMaterialEvidence[] = [];
  value.slice(0, RECEIPT_MATERIAL_EVIDENCE_LIMIT).forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'Each material evidence entry must be an object.', entryPath);
      return;
    }
    const allowed = ['semantic_id', 'content_hash', 'byte_length', 'mime_type', 'width', 'height', 'source_status', 'decode_qualified', 'x', 'y', 'w', 'h', 'originating_capability', 'qualification_boundary', 'prompt_summary'];
    if (!hasOnlyKeys(entry, allowed)) addError(errors, 'UNKNOWN_FIELD', 'Material evidence contains an unknown field.', entryPath);
    const semanticId = boundedString(entry.semantic_id, limits.max_identity_length) ? entry.semantic_id : undefined;
    const contentHash = canonicalHash(entry.content_hash, limits.max_hash_length) ? entry.content_hash : undefined;
    const mimeType = entry.mime_type === 'image/png' || entry.mime_type === 'image/jpeg' || entry.mime_type === 'image/svg+xml' ? entry.mime_type : undefined;
    const sourceStatus = entry.source_status === 'original' || entry.source_status === 'sanitized' ? entry.source_status : undefined;
    const decodeQualified = entry.decode_qualified === true;
    const byteLength = isFiniteNumber(entry.byte_length) && Number.isSafeInteger(entry.byte_length) && entry.byte_length >= 1 && entry.byte_length <= 12 * 1024 * 1024 ? entry.byte_length : undefined;
    const width = isFiniteNumber(entry.width) && Number.isSafeInteger(entry.width) && entry.width >= 1 && entry.width <= 8192 ? entry.width : undefined;
    const height = isFiniteNumber(entry.height) && Number.isSafeInteger(entry.height) && entry.height >= 1 && entry.height <= 8192 ? entry.height : undefined;
    const x = isFiniteNumber(entry.x) && entry.x >= -100_000 && entry.x <= 100_000 ? entry.x : undefined;
    const y = isFiniteNumber(entry.y) && entry.y >= -100_000 && entry.y <= 100_000 ? entry.y : undefined;
    const w = isFiniteNumber(entry.w) && entry.w >= 16 && entry.w <= 8192 ? entry.w : undefined;
    const h = isFiniteNumber(entry.h) && entry.h >= 16 && entry.h <= 8192 ? entry.h : undefined;
    const originatingCapability = boundedString(entry.originating_capability, limits.max_identity_length) ? entry.originating_capability : undefined;
    const qualificationBoundary = boundedString(entry.qualification_boundary, limits.max_string_length) ? entry.qualification_boundary : undefined;
    const promptSummary = boundedString(entry.prompt_summary, limits.max_string_length) ? entry.prompt_summary : undefined;
    if (semanticId === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'semantic_id must be a bounded non-empty string.', `${entryPath}.semantic_id`);
    if (contentHash === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'content_hash must use the canonical sha256:<64 lowercase hex> form.', `${entryPath}.content_hash`);
    if (byteLength === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'byte_length must be a bounded positive safe integer.', `${entryPath}.byte_length`);
    if (mimeType === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'mime_type must be one of the supported material types.', `${entryPath}.mime_type`);
    if (sourceStatus === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'source_status must be original or sanitized.', `${entryPath}.source_status`);
    if (!decodeQualified) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'decode_qualified must be true for recorded material evidence.', `${entryPath}.decode_qualified`);
    if (width === undefined || height === undefined || (width !== undefined && height !== undefined && width * height > 16_000_000)) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'Material evidence dimensions must stay within the bounded pixel limit.', entryPath);
    if (x === undefined || y === undefined || w === undefined || h === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'Material evidence placement must stay within the bounded page/display limits.', entryPath);
    if (originatingCapability === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'originating_capability must be a bounded non-empty string.', `${entryPath}.originating_capability`);
    if (qualificationBoundary === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'qualification_boundary must be a bounded non-empty string.', `${entryPath}.qualification_boundary`);
    if (promptSummary === undefined) addError(errors, 'INVALID_MATERIAL_EVIDENCE', 'prompt_summary must be a bounded non-empty string.', `${entryPath}.prompt_summary`);
    if (semanticId === undefined || contentHash === undefined || byteLength === undefined || mimeType === undefined || sourceStatus === undefined || width === undefined || height === undefined || x === undefined || y === undefined || w === undefined || h === undefined || originatingCapability === undefined || qualificationBoundary === undefined || promptSummary === undefined) return;
    normalized.push({ semantic_id: semanticId, content_hash: contentHash, byte_length: byteLength, mime_type: mimeType, width, height, source_status: sourceStatus, decode_qualified: true, x, y, w, h, originating_capability: originatingCapability, qualification_boundary: qualificationBoundary, prompt_summary: promptSummary });
  });
  return normalized;
}

function normalizeSeededEvidence(
  value: unknown,
  path: string,
  limits: ReceiptLedgerLimits,
  errors: ReceiptValidationError[],
): ReceiptSeededCompositionEvidence[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > RECEIPT_SEEDED_EVIDENCE_LIMIT) {
    addError(errors, 'SEEDED_EVIDENCE_LIMIT', `seeded_evidence must contain 1-${RECEIPT_SEEDED_EVIDENCE_LIMIT} entries.`, path);
    return undefined;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      addError(errors, 'INVALID_SEEDED_EVIDENCE', 'seeded_evidence cannot contain holes.', `${path}[${index}]`);
      return undefined;
    }
  }
  const normalized: ReceiptSeededCompositionEvidence[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      addError(errors, 'INVALID_SEEDED_EVIDENCE', 'Each seeded evidence entry must be an object.', entryPath);
      return;
    }
    const allowed = ['grammar', 'algorithm_version', 'prng', 'seed', 'wildness', 'source_revision', 'source_fingerprint', 'layout', 'lineage'];
    if (!hasOnlyKeys(entry, allowed)) addError(errors, 'UNKNOWN_FIELD', 'Seeded evidence contains an unknown field.', entryPath);
    const grammar = entry.grammar === 'remix' ? 'remix' as const : undefined;
    const algorithmVersion = entry.algorithm_version === 1 ? 1 as const : undefined;
    const prng = entry.prng === 'xorshift32-v1' ? 'xorshift32-v1' as const : undefined;
    const seed = typeof entry.seed === 'string' && entry.seed.trim().length > 0 && entry.seed.length <= 96
      ? entry.seed
      : typeof entry.seed === 'number' && Number.isSafeInteger(entry.seed)
        ? entry.seed
        : undefined;
    const wildness = isFiniteNumber(entry.wildness) && entry.wildness >= 0 && entry.wildness <= 1 ? entry.wildness : undefined;
    const sourceRevision = boundedString(entry.source_revision, limits.max_revision_length) ? entry.source_revision : undefined;
    const sourceFingerprint = canonicalHash(entry.source_fingerprint, limits.max_hash_length) ? entry.source_fingerprint : undefined;
    if (grammar === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'grammar must be remix.', `${entryPath}.grammar`);
    if (algorithmVersion === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'algorithm_version must be 1.', `${entryPath}.algorithm_version`);
    if (prng === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'prng must be xorshift32-v1.', `${entryPath}.prng`);
    if (seed === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'seed must be a bounded string or safe integer.', `${entryPath}.seed`);
    if (wildness === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'wildness must be a finite number from 0 to 1.', `${entryPath}.wildness`);
    if (sourceRevision === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'source_revision must be bounded.', `${entryPath}.source_revision`);
    if (sourceFingerprint === undefined) addError(errors, 'INVALID_SEEDED_EVIDENCE', 'source_fingerprint must be a canonical SHA-256 identity.', `${entryPath}.source_fingerprint`);

    let layout: ReceiptSeededCompositionEvidence['layout'] | undefined;
    if (!isRecord(entry.layout) || !hasOnlyKeys(entry.layout, ['kind', 'open_side', 'branch_count', 'open_gap', 'rhythm'])) {
      addError(errors, 'INVALID_SEEDED_EVIDENCE', 'layout must be the bounded branch-cluster projection.', `${entryPath}.layout`);
    } else {
      const side = ['right', 'bottom', 'left', 'top'].includes(String(entry.layout.open_side))
        ? entry.layout.open_side as ReceiptSeededCompositionEvidence['layout']['open_side']
        : undefined;
      const branchCount = isFiniteNumber(entry.layout.branch_count) && Number.isSafeInteger(entry.layout.branch_count) && entry.layout.branch_count >= 1 && entry.layout.branch_count <= RECEIPT_SEEDED_LINEAGE_LIMIT ? entry.layout.branch_count : undefined;
      const openGap = isFiniteNumber(entry.layout.open_gap) && entry.layout.open_gap >= 0 && entry.layout.open_gap <= 10_000 ? entry.layout.open_gap : undefined;
      const rhythm = isFiniteNumber(entry.layout.rhythm) && entry.layout.rhythm >= 0.5 && entry.layout.rhythm <= 1.5 ? entry.layout.rhythm : undefined;
      if (entry.layout.kind !== 'branch-cluster' || side === undefined || branchCount === undefined || openGap === undefined || rhythm === undefined) {
        addError(errors, 'INVALID_SEEDED_EVIDENCE', 'layout fields exceed the seeded branch-cluster bounds.', `${entryPath}.layout`);
      } else {
        layout = { kind: 'branch-cluster', open_side: side, branch_count: branchCount, open_gap: openGap, rhythm };
      }
    }

    const lineage: Array<ReceiptSeededCompositionEvidence['lineage'][number]> = [];
    const lineageLength = Array.isArray(entry.lineage) ? entry.lineage.length : -1;
    if (!Array.isArray(entry.lineage) || entry.lineage.length < 1 || entry.lineage.length > RECEIPT_SEEDED_LINEAGE_LIMIT) {
      addError(errors, 'SEEDED_LINEAGE_LIMIT', `lineage must contain 1-${RECEIPT_SEEDED_LINEAGE_LIMIT} entries.`, `${entryPath}.lineage`);
    } else {
      for (let lineageIndex = 0; lineageIndex < entry.lineage.length; lineageIndex += 1) {
        const candidate = entry.lineage[lineageIndex];
        const lineagePath = `${entryPath}.lineage[${lineageIndex}]`;
        if (!isRecord(candidate) || !hasOnlyKeys(candidate, ['source_semantic_id', 'variant_semantic_id', 'lineage_source_id', 'parent_variant_id', 'branch_index', 'depth'])) {
          addError(errors, 'INVALID_SEEDED_LINEAGE', 'Seeded lineage must contain only bounded replay fields.', lineagePath);
          continue;
        }
        const sourceSemanticId = boundedString(candidate.source_semantic_id, limits.max_identity_length) ? candidate.source_semantic_id : undefined;
        const variantSemanticId = boundedString(candidate.variant_semantic_id, limits.max_identity_length) ? candidate.variant_semantic_id : undefined;
        const lineageSourceId = boundedString(candidate.lineage_source_id, limits.max_identity_length) ? candidate.lineage_source_id : undefined;
        const parentVariantId = candidate.parent_variant_id === undefined
          ? undefined
          : boundedString(candidate.parent_variant_id, limits.max_identity_length)
            ? candidate.parent_variant_id
            : null;
        const branchIndex = isFiniteNumber(candidate.branch_index) && Number.isSafeInteger(candidate.branch_index) && candidate.branch_index >= 0 && candidate.branch_index < RECEIPT_SEEDED_LINEAGE_LIMIT ? candidate.branch_index : undefined;
        const depth = isFiniteNumber(candidate.depth) && Number.isSafeInteger(candidate.depth) && candidate.depth >= 0 && candidate.depth < RECEIPT_SEEDED_LINEAGE_LIMIT ? candidate.depth : undefined;
        if (sourceSemanticId === undefined || variantSemanticId === undefined || lineageSourceId === undefined || parentVariantId === null || branchIndex === undefined || depth === undefined) {
          addError(errors, 'INVALID_SEEDED_LINEAGE', 'Seeded lineage fields must stay within their declared bounds.', lineagePath);
          continue;
        }
        lineage.push({ source_semantic_id: sourceSemanticId, variant_semantic_id: variantSemanticId, lineage_source_id: lineageSourceId, ...(parentVariantId === undefined ? {} : { parent_variant_id: parentVariantId }), branch_index: branchIndex, depth });
      }
    }
    if (grammar === undefined || algorithmVersion === undefined || prng === undefined || seed === undefined || wildness === undefined || sourceRevision === undefined || sourceFingerprint === undefined || layout === undefined || lineage.length !== lineageLength) return;
    normalized.push({ grammar, algorithm_version: algorithmVersion, prng, seed, wildness, source_revision: sourceRevision, source_fingerprint: sourceFingerprint, layout, lineage });
  });
  return normalized;
}

/**
 * Normalize and validate an event draft. This function intentionally does not
 * assign receipt IDs, timestamps, or sequence numbers; validation is pure and
 * therefore safe to call before checking storage capacity.
 */
function validateDraft(input: unknown, limits: ReceiptLedgerLimits): ReceiptValidationResult {
  const errors: ReceiptValidationError[] = [];
  if (!isRecord(input)) return { ok: false, status: 'INVALID_RECEIPT', errors: [{ code: 'WRONG_TYPE', message: 'Receipt draft must be an object.' }] };
  if (!hasOnlyKeys(input, DRAFT_KEYS)) addError(errors, 'UNKNOWN_FIELD', 'Receipt draft contains an unknown field.');
  const event = isReceiptEvent(input.event) ? input.event : undefined;
  if (event === undefined) addError(errors, 'INVALID_EVENT', 'Receipt event is not supported.', 'event');
  const planId = input.plan_id === undefined
    ? undefined
    : typeof input.plan_id === 'string' && PREPARED_PLAN_ID.test(input.plan_id)
      ? input.plan_id
      : null;
  if (planId === null) addError(errors, 'INVALID_PLAN_ID', 'plan_id must be a lowercase SHA-256 prepared-plan identity.', 'plan_id');

  const outcome = isReceiptOutcome(input.outcome) ? input.outcome : undefined;
  if (outcome === undefined) addError(errors, 'INVALID_OUTCOME', 'outcome must be one of staged, applied, rejected, inserted, or exported.', 'outcome');
  if (input.locality !== undefined && input.locality !== 'device-local') addError(errors, 'INVALID_LOCALITY', 'Receipts can only be device-local.', 'locality');
  const qualificationBoundary = boundedString(input.qualification_boundary, limits.max_string_length) ? input.qualification_boundary : undefined;
  if (qualificationBoundary === undefined) {
    addError(errors, 'INVALID_QUALIFICATION_BOUNDARY', 'qualification_boundary must be a bounded non-empty string.', 'qualification_boundary');
  }

  const sourceRevision = boundedString(input.source_revision, limits.max_revision_length) ? input.source_revision : undefined;
  const baseRevision = boundedString(input.base_revision, limits.max_revision_length) ? input.base_revision : undefined;
  const resultRevision = boundedString(input.result_revision, limits.max_revision_length) ? input.result_revision : undefined;
  for (const [value, path] of [[input.source_revision, 'source_revision'], [input.base_revision, 'base_revision'], [input.result_revision, 'result_revision']] as const) {
    if (value !== undefined && !boundedString(value, limits.max_revision_length)) addError(errors, 'INVALID_REVISION', 'Revision must be a bounded non-empty string.', path);
  }

  const warnings = normalizeStringList(input.warnings, 'warnings', limits.max_warnings, limits.max_string_length, errors);
  const loss = normalizeStringList(input.loss, 'loss', limits.max_loss_entries, limits.max_string_length, errors);
  const proposal = input.proposal === undefined ? undefined : normalizeIdentity(input.proposal, 'proposal', limits, errors);
  const packageIdentity = input.package === undefined ? undefined : normalizeIdentity(input.package, 'package', limits, errors);
  const recipe = input.recipe === undefined ? undefined : normalizeIdentity(input.recipe, 'recipe', limits, errors);
  const materialEvidence = normalizeMaterialEvidence(input.material_evidence, 'material_evidence', limits, errors);
  const seededEvidence = normalizeSeededEvidence(input.seeded_evidence, 'seeded_evidence', limits, errors);
  if (materialEvidence && materialEvidence.length > 0) {
    const expectedEvidenceHash = hashReceiptMaterialEvidence(materialEvidence);
    if (proposal?.material_evidence_hash !== expectedEvidenceHash) {
      addError(errors, 'MATERIAL_EVIDENCE_HASH_MISMATCH', 'Material evidence must match the digest bound into the proposal identity.', 'material_evidence');
    }
  }
  if (seededEvidence && seededEvidence.length > 0) {
    const expectedEvidenceHash = hashReceiptSeededEvidence(seededEvidence);
    if (proposal?.seeded_evidence_hash !== expectedEvidenceHash) {
      addError(errors, 'SEEDED_EVIDENCE_HASH_MISMATCH', 'Seeded evidence must match the digest bound into the proposal identity.', 'seeded_evidence');
    }
  } else if (proposal?.seeded_evidence_hash !== undefined) {
    addError(errors, 'MISSING_SEEDED_EVIDENCE', 'A proposal seeded_evidence_hash requires its bounded seeded evidence projection.', 'seeded_evidence');
  }
  if (proposal?.seeded_evidence_hash !== undefined) {
    if (proposal.hash === undefined || proposal.content_hash === undefined) {
      addError(errors, 'MISSING_PROPOSAL_EVIDENCE_IDENTITY', 'Seeded proposal evidence requires both the exact proposal content_hash and its evidence-bound hash.', 'proposal');
    } else {
      const expectedProposalHash = hashReceiptProposalEvidenceIdentity({
        content_hash: proposal.content_hash,
        seeded_evidence_hash: proposal.seeded_evidence_hash,
      });
      if (proposal.hash !== expectedProposalHash) {
        addError(errors, 'PROPOSAL_EVIDENCE_IDENTITY_MISMATCH', 'The proposal identity must bind its exact content hash to the seeded evidence digest.', 'proposal.hash');
      }
    }
  }
  const artifact = input.artifact === undefined ? undefined : normalizeArtifact(input.artifact, 'artifact', limits, errors);
  let reason: string | undefined;
  if (input.reason !== undefined) {
    if (boundedString(input.reason, limits.max_string_length)) reason = input.reason;
    else addError(errors, 'INVALID_REASON', 'reason must be a bounded non-empty string.', 'reason');
  }

  const requireField = (field: string, value: unknown, message: string) => {
    if (value === undefined) addError(errors, 'MISSING_FIELD', message, field);
  };
  if (event !== undefined && outcome !== undefined && outcome !== expectedOutcome(event)) {
    addError(errors, 'EVENT_OUTCOME_MISMATCH', `${event} receipts must use outcome ${expectedOutcome(event)}.`, 'outcome');
  }
  if (event === 'proposal-staged') {
    requireField('proposal', proposal, 'proposal identity is required for a staged proposal.');
    requireField('source_revision', sourceRevision, 'source_revision is required for a staged proposal.');
    requireField('base_revision', baseRevision, 'base_revision is required for a staged proposal.');
    if (resultRevision !== undefined) addError(errors, 'UNEXPECTED_RESULT_REVISION', 'A staged proposal cannot claim a result revision.', 'result_revision');
  }
  if (event === 'proposal-applied') {
    requireField('proposal', proposal, 'proposal identity is required for an applied proposal.');
    requireField('source_revision', sourceRevision, 'source_revision is required for an applied proposal.');
    requireField('base_revision', baseRevision, 'base_revision is required for an applied proposal.');
    requireField('result_revision', resultRevision, 'result_revision is required for an applied proposal.');
  }
  if (event === 'proposal-rejected') {
    requireField('proposal', proposal, 'proposal identity is required for a rejected proposal.');
    requireField('source_revision', sourceRevision, 'source_revision is required for a rejected proposal.');
    requireField('base_revision', baseRevision, 'base_revision is required for a rejected proposal.');
    if (resultRevision !== undefined) addError(errors, 'UNEXPECTED_RESULT_REVISION', 'A rejected proposal cannot claim a result revision.', 'result_revision');
  }
  if (event === 'recipe-staged') {
    requireField('recipe', recipe, 'recipe identity is required for a staged recipe.');
    requireField('package', packageIdentity, 'package identity is required for a staged recipe.');
    requireField('source_revision', sourceRevision, 'source_revision is required for a staged recipe.');
    requireField('base_revision', baseRevision, 'base_revision is required for a staged recipe.');
    if (resultRevision !== undefined) addError(errors, 'UNEXPECTED_RESULT_REVISION', 'A staged recipe cannot claim a result revision.', 'result_revision');
  }
  if (event === 'recipe-inserted') {
    requireField('recipe', recipe, 'recipe identity is required for an inserted recipe.');
    requireField('package', packageIdentity, 'package identity is required for an inserted recipe.');
    requireField('source_revision', sourceRevision, 'source_revision is required for an inserted recipe.');
    requireField('base_revision', baseRevision, 'base_revision is required for an inserted recipe.');
    requireField('result_revision', resultRevision, 'result_revision is required for an inserted recipe.');
  }
  if (event === 'snapshot-exported') {
    requireField('source_revision', sourceRevision, 'source_revision is required for a snapshot export.');
    requireField('artifact', artifact, 'artifact is required for a snapshot export.');
  }

  if (errors.length > 0 || event === undefined || outcome === undefined || qualificationBoundary === undefined) return { ok: false, status: 'INVALID_RECEIPT', errors };
  const normalized = {
    event,
    ...(planId === undefined || planId === null ? {} : { plan_id: planId }),
    ...(sourceRevision === undefined ? {} : { source_revision: sourceRevision }),
    ...(baseRevision === undefined ? {} : { base_revision: baseRevision }),
    ...(resultRevision === undefined ? {} : { result_revision: resultRevision }),
    ...(proposal === undefined ? {} : { proposal }),
    ...(packageIdentity === undefined ? {} : { package: packageIdentity }),
    ...(recipe === undefined ? {} : { recipe }),
    ...(materialEvidence === undefined ? {} : { material_evidence: materialEvidence }),
    ...(seededEvidence === undefined ? {} : { seeded_evidence: seededEvidence }),
    outcome,
    locality: 'device-local' as const,
    qualification_boundary: qualificationBoundary,
    warnings,
    loss,
    ...(artifact === undefined ? {} : { artifact }),
    ...(reason === undefined ? {} : { reason }),
    authority: 'evidence-only' as const,
  } satisfies ReceiptDraft & { locality: ReceiptLocality; warnings: readonly string[]; loss: readonly string[]; authority: ReceiptAuthority };
  return { ok: true, receipt: deepFreeze(normalized) };
}

type StoredRecordValidation = {
  errors: ReceiptValidationError[];
  receipt?: Receipt;
};

function validateStoredRecord(value: unknown, limits: ReceiptLedgerLimits, index: number): StoredRecordValidation {
  const errors: ReceiptValidationError[] = [];
  const path = `receipts[${index}]`;
  if (!isRecord(value)) return { errors: [{ code: 'WRONG_TYPE', message: 'Stored receipt must be an object.', path }] };
  if (!hasOnlyKeys(value, RECORD_KEYS)) addError(errors, 'UNKNOWN_FIELD', 'Stored receipt contains an unknown field.', path);
  if (value.schema_version !== RECEIPT_SCHEMA_VERSION) addError(errors, 'INVALID_SCHEMA_VERSION', 'Stored receipt schema_version is unsupported.', `${path}.schema_version`);
  const receiptId = boundedString(value.receipt_id, limits.max_identity_length) ? value.receipt_id : undefined;
  const sequence = isFiniteNumber(value.sequence) && Number.isSafeInteger(value.sequence) && value.sequence >= 1 ? value.sequence : undefined;
  const recordedAt = boundedString(value.recorded_at, 100) ? value.recorded_at : undefined;
  if (receiptId === undefined) addError(errors, 'INVALID_RECEIPT_ID', 'Stored receipt_id must be a bounded non-empty string.', `${path}.receipt_id`);
  if (sequence === undefined) addError(errors, 'INVALID_SEQUENCE', 'Stored sequence must be a positive safe integer.', `${path}.sequence`);
  if (recordedAt === undefined) addError(errors, 'INVALID_RECORDED_AT', 'Stored recorded_at must be a bounded non-empty string.', `${path}.recorded_at`);
  if (value.authority !== 'evidence-only') addError(errors, 'INVALID_AUTHORITY', 'Receipts are evidence-only and cannot grant authority.', `${path}.authority`);
  if (value.locality !== 'device-local') addError(errors, 'INVALID_LOCALITY', 'Stored receipts must be device-local.', `${path}.locality`);
  const draft: Record<string, unknown> = {};
  DRAFT_KEYS.forEach((key) => {
    if (key in value) draft[key] = value[key];
  });
  draft.locality = value.locality;
  const result = validateDraft(draft, limits);
  if (!result.ok) {
    errors.push(...result.errors.map((error) => ({ ...error, path: error.path ? `${path}.${error.path}` : path })));
  }
  if (errors.length > 0 || !result.ok || receiptId === undefined || sequence === undefined || recordedAt === undefined) return { errors };
  return {
    errors,
    receipt: {
      schema_version: RECEIPT_SCHEMA_VERSION,
      receipt_id: receiptId,
      sequence,
      recorded_at: recordedAt,
      ...result.receipt,
    },
  };
}

function parseLedger(raw: string | null | undefined, limits: ReceiptLedgerLimits): ReceiptValidateStoredResult {
  if (raw === null || raw === undefined) return { ok: true, receipts: [] };
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, status: 'MALFORMED_STORAGE', error: { code: 'INVALID_STORAGE_VALUE', message: 'Receipt storage must contain serialized JSON or be empty.' } };
  }
  if (utf8ByteLength(raw) > limits.max_serialized_bytes) {
    return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_SERIALIZED_BYTES', message: 'Stored receipt ledger exceeds its configured byte bound.' } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 'MALFORMED_STORAGE', error: { code: 'INVALID_JSON', message: 'Stored receipt ledger is not valid JSON.' } };
  }
  if (!isRecord(parsed) || !hasOnlyKeys(parsed, ['schema_version', 'receipts'])) {
    return { ok: false, status: 'MALFORMED_STORAGE', error: { code: 'INVALID_LEDGER', message: 'Stored receipt ledger must contain only schema_version and receipts.' } };
  }
  if (parsed.schema_version !== RECEIPT_LEDGER_SCHEMA_VERSION) {
    return { ok: false, status: 'MALFORMED_STORAGE', error: { code: 'INVALID_SCHEMA_VERSION', message: 'Stored receipt ledger schema_version is unsupported.' } };
  }
  if (!Array.isArray(parsed.receipts)) {
    return { ok: false, status: 'MALFORMED_STORAGE', error: { code: 'INVALID_RECEIPTS', message: 'Stored receipt ledger receipts must be an array.' } };
  }
  if (parsed.receipts.length > limits.max_records) {
    return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_RECORDS', message: 'Stored receipt ledger exceeds its configured record bound.' } };
  }
  const errors: ReceiptValidationError[] = [];
  const ids = new Set<string>();
  let previousSequence = 0;
  const receipts: Receipt[] = [];
  parsed.receipts.forEach((value, index) => {
    const recordValidation = validateStoredRecord(value, limits, index);
    errors.push(...recordValidation.errors);
    if (!isRecord(value)) return;
    if (typeof value.receipt_id === 'string') {
      if (ids.has(value.receipt_id)) addError(errors, 'DUPLICATE_RECEIPT_ID', 'Stored receipt IDs must be unique.', `receipts[${index}].receipt_id`);
      ids.add(value.receipt_id);
    }
    if (isFiniteNumber(value.sequence)) {
      if (value.sequence <= previousSequence) addError(errors, 'UNORDERED_RECEIPTS', 'Stored receipts must be in strictly increasing sequence order.', `receipts[${index}].sequence`);
      previousSequence = value.sequence;
    }
    if (recordValidation.errors.length === 0 && recordValidation.receipt !== undefined) {
      receipts.push(deepFreeze(recordValidation.receipt, limits));
    }
  });
  const firstError = errors[0];
  if (firstError !== undefined) return { ok: false, status: 'MALFORMED_STORAGE', error: { code: firstError.code, message: firstError.message, ...(firstError.path === undefined ? {} : { path: firstError.path }) } };
  return { ok: true, receipts: deepFreeze(receipts) };
}

function serializeLedger(receipts: readonly Receipt[]): string {
  return JSON.stringify({ schema_version: RECEIPT_LEDGER_SCHEMA_VERSION, receipts });
}

export type ReceiptDraftInput = Omit<ReceiptDraft, 'event'>;

type EventReceiptInput<RequiredFields extends keyof ReceiptDraftInput, Outcome extends ReceiptOutcome> =
  Omit<ReceiptDraftInput, RequiredFields | 'outcome'> &
  Required<Pick<ReceiptDraftInput, RequiredFields>> &
  { outcome: Outcome };

export type ProposalStagedReceiptInput = EventReceiptInput<'proposal' | 'source_revision' | 'base_revision', 'staged'>;
export type ProposalAppliedReceiptInput = EventReceiptInput<'proposal' | 'source_revision' | 'base_revision' | 'result_revision', 'applied'>;
export type ProposalRejectedReceiptInput = EventReceiptInput<'proposal' | 'source_revision' | 'base_revision', 'rejected'>;
export type RecipeStagedReceiptInput = EventReceiptInput<'recipe' | 'package' | 'source_revision' | 'base_revision', 'staged'>;
export type RecipeInsertedReceiptInput = EventReceiptInput<'recipe' | 'package' | 'source_revision' | 'base_revision' | 'result_revision', 'inserted'>;
export type SnapshotExportedReceiptInput = EventReceiptInput<'source_revision' | 'artifact', 'exported'>;

function deepClone(value: ReceiptDraftInput, limits?: ReceiptLedgerLimits): ReceiptDraftInput;
function deepClone(value: unknown, limits: ReceiptLedgerLimits = DEFAULT_RECEIPT_LIMITS): unknown {
  return cloneUnknown(value, traversalState(limits), 0, '$');
}

function makeDraft(event: ReceiptEvent, input: ReceiptDraftInput): ReceiptDraft {
  return deepFreeze({ ...deepClone(input), event });
}

export function createProposalStagedReceipt(input: ProposalStagedReceiptInput): ReceiptDraft {
  return makeDraft('proposal-staged', input);
}

export function createProposalAppliedReceipt(input: ProposalAppliedReceiptInput): ReceiptDraft {
  return makeDraft('proposal-applied', input);
}

export function createProposalRejectedReceipt(input: ProposalRejectedReceiptInput): ReceiptDraft {
  return makeDraft('proposal-rejected', input);
}

export function createRecipeStagedReceipt(input: RecipeStagedReceiptInput): ReceiptDraft {
  return makeDraft('recipe-staged', input);
}

export function createRecipeInsertedReceipt(input: RecipeInsertedReceiptInput): ReceiptDraft {
  return makeDraft('recipe-inserted', input);
}

export function createSnapshotExportedReceipt(input: SnapshotExportedReceiptInput): ReceiptDraft {
  return makeDraft('snapshot-exported', input);
}

let fallbackReceiptId = 0;

export function createReceiptLedger(options: ReceiptLedgerOptions) {
  if (!options || !options.storage || typeof options.storage.read !== 'function' || typeof options.storage.write !== 'function') {
    throw new TypeError('Receipt ledger requires a storage adapter with read and write functions.');
  }
  const limits = normalizeLimits(options.limits);
  const clock: ReceiptClock = options.clock ?? (() => new Date().toISOString());
  const idSource: ReceiptIdSource = options.idSource ?? (() => `receipt:${fallbackReceiptId++}`);

  const readStored = (): { raw: string | null | undefined; result: ReceiptValidateStoredResult } => {
    let raw: string | null | undefined;
    try {
      raw = options.storage.read();
    } catch {
      return {
        raw: undefined,
        result: { ok: false, status: 'STORAGE_ERROR', error: { code: 'READ_FAILED', message: 'Receipt storage read failed.' } },
      };
    }
    try {
      return { raw, result: parseLedger(raw, limits) };
    } catch (error) {
      const constructionError = error instanceof ReceiptConstructionError ? error : undefined;
      return {
        raw,
        result: {
          ok: false,
          status: 'MALFORMED_STORAGE',
          error: {
            code: constructionError?.code ?? 'STORAGE_PARSE_FAILED',
            message: constructionError?.message ?? 'Receipt storage could not be validated safely.',
            ...(constructionError?.path === undefined ? {} : { path: constructionError.path }),
          },
        },
      };
    }
  };

  const validate = (draft: unknown): ReceiptValidationResult => validateDraft(draft, limits);

  const append = (draft: unknown): ReceiptAppendResult => {
    const storedRead = readStored();
    const stored = storedRead.result;
    if (!stored.ok) return stored;
    const validated = validateDraft(draft, limits);
    if (!validated.ok) {
      const firstError = validated.errors[0];
      return {
        ok: false,
        status: 'INVALID_RECEIPT',
        error: {
          code: firstError?.code ?? 'INVALID_RECEIPT',
          message: firstError?.message ?? 'Receipt draft is invalid.',
          ...(firstError?.path === undefined ? {} : { path: firstError.path }),
        },
        errors: validated.errors,
      };
    }
    if (stored.receipts.length >= limits.max_records) {
      return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_RECORDS', message: 'Receipt ledger is full; no evidence was evicted.' } };
    }
    let receiptId: string;
    try {
      receiptId = idSource();
    } catch {
      return { ok: false, status: 'STORAGE_ERROR', error: { code: 'ID_SOURCE_FAILED', message: 'Receipt ID source failed; no evidence was written.' } };
    }
    if (!boundedString(receiptId, limits.max_identity_length)) {
      return { ok: false, status: 'INVALID_RECEIPT', error: { code: 'INVALID_RECEIPT_ID', message: 'Receipt ID source must return a bounded non-empty string.' } };
    }
    if (stored.receipts.some((receipt) => receipt.receipt_id === receiptId)) {
      return { ok: false, status: 'DUPLICATE_RECEIPT_ID', error: { code: 'DUPLICATE_RECEIPT_ID', message: 'Receipt ID source returned an ID already present in the ledger.' } };
    }
    let recordedAt: string | undefined;
    try {
      recordedAt = normalizeClockValue(clock());
    } catch {
      recordedAt = undefined;
    }
    if (!recordedAt) return { ok: false, status: 'STORAGE_ERROR', error: { code: 'CLOCK_FAILED', message: 'Receipt clock failed; no evidence was written.' } };
    const lastReceipt = stored.receipts[stored.receipts.length - 1];
    const nextSequence = lastReceipt === undefined ? 1 : lastReceipt.sequence + 1;
    if (!Number.isSafeInteger(nextSequence)) return { ok: false, status: 'LEDGER_FULL', error: { code: 'SEQUENCE_EXHAUSTED', message: 'Receipt sequence is exhausted; no evidence was written.' } };
    let receipt: Receipt;
    try {
      receipt = deepFreeze({
        schema_version: RECEIPT_SCHEMA_VERSION,
        receipt_id: receiptId,
        sequence: nextSequence,
        recorded_at: recordedAt,
        ...validated.receipt,
      }, limits);
    } catch (error) {
      const constructionError = error instanceof ReceiptConstructionError ? error : undefined;
      return {
        ok: false,
        status: 'INVALID_RECEIPT',
        error: {
          code: constructionError?.code ?? 'RECEIPT_FREEZE_FAILED',
          message: constructionError?.message ?? 'Receipt could not be frozen safely; no evidence was written.',
          ...(constructionError?.path === undefined ? {} : { path: constructionError.path }),
        },
      };
    }
    const nextReceipts = [...stored.receipts, receipt];
    const serialized = serializeLedger(nextReceipts);
    if (utf8ByteLength(serialized) > limits.max_serialized_bytes) {
      return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_SERIALIZED_BYTES', message: 'Receipt ledger byte bound would be exceeded; no evidence was evicted.' } };
    }
    // This synchronous optimistic reread detects an intervening write that
    // happened before this adapter call. It cannot make two independent tabs
    // atomic; adapters needing that guarantee must provide compare-and-swap.
    let latestRaw: string | null | undefined;
    try {
      latestRaw = options.storage.read();
    } catch {
      return { ok: false, status: 'STORAGE_ERROR', error: { code: 'READ_FAILED', message: 'Receipt storage reread failed; no evidence was written.' } };
    }
    if ((latestRaw ?? null) !== (storedRead.raw ?? null)) {
      return { ok: false, status: 'STORAGE_CONFLICT', error: { code: 'STORAGE_CONFLICT', message: 'Receipt storage changed during append; no evidence was written.' } };
    }
    try {
      options.storage.write(serialized);
    } catch {
      return { ok: false, status: 'STORAGE_ERROR', error: { code: 'WRITE_FAILED', message: 'Receipt storage write failed; existing evidence was not intentionally changed.' } };
    }
    return { ok: true, receipt, total: nextReceipts.length };
  };

  const appendMany = (drafts: readonly unknown[]): ReceiptAppendManyResult => {
    if (!Array.isArray(drafts) || drafts.length < 1 || drafts.length > RECEIPT_BATCH_LIMIT) {
      return {
        ok: false,
        status: 'INVALID_RECEIPT',
        error: { code: 'BATCH_LIMIT', message: `Receipt appendMany accepts between 1 and ${RECEIPT_BATCH_LIMIT} drafts.` },
      };
    }

    const validatedDrafts: NormalizedReceiptDraft[] = [];
    const validationErrors: ReceiptValidationError[] = [];
    for (const [index, draft] of drafts.entries()) {
      const validated = validateDraft(draft, limits);
      if (validated.ok) {
        validatedDrafts.push(validated.receipt);
      } else {
        validationErrors.push(...validated.errors.map((error) => ({
          ...error,
          path: error.path === undefined ? `drafts[${index}]` : `drafts[${index}].${error.path}`,
        })));
      }
    }
    if (validationErrors.length > 0) {
      const firstError = validationErrors[0];
      return {
        ok: false,
        status: 'INVALID_RECEIPT',
        error: {
          code: firstError?.code ?? 'INVALID_RECEIPT',
          message: firstError?.message ?? 'One or more receipt drafts are invalid.',
          ...(firstError?.path === undefined ? {} : { path: firstError.path }),
        },
        errors: validationErrors,
      };
    }

    const storedRead = readStored();
    const stored = storedRead.result;
    if (!stored.ok) return stored;
    if (stored.receipts.length + validatedDrafts.length > limits.max_records) {
      return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_RECORDS', message: 'Receipt ledger cannot fit the complete batch; no evidence was evicted.' } };
    }

    const usedIds = new Set(stored.receipts.map((receipt) => receipt.receipt_id));
    const newReceipts: Receipt[] = [];
    const lastReceipt = stored.receipts[stored.receipts.length - 1];
    let nextSequence = lastReceipt === undefined ? 0 : lastReceipt.sequence;
    for (const draft of validatedDrafts) {
      let receiptId: string;
      try {
        receiptId = idSource();
      } catch {
        return { ok: false, status: 'STORAGE_ERROR', error: { code: 'ID_SOURCE_FAILED', message: 'Receipt ID source failed; no evidence was written.' } };
      }
      if (!boundedString(receiptId, limits.max_identity_length)) {
        return { ok: false, status: 'INVALID_RECEIPT', error: { code: 'INVALID_RECEIPT_ID', message: 'Receipt ID source must return bounded non-empty strings; no evidence was written.' } };
      }
      if (usedIds.has(receiptId)) {
        return { ok: false, status: 'DUPLICATE_RECEIPT_ID', error: { code: 'DUPLICATE_RECEIPT_ID', message: 'Receipt ID source returned a duplicate ID; no evidence was written.' } };
      }
      usedIds.add(receiptId);

      let recordedAt: string | undefined;
      try {
        recordedAt = normalizeClockValue(clock());
      } catch {
        recordedAt = undefined;
      }
      if (recordedAt === undefined) return { ok: false, status: 'STORAGE_ERROR', error: { code: 'CLOCK_FAILED', message: 'Receipt clock failed; no evidence was written.' } };
      nextSequence += 1;
      if (!Number.isSafeInteger(nextSequence)) return { ok: false, status: 'LEDGER_FULL', error: { code: 'SEQUENCE_EXHAUSTED', message: 'Receipt sequence is exhausted; no evidence was written.' } };
      let receipt: Receipt;
      try {
        receipt = deepFreeze({
          schema_version: RECEIPT_SCHEMA_VERSION,
          receipt_id: receiptId,
          sequence: nextSequence,
          recorded_at: recordedAt,
          ...draft,
        }, limits);
      } catch (error) {
        const constructionError = error instanceof ReceiptConstructionError ? error : undefined;
        return {
          ok: false,
          status: 'INVALID_RECEIPT',
          error: {
            code: constructionError?.code ?? 'RECEIPT_FREEZE_FAILED',
            message: constructionError?.message ?? 'Receipt could not be frozen safely; no evidence was written.',
            ...(constructionError?.path === undefined ? {} : { path: constructionError.path }),
          },
        };
      }
      newReceipts.push(receipt);
    }

    let batchReceipts: readonly Receipt[];
    try {
      batchReceipts = deepFreeze(newReceipts, limits);
    } catch (error) {
      const constructionError = error instanceof ReceiptConstructionError ? error : undefined;
      return {
        ok: false,
        status: 'INVALID_RECEIPT',
        error: {
          code: constructionError?.code ?? 'RECEIPT_FREEZE_FAILED',
          message: constructionError?.message ?? 'Receipt batch could not be frozen safely; no evidence was written.',
          ...(constructionError?.path === undefined ? {} : { path: constructionError.path }),
        },
      };
    }
    const nextReceipts = [...stored.receipts, ...batchReceipts];
    const serialized = serializeLedger(nextReceipts);
    if (utf8ByteLength(serialized) > limits.max_serialized_bytes) {
      return { ok: false, status: 'LEDGER_FULL', error: { code: 'MAX_SERIALIZED_BYTES', message: 'Receipt ledger byte bound would be exceeded; no evidence was evicted.' } };
    }

    // One optimistic reread covers the whole batch. This is conflict
    // detection for the synchronous adapter, not cross-tab atomicity.
    let latestRaw: string | null | undefined;
    try {
      latestRaw = options.storage.read();
    } catch {
      return { ok: false, status: 'STORAGE_ERROR', error: { code: 'READ_FAILED', message: 'Receipt storage reread failed; no evidence was written.' } };
    }
    if ((latestRaw ?? null) !== (storedRead.raw ?? null)) {
      return { ok: false, status: 'STORAGE_CONFLICT', error: { code: 'STORAGE_CONFLICT', message: 'Receipt storage changed during appendMany; no evidence was written.' } };
    }
    try {
      options.storage.write(serialized);
    } catch {
      return { ok: false, status: 'STORAGE_ERROR', error: { code: 'WRITE_FAILED', message: 'Receipt storage write failed; existing evidence was not intentionally changed.' } };
    }
    return { ok: true, receipts: batchReceipts, total: nextReceipts.length };
  };

  const list = (input: ReceiptListInput = {}): ReceiptListResult => {
    const stored = readStored().result;
    if (!stored.ok) return stored;
    const requestedLimit = input.limit === undefined ? limits.max_read : input.limit;
    if (!isFiniteNumber(requestedLimit)) return { ok: false, status: 'INVALID_READ', error: { code: 'INVALID_LIMIT', message: 'Read limit must be a finite number.' } };
    const limit = Math.max(1, Math.min(limits.max_read, Math.trunc(requestedLimit)));
    const cursor = input.cursor === undefined ? 0 : (/^\d+$/.test(input.cursor) ? Number(input.cursor) : NaN);
    if (!Number.isSafeInteger(cursor) || cursor < 0) return { ok: false, status: 'INVALID_READ', error: { code: 'INVALID_CURSOR', message: 'Read cursor must be a non-negative decimal offset.' } };
    const newestFirst = input.newest_first !== false;
    const ordered = newestFirst ? [...stored.receipts].reverse() : [...stored.receipts];
    const receipts = ordered.slice(cursor, cursor + limit);
    const hasMore = cursor + receipts.length < ordered.length;
    return deepFreeze({
      ok: true as const,
      receipts,
      total: ordered.length,
      has_more: hasMore,
      ...(hasMore ? { next_cursor: String(cursor + receipts.length) } : {}),
    });
  };

  return Object.freeze({
    validate,
    append,
    appendMany,
    list,
    limits: Object.freeze({ ...limits }),
    storage_key: RECEIPT_STORAGE_KEY,
  });
}
