/**
 * Pure read-only seams for the local Fogwood Bazaar snapshot.
 *
 * The generated catalog contains data only. This module deliberately has no
 * tldraw, DOM, network, storage, or dynamic module loading dependency.
 */

// @ts-expect-error Node's strip-types test loader and the browser bundler both resolve this generated TS module.
import generatedCatalog from './fogwood-bazaar-catalog.generated.ts';

export const FOGWOOD_BAZAAR_TOOL_NAME = 'fogwood-bazaar';
export const FOGWOOD_BAZAAR_PROTOCOL_VERSION = '1';
export const BAZAAR_CATALOG_SOURCE = 'local-snapshot';
export const BAZAAR_CATALOG = generatedCatalog;
export const BAZAAR_CATALOG_REVISION = generatedCatalog.catalog_revision;

const SECTION_NAMES = [
  'manifest',
  'readme',
  'skill',
  'prompts',
  'recipes',
  'examples',
  'fixtures',
  'provenance',
  'license',
  'notices',
  'qualification',
] as const;

export type BazaarSection = (typeof SECTION_NAMES)[number];
export type BazaarPackageKind = 'instrument' | 'recipe' | 'adapter' | 'collection';

type JsonRecord = Record<string, unknown>;
type CatalogEntry = {
  id: string;
  version: number;
  content_hash: string;
  recipe_ids?: readonly string[];
  manifest: JsonRecord & {
    id: string;
    version: number;
    content_hash: string;
    kind: BazaarPackageKind;
    title: string;
    summary: string;
    use_when: string;
    not_for: string;
    keywords: readonly string[];
    locality: 'local';
    network: JsonRecord;
    qualification: JsonRecord;
    compatibility: JsonRecord;
    license: string;
    notices: readonly string[];
  };
  sections: {
    readme: string;
    skill: string;
    prompts: ReadonlyArray<{ path: string; content: string }>;
    recipes: ReadonlyArray<{ path: string; content: JsonRecord }>;
    examples: ReadonlyArray<{ path: string; content: JsonRecord }>;
    fixtures: ReadonlyArray<{ path: string; content: JsonRecord }>;
    provenance: ReadonlyArray<{ path: string; content: string | JsonRecord }>;
  };
};

type Catalog = {
  schema_version: number;
  catalog_source: string;
  catalog_revision: string;
  packages: readonly CatalogEntry[];
};

const catalog = generatedCatalog as unknown as Catalog;

export const BAZAAR_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operation: { type: 'string', enum: ['search', 'read'] },
    query: { type: 'string', maxLength: 120 },
    kind: { type: 'string', enum: ['instrument', 'recipe', 'adapter', 'collection'] },
    locality: { type: 'string', const: 'local' },
    limit: { type: 'integer', minimum: 1, maximum: 20 },
    cursor: { type: 'string', pattern: '^\\d+$', maxLength: 12 },
    catalog_revision: { type: 'string', minLength: 1, maxLength: 80 },
    id: { type: 'string', minLength: 1, maxLength: 120 },
    version: { type: 'integer', minimum: 1, maximum: 999 },
    content_hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    include: {
      type: 'array',
      minItems: 1,
      maxItems: 11,
      items: { type: 'string', enum: [...SECTION_NAMES] },
    },
  },
  required: ['operation'],
} as const;

/** Alias used by WebMCP registration code. */
export const FOGWOOD_BAZAAR_INPUT_SCHEMA = BAZAAR_INPUT_SCHEMA;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((child) => clone(child)) as T;
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).map((key) => [key, clone(value[key])])) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as object)) deepFreeze(child);
  return value;
}

deepFreeze(catalog);

function errorResult(code: string, message: string, path?: string) {
  return {
    ok: false as const,
    code,
    message,
    ...(path ? { path } : {}),
    catalog_source: BAZAAR_CATALOG_SOURCE,
    catalog_revision: BAZAAR_CATALOG_REVISION,
  };
}

type BazaarErrorResult = ReturnType<typeof errorResult>;

function isErrorResult(value: unknown): value is BazaarErrorResult {
  return isRecord(value) && value.ok === false && typeof value.code === 'string';
}

function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function boundedLimit(value: unknown) {
  if (!isFiniteNumber(value)) return 10;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

function currentCatalogEntries() {
  return [...catalog.packages].sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
}

function checkCatalogIdentity() {
  if (catalog.schema_version !== 1 || catalog.catalog_source !== BAZAAR_CATALOG_SOURCE || typeof catalog.catalog_revision !== 'string') {
    return errorResult('TAMPERED_CATALOG', 'The local catalog identity is invalid.');
  }
  const entries = currentCatalogEntries();
  if (entries.length === 0) return errorResult('TAMPERED_CATALOG', 'The local catalog contains no packages.');
  for (const [index, entry] of entries.entries()) {
    if (
      typeof entry.id !== 'string' ||
      !Number.isInteger(entry.version) ||
      typeof entry.content_hash !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(entry.content_hash) ||
      !isRecord(entry.manifest) ||
      entry.manifest.id !== entry.id ||
      entry.manifest.version !== entry.version ||
      entry.manifest.content_hash !== entry.content_hash ||
      !isRecord(entry.sections)
    ) {
      return errorResult('TAMPERED_CATALOG', 'A package identity or section record is invalid.', `packages[${index}]`);
    }
  }
  return null;
}

export type BazaarSearchInput = {
  query?: string;
  kind?: BazaarPackageKind;
  locality?: 'local';
  limit?: number;
  cursor?: string;
  catalog_revision?: string;
};

export type BazaarSearchSummary = {
  id: string;
  version: number;
  content_hash: string;
  kind: BazaarPackageKind;
  title: string;
  summary: string;
  use_when: string;
  not_for: string;
  keywords: string[];
  locality: 'local';
  network: JsonRecord;
  qualification: JsonRecord;
  compatibility: JsonRecord;
  recipe_ids: string[];
};

export type BazaarSearchSuccess = {
  ok: true;
  catalog_source: typeof BAZAAR_CATALOG_SOURCE;
  catalog_revision: string;
  results: BazaarSearchSummary[];
  has_more: boolean;
  next_cursor?: string;
};

export type BazaarSearchResult = BazaarSearchSuccess | ReturnType<typeof errorResult>;

function validateCatalogPin(catalogRevision: unknown) {
  if (catalogRevision !== undefined && catalogRevision !== BAZAAR_CATALOG_REVISION) {
    return errorResult('STALE_CATALOG', 'The requested catalog revision is stale; select the exact local snapshot revision.', 'catalog_revision');
  }
  return null;
}

function validateSearchInput(input: unknown): BazaarSearchInput | ReturnType<typeof errorResult> {
  if (!isRecord(input)) return errorResult('INVALID_INPUT', 'Search input must be an object.');
  const allowed = new Set(['query', 'kind', 'locality', 'limit', 'cursor', 'catalog_revision']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) return errorResult('UNKNOWN_FIELD', 'Unknown search field.', key);
  if (input.query !== undefined && typeof input.query !== 'string') return errorResult('INVALID_INPUT', 'query must be text.', 'query');
  if (input.kind !== undefined && !['instrument', 'recipe', 'adapter', 'collection'].includes(String(input.kind))) return errorResult('INVALID_INPUT', 'kind is unsupported.', 'kind');
  if (input.locality !== undefined && input.locality !== 'local') return errorResult('INVALID_LOCALITY', 'Only local catalog data is available.', 'locality');
  if (input.limit !== undefined && (!isFiniteNumber(input.limit) || input.limit < 1)) return errorResult('INVALID_LIMIT', 'limit must be a positive number.', 'limit');
  if (input.cursor !== undefined && (typeof input.cursor !== 'string' || !/^\d+$/.test(input.cursor) || input.cursor.length > 12)) return errorResult('INVALID_CURSOR', 'cursor must be a bounded numeric offset.', 'cursor');
  if (input.catalog_revision !== undefined && typeof input.catalog_revision !== 'string') return errorResult('INVALID_INPUT', 'catalog_revision must be text.', 'catalog_revision');
  return input as BazaarSearchInput;
}

export function searchBazaar(input: BazaarSearchInput = {}): BazaarSearchResult {
  const catalogError = checkCatalogIdentity();
  if (catalogError) return catalogError;
  const validated = validateSearchInput(input);
  if (isErrorResult(validated)) return validated;
  const stale = validateCatalogPin(validated.catalog_revision);
  if (stale) return stale;
  const query = boundedText(validated.query, 120).trim().toLowerCase();
  const limit = boundedLimit(validated.limit);
  const offset = validated.cursor === undefined ? 0 : Number(validated.cursor);
  const entries = currentCatalogEntries().filter((entry) => {
    if (validated.kind && entry.manifest.kind !== validated.kind) return false;
    if (!query) return true;
    const haystack = [
      entry.id,
      entry.manifest.title,
      entry.manifest.summary,
      entry.manifest.use_when,
      entry.manifest.not_for,
      ...entry.manifest.keywords,
      ...(entry.recipe_ids ?? []),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
  const page = entries.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    ok: true,
    catalog_source: BAZAAR_CATALOG_SOURCE,
    catalog_revision: BAZAAR_CATALOG_REVISION,
    results: page.map((entry) => ({
      id: entry.id,
      version: entry.version,
      content_hash: entry.content_hash,
      kind: entry.manifest.kind,
      title: entry.manifest.title,
      summary: entry.manifest.summary,
      use_when: entry.manifest.use_when,
      not_for: entry.manifest.not_for,
      keywords: [...entry.manifest.keywords],
      locality: 'local',
      network: clone(entry.manifest.network),
      qualification: clone(entry.manifest.qualification),
      compatibility: clone(entry.manifest.compatibility),
      recipe_ids: [...(entry.recipe_ids ?? [])],
    })),
    has_more: nextOffset < entries.length,
    ...(nextOffset < entries.length ? { next_cursor: String(nextOffset) } : {}),
  };
}

export type BazaarReadInput = {
  id: string;
  version: number;
  content_hash?: string;
  catalog_revision?: string;
  include?: BazaarSection[];
};

export type BazaarReadSuccess = {
  ok: true;
  catalog_source: typeof BAZAAR_CATALOG_SOURCE;
  catalog_revision: string;
  id: string;
  version: number;
  content_hash: string;
  sections: Partial<Record<BazaarSection, unknown>>;
};

export type BazaarReadResult = BazaarReadSuccess | ReturnType<typeof errorResult>;

function validateReadInput(input: unknown): BazaarReadInput | ReturnType<typeof errorResult> {
  if (!isRecord(input)) return errorResult('INVALID_INPUT', 'Read input must be an object.');
  const allowed = new Set(['id', 'version', 'content_hash', 'catalog_revision', 'include']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) return errorResult('UNKNOWN_FIELD', 'Unknown read field.', key);
  if (typeof input.id !== 'string' || input.id.length < 1 || input.id.length > 120) return errorResult('INVALID_INPUT', 'id must be bounded text.', 'id');
  if (!Number.isInteger(input.version) || (input.version as number) < 1 || (input.version as number) > 999) return errorResult('INVALID_INPUT', 'version must be a positive integer.', 'version');
  if (input.content_hash !== undefined && (typeof input.content_hash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(input.content_hash))) return errorResult('INVALID_HASH', 'content_hash must be a SHA-256 pin.', 'content_hash');
  if (input.catalog_revision !== undefined && typeof input.catalog_revision !== 'string') return errorResult('INVALID_INPUT', 'catalog_revision must be text.', 'catalog_revision');
  if (input.include !== undefined) {
    if (!Array.isArray(input.include) || input.include.length < 1 || input.include.length > SECTION_NAMES.length) return errorResult('INVALID_SECTION', 'include must contain one or more bounded section names.', 'include');
    const seen = new Set<string>();
    for (const [index, section] of input.include.entries()) {
      if (typeof section !== 'string' || !(SECTION_NAMES as readonly string[]).includes(section)) return errorResult('INVALID_SECTION', 'Requested section is not available.', `include[${index}]`);
      if (seen.has(section)) return errorResult('DUPLICATE_SECTION', 'Requested sections must be unique.', `include[${index}]`);
      seen.add(section);
    }
  }
  return input as BazaarReadInput;
}

function sectionFor(entry: CatalogEntry, section: BazaarSection) {
  if (section === 'manifest') return clone(entry.manifest);
  if (section === 'readme' || section === 'skill') return entry.sections[section];
  if (section === 'prompts' || section === 'recipes' || section === 'examples' || section === 'fixtures' || section === 'provenance') return clone(entry.sections[section as keyof CatalogEntry['sections']]);
  if (section === 'license') return clone(entry.sections.provenance.find((item) => item.path === entry.manifest.license)?.content);
  if (section === 'notices') return clone(entry.sections.provenance.filter((item) => entry.manifest.notices.includes(item.path)).map((item) => item));
  if (section === 'qualification') return clone(entry.manifest.qualification);
  return undefined;
}

export function readBazaar(input: BazaarReadInput): BazaarReadResult {
  const catalogError = checkCatalogIdentity();
  if (catalogError) return catalogError;
  const validated = validateReadInput(input);
  if (isErrorResult(validated)) return validated;
  const stale = validateCatalogPin(validated.catalog_revision);
  if (stale) return stale;
  const entry = currentCatalogEntries().find((candidate) => candidate.id === validated.id && candidate.version === validated.version);
  if (!entry) return errorResult('UNKNOWN_PACKAGE', 'No exact package identity exists in the local catalog.', 'id');
  if (validated.content_hash !== undefined && validated.content_hash !== entry.content_hash) return errorResult('TAMPERED_PACKAGE', 'The requested package hash does not match the pinned local package.', 'content_hash');
  const include = validated.include ?? ['manifest'];
  const sections: Partial<Record<BazaarSection, unknown>> = {};
  for (const section of include) sections[section] = sectionFor(entry, section);
  return {
    ok: true,
    catalog_source: BAZAAR_CATALOG_SOURCE,
    catalog_revision: BAZAAR_CATALOG_REVISION,
    id: entry.id,
    version: entry.version,
    content_hash: entry.content_hash,
    sections,
  };
}

export type FogwoodBazaarRequest =
  | ({ operation: 'search' } & BazaarSearchInput)
  | ({ operation: 'read' } & BazaarReadInput);

export type BazaarExecutionResult = BazaarSearchResult | BazaarReadResult;

export function validateBazaarRequest(input: unknown): FogwoodBazaarRequest | ReturnType<typeof errorResult> {
  if (!isRecord(input)) return errorResult('INVALID_INPUT', 'Bazaar input must be an object.');
  if (input.operation !== 'search' && input.operation !== 'read') return errorResult('INVALID_OPERATION', 'operation must be search or read.', 'operation');
  const payload = { ...input };
  delete payload.operation;
  const result = input.operation === 'search' ? validateSearchInput(payload) : validateReadInput(payload);
  if (isErrorResult(result)) return result;
  return { operation: input.operation, ...result } as FogwoodBazaarRequest;
}

export function executeFogwoodBazaar(input: unknown): BazaarExecutionResult {
  const request = validateBazaarRequest(input);
  if (isErrorResult(request)) return request;
  const { operation, ...payload } = request;
  if (operation === 'search') return searchBazaar(payload as BazaarSearchInput);
  return readBazaar(payload as BazaarReadInput);
}

export const FOGWOOD_BAZAAR_CAPABILITY = {
  id: FOGWOOD_BAZAAR_TOOL_NAME,
  kind: 'tool' as const,
  version: 1 as const,
  title: 'Search and read the local Fogwood Bazaar',
  summary: 'Read-only bounded search and exact-section reads for local materials, moves, adapters, aesthetics, algorithms, provocations, and compositional recipes.',
  use_when: 'Discover or inspect an exact local data-only package before staging a page-owned composition proposal.',
  keywords: ['bazaar', 'materials', 'moves', 'adapters', 'aesthetics', 'algorithms', 'provocation', 'search', 'read', 'local', 'recipe', 'package'],
  effect: 'read-only' as const,
  input_schema: BAZAAR_INPUT_SCHEMA,
};

export function createFogwoodBazaarTool() {
  return {
    name: FOGWOOD_BAZAAR_TOOL_NAME,
    description: FOGWOOD_BAZAAR_CAPABILITY.summary,
    inputSchema: BAZAAR_INPUT_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    readOnlyHint: true,
    untrustedContentHint: true,
    execute: executeFogwoodBazaar,
  } as const;
}

export const FOGWOOD_BAZAAR_TOOL = createFogwoodBazaarTool();
export const searchFogwoodBazaar = searchBazaar;
export const readFogwoodBazaar = readBazaar;
