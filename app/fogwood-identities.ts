/**
 * Device-local, browser-safe identities for append-only Fogwood receipts.
 *
 * This module intentionally has no platform, storage, DOM, network, or
 * executable-content dependency. Canonical serialization is bounded and
 * rejects values that JSON would otherwise silently omit or coerce.
 */

export type IdentityVersion = string | number;

export type IdentityLimits = {
  max_depth: number;
  max_entries: number;
  max_string_length: number;
  max_serialized_length: number;
};

type IdentityLimitOverrides = Partial<IdentityLimits> & {
  maxDepth?: number;
  maxEntries?: number;
  maxStringLength?: number;
  maxSerializedLength?: number;
  max_serialized_bytes?: number;
  maxSerializedBytes?: number;
  max_bytes?: number;
  maxBytes?: number;
};

export type CanonicalSerializeOptions = IdentityLimitOverrides & {
  /** Nested form mirrors the options shape used by the receipt ledger. */
  limits?: IdentityLimitOverrides;
};

export const DEFAULT_IDENTITY_LIMITS: Readonly<IdentityLimits> = Object.freeze({
  max_depth: 32,
  max_entries: 4096,
  max_string_length: 4096,
  max_serialized_length: 512_000,
});

/** Alias for callers that name the serializer boundary directly. */
export const DEFAULT_CANONICAL_LIMITS = DEFAULT_IDENTITY_LIMITS;

export type CanonicalSerializeErrorCode =
  | 'CYCLIC_INPUT'
  | 'INPUT_DEPTH_LIMIT'
  | 'INPUT_ENTRY_LIMIT'
  | 'INPUT_STRING_LIMIT'
  | 'SERIALIZED_SIZE_LIMIT'
  | 'UNCLONEABLE_INPUT'
  | 'INVALID_CANONICAL_VALUE'
  | 'INVALID_LIMIT'
  | 'INVALID_IDENTITY'
  | 'INVALID_PACKAGE_IDENTITY';

/** A bounded identity input could not be represented or validated. */
export class CanonicalSerializeError extends TypeError {
  readonly code: CanonicalSerializeErrorCode;
  readonly path?: string;

  constructor(code: CanonicalSerializeErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'CanonicalSerializeError';
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Compatibility aliases for callers that use the identity seam's name. */
export { CanonicalSerializeError as FogwoodIdentityError };
export { CanonicalSerializeError as IdentityError };

type TraversalState = {
  active: WeakSet<object>;
  entries: number;
  limits: IdentityLimits;
};

export type IdentityOptions = CanonicalSerializeOptions & {
  id?: string;
  version?: IdentityVersion;
};

export type ReceiptIdentity = Readonly<{
  id: string;
  version: IdentityVersion;
  hash?: string;
  content_hash?: string;
}>;

export type ProposalIdentityInput = Record<string, unknown>;
export type RecipeIdentityInput = Record<string, unknown> & {
  id: string;
  version: IdentityVersion;
};
export type PackageIdentityInput = Record<string, unknown> & {
  id: string;
  version: IdentityVersion;
  content_hash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  try {
    return !Array.isArray(value);
  } catch {
    return false;
  }
}

function isArray(value: object): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function compareUtf16CodeUnits(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftCodeUnit = left.charCodeAt(index);
    const rightCodeUnit = right.charCodeAt(index);
    if (leftCodeUnit !== rightCodeUnit) return leftCodeUnit - rightCodeUnit;
  }
  return left.length - right.length;
}

function pathForProperty(path: string, key: string) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)) return `${path}.${key}`;
  return `${path}[${JSON.stringify(key)}]`;
}

function pathForIndex(path: string, index: number) {
  return `${path}[${index}]`;
}

function positiveLimit(value: unknown, key: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new CanonicalSerializeError('INVALID_LIMIT', `Identity limit ${key} must be a positive safe integer.`, key);
  }
  return value;
}

function resolveLimits(options: CanonicalSerializeOptions = {}): IdentityLimits {
  const nested = options.limits ?? {};
  const maxDepth = options.maxDepth ?? options.max_depth ?? nested.maxDepth ?? nested.max_depth;
  const maxEntries = options.maxEntries ?? options.max_entries ?? nested.maxEntries ?? nested.max_entries;
  const maxStringLength = options.maxStringLength ?? options.max_string_length ?? nested.maxStringLength ?? nested.max_string_length;
  const maxSerializedLength = options.maxSerializedLength
    ?? options.max_serialized_length
    ?? options.maxSerializedBytes
    ?? options.max_serialized_bytes
    ?? options.maxBytes
    ?? options.max_bytes
    ?? nested.maxSerializedLength
    ?? nested.max_serialized_length
    ?? nested.maxSerializedBytes
    ?? nested.max_serialized_bytes
    ?? nested.maxBytes
    ?? nested.max_bytes;
  return {
    max_depth: positiveLimit(maxDepth ?? DEFAULT_IDENTITY_LIMITS.max_depth, 'max_depth'),
    max_entries: positiveLimit(maxEntries ?? DEFAULT_IDENTITY_LIMITS.max_entries, 'max_entries'),
    max_string_length: positiveLimit(maxStringLength ?? DEFAULT_IDENTITY_LIMITS.max_string_length, 'max_string_length'),
    max_serialized_length: positiveLimit(maxSerializedLength ?? DEFAULT_IDENTITY_LIMITS.max_serialized_length, 'max_serialized_length'),
  };
}

function checkTraversal(state: TraversalState, depth: number, path: string) {
  if (depth > state.limits.max_depth) {
    throw new CanonicalSerializeError('INPUT_DEPTH_LIMIT', 'Identity input exceeds the bounded canonical depth.', path);
  }
  state.entries += 1;
  if (state.entries > state.limits.max_entries) {
    throw new CanonicalSerializeError('INPUT_ENTRY_LIMIT', 'Identity input exceeds the bounded canonical entry limit.', path);
  }
}

function checkString(value: string, state: TraversalState, path: string) {
  if (value.length > state.limits.max_string_length) {
    throw new CanonicalSerializeError('INPUT_STRING_LIMIT', 'Identity input contains a string beyond the configured bound.', path);
  }
}

function readDataProperty(value: object, key: string, path: string) {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity input contains a property that cannot be inspected.', path);
  }
  if (!descriptor || !('value' in descriptor)) {
    throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity input cannot contain accessor properties.', path);
  }
  return descriptor.value;
}

function enumerableKeys(value: object, path: string) {
  let keys: string[];
  let symbols: symbol[];
  try {
    keys = Object.keys(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity input properties cannot be inspected.', path);
  }
  if (symbols.length > 0) {
    throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity input cannot contain symbol properties.', path);
  }
  return keys;
}

function serializeValue(value: unknown, state: TraversalState, depth: number, path: string): string {
  checkTraversal(state, depth, path);
  if (value === null) return 'null';
  if (typeof value === 'string') {
    checkString(value, state, path);
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalSerializeError('INVALID_CANONICAL_VALUE', 'Canonical JSON only accepts finite numbers.', path);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new CanonicalSerializeError('INVALID_CANONICAL_VALUE', 'Canonical JSON cannot represent this value.', path);
  }
  if (state.active.has(value)) {
    throw new CanonicalSerializeError('CYCLIC_INPUT', 'Identity input contains a cyclic reference.', path);
  }

  state.active.add(value);
  try {
    if (isArray(value)) {
      let length: number;
      try {
        length = value.length;
      } catch {
        throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity array length cannot be inspected.', path);
      }
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity array length is invalid.', path);
      }
      const keys = enumerableKeys(value, path);
      for (const key of keys) {
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= length) {
          throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity arrays cannot contain extra enumerable properties.', pathForProperty(path, key));
        }
      }
      const parts: string[] = [];
      for (let index = 0; index < length; index += 1) {
        const childPath = pathForIndex(path, index);
        let hasValue: boolean;
        try {
          hasValue = Object.prototype.hasOwnProperty.call(value, String(index));
        } catch {
          throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity array entries cannot be inspected.', childPath);
        }
        if (!hasValue) {
          throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity arrays cannot contain holes.', childPath);
        }
        parts.push(serializeValue(readDataProperty(value, String(index), childPath), state, depth + 1, childPath));
      }
      return `[${parts.join(',')}]`;
    }
    if (!isPlainRecord(value)) {
      throw new CanonicalSerializeError('UNCLONEABLE_INPUT', 'Identity input must contain plain objects or arrays.', path);
    }
    const keys = enumerableKeys(value, path);
    keys.sort(compareUtf16CodeUnits);
    const parts: string[] = [];
    for (const key of keys) {
      const keyPath = pathForProperty(path, key);
      checkString(key, state, keyPath);
      const serializedKey = JSON.stringify(key);
      const serializedValue = serializeValue(readDataProperty(value, key, keyPath), state, depth + 1, keyPath);
      parts.push(`${serializedKey}:${serializedValue}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    state.active.delete(value);
  }
}

/** Serialize JSON-compatible data with stable UTF-16 code-unit object ordering. */
export function canonicalSerialize(value: unknown, options: CanonicalSerializeOptions = {}) {
  const limits = resolveLimits(options);
  const serialized = serializeValue(value, { active: new WeakSet<object>(), entries: 0, limits }, 0, '$');
  if (serialized.length > limits.max_serialized_length) {
    throw new CanonicalSerializeError('SERIALIZED_SIZE_LIMIT', 'Canonical identity JSON exceeds the configured serialized-length bound.', '$');
  }
  return serialized;
}

function utf8Bytes(value: string) {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (second >= 0xdc00 && second <= 0xdfff) {
        codePoint = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      codePoint = 0xfffd;
    }
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (second >= 0xdc00 && second <= 0xdfff) {
        codePoint = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint <= 0x7f) {
      bytes[offset] = codePoint;
      offset += 1;
    } else if (codePoint <= 0x7ff) {
      bytes[offset] = 0xc0 | (codePoint >>> 6);
      bytes[offset + 1] = 0x80 | (codePoint & 0x3f);
      offset += 2;
    } else if (codePoint <= 0xffff) {
      bytes[offset] = 0xe0 | (codePoint >>> 12);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 2] = 0x80 | (codePoint & 0x3f);
      offset += 3;
    } else {
      bytes[offset] = 0xf0 | (codePoint >>> 18);
      bytes[offset + 1] = 0x80 | ((codePoint >>> 12) & 0x3f);
      bytes[offset + 2] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[offset + 3] = 0x80 | (codePoint & 0x3f);
      offset += 4;
    }
  }
  return bytes;
}

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const INITIAL_HASH = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const;

function rotateRight(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function choice(e: number, f: number, g: number) {
  return (e & f) ^ (~e & g);
}

function majority(a: number, b: number, c: number) {
  return (a & b) ^ (a & c) ^ (b & c);
}

function bigSigma0(value: number) {
  return rotateRight(value, 2) ^ rotateRight(value, 13) ^ rotateRight(value, 22);
}

function bigSigma1(value: number) {
  return rotateRight(value, 6) ^ rotateRight(value, 11) ^ rotateRight(value, 25);
}

function smallSigma0(value: number) {
  return rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
}

function smallSigma1(value: number) {
  return rotateRight(value, 17) ^ rotateRight(value, 19) ^ (value >>> 10);
}

function hexWord(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/** Synchronous SHA-256 over the UTF-8 encoding of a string, returned as 64 hex digits. */
export function sha256Hex(value: string) {
  if (typeof value !== 'string') {
    throw new CanonicalSerializeError('INVALID_CANONICAL_VALUE', 'sha256Hex requires a string input.', '$');
  }
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  const blockCount = Math.ceil((bytes.length + 9) / 64);
  const padded = new Uint8Array(blockCount * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const lowLength = bitLength >>> 0;
  const highLength = Math.floor(bitLength / 0x1_0000_0000) >>> 0;
  const lengthOffset = padded.length - 8;
  padded[lengthOffset] = highLength >>> 24;
  padded[lengthOffset + 1] = highLength >>> 16;
  padded[lengthOffset + 2] = highLength >>> 8;
  padded[lengthOffset + 3] = highLength;
  padded[lengthOffset + 4] = lowLength >>> 24;
  padded[lengthOffset + 5] = lowLength >>> 16;
  padded[lengthOffset + 6] = lowLength >>> 8;
  padded[lengthOffset + 7] = lowLength;

  const hash: number[] = [...INITIAL_HASH];
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      schedule[index] = (
        (padded[position] << 24)
        | (padded[position + 1] << 16)
        | (padded[position + 2] << 8)
        | padded[position + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      schedule[index] = (
        smallSigma1(schedule[index - 2])
        + schedule[index - 7]
        + smallSigma0(schedule[index - 15])
        + schedule[index - 16]
      ) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const temporary1 = (
        h
        + bigSigma1(e)
        + choice(e, f, g)
        + ROUND_CONSTANTS[index]
        + schedule[index]
      ) >>> 0;
      const temporary2 = (bigSigma0(a) + majority(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map(hexWord).join('');
}

function identityVersion(value: unknown, path: string): IdentityVersion {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && value.length > 0 && value.length <= 80) return value;
  throw new CanonicalSerializeError('INVALID_IDENTITY', 'Identity version must be a bounded string or non-negative integer.', path);
}

function identityId(value: unknown, fallback: string, path: string) {
  const id = value === undefined ? fallback : value;
  if (typeof id !== 'string' || id.length < 1 || id.length > 180) {
    throw new CanonicalSerializeError('INVALID_IDENTITY', 'Identity id must be a bounded non-empty string.', path);
  }
  return id;
}

function identityField(value: object, key: string, path: string) {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new CanonicalSerializeError('INVALID_IDENTITY', 'Identity metadata cannot be inspected.', path);
  }
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) {
    throw new CanonicalSerializeError('INVALID_IDENTITY', 'Identity metadata cannot use accessor properties.', path);
  }
  return descriptor.value;
}

function identityOptions(options: IdentityOptions, fallbackId: string, fallbackVersion: IdentityVersion) {
  return {
    id: identityId(options.id, fallbackId, 'id'),
    version: identityVersion(options.version ?? fallbackVersion, 'version'),
  };
}

function canonicalHash(value: unknown, options: CanonicalSerializeOptions) {
  return `sha256:${sha256Hex(canonicalSerialize(value, options))}`;
}

function normalizedInput(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value) || !isPlainRecord(value)) {
    throw new CanonicalSerializeError('INVALID_IDENTITY', 'Identity content must be a plain object.', path);
  }
  return value;
}

/** Build a receipt proposal identity from the exact normalized proposal object. */
export function identityForProposal(proposal: unknown, options: IdentityOptions = {}): ReceiptIdentity {
  const content = normalizedInput(proposal, 'proposal');
  const proposalIdValue = identityField(content, 'id', 'proposal.id');
  const proposalVersionValue = identityField(content, 'version', 'proposal.version');
  const proposalId = typeof proposalIdValue === 'string' ? proposalIdValue : 'proposal';
  const proposalVersion = proposalVersionValue === undefined ? 1 : identityVersion(proposalVersionValue, 'proposal.version');
  const identity = identityOptions(options, proposalId, proposalVersion);
  return Object.freeze({
    id: identity.id,
    version: identity.version,
    hash: canonicalHash(content, options),
  });
}

/** Build a receipt recipe identity from the exact immutable recipe content. */
export function identityForRecipe(recipe: unknown, options: IdentityOptions = {}): ReceiptIdentity {
  const content = normalizedInput(recipe, 'recipe');
  const recipeIdValue = identityField(content, 'id', 'recipe.id');
  if (typeof recipeIdValue !== 'string') {
    throw new CanonicalSerializeError('INVALID_IDENTITY', 'Recipe identity requires a bounded non-empty id.', 'recipe.id');
  }
  const recipeVersion = identityVersion(identityField(content, 'version', 'recipe.version'), 'recipe.version');
  const identity = identityOptions(options, recipeIdValue, recipeVersion);
  return Object.freeze({
    id: identity.id,
    version: identity.version,
    hash: canonicalHash(content, options),
  });
}

/** Carry a Bazaar search/read pin into the receipt spelling without recomputing it. */
export function identityForPackage(summary: unknown): ReceiptIdentity {
  if (!isRecord(summary) || !isPlainRecord(summary)) {
    throw new CanonicalSerializeError('INVALID_PACKAGE_IDENTITY', 'Package identity must be a plain search/read summary object.', 'package');
  }
  const id = identityId(identityField(summary, 'id', 'package.id'), '', 'package.id');
  const version = identityVersion(identityField(summary, 'version', 'package.version'), 'package.version');
  const contentHash = identityField(summary, 'content_hash', 'package.content_hash');
  if (typeof contentHash !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(contentHash)) {
    throw new CanonicalSerializeError('INVALID_PACKAGE_IDENTITY', 'Package content_hash must be the canonical sha256:<64 lowercase hex> form.', 'package.content_hash');
  }
  return Object.freeze({ id, version, content_hash: contentHash });
}
