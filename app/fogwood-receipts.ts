/**
 * Browser-safe, DOM-free, device-local evidence receipts for Fogwood.
 *
 * Receipts are evidence about a proposal or export. They do not grant Apply,
 * Reject, or any other authority. The page/controller remains the authority
 * for canvas mutations; this module only validates and appends records to an
 * injected storage adapter.
 */

export const RECEIPT_SCHEMA_VERSION = 1 as const;
export const RECEIPT_LEDGER_SCHEMA_VERSION = 1 as const;
export const RECEIPT_STORAGE_KEY = 'fogwood-receipts-local:v1' as const;
export const RECEIPT_BATCH_LIMIT = 16 as const;
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
};

export type ReceiptArtifact = {
  format: string;
  hash: string;
};

export type ReceiptDraft = {
  event: ReceiptEvent;
  source_revision?: string;
  base_revision?: string;
  result_revision?: string;
  proposal?: ReceiptIdentity;
  package?: ReceiptIdentity;
  recipe?: ReceiptIdentity;
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
  source_revision?: string;
  base_revision?: string;
  result_revision?: string;
  proposal?: Readonly<ReceiptIdentity>;
  package?: Readonly<ReceiptIdentity>;
  recipe?: Readonly<ReceiptIdentity>;
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
  'source_revision',
  'base_revision',
  'result_revision',
  'proposal',
  'package',
  'recipe',
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
  if (!hasOnlyKeys(value, ['id', 'version', 'hash', 'content_hash'])) addError(errors, 'UNKNOWN_FIELD', 'Identity contains an unknown field.', path);
  const id = boundedString(value.id, limits.max_identity_length) ? value.id : undefined;
  if (id === undefined) addError(errors, 'INVALID_IDENTITY_ID', 'Identity id must be a bounded non-empty string.', `${path}.id`);
  const version = normalizeVersion(value.version, path, errors);
  const hash = canonicalHash(value.hash, limits.max_hash_length) ? value.hash : undefined;
  const contentHash = canonicalHash(value.content_hash, limits.max_hash_length) ? value.content_hash : undefined;
  if (hash === undefined && contentHash === undefined) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity must include a bounded non-empty hash or content_hash.', `${path}.hash`);
  if (value.hash !== undefined && !canonicalHash(value.hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.hash`);
  if (value.content_hash !== undefined && !canonicalHash(value.content_hash, limits.max_hash_length)) addError(errors, 'INVALID_IDENTITY_HASH', 'Identity content_hash must be the canonical sha256:<64 lowercase hex> form.', `${path}.content_hash`);
  if (hash !== undefined && contentHash !== undefined && hash !== contentHash) addError(errors, 'IDENTITY_HASH_MISMATCH', 'hash and content_hash must match when both are supplied.', path);
  if (id === undefined || version === undefined || errors.some((error) => error.path === path || error.path?.startsWith(`${path}.`))) return undefined;
  return {
    id,
    version,
    ...(hash === undefined ? {} : { hash }),
    ...(contentHash === undefined ? {} : { content_hash: contentHash }),
  };
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
    ...(sourceRevision === undefined ? {} : { source_revision: sourceRevision }),
    ...(baseRevision === undefined ? {} : { base_revision: baseRevision }),
    ...(resultRevision === undefined ? {} : { result_revision: resultRevision }),
    ...(proposal === undefined ? {} : { proposal }),
    ...(packageIdentity === undefined ? {} : { package: packageIdentity }),
    ...(recipe === undefined ? {} : { recipe }),
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
