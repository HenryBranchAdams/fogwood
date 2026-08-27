#!/usr/bin/env node

/**
 * Compile Fogwood's source-controlled, data-only Bazaar packages.
 *
 * This file intentionally uses only Node's standard library. It is a
 * validation boundary, not a package loader: package data can name a small
 * set of host-owned capability IDs, but it can never provide executable
 * modules or network authority.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BAZAAR_SCHEMA_VERSION = 1;
export const BAZAAR_CATALOG_SOURCE = 'local-snapshot';
export const BAZAAR_PROTOCOL = 'fogwood-agent-runtime';
export const BAZAAR_PROTOCOL_VERSION = '1';
export const BAZAAR_REGISTRY_VERSION = '1';
export const COMPOSITION_FORMAT = 'composition.v2';

export const MAX_PACKAGE_BYTES = 512 * 1024;
export const MAX_FILE_BYTES = 96 * 1024;
export const MAX_PACKAGES = 64;
export const MAX_SEARCH_LIMIT = 20;

const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const PATH_PATTERN = /^(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.(?:json|md|txt)$/i;
const HOST_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Host-owned IDs are the only capability references accepted from Vault data. */
export const TRUSTED_HOST_IDS = new Set([
  'primitive.native-shapes.v1',
  'primitive.surface-block.v1',
  'action.insert-recipe.v1',
  'instrument.compare-decision.v1',
  'behavior.transform.diff.v1',
  'behavior.formula.bounded.v1',
  'adapter.materials.v1',
  'adapter.live-image-material.v1',
  'aesthetic.fungi-cities.v1',
  'aesthetic.evidence-constellation.v1',
  'aesthetic.storyworld-mutation.v1',
  'algorithm.scatter.v1',
  'algorithm.cluster.v1',
  'algorithm.branch.v1',
  'algorithm.orbit.v1',
  'algorithm.montage.v1',
  'algorithm.trace.v1',
  'algorithm.place.v1',
]);

const ROOT_FIELDS = [
  'id',
  'version',
  'kind',
  'content_hash',
  'title',
  'summary',
  'use_when',
  'not_for',
  'keywords',
  'input_schema',
  'output_schema',
  'renderer_id',
  'behavior_ids',
  'adapter_id',
  'ports',
  'permissions',
  'locality',
  'network',
  'limits',
  'recipes',
  'skill',
  'prompts',
  'examples',
  'fixtures',
  'sources',
  'license',
  'notices',
  'qualification',
  'compatibility',
  'replacement',
];

const SCHEMA_FIELDS = [
  'type',
  'additionalProperties',
  'properties',
  'required',
  'items',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'enum',
  'oneOf',
  'description',
];

const RECIPE_FIELDS = [
  'id',
  'version',
  'format',
  'title',
  'purpose',
  'status',
  'bounds',
  'semantic',
  'provenance',
  'expected_count',
  'operations',
  'capability_refs',
  'instrument',
  'instrument_projection',
  'regions',
  'materials',
  'items',
  'edges',
  'placements',
  'moves',
  'adapters',
  'aesthetics',
  'algorithms',
  'provocations',
  'variants',
  'source_notes',
  'qualification',
];

const BLOCK_FIELDS = [
  'kind',
  'tone',
  'x',
  'y',
  'w',
  'h',
  'title',
  'body',
  'value',
  'items',
  'columns',
  'rows',
  'options',
  'series',
  'min',
  'max',
  'step',
];

const SHAPE_FIELDS = ['kind', 'x', 'y', 'end_x', 'end_y', 'w', 'h', 'text', 'color', 'fill'];

const FORBIDDEN_KEYS = new Set([
  'code',
  'exec',
  'execute',
  'executable',
  'eval',
  'function',
  'handler',
  'callback',
  'module',
  'modulepath',
  'module_path',
  'component',
  'componentname',
  'component_name',
  'script',
  'scripturl',
  'credential',
  'credentials',
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'fetch',
  'xhr',
  'webhook',
  '__proto__',
  'proto',
  'prototype',
  'constructor',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tolocalestring',
  'tostring',
  'valueof',
  '__definegetter__',
  '__definesetter__',
  '__lookupgetter__',
  '__lookupsetter__',
]);

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.exe',
  '.html',
  '.js',
  '.jsx',
  '.mjs',
  '.py',
  '.sh',
  '.svg',
  '.ts',
  '.tsx',
  '.wasm',
]);

const TEXT_DANGER_PATTERNS = [
  /\bjavascript\s*:/i,
  /\bvbscript\s*:/i,
  /data\s*:\s*text\//i,
  /<\s*script\b/i,
  /\b(?:eval|Function)\s*\(/i,
  /\b(?:import|require)\s*\(/i,
  /\b(?:fetch|XMLHttpRequest)\s*\(/i,
  /\b(?:child_process|process\.env|document\.cookie|window\.location)\b/i,
  /["']?(?:code|execute|executable|eval|function|handler|callback|module(?:_path|path)?|script|credential|secret|token|password|api[_-]?key|fetch|webhook)["']?\s*:/i,
];

class BazaarValidationError extends Error {
  constructor(code, message, targetPath = '') {
    super(`${code}: ${message}${targetPath ? ` (${targetPath})` : ''}`);
    this.name = 'BazaarValidationError';
    this.code = code;
    this.targetPath = targetPath;
  }
}

function fail(code, message, targetPath = '') {
  throw new BazaarValidationError(code, message, targetPath);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertRecord(value, targetPath) {
  if (!isRecord(value)) fail('WRONG_TYPE', 'Expected an object.', targetPath);
  return value;
}

function assertOnlyKeys(value, allowed, targetPath) {
  assertRecord(value, targetPath);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail('UNKNOWN_FIELD', `Unknown field "${key}".`, `${targetPath}.${key}`);
  }
}

function assertString(value, targetPath, minLength = 1, maxLength = 512) {
  if (typeof value !== 'string' || value.length < minLength || value.length > maxLength) {
    fail('INVALID_STRING', `Expected a string between ${minLength} and ${maxLength} characters.`, targetPath);
  }
  return value;
}

function assertBoolean(value, targetPath) {
  if (typeof value !== 'boolean') fail('INVALID_BOOLEAN', 'Expected a boolean.', targetPath);
}

function assertInteger(value, targetPath, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('INVALID_INTEGER', `Expected an integer between ${min} and ${max}.`, targetPath);
  }
  return value;
}

function assertNumber(value, targetPath, min, max) {
  if (!isFiniteNumber(value) || value < min || value > max) {
    fail('INVALID_NUMBER', `Expected a finite number between ${min} and ${max}.`, targetPath);
  }
  return value;
}

function assertArray(value, targetPath, minLength = 0, maxLength = 64) {
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    fail('INVALID_ARRAY', `Expected an array between ${minLength} and ${maxLength} entries.`, targetPath);
  }
  return value;
}

function assertDate(value, targetPath) {
  assertString(value, targetPath, 10, 10);
  if (!DATE_PATTERN.test(value)) fail('INVALID_DATE', 'Expected an ISO calendar date.', targetPath);
}

function assertSafeRelativePath(value, targetPath, expectedPrefix = '') {
  assertString(value, targetPath, 1, 180);
  if (
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.includes('\\') ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..') ||
    !PATH_PATTERN.test(value)
  ) {
    fail('UNSAFE_PATH', 'Path must be a relative, normalized data-file path.', targetPath);
  }
  if (expectedPrefix && !value.startsWith(`${expectedPrefix}/`)) {
    fail('UNSAFE_PATH', `Path must be inside ${expectedPrefix}/.`, targetPath);
  }
  return value;
}

function assertPathArray(value, targetPath, prefix, minLength = 1, maxLength = 16) {
  const paths = assertArray(value, targetPath, minLength, maxLength);
  const seen = new Set();
  for (let index = 0; index < paths.length; index += 1) {
    const itemPath = `${targetPath}[${index}]`;
    const safe = assertSafeRelativePath(paths[index], itemPath, prefix);
    if (seen.has(safe)) fail('DUPLICATE_PATH', 'Referenced paths must be unique.', itemPath);
    seen.add(safe);
  }
  return paths;
}

function normalizedKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function scanDataForDanger(value, targetPath, seen = new Set()) {
  if (typeof value === 'string') {
    for (const pattern of TEXT_DANGER_PATTERNS) {
      if (pattern.test(value)) fail('SUSPICIOUS_CONTENT', 'Executable or hidden-network content is not allowed.', targetPath);
    }
    if (value.includes('..\\') || value.includes('../')) {
      fail('SUSPICIOUS_CONTENT', 'Traversal content is not allowed.', targetPath);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((child, index) => scanDataForDanger(child, `${targetPath}[${index}]`, seen));
    return;
  }
  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const compact = normalizedKey(key);
    if (FORBIDDEN_KEYS.has(key) || FORBIDDEN_KEYS.has(compact)) {
      fail('FORBIDDEN_FIELD', `Field "${key}" is not permitted in Vault data.`, `${targetPath}.${key}`);
    }
    scanDataForDanger(child, `${targetPath}.${key}`, seen);
  }
}

/** Strict JSON reader that rejects duplicate object keys before JSON.parse could overwrite them. */
class JsonReader {
  constructor(text, targetPath) {
    this.text = text;
    this.targetPath = targetPath;
    this.index = 0;
  }

  error(message) {
    fail('MALFORMED_JSON', message, `${this.targetPath}@${this.index}`);
  }

  whitespace() {
    while (/\s/.test(this.text[this.index] ?? '')) this.index += 1;
  }

  parse() {
    this.whitespace();
    const value = this.value();
    this.whitespace();
    if (this.index !== this.text.length) this.error('Trailing JSON content.');
    return value;
  }

  value() {
    this.whitespace();
    const current = this.text[this.index];
    if (current === '{') return this.object();
    if (current === '[') return this.array();
    if (current === '"') return this.string();
    if (current === '-' || /[0-9]/.test(current ?? '')) return this.number();
    if (this.text.startsWith('true', this.index)) {
      this.index += 4;
      return true;
    }
    if (this.text.startsWith('false', this.index)) {
      this.index += 5;
      return false;
    }
    if (this.text.startsWith('null', this.index)) {
      this.index += 4;
      return null;
    }
    this.error('Unexpected JSON token.');
  }

  string() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      const current = this.text[this.index];
      if (code < 0x20) this.error('Control characters must be escaped.');
      if (escaped) {
        escaped = false;
        this.index += 1;
        continue;
      }
      if (current === '\\') {
        escaped = true;
        this.index += 1;
        continue;
      }
      if (current === '"') {
        this.index += 1;
        const raw = this.text.slice(start, this.index);
        try {
          return JSON.parse(raw);
        } catch {
          this.error('Invalid JSON string escape.');
        }
      }
      this.index += 1;
    }
    this.error('Unterminated JSON string.');
  }

  number() {
    const rest = this.text.slice(this.index);
    const match = rest.match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) this.error('Invalid JSON number.');
    const number = Number(match[0]);
    if (!Number.isFinite(number)) this.error('JSON numbers must be finite.');
    this.index += match[0].length;
    return number;
  }

  object() {
    this.index += 1;
    const value = {};
    const keys = new Set();
    this.whitespace();
    if (this.text[this.index] === '}') {
      this.index += 1;
      return value;
    }
    while (this.index < this.text.length) {
      this.whitespace();
      if (this.text[this.index] !== '"') this.error('Object keys must be strings.');
      const key = this.string();
      if (keys.has(key)) fail('DUPLICATE_KEY', `Duplicate JSON key "${key}".`, `${this.targetPath}.${key}`);
      keys.add(key);
      this.whitespace();
      if (this.text[this.index] !== ':') this.error('Expected a colon after object key.');
      this.index += 1;
      const child = this.value();
      Object.defineProperty(value, key, { value: child, enumerable: true, writable: true, configurable: true });
      this.whitespace();
      if (this.text[this.index] === '}') {
        this.index += 1;
        return value;
      }
      if (this.text[this.index] !== ',') this.error('Expected a comma between object members.');
      this.index += 1;
    }
    this.error('Unterminated JSON object.');
  }

  array() {
    this.index += 1;
    const value = [];
    this.whitespace();
    if (this.text[this.index] === ']') {
      this.index += 1;
      return value;
    }
    while (this.index < this.text.length) {
      value.push(this.value());
      this.whitespace();
      if (this.text[this.index] === ']') {
        this.index += 1;
        return value;
      }
      if (this.text[this.index] !== ',') this.error('Expected a comma between array members.');
      this.index += 1;
    }
    this.error('Unterminated JSON array.');
  }
}

export function parseJsonStrict(text, targetPath = 'json') {
  if (typeof text !== 'string') fail('WRONG_TYPE', 'Expected UTF-8 text.', targetPath);
  const result = new JsonReader(text, targetPath).parse();
  scanDataForDanger(result, targetPath);
  return result;
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readFileText(filePath, targetPath) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) fail('SYMLINK', 'Symlinks are not allowed in Vault packages.', targetPath);
  if (!stat.isFile()) fail('INVALID_FILE', 'Expected a regular file.', targetPath);
  if (stat.size > MAX_FILE_BYTES) fail('OVERSIZE_FILE', `File exceeds ${MAX_FILE_BYTES} bytes.`, targetPath);
  const bytes = fs.readFileSync(filePath);
  const text = bytes.toString('utf8');
  if (Buffer.byteLength(text, 'utf8') !== bytes.length) fail('INVALID_ENCODING', 'Files must be valid UTF-8.', targetPath);
  return text;
}

function walkPackageFiles(packageRoot) {
  const files = [];
  const walk = (directory, relative = '') => {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink()) fail('SYMLINK', 'Symlinks are not allowed in Vault packages.', relative || '.');
    if (!stat.isDirectory()) fail('INVALID_PACKAGE', 'Package root must be a directory.', relative || '.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) fail('UNKNOWN_FILE', 'Hidden files are not allowed.', path.posix.join(relative, entry.name));
      const childRelative = path.posix.join(relative, entry.name);
      const childPath = path.join(directory, entry.name);
      const childStat = fs.lstatSync(childPath);
      if (childStat.isSymbolicLink()) fail('SYMLINK', 'Symlinks are not allowed in Vault packages.', childRelative);
      if (childStat.isDirectory()) {
        if (relative) fail('UNKNOWN_FILE', 'Nested directories are not allowed.', childRelative);
        walk(childPath, childRelative);
      } else if (childStat.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (FORBIDDEN_FILE_EXTENSIONS.has(extension)) fail('FORBIDDEN_FILE', 'Executable or runtime file types are not allowed.', childRelative);
        files.push(childRelative);
      } else {
        fail('INVALID_FILE', 'Special files are not allowed.', childRelative);
      }
    }
  };
  walk(packageRoot);
  return files.sort();
}

function validateSchema(schema, targetPath, depth = 0) {
  if (depth > 8) fail('SCHEMA_DEPTH', 'Schema nesting exceeds the bound.', targetPath);
  assertOnlyKeys(schema, SCHEMA_FIELDS, targetPath);
  if (schema.type !== undefined) {
    const types = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
    if (!types.includes(schema.type)) fail('INVALID_SCHEMA', 'Unsupported schema type.', `${targetPath}.type`);
  }
  if (schema.additionalProperties !== undefined) assertBoolean(schema.additionalProperties, `${targetPath}.additionalProperties`);
  if (schema.properties !== undefined) {
    const properties = assertRecord(schema.properties, `${targetPath}.properties`);
    for (const [key, child] of Object.entries(properties)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) fail('INVALID_SCHEMA', 'Schema property name is not bounded.', `${targetPath}.properties.${key}`);
      validateSchema(child, `${targetPath}.properties.${key}`, depth + 1);
    }
  }
  if (schema.required !== undefined) {
    const required = assertArray(schema.required, `${targetPath}.required`, 0, 32);
    for (const [index, key] of required.entries()) assertString(key, `${targetPath}.required[${index}]`, 1, 64);
  }
  if (schema.items !== undefined) validateSchema(schema.items, `${targetPath}.items`, depth + 1);
  for (const key of ['minimum', 'maximum', 'exclusiveMinimum']) {
    if (schema[key] !== undefined) assertNumber(schema[key], `${targetPath}.${key}`, -1_000_000_000, 1_000_000_000);
  }
  for (const key of ['minItems', 'maxItems', 'minLength', 'maxLength']) {
    if (schema[key] !== undefined) assertInteger(schema[key], `${targetPath}.${key}`, 0, 100_000);
  }
  if (schema.enum !== undefined) {
    const values = assertArray(schema.enum, `${targetPath}.enum`, 1, 32);
    values.forEach((value, index) => {
      if (!['string', 'number', 'boolean', 'null'].includes(typeof value) && value !== null) {
        fail('INVALID_SCHEMA', 'Enum values must be primitive.', `${targetPath}.enum[${index}]`);
      }
    });
  }
  if (schema.oneOf !== undefined) {
    const alternatives = assertArray(schema.oneOf, `${targetPath}.oneOf`, 1, 8);
    alternatives.forEach((alternative, index) => validateSchema(alternative, `${targetPath}.oneOf[${index}]`, depth + 1));
  }
  if (schema.description !== undefined) assertString(schema.description, `${targetPath}.description`, 1, 500);
}

function validateCapabilityId(value, targetPath) {
  assertString(value, targetPath, 3, 120);
  if (!HOST_ID_PATTERN.test(value) || !TRUSTED_HOST_IDS.has(value)) {
    fail('UNTRUSTED_CAPABILITY', 'Package references an unknown host-owned capability.', targetPath);
  }
}

function validateCapabilityArray(value, targetPath, maxLength = 16) {
  const refs = assertArray(value, targetPath, 0, maxLength);
  const seen = new Set();
  refs.forEach((ref, index) => {
    validateCapabilityId(ref, `${targetPath}[${index}]`);
    if (seen.has(ref)) fail('DUPLICATE_CAPABILITY', 'Capability references must be unique.', `${targetPath}[${index}]`);
    seen.add(ref);
  });
  return refs;
}

function validatePorts(value, targetPath) {
  const ports = assertRecord(value, targetPath);
  assertOnlyKeys(ports, ['inputs', 'outputs'], targetPath);
  for (const direction of ['inputs', 'outputs']) {
    const entries = assertArray(ports[direction], `${targetPath}.${direction}`, 0, 24);
    const names = new Set();
    entries.forEach((entry, index) => {
      const entryPath = `${targetPath}.${direction}[${index}]`;
      assertOnlyKeys(entry, ['name', 'type', 'required', 'description'], entryPath);
      assertString(entry.name, `${entryPath}.name`, 1, 80);
      if (!/^[a-z][a-z0-9_.-]*$/.test(entry.name) || names.has(entry.name)) fail('INVALID_PORT', 'Port names must be unique and bounded.', `${entryPath}.name`);
      names.add(entry.name);
      if (!['string', 'number', 'boolean', 'object', 'array'].includes(entry.type)) fail('INVALID_PORT', 'Port type is not supported.', `${entryPath}.type`);
      if (entry.required !== undefined) assertBoolean(entry.required, `${entryPath}.required`);
      if (entry.description !== undefined) assertString(entry.description, `${entryPath}.description`, 1, 300);
    });
  }
}

function validateNetwork(value, targetPath) {
  const network = assertRecord(value, targetPath);
  assertOnlyKeys(network, ['mode', 'endpoints', 'telemetry'], targetPath);
  if (network.mode !== 'none') fail('NETWORK_NOT_LOCAL', 'v0.1 packages must declare network mode none.', `${targetPath}.mode`);
  const endpoints = assertArray(network.endpoints, `${targetPath}.endpoints`, 0, 0);
  if (endpoints.length !== 0) fail('NETWORK_NOT_LOCAL', 'Local packages cannot declare endpoints.', `${targetPath}.endpoints`);
  assertBoolean(network.telemetry, `${targetPath}.telemetry`);
  if (network.telemetry) fail('NETWORK_NOT_LOCAL', 'Local packages cannot declare telemetry.', `${targetPath}.telemetry`);
}

function validateLimits(value, targetPath) {
  const limits = assertRecord(value, targetPath);
  const fields = ['max_bytes', 'max_instances', 'max_bindings', 'max_depth', 'max_operations', 'max_items', 'max_output_bytes'];
  assertOnlyKeys(limits, fields, targetPath);
  for (const field of fields) {
    assertInteger(limits[field], `${targetPath}.${field}`, 1, field === 'max_bytes' || field === 'max_output_bytes' ? MAX_PACKAGE_BYTES : 256);
  }
}

function validateQualification(value, targetPath) {
  const qualification = assertRecord(value, targetPath);
  assertOnlyKeys(qualification, ['status', 'evidence', 'reviewer', 'date', 'tested_boundary'], targetPath);
  const statuses = ['draft', 'schema-valid', 'local-tested', 'fixture-tested', 'independently-reviewed', 'approved', 'deprecated', 'revoked'];
  if (!statuses.includes(qualification.status)) fail('INVALID_QUALIFICATION', 'Unknown qualification status.', `${targetPath}.status`);
  if (qualification.status === 'revoked') fail('INVALID_QUALIFICATION', 'Revoked packages cannot enter the v0.1 local snapshot.', `${targetPath}.status`);
  assertPathArray(qualification.evidence, `${targetPath}.evidence`, 'provenance', 1, 8);
  assertString(qualification.reviewer, `${targetPath}.reviewer`, 1, 180);
  assertDate(qualification.date, `${targetPath}.date`);
  assertString(qualification.tested_boundary, `${targetPath}.tested_boundary`, 1, 500);
}

function validateCompatibility(value, targetPath) {
  const compatibility = assertRecord(value, targetPath);
  assertOnlyKeys(compatibility, ['protocol', 'protocol_version', 'registry_version', 'renderer_ids', 'behavior_ids', 'adapter_ids'], targetPath);
  if (compatibility.protocol !== BAZAAR_PROTOCOL) fail('INCOMPATIBLE_PROTOCOL', 'Package protocol does not match Fogwood.', `${targetPath}.protocol`);
  if (compatibility.protocol_version !== BAZAAR_PROTOCOL_VERSION) fail('INCOMPATIBLE_PROTOCOL', 'Package protocol version is unsupported.', `${targetPath}.protocol_version`);
  if (compatibility.registry_version !== BAZAAR_REGISTRY_VERSION) fail('INCOMPATIBLE_REGISTRY', 'Package registry version is unsupported.', `${targetPath}.registry_version`);
  validateCapabilityArray(compatibility.renderer_ids, `${targetPath}.renderer_ids`);
  validateCapabilityArray(compatibility.behavior_ids, `${targetPath}.behavior_ids`);
  validateCapabilityArray(compatibility.adapter_ids, `${targetPath}.adapter_ids`);
}

function validateBlock(value, targetPath) {
  const block = assertRecord(value, targetPath);
  assertOnlyKeys(block, BLOCK_FIELDS, targetPath);
  const kinds = ['panel', 'heading', 'text', 'metric', 'checklist', 'table', 'input', 'select', 'slider', 'button', 'progress', 'chart'];
  const tones = ['paper', 'ink', 'accent', 'blue', 'green', 'yellow'];
  if (!kinds.includes(block.kind)) fail('INVALID_RECIPE', 'Recipe block kind is unsupported.', `${targetPath}.kind`);
  if (block.tone !== undefined && !tones.includes(block.tone)) fail('INVALID_RECIPE', 'Recipe block tone is unsupported.', `${targetPath}.tone`);
  for (const field of ['x', 'y']) if (block[field] !== undefined) assertNumber(block[field], `${targetPath}.${field}`, -100_000, 100_000);
  for (const field of ['w', 'h']) if (block[field] !== undefined) assertNumber(block[field], `${targetPath}.${field}`, field === 'w' ? 120 : 56, field === 'w' ? 1_400 : 1_000);
  for (const field of ['title', 'body']) if (block[field] !== undefined) assertString(block[field], `${targetPath}.${field}`, 1, field === 'title' ? 180 : 2_000);
  if (block.value !== undefined && typeof block.value !== 'string' && !isFiniteNumber(block.value)) fail('INVALID_RECIPE', 'Block value must be text or a finite number.', `${targetPath}.value`);
  if (typeof block.value === 'string') assertString(block.value, `${targetPath}.value`, 1, 500);
  if (block.items !== undefined) {
    const items = assertArray(block.items, `${targetPath}.items`, 1, 20);
    items.forEach((item, index) => {
      const itemPath = `${targetPath}.items[${index}]`;
      assertOnlyKeys(item, ['label', 'checked'], itemPath);
      assertString(item.label, `${itemPath}.label`, 1, 240);
      if (item.checked !== undefined) assertBoolean(item.checked, `${itemPath}.checked`);
    });
  }
  for (const field of ['columns', 'options']) {
    if (block[field] === undefined) continue;
    const list = assertArray(block[field], `${targetPath}.${field}`, 1, field === 'columns' ? 8 : 20);
    list.forEach((item, index) => assertString(item, `${targetPath}.${field}[${index}]`, 1, 160));
  }
  if (block.rows !== undefined) {
    const rows = assertArray(block.rows, `${targetPath}.rows`, 1, 12);
    rows.forEach((row, rowIndex) => {
      const entries = assertArray(row, `${targetPath}.rows[${rowIndex}]`, 1, 8);
      entries.forEach((item, itemIndex) => assertString(item, `${targetPath}.rows[${rowIndex}][${itemIndex}]`, 1, 160));
    });
  }
  if (block.series !== undefined) {
    const series = assertArray(block.series, `${targetPath}.series`, 1, 10);
    series.forEach((item, index) => {
      const itemPath = `${targetPath}.series[${index}]`;
      assertOnlyKeys(item, ['label', 'value'], itemPath);
      assertString(item.label, `${itemPath}.label`, 1, 80);
      assertNumber(item.value, `${itemPath}.value`, -1_000_000_000, 1_000_000_000);
    });
  }
  for (const field of ['min', 'max', 'step']) if (block[field] !== undefined) assertNumber(block[field], `${targetPath}.${field}`, field === 'step' ? 0.001 : -1_000_000, field === 'step' ? 100_000 : 1_000_000);
}

function validateShape(value, targetPath) {
  const shape = assertRecord(value, targetPath);
  assertOnlyKeys(shape, SHAPE_FIELDS, targetPath);
  const kinds = ['rectangle', 'ellipse', 'diamond', 'triangle', 'cloud', 'note', 'text', 'arrow', 'frame'];
  const colors = ['black', 'grey', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'];
  const fills = ['none', 'semi', 'solid', 'pattern'];
  if (!kinds.includes(shape.kind)) fail('INVALID_RECIPE', 'Recipe shape kind is unsupported.', `${targetPath}.kind`);
  if (shape.color !== undefined && !colors.includes(shape.color)) fail('INVALID_RECIPE', 'Recipe shape color is unsupported.', `${targetPath}.color`);
  if (shape.fill !== undefined && !fills.includes(shape.fill)) fail('INVALID_RECIPE', 'Recipe shape fill is unsupported.', `${targetPath}.fill`);
  for (const field of ['x', 'y', 'end_x', 'end_y']) if (shape[field] !== undefined) assertNumber(shape[field], `${targetPath}.${field}`, -100_000, 100_000);
  if (shape.w !== undefined) assertNumber(shape.w, `${targetPath}.w`, 40, 2_000);
  if (shape.h !== undefined) assertNumber(shape.h, `${targetPath}.h`, 40, 1_600);
  if (shape.text !== undefined) assertString(shape.text, `${targetPath}.text`, 1, 2_000);
}

const COMPOSITION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/u;
const COMPOSITION_RELATIONSHIP_KINDS = new Set(['supports', 'contradicts', 'depends_on', 'causes', 'blocks', 'echoes', 'mutates_into']);
const COMPOSITION_MOVE_KINDS = new Set(['scatter', 'cluster', 'branch', 'orbit', 'montage', 'trace', 'annotate', 'mutate']);
const COMPOSITION_SHAPE_KINDS = new Set(['rectangle', 'ellipse', 'diamond', 'triangle', 'cloud', 'note', 'text', 'frame']);
const COMPOSITION_MATERIAL_KINDS = new Set(['native', 'asset']);
const COMPOSITION_PROVOCATION_KINDS = new Set(['question', 'portal', 'quotation', 'instruction']);
const COMPOSITION_SOURCE_STATUSES = new Set(['observed', 'analogy', 'inference', 'open']);
const COMPOSITION_TEXT_DANGER = /(?:https?:\/\/|ftp:\/\/|blob:\/\/|data:|<\/?[a-z]|javascript\s*:|vbscript\s*:|\b(?:fetch|eval|function|import|require)\s*\()/iu;
const COMPOSITION_DATA_FORBIDDEN_KEYS = new Set([
  'code', 'exec', 'execute', 'eval', 'function', 'script', 'formula', 'expression',
  'html', 'css', 'style', 'url', 'href', 'src', 'fetch', 'remote', 'embed', 'iframe',
]);

function validateCompositionId(value, targetPath) {
  assertString(value, targetPath, 1, 180);
  if (!COMPOSITION_ID_PATTERN.test(value)) fail('INVALID_ID', 'Composition IDs must use the bounded stable lexical form.', targetPath);
  return value;
}

function validateCompositionText(value, targetPath, max = 500) {
  assertString(value, targetPath, 1, max);
  if (COMPOSITION_TEXT_DANGER.test(value)) fail('SUSPICIOUS_CONTENT', 'Composition text cannot contain code, HTML, or remote references.', targetPath);
  return value;
}

function validateCompositionData(value, targetPath, depth = 0, state = { entries: 0 }) {
  const data = assertRecord(value, targetPath);
  if (depth > 4) fail('DATA_DEPTH', 'Composition algorithm data exceeds the depth bound.', targetPath);
  for (const [key, child] of Object.entries(data)) {
    state.entries += 1;
    if (state.entries > 32) fail('DATA_LIMIT', 'Composition algorithm data exceeds the entry bound.', targetPath);
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) fail('INVALID_DATA', 'Algorithm data keys must be bounded names.', `${targetPath}.${key}`);
    if (COMPOSITION_DATA_FORBIDDEN_KEYS.has(key.toLowerCase())) fail('FORBIDDEN_FIELD', 'Algorithm data cannot contain executable, network, markup, or formula fields.', `${targetPath}.${key}`);
    if (typeof child === 'string') validateCompositionText(child, `${targetPath}.${key}`);
    else if (typeof child === 'number') assertNumber(child, `${targetPath}.${key}`, -1_000_000, 1_000_000);
    else if (typeof child === 'boolean' || child === null) continue;
    else if (Array.isArray(child)) {
      if (child.length > 32) fail('DATA_LIMIT', 'Composition algorithm arrays are bounded.', `${targetPath}.${key}`);
      child.forEach((entry, index) => {
        if (typeof entry === 'string') validateCompositionText(entry, `${targetPath}.${key}[${index}]`);
        else if (typeof entry === 'number') assertNumber(entry, `${targetPath}.${key}[${index}]`, -1_000_000, 1_000_000);
        else if (typeof entry !== 'boolean' && entry !== null) fail('INVALID_DATA', 'Algorithm arrays contain only scalar values.', `${targetPath}.${key}[${index}]`);
      });
    } else if (isRecord(child)) validateCompositionData(child, `${targetPath}.${key}`, depth + 1, state);
    else fail('INVALID_DATA', 'Algorithm data contains an unsupported value.', `${targetPath}.${key}`);
  }
}

function validateCompositionRecipe(value, targetPath, manifest, limits) {
  const recipe = assertRecord(value, targetPath);
  assertOnlyKeys(recipe, RECIPE_FIELDS, targetPath);
  assertString(recipe.id, `${targetPath}.id`, 1, 180);
  if (!COMPOSITION_ID_PATTERN.test(recipe.id)) fail('INVALID_ID', 'Composition recipe id is not stable.', `${targetPath}.id`);
  if (recipe.version !== 2) fail('INVALID_VERSION', 'Composition recipes must use version 2.', `${targetPath}.version`);
  if (recipe.format !== COMPOSITION_FORMAT) fail('INVALID_FORMAT', `Composition recipes must use ${COMPOSITION_FORMAT}.`, `${targetPath}.format`);
  validateCompositionText(recipe.title, `${targetPath}.title`, 180);
  validateCompositionText(recipe.purpose, `${targetPath}.purpose`, 500);
  if (recipe.status !== 'immutable') fail('INVALID_RECIPE', 'Composition recipes must be immutable.', `${targetPath}.status`);
  const bounds = assertRecord(recipe.bounds, `${targetPath}.bounds`);
  assertOnlyKeys(bounds, ['x', 'y', 'w', 'h'], `${targetPath}.bounds`);
  if (bounds.x !== 0 || bounds.y !== 0) fail('INVALID_RECIPE', 'Composition bounds must start at 0,0.', `${targetPath}.bounds`);
  assertNumber(bounds.w, `${targetPath}.bounds.w`, 1, 2_000);
  assertNumber(bounds.h, `${targetPath}.bounds.h`, 1, 2_000);
  validateCompositionText(recipe.semantic, `${targetPath}.semantic`, 180);
  const provenance = assertRecord(recipe.provenance, `${targetPath}.provenance`);
  assertOnlyKeys(provenance, ['source', 'recipe_id', 'recipe_version'], `${targetPath}.provenance`);
  if (provenance.source !== 'fogwood' || provenance.recipe_id !== recipe.id || provenance.recipe_version !== 2) fail('INVALID_PROVENANCE', 'Composition provenance must pin its exact identity.', `${targetPath}.provenance`);

  const regions = assertArray(recipe.regions, `${targetPath}.regions`, 1, 24);
  const regionIds = new Set();
  regions.forEach((region, index) => {
    const regionPath = `${targetPath}.regions[${index}]`;
    assertOnlyKeys(region, ['id', 'label', 'x', 'y', 'w', 'h'], regionPath);
    const id = validateCompositionId(region.id, `${regionPath}.id`);
    if (regionIds.has(id)) fail('DUPLICATE_REGION_ID', 'Composition region IDs must be unique.', `${regionPath}.id`);
    regionIds.add(id);
    validateCompositionText(region.label, `${regionPath}.label`, 180);
    for (const field of ['x', 'y']) assertNumber(region[field], `${regionPath}.${field}`, -100_000, 100_000);
    for (const field of ['w', 'h']) assertNumber(region[field], `${regionPath}.${field}`, 1, 2_000);
  });

  const items = assertArray(recipe.items, `${targetPath}.items`, 1, 64);
  const itemIds = new Set();
  const semanticIds = new Set();
  items.forEach((item, index) => {
    const itemPath = `${targetPath}.items[${index}]`;
    assertOnlyKeys(item, ['id', 'semantic_id', 'kind', 'role', 'region_id', 'x', 'y', 'w', 'h', 'text', 'color', 'fill', 'variant_id', 'parent_variant_id', 'lineage_source_id'], itemPath);
    const id = validateCompositionId(item.id, `${itemPath}.id`);
    const semanticId = validateCompositionId(item.semantic_id, `${itemPath}.semantic_id`);
    if (itemIds.has(id)) fail('DUPLICATE_ITEM_ID', 'Composition item IDs must be unique.', `${itemPath}.id`);
    if (semanticIds.has(semanticId)) fail('DUPLICATE_SEMANTIC_ID', 'Composition semantic IDs must be unique.', `${itemPath}.semantic_id`);
    itemIds.add(id); semanticIds.add(semanticId);
    if (!COMPOSITION_SHAPE_KINDS.has(item.kind)) fail('INVALID_RECIPE', 'Composition items must be native shape kinds.', `${itemPath}.kind`);
    validateCompositionText(item.role, `${itemPath}.role`, 180);
    const regionId = validateCompositionId(item.region_id, `${itemPath}.region_id`);
    if (!regionIds.has(regionId)) fail('UNKNOWN_REGION', 'Composition item references an unknown region.', `${itemPath}.region_id`);
    for (const field of ['x', 'y']) assertNumber(item[field], `${itemPath}.${field}`, -100_000, 100_000);
    for (const field of ['w', 'h']) assertNumber(item[field], `${itemPath}.${field}`, 40, field === 'w' ? 2_000 : 1_600);
    if (item.text !== undefined) validateCompositionText(item.text, `${itemPath}.text`);
    if (item.color !== undefined && !['black', 'grey', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'].includes(item.color)) fail('INVALID_COLOR', 'Composition color is not host-owned.', `${itemPath}.color`);
    if (item.fill !== undefined && !['none', 'semi', 'solid', 'pattern'].includes(item.fill)) fail('INVALID_FILL', 'Composition fill is not host-owned.', `${itemPath}.fill`);
    for (const field of ['variant_id', 'parent_variant_id', 'lineage_source_id']) if (item[field] !== undefined) validateCompositionId(item[field], `${itemPath}.${field}`);
  });

  const materials = assertArray(recipe.materials, `${targetPath}.materials`, 1, 96);
  const materialIds = new Set();
  const materialItems = new Set();
  const materialSemanticIds = new Set();
  materials.forEach((material, index) => {
    const materialPath = `${targetPath}.materials[${index}]`;
    assertOnlyKeys(material, ['id', 'kind', 'item_id', 'role', 'semantic_id'], materialPath);
    const id = validateCompositionId(material.id, `${materialPath}.id`);
    const itemId = validateCompositionId(material.item_id, `${materialPath}.item_id`);
    const semanticId = validateCompositionId(material.semantic_id, `${materialPath}.semantic_id`);
    if (materialIds.has(id)) fail('DUPLICATE_MATERIAL_ID', 'Composition material IDs must be unique.', `${materialPath}.id`);
    if (materialItems.has(itemId)) fail('DUPLICATE_MATERIAL_ITEM', 'Each composition item must have one material record.', `${materialPath}.item_id`);
    if (materialSemanticIds.has(semanticId)) fail('DUPLICATE_SEMANTIC_ID', 'Composition material semantic IDs must be unique.', `${materialPath}.semantic_id`);
    if (!COMPOSITION_MATERIAL_KINDS.has(material.kind)) fail('INVALID_MATERIAL_KIND', 'Composition material kind is unsupported.', `${materialPath}.kind`);
    if (!itemIds.has(itemId) || !semanticIds.has(semanticId)) fail('UNKNOWN_TARGET', 'Composition material must reference a known item.', materialPath);
    validateCompositionText(material.role, `${materialPath}.role`, 180);
    materialIds.add(id); materialItems.add(itemId); materialSemanticIds.add(semanticId);
  });
  if (materialItems.size !== itemIds.size) fail('MATERIAL_COVERAGE', 'Every composition item needs exactly one material.', `${targetPath}.materials`);

  const edges = assertArray(recipe.edges, `${targetPath}.edges`, 1, 256);
  const edgeIds = new Set();
  edges.forEach((edge, index) => {
    const edgePath = `${targetPath}.edges[${index}]`;
    assertOnlyKeys(edge, ['id', 'kind', 'source_semantic_id', 'target_semantic_id', 'label'], edgePath);
    const id = validateCompositionId(edge.id, `${edgePath}.id`);
    const source = validateCompositionId(edge.source_semantic_id, `${edgePath}.source_semantic_id`);
    const target = validateCompositionId(edge.target_semantic_id, `${edgePath}.target_semantic_id`);
    if (edgeIds.has(id)) fail('DUPLICATE_EDGE_ID', 'Composition edge IDs must be unique.', `${edgePath}.id`);
    if (!COMPOSITION_RELATIONSHIP_KINDS.has(edge.kind)) fail('INVALID_EDGE_KIND', 'Composition edge kind is unsupported.', `${edgePath}.kind`);
    if (!semanticIds.has(source) || !semanticIds.has(target)) fail('UNKNOWN_ENDPOINT', 'Composition edge endpoints must reference known semantic IDs.', edgePath);
    if (source === target) fail('SELF_RELATIONSHIP', 'Composition edges cannot point to themselves.', edgePath);
    if (edge.label !== undefined) validateCompositionText(edge.label, `${edgePath}.label`, 180);
    edgeIds.add(id);
  });

  const placements = assertArray(recipe.placements, `${targetPath}.placements`, items.length, 96);
  if (placements.length !== items.length) fail('PLACEMENT_MISMATCH', 'Every composition item needs exactly one placement.', `${targetPath}.placements`);
  const placementIds = new Set();
  const placementTargets = new Set();
  placements.forEach((placement, index) => {
    const placementPath = `${targetPath}.placements[${index}]`;
    assertOnlyKeys(placement, ['id', 'target_semantic_id', 'x', 'y', 'rotation'], placementPath);
    const placementId = validateCompositionId(placement.id, `${placementPath}.id`);
    if (placementIds.has(placementId)) fail('DUPLICATE_PLACEMENT_ID', 'Composition placement IDs must be unique.', `${placementPath}.id`);
    const target = validateCompositionId(placement.target_semantic_id, `${placementPath}.target_semantic_id`);
    if (placementTargets.has(target) || !semanticIds.has(target)) fail('PLACEMENT_MISMATCH', 'Placement targets must be unique known semantic IDs.', `${placementPath}.target_semantic_id`);
    placementIds.add(placementId); placementTargets.add(target);
    assertNumber(placement.x, `${placementPath}.x`, -100_000, 100_000);
    assertNumber(placement.y, `${placementPath}.y`, -100_000, 100_000);
    if (placement.rotation !== undefined) assertNumber(placement.rotation, `${placementPath}.rotation`, -Math.PI * 4, Math.PI * 4);
  });

  const moves = assertArray(recipe.moves, `${targetPath}.moves`, 0, 8);
  const moveIds = new Set();
  moves.forEach((move, index) => {
    const movePath = `${targetPath}.moves[${index}]`;
    assertOnlyKeys(move, ['id', 'kind', 'target_semantic_ids', 'algorithm_id', 'data'], movePath);
    const id = validateCompositionId(move.id, `${movePath}.id`);
    if (moveIds.has(id)) fail('DUPLICATE_MOVE_ID', 'Composition move IDs must be unique.', `${movePath}.id`);
    if (!COMPOSITION_MOVE_KINDS.has(move.kind)) fail('INVALID_MOVE_KIND', 'Composition move kind is unsupported.', `${movePath}.kind`);
    const targets = assertArray(move.target_semantic_ids, `${movePath}.target_semantic_ids`, 1, 64);
    const targetSet = new Set();
    targets.forEach((target, targetIndex) => {
      const semanticId = validateCompositionId(target, `${movePath}.target_semantic_ids[${targetIndex}]`);
      if (targetSet.has(semanticId) || !semanticIds.has(semanticId)) fail('UNKNOWN_TARGET', 'Composition move targets must be unique known semantic IDs.', `${movePath}.target_semantic_ids[${targetIndex}]`);
      targetSet.add(semanticId);
    });
    if (move.algorithm_id !== undefined) validateCompositionId(move.algorithm_id, `${movePath}.algorithm_id`);
    if (move.data !== undefined) validateCompositionData(move.data, `${movePath}.data`);
    moveIds.add(id);
  });

  const adapters = assertArray(recipe.adapters, `${targetPath}.adapters`, 0, 8);
  const adapterIds = new Set();
  adapters.forEach((adapter, index) => {
    const adapterPath = `${targetPath}.adapters[${index}]`;
    assertOnlyKeys(adapter, ['id', 'capability_id', 'locality', 'purpose', 'loss'], adapterPath);
    const id = validateCompositionId(adapter.id, `${adapterPath}.id`);
    if (adapterIds.has(id)) fail('DUPLICATE_ADAPTER_ID', 'Composition adapter IDs must be unique.', `${adapterPath}.id`);
    validateCapabilityId(adapter.capability_id, `${adapterPath}.capability_id`);
    if (adapter.locality !== 'local') fail('INVALID_LOCALITY', 'Composition adapters must be local.', `${adapterPath}.locality`);
    validateCompositionText(adapter.purpose, `${adapterPath}.purpose`);
    if (!['none', 'annotated', 'bounded'].includes(adapter.loss)) fail('INVALID_ADAPTER', 'Composition adapter loss is unsupported.', `${adapterPath}.loss`);
    adapterIds.add(id);
  });

  const aesthetics = assertArray(recipe.aesthetics, `${targetPath}.aesthetics`, 0, 12);
  const aestheticIds = new Set();
  aesthetics.forEach((aesthetic, index) => {
    const aestheticPath = `${targetPath}.aesthetics[${index}]`;
    assertOnlyKeys(aesthetic, ['id', 'token_id', 'purpose'], aestheticPath);
    const id = validateCompositionId(aesthetic.id, `${aestheticPath}.id`);
    if (aestheticIds.has(id)) fail('DUPLICATE_AESTHETIC_ID', 'Composition aesthetic IDs must be unique.', `${aestheticPath}.id`);
    validateCapabilityId(aesthetic.token_id, `${aestheticPath}.token_id`);
    validateCompositionText(aesthetic.purpose, `${aestheticPath}.purpose`);
    aestheticIds.add(id);
  });

  const algorithms = assertArray(recipe.algorithms, `${targetPath}.algorithms`, 0, 12);
  const algorithmIds = new Set();
  algorithms.forEach((algorithm, index) => {
    const algorithmPath = `${targetPath}.algorithms[${index}]`;
    assertOnlyKeys(algorithm, ['id', 'capability_id', 'data'], algorithmPath);
    const id = validateCompositionId(algorithm.id, `${algorithmPath}.id`);
    if (algorithmIds.has(id)) fail('DUPLICATE_ALGORITHM_ID', 'Composition algorithm IDs must be unique.', `${algorithmPath}.id`);
    validateCapabilityId(algorithm.capability_id, `${algorithmPath}.capability_id`);
    if (algorithm.data !== undefined) validateCompositionData(algorithm.data, `${algorithmPath}.data`);
    algorithmIds.add(id);
  });
  moves.forEach((move, index) => {
    if (move.algorithm_id !== undefined && !algorithmIds.has(move.algorithm_id)) fail('UNKNOWN_ALGORITHM', 'Composition move algorithm_id must reference a declared algorithm.', `${targetPath}.moves[${index}].algorithm_id`);
  });

  const provocations = assertArray(recipe.provocations, `${targetPath}.provocations`, 0, 16);
  const provocationIds = new Set();
  provocations.forEach((provocation, index) => {
    const provocationPath = `${targetPath}.provocations[${index}]`;
    assertOnlyKeys(provocation, ['id', 'kind', 'text', 'target_semantic_id'], provocationPath);
    const id = validateCompositionId(provocation.id, `${provocationPath}.id`);
    if (provocationIds.has(id)) fail('DUPLICATE_PROVOCATION_ID', 'Composition provocation IDs must be unique.', `${provocationPath}.id`);
    if (!COMPOSITION_PROVOCATION_KINDS.has(provocation.kind)) fail('INVALID_PROVOCATION', 'Provocation kind is unsupported.', `${provocationPath}.kind`);
    validateCompositionText(provocation.text, `${provocationPath}.text`);
    if (provocation.target_semantic_id !== undefined && !semanticIds.has(validateCompositionId(provocation.target_semantic_id, `${provocationPath}.target_semantic_id`))) fail('UNKNOWN_TARGET', 'Provocation target is unknown.', `${provocationPath}.target_semantic_id`);
    provocationIds.add(id);
  });

  const variants = assertArray(recipe.variants, `${targetPath}.variants`, 0, 64);
  const variantIds = new Set();
  variants.forEach((variant, index) => {
    const variantPath = `${targetPath}.variants[${index}]`;
    assertOnlyKeys(variant, ['id', 'variant_id', 'lineage_source_id', 'parent_variant_id', 'label'], variantPath);
    const id = validateCompositionId(variant.id, `${variantPath}.id`);
    const variantId = validateCompositionId(variant.variant_id, `${variantPath}.variant_id`);
    const lineage = validateCompositionId(variant.lineage_source_id, `${variantPath}.lineage_source_id`);
    if (variantIds.has(variantId)) fail('DUPLICATE_VARIANT_ID', 'Composition variant IDs must be unique.', `${variantPath}.variant_id`);
    if (!semanticIds.has(lineage) && !variantIds.has(lineage)) fail('UNKNOWN_LINEAGE', 'Variant lineage source must name an item or earlier variant.', `${variantPath}.lineage_source_id`);
    if (variant.parent_variant_id !== undefined) {
      const parent = validateCompositionId(variant.parent_variant_id, `${variantPath}.parent_variant_id`);
      if (!semanticIds.has(parent) && !variantIds.has(parent)) fail('UNKNOWN_LINEAGE', 'Variant parent must name an item or earlier variant.', `${variantPath}.parent_variant_id`);
    }
    validateCompositionText(variant.label, `${variantPath}.label`, 180);
    variantIds.add(variantId);
    if (!id) fail('INVALID_ID', 'Variant record id is required.', `${variantPath}.id`);
  });
  const declaredVariantIds = new Set(variantIds);
  items.forEach((item, index) => {
    const itemPath = `${targetPath}.items[${index}]`;
    if (item.variant_id !== undefined && !declaredVariantIds.has(item.variant_id)) fail('UNKNOWN_VARIANT', 'Item variant_id must reference a declared variant.', `${itemPath}.variant_id`);
    if (item.parent_variant_id !== undefined && !declaredVariantIds.has(item.parent_variant_id)) fail('UNKNOWN_VARIANT', 'Item parent_variant_id must reference a declared variant.', `${itemPath}.parent_variant_id`);
    if (item.lineage_source_id !== undefined && !semanticIds.has(item.lineage_source_id) && !declaredVariantIds.has(item.lineage_source_id)) fail('UNKNOWN_LINEAGE', 'Item lineage_source_id must name an item or declared variant.', `${itemPath}.lineage_source_id`);
  });

  const sourceNotes = assertArray(recipe.source_notes, `${targetPath}.source_notes`, 0, 16);
  const sourceIds = new Set();
  sourceNotes.forEach((source, index) => {
    const sourcePath = `${targetPath}.source_notes[${index}]`;
    assertOnlyKeys(source, ['id', 'title', 'locator', 'status', 'summary'], sourcePath);
    const id = validateCompositionId(source.id, `${sourcePath}.id`);
    if (sourceIds.has(id)) fail('DUPLICATE_SOURCE_ID', 'Composition source IDs must be unique.', `${sourcePath}.id`);
    validateCompositionText(source.title, `${sourcePath}.title`, 180);
    assertString(source.locator, `${sourcePath}.locator`, 1, 500);
    if (!/^https:\/\//iu.test(source.locator)) fail('INVALID_SOURCE', 'Composition source locators must be bounded HTTPS URLs.', `${sourcePath}.locator`);
    if (!COMPOSITION_SOURCE_STATUSES.has(source.status)) fail('INVALID_SOURCE_STATUS', 'Composition source status is unsupported.', `${sourcePath}.status`);
    validateCompositionText(source.summary, `${sourcePath}.summary`);
    sourceIds.add(id);
  });

  const qualification = assertRecord(recipe.qualification, `${targetPath}.qualification`);
  assertOnlyKeys(qualification, ['default_surface_blocks', 'native_material_ratio', 'typed_edge_ratio', 'deterministic_repeat', 'stable_ids', 'variant_preservation', 'edit_inspect_mutation', 'no_live_provider', 'fixtures', 'examples', 'expected_counts'], `${targetPath}.qualification`);
  if (qualification.default_surface_blocks !== 0) fail('QUALIFICATION_MISMATCH', 'Composition defaults must have zero surface blocks.', `${targetPath}.qualification.default_surface_blocks`);
  assertNumber(qualification.native_material_ratio, `${targetPath}.qualification.native_material_ratio`, 0.7, 1);
  assertNumber(qualification.typed_edge_ratio, `${targetPath}.qualification.typed_edge_ratio`, 0.6, 1);
  const actualNativeMaterialRatio = materials.length === 0 ? 0 : materials.filter((entry) => entry.kind === 'native').length / materials.length;
  const actualTypedEdgeRatio = edges.length === 0 ? 0 : edges.filter((edge) => COMPOSITION_RELATIONSHIP_KINDS.has(edge.kind)).length / edges.length;
  if (Math.abs(qualification.native_material_ratio - actualNativeMaterialRatio) > 1e-9) fail('RATIO_MISMATCH', 'Composition native_material_ratio must match the declarative materials.', `${targetPath}.qualification.native_material_ratio`);
  if (Math.abs(qualification.typed_edge_ratio - actualTypedEdgeRatio) > 1e-9) fail('RATIO_MISMATCH', 'Composition typed_edge_ratio must match the declarative edges.', `${targetPath}.qualification.typed_edge_ratio`);
  if (qualification.deterministic_repeat !== true || qualification.stable_ids !== true || qualification.no_live_provider !== true) fail('QUALIFICATION_MISMATCH', 'Composition qualification must explicitly prove determinism, stable IDs, and no live provider.', `${targetPath}.qualification`);
  if (typeof qualification.variant_preservation !== 'boolean' || typeof qualification.edit_inspect_mutation !== 'boolean') fail('QUALIFICATION_MISMATCH', 'Composition qualification must record variant and edit-inspect fixtures.', `${targetPath}.qualification`);
  assertPathArray(qualification.fixtures, `${targetPath}.qualification.fixtures`, 'fixtures', 1, 12);
  assertPathArray(qualification.examples, `${targetPath}.qualification.examples`, 'examples', 1, 8);
  if (qualification.expected_counts !== undefined) {
    const expected = assertRecord(qualification.expected_counts, `${targetPath}.qualification.expected_counts`);
    assertOnlyKeys(expected, ['items', 'edges', 'native_materials', 'typed_edges'], `${targetPath}.qualification.expected_counts`);
    if (expected.items !== items.length || expected.edges !== edges.length || expected.native_materials !== materials.filter((entry) => entry.kind === 'native').length || expected.typed_edges !== edges.length) fail('EXPECTED_COUNT_MISMATCH', 'Composition qualification expected counts do not match content.', `${targetPath}.qualification.expected_counts`);
  }
  assertInteger(recipe.expected_count, `${targetPath}.expected_count`, 1, limits.max_items);
  if (recipe.expected_count !== items.length + edges.length) fail('EXPECTED_COUNT_MISMATCH', 'Composition expected_count must equal items plus typed edges.', `${targetPath}.expected_count`);
  if (!edges.some((edge) => edge.kind === 'mutates_into') && variants.length > 0) fail('VARIANT_EDGE_REQUIRED', 'A composition with variants must include a mutates_into edge.', `${targetPath}.edges`);
  return recipe;
}

const INSTRUMENT_VALUE_TYPES = new Set(['number', 'boolean', 'string', 'chart', 'table']);
const INSTRUMENT_ID_PATTERN = /^[a-z][a-z0-9_.:-]*$/;
const RESERVED_INSTRUMENT_NAMES = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);
const FORMULA_BINARY_OPERATORS = new Set(['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte']);
const FORMULA_UNARY_OPERATORS = new Set(['neg', 'abs', 'not', 'round']);
const FORMULA_VARIADIC_OPERATORS = new Set(['sum', 'min', 'max', 'and', 'or', 'concat']);

function assertInstrumentName(value, targetPath, maxLength = 180) {
  assertString(value, targetPath, 1, maxLength);
  if (!INSTRUMENT_ID_PATTERN.test(value) || RESERVED_INSTRUMENT_NAMES.has(value)) {
    fail('INVALID_INSTRUMENT_ID', 'Runtime identities must be stable non-reserved names.', targetPath);
  }
  return value;
}

function validateInstrumentScalar(value, targetPath) {
  if (typeof value === 'number') {
    assertNumber(value, targetPath, -1_000_000_000, 1_000_000_000);
    return;
  }
  if (typeof value === 'boolean') return;
  if (typeof value === 'string') {
    assertString(value, targetPath, 0, 180);
    return;
  }
  fail('INVALID_INSTRUMENT_VALUE', 'Instrument values must be finite typed scalars or bounded data.', targetPath);
}

function validateInstrumentValue(value, targetPath, depth = 0) {
  if (depth > 4) fail('INSTRUMENT_VALUE_DEPTH', 'Instrument value nesting exceeds the bound.', targetPath);
  if (!isRecord(value)) {
    validateInstrumentScalar(value, targetPath);
    return;
  }
  if (value.kind === 'chart') {
    assertOnlyKeys(value, ['kind', 'series'], targetPath);
    const series = assertArray(value.series, `${targetPath}.series`, 1, 32);
    series.forEach((point, index) => {
      const pointPath = `${targetPath}.series[${index}]`;
      assertOnlyKeys(point, ['label', 'value'], pointPath);
      assertString(point.label, `${pointPath}.label`, 1, 180);
      assertNumber(point.value, `${pointPath}.value`, -1_000_000_000, 1_000_000_000);
    });
    return;
  }
  if (value.kind === 'table') {
    assertOnlyKeys(value, ['kind', 'columns', 'rows'], targetPath);
    const columns = assertArray(value.columns, `${targetPath}.columns`, 1, 32);
    columns.forEach((column, index) => assertString(column, `${targetPath}.columns[${index}]`, 1, 180));
    const rows = assertArray(value.rows, `${targetPath}.rows`, 0, 32);
    rows.forEach((row, rowIndex) => {
      const rowPath = `${targetPath}.rows[${rowIndex}]`;
      const entries = assertArray(row, rowPath, columns.length, columns.length);
      entries.forEach((entry, columnIndex) => assertString(entry, `${rowPath}[${columnIndex}]`, 0, 180));
    });
    return;
  }
  fail('INVALID_INSTRUMENT_VALUE', 'Instrument data values must declare chart or table kind.', targetPath);
}

function instrumentValueMatchesType(value, valueType) {
  if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (valueType === 'boolean') return typeof value === 'boolean';
  if (valueType === 'string') return typeof value === 'string';
  return isRecord(value) && value.kind === valueType;
}

function validateRuntimeFormulaAst(value, targetPath, depth = 0, state = { nodes: 0, operations: 0 }) {
  if (depth > 16) fail('FORMULA_DEPTH', 'Runtime formula AST exceeds the depth bound.', targetPath);
  const node = assertRecord(value, targetPath);
  state.nodes += 1;
  if (state.nodes > 512) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the node bound.', targetPath);
  assertString(node.type, `${targetPath}.type`, 1, 16);
  if (node.type === 'literal') {
    assertOnlyKeys(node, ['type', 'value'], targetPath);
    validateInstrumentScalar(node.value, `${targetPath}.value`);
    return;
  }
  if (node.type === 'ref') {
    assertOnlyKeys(node, ['type', 'path'], targetPath);
    assertInstrumentName(node.path, `${targetPath}.path`);
    return;
  }
  if (node.type === 'binary') {
    assertOnlyKeys(node, ['type', 'op', 'left', 'right'], targetPath);
    if (!FORMULA_BINARY_OPERATORS.has(node.op)) fail('INVALID_FORMULA', 'Runtime binary operator is not allowlisted.', `${targetPath}.op`);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    validateRuntimeFormulaAst(node.left, `${targetPath}.left`, depth + 1, state);
    validateRuntimeFormulaAst(node.right, `${targetPath}.right`, depth + 1, state);
    return;
  }
  if (node.type === 'unary') {
    assertOnlyKeys(node, ['type', 'op', 'value', 'digits'], targetPath);
    if (!FORMULA_UNARY_OPERATORS.has(node.op)) fail('INVALID_FORMULA', 'Runtime unary operator is not allowlisted.', `${targetPath}.op`);
    if (node.digits !== undefined) assertInteger(node.digits, `${targetPath}.digits`, 0, 6);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    validateRuntimeFormulaAst(node.value, `${targetPath}.value`, depth + 1, state);
    return;
  }
  if (node.type === 'variadic') {
    assertOnlyKeys(node, ['type', 'op', 'args'], targetPath);
    if (!FORMULA_VARIADIC_OPERATORS.has(node.op)) fail('INVALID_FORMULA', 'Runtime variadic operator is not allowlisted.', `${targetPath}.op`);
    const args = assertArray(node.args, `${targetPath}.args`, 1, 32);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    args.forEach((child, index) => validateRuntimeFormulaAst(child, `${targetPath}.args[${index}]`, depth + 1, state));
    return;
  }
  if (node.type === 'conditional') {
    assertOnlyKeys(node, ['type', 'condition', 'then', 'else'], targetPath);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    validateRuntimeFormulaAst(node.condition, `${targetPath}.condition`, depth + 1, state);
    validateRuntimeFormulaAst(node.then, `${targetPath}.then`, depth + 1, state);
    validateRuntimeFormulaAst(node.else, `${targetPath}.else`, depth + 1, state);
    return;
  }
  if (node.type === 'chart') {
    assertOnlyKeys(node, ['type', 'points'], targetPath);
    const points = assertArray(node.points, `${targetPath}.points`, 1, 32);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    points.forEach((point, index) => {
      const pointPath = `${targetPath}.points[${index}]`;
      assertOnlyKeys(point, ['label', 'value'], pointPath);
      assertString(point.label, `${pointPath}.label`, 1, 180);
      validateRuntimeFormulaAst(point.value, `${pointPath}.value`, depth + 1, state);
    });
    return;
  }
  if (node.type === 'table') {
    assertOnlyKeys(node, ['type', 'columns', 'rows'], targetPath);
    const columns = assertArray(node.columns, `${targetPath}.columns`, 1, 32);
    columns.forEach((column, index) => assertString(column, `${targetPath}.columns[${index}]`, 1, 180));
    const rows = assertArray(node.rows, `${targetPath}.rows`, 0, 32);
    state.operations += 1;
    if (state.operations > 256) fail('FORMULA_LIMIT', 'Runtime formula AST exceeds the operation bound.', targetPath);
    rows.forEach((row, rowIndex) => {
      const rowPath = `${targetPath}.rows[${rowIndex}]`;
      const entries = assertArray(row, rowPath, columns.length, columns.length);
      entries.forEach((child, columnIndex) => validateRuntimeFormulaAst(child, `${rowPath}[${columnIndex}]`, depth + 1, state));
    });
    return;
  }
  fail('INVALID_FORMULA', 'Runtime formula node type is not allowlisted.', `${targetPath}.type`);
}

function validateInstrumentPortSet(value, targetPath) {
  const ports = assertRecord(value, targetPath);
  assertOnlyKeys(ports, ['inputs', 'outputs'], targetPath);
  const result = {};
  for (const direction of ['inputs', 'outputs']) {
    const entries = assertArray(ports[direction], `${targetPath}.${direction}`, 0, 32);
    const names = new Set();
    result[direction] = new Map();
    entries.forEach((entry, index) => {
      const entryPath = `${targetPath}.${direction}[${index}]`;
      assertOnlyKeys(entry, ['name', 'direction', 'value_type', 'required', 'default_value', 'formula'], entryPath);
      assertInstrumentName(entry.name, `${entryPath}.name`, 80);
      if (names.has(entry.name)) fail('INVALID_PORT', 'Runtime port names must be unique and bounded.', `${entryPath}.name`);
      if (entry.direction !== direction.slice(0, -1)) fail('INVALID_PORT', 'Runtime port direction does not match its port set.', `${entryPath}.direction`);
      if (!INSTRUMENT_VALUE_TYPES.has(entry.value_type)) fail('INVALID_PORT', 'Runtime port value_type is unsupported.', `${entryPath}.value_type`);
      if (entry.required !== undefined) assertBoolean(entry.required, `${entryPath}.required`);
      if (entry.default_value !== undefined) {
        validateInstrumentValue(entry.default_value, `${entryPath}.default_value`);
        if (!instrumentValueMatchesType(entry.default_value, entry.value_type)) fail('INVALID_PORT', 'Runtime default value does not match its value_type.', `${entryPath}.default_value`);
      }
      if (entry.formula !== undefined) validateRuntimeFormulaAst(entry.formula, `${entryPath}.formula`);
      names.add(entry.name);
      result[direction].set(entry.name, entry);
    });
  }
  return result;
}

function validateInstrumentValueMap(value, targetPath, ports, direction) {
  const values = assertRecord(value, targetPath);
  for (const [name, item] of Object.entries(values)) {
    if (!INSTRUMENT_ID_PATTERN.test(name) || RESERVED_INSTRUMENT_NAMES.has(name)) fail('INVALID_INSTRUMENT_VALUE', 'Runtime value names must be stable non-reserved names.', `${targetPath}.${name}`);
    const port = ports[direction].get(name);
    if (!port) fail('INVALID_INSTRUMENT_VALUE', 'Runtime value must reference a declared port.', `${targetPath}.${name}`);
    validateInstrumentValue(item, `${targetPath}.${name}`);
    if (!instrumentValueMatchesType(item, port.value_type)) fail('INVALID_INSTRUMENT_VALUE', 'Runtime value does not match its declared port type.', `${targetPath}.${name}`);
  }
}

function validateInstrumentProjection(value, targetPath, manifest, limits) {
  const projection = assertRecord(value, targetPath);
  assertOnlyKeys(projection, ['schema_version', 'source', 'instances', 'bindings', 'expected'], targetPath);
  assertInteger(projection.schema_version, `${targetPath}.schema_version`, 1, 1);
  assertString(projection.source, `${targetPath}.source`, 1, 120);
  if (projection.source !== manifest.id) fail('INVALID_INSTRUMENT_PROJECTION', 'Runtime fixture source must pin the package identity.', `${targetPath}.source`);
  const instances = assertArray(projection.instances, `${targetPath}.instances`, 1, limits.max_instances);
  const instanceIds = new Set();
  const instanceMap = new Map();
  instances.forEach((instance, index) => {
    const instancePath = `${targetPath}.instances[${index}]`;
    assertOnlyKeys(instance, ['id', 'shape_id', 'type', 'version', 'ports', 'input_values', 'output_values', 'formulas'], instancePath);
    assertInstrumentName(instance.id, `${instancePath}.id`);
    if (instanceIds.has(instance.id)) fail('INVALID_INSTRUMENT_PROJECTION', 'Runtime instance IDs must be unique stable names.', `${instancePath}.id`);
    if (instance.shape_id !== undefined) {
      assertInstrumentName(instance.shape_id, `${instancePath}.shape_id`);
    }
    assertInstrumentName(instance.type, `${instancePath}.type`, 80);
    if (!/^[a-z][a-z0-9-]*$/.test(instance.type)) fail('INVALID_INSTRUMENT_PROJECTION', 'Runtime instance type is not bounded.', `${instancePath}.type`);
    assertInteger(instance.version, `${instancePath}.version`, 1, 1);
    const ports = validateInstrumentPortSet(instance.ports, `${instancePath}.ports`);
    if (instance.input_values !== undefined) validateInstrumentValueMap(instance.input_values, `${instancePath}.input_values`, ports, 'inputs');
    if (instance.output_values !== undefined) validateInstrumentValueMap(instance.output_values, `${instancePath}.output_values`, ports, 'outputs');
    if (instance.formulas !== undefined) {
      const formulas = assertRecord(instance.formulas, `${instancePath}.formulas`);
      for (const [name, formula] of Object.entries(formulas)) {
        if (!ports.outputs.has(name)) fail('INVALID_FORMULA', 'Runtime formula must reference a declared output port.', `${instancePath}.formulas.${name}`);
        validateRuntimeFormulaAst(formula, `${instancePath}.formulas.${name}`);
      }
    }
    instanceIds.add(instance.id);
    instanceMap.set(instance.id, { ...instance, ports });
  });

  const bindings = assertArray(projection.bindings, `${targetPath}.bindings`, 1, limits.max_bindings);
  const bindingIds = new Set();
  const bindingTargets = new Set();
  const adjacency = new Map();
  bindings.forEach((binding, index) => {
    const bindingPath = `${targetPath}.bindings[${index}]`;
    assertOnlyKeys(binding, ['id', 'source', 'target'], bindingPath);
    if (binding.id !== undefined) {
      assertInstrumentName(binding.id, `${bindingPath}.id`);
      if (bindingIds.has(binding.id)) fail('INVALID_BINDING', 'Runtime binding IDs must be unique stable names.', `${bindingPath}.id`);
      bindingIds.add(binding.id);
    }
    for (const endpointName of ['source', 'target']) {
      const endpointPath = `${bindingPath}.${endpointName}`;
      const endpoint = assertRecord(binding[endpointName], endpointPath);
      assertOnlyKeys(endpoint, ['instance_id', 'port'], endpointPath);
      assertInstrumentName(endpoint.instance_id, `${endpointPath}.instance_id`);
      assertInstrumentName(endpoint.port, `${endpointPath}.port`, 80);
      const instance = instanceMap.get(endpoint.instance_id);
      if (!instance) fail('INVALID_BINDING', 'Runtime binding endpoint references an unknown instance.', `${endpointPath}.instance_id`);
      const expectedDirection = endpointName === 'source' ? 'outputs' : 'inputs';
      if (!instance.ports[expectedDirection].has(endpoint.port)) fail('INVALID_BINDING', 'Runtime binding endpoint references an undeclared port.', endpointPath);
    }
    const source = instanceMap.get(binding.source.instance_id);
    const target = instanceMap.get(binding.target.instance_id);
    const sourcePort = source.ports.outputs.get(binding.source.port);
    const targetPort = target.ports.inputs.get(binding.target.port);
    if (sourcePort.value_type !== targetPort.value_type) fail('INVALID_BINDING', 'Runtime binding endpoints must have matching value types.', bindingPath);
    const targetKey = `${binding.target.instance_id}.${binding.target.port}`;
    if (bindingTargets.has(targetKey)) fail('INVALID_BINDING', 'Runtime binding targets must be unique.', `${bindingPath}.target`);
    bindingTargets.add(targetKey);
    const children = adjacency.get(binding.source.instance_id) ?? [];
    children.push(binding.target.instance_id);
    adjacency.set(binding.source.instance_id, children);
  });
  const visiting = new Set();
  const visited = new Set();
  const visit = (instanceId) => {
    if (visiting.has(instanceId)) fail('INVALID_BINDING', 'Runtime binding graph must be acyclic.', `${targetPath}.bindings`);
    if (visited.has(instanceId)) return;
    visiting.add(instanceId);
    for (const child of adjacency.get(instanceId) ?? []) visit(child);
    visiting.delete(instanceId);
    visited.add(instanceId);
  };
  for (const instanceId of instanceIds) visit(instanceId);

  const expected = assertRecord(projection.expected, `${targetPath}.expected`);
  assertOnlyKeys(expected, ['status', 'alpha_score', 'beta_score', 'recommendation', 'chart'], `${targetPath}.expected`);
  if (expected.status !== 'ok') fail('INVALID_INSTRUMENT_PROJECTION', 'Compare fixture projection must describe a successful bounded result.', `${targetPath}.expected.status`);
  assertNumber(expected.alpha_score, `${targetPath}.expected.alpha_score`, 0, 100);
  assertNumber(expected.beta_score, `${targetPath}.expected.beta_score`, 0, 100);
  assertString(expected.recommendation, `${targetPath}.expected.recommendation`, 1, 120);
  const chart = assertArray(expected.chart, `${targetPath}.expected.chart`, 2, 2);
  chart.forEach((point, index) => {
    const pointPath = `${targetPath}.expected.chart[${index}]`;
    assertOnlyKeys(point, ['label', 'value'], pointPath);
    assertString(point.label, `${pointPath}.label`, 1, 80);
    assertNumber(point.value, `${pointPath}.value`, 0, 100);
  });
}

function validateRecipe(value, targetPath, manifest, limits) {
  const recipe = assertRecord(value, targetPath);
  if (recipe.version === 2 || recipe.format === COMPOSITION_FORMAT) return validateCompositionRecipe(recipe, targetPath, manifest, limits);
  assertOnlyKeys(recipe, RECIPE_FIELDS, targetPath);
  assertString(recipe.id, `${targetPath}.id`, 1, 120);
  assertInteger(recipe.version, `${targetPath}.version`, 1, 1);
  assertString(recipe.title, `${targetPath}.title`, 1, 180);
  assertString(recipe.purpose, `${targetPath}.purpose`, 1, 500);
  if (recipe.status !== 'immutable') fail('INVALID_RECIPE', 'Recipes must be immutable.', `${targetPath}.status`);
  const bounds = assertRecord(recipe.bounds, `${targetPath}.bounds`);
  assertOnlyKeys(bounds, ['x', 'y', 'w', 'h'], `${targetPath}.bounds`);
  if (bounds.x !== 0 || bounds.y !== 0) fail('INVALID_RECIPE', 'Recipe bounds must start at 0,0.', `${targetPath}.bounds`);
  assertNumber(bounds.w, `${targetPath}.bounds.w`, 1, 2_000);
  assertNumber(bounds.h, `${targetPath}.bounds.h`, 1, 2_000);
  assertString(recipe.semantic, `${targetPath}.semantic`, 1, 180);
  const provenance = assertRecord(recipe.provenance, `${targetPath}.provenance`);
  assertOnlyKeys(provenance, ['source', 'recipe_id', 'recipe_version'], `${targetPath}.provenance`);
  if (provenance.source !== 'fogwood' || provenance.recipe_id !== recipe.id || provenance.recipe_version !== 1) fail('INVALID_PROVENANCE', 'Recipe provenance must pin its exact Fogwood identity.', `${targetPath}.provenance`);
  const operations = assertArray(recipe.operations, `${targetPath}.operations`, 1, limits.max_operations);
  let expandedCount = 0;
  operations.forEach((operation, index) => {
    const operationPath = `${targetPath}.operations[${index}]`;
    assertRecord(operation, operationPath);
    if (operation.type === 'add_blocks') {
      assertOnlyKeys(operation, ['type', 'coordinate_space', 'blocks'], operationPath);
      if (operation.coordinate_space !== 'page') fail('INVALID_RECIPE', 'Recipe operations must use page coordinates.', `${operationPath}.coordinate_space`);
      const blocks = assertArray(operation.blocks, `${operationPath}.blocks`, 1, 48);
      blocks.forEach((block, blockIndex) => validateBlock(block, `${operationPath}.blocks[${blockIndex}]`));
      expandedCount += blocks.length;
    } else if (operation.type === 'add_shapes') {
      assertOnlyKeys(operation, ['type', 'coordinate_space', 'shapes'], operationPath);
      if (operation.coordinate_space !== 'page') fail('INVALID_RECIPE', 'Recipe operations must use page coordinates.', `${operationPath}.coordinate_space`);
      const shapes = assertArray(operation.shapes, `${operationPath}.shapes`, 1, 64);
      shapes.forEach((shape, shapeIndex) => validateShape(shape, `${operationPath}.shapes[${shapeIndex}]`));
      expandedCount += shapes.length;
    } else {
      fail('INVALID_RECIPE', 'Recipe operation is not allowlisted.', `${operationPath}.type`);
    }
  });
  if (recipe.expected_count !== expandedCount) fail('INVALID_RECIPE', 'expected_count must match operation item count.', `${targetPath}.expected_count`);
  assertInteger(recipe.expected_count, `${targetPath}.expected_count`, 1, limits.max_items);
  if (recipe.capability_refs !== undefined) validateCapabilityArray(recipe.capability_refs, `${targetPath}.capability_refs`);
  if (recipe.instrument !== undefined) {
    const instrument = assertRecord(recipe.instrument, `${targetPath}.instrument`);
    assertOnlyKeys(instrument, ['kind', 'version'], `${targetPath}.instrument`);
    assertString(instrument.kind, `${targetPath}.instrument.kind`, 1, 80);
    if (!/^[a-z][a-z0-9-]*$/.test(instrument.kind)) fail('INVALID_INSTRUMENT', 'Instrument kind is not bounded.', `${targetPath}.instrument.kind`);
    assertInteger(instrument.version, `${targetPath}.instrument.version`, 1, 1);
  }
  if (recipe.instrument_projection !== undefined) {
    if (recipe.instrument === undefined) fail('INVALID_INSTRUMENT_PROJECTION', 'Instrument projection requires an instrument identity.', `${targetPath}.instrument_projection`);
    validateInstrumentProjection(recipe.instrument_projection, `${targetPath}.instrument_projection`, manifest, limits);
  }
  return recipe;
}

function validateAuxiliaryJson(value, targetPath, kind) {
  if (kind === 'example') {
    assertOnlyKeys(value, ['id', 'title', 'input', 'expected', 'notes'], targetPath);
    assertString(value.id, `${targetPath}.id`, 1, 120);
    assertString(value.title, `${targetPath}.title`, 1, 180);
    assertRecord(value.input, `${targetPath}.input`);
    assertRecord(value.expected, `${targetPath}.expected`);
    if (value.notes !== undefined) assertString(value.notes, `${targetPath}.notes`, 1, 500);
  } else if (kind === 'fixture') {
    assertOnlyKeys(value, ['id', 'kind', 'description', 'input', 'expected', 'warnings'], targetPath);
    assertString(value.id, `${targetPath}.id`, 1, 120);
    if (!['valid', 'malformed', 'oversized', 'loss'].includes(value.kind)) fail('INVALID_FIXTURE', 'Fixture kind is unsupported.', `${targetPath}.kind`);
    assertString(value.description, `${targetPath}.description`, 1, 500);
    assertRecord(value.input, `${targetPath}.input`);
    assertRecord(value.expected, `${targetPath}.expected`);
    if (value.warnings !== undefined) {
      const warnings = assertArray(value.warnings, `${targetPath}.warnings`, 0, 16);
      warnings.forEach((warning, index) => assertString(warning, `${targetPath}.warnings[${index}]`, 1, 240));
    }
  }
}

function validateProvenanceJson(value, targetPath, kind) {
  if (kind === 'sources') {
    assertOnlyKeys(value, ['sources', 'method'], targetPath);
    const sources = assertArray(value.sources, `${targetPath}.sources`, 1, 16);
    sources.forEach((source, index) => {
      const sourcePath = `${targetPath}.sources[${index}]`;
      assertOnlyKeys(source, ['id', 'kind', 'title', 'locator', 'retrieved'], sourcePath);
      assertString(source.id, `${sourcePath}.id`, 1, 120);
      assertString(source.kind, `${sourcePath}.kind`, 1, 120);
      assertString(source.title, `${sourcePath}.title`, 1, 180);
      assertString(source.locator, `${sourcePath}.locator`, 1, 500);
      assertDate(source.retrieved, `${sourcePath}.retrieved`);
    });
    assertString(value.method, `${targetPath}.method`, 1, 500);
  } else if (kind === 'license') {
    assertOnlyKeys(value, ['spdx', 'name', 'notice'], targetPath);
    assertString(value.spdx, `${targetPath}.spdx`, 1, 80);
    assertString(value.name, `${targetPath}.name`, 1, 180);
    assertString(value.notice, `${targetPath}.notice`, 1, 500);
  } else if (kind === 'qualification') {
    assertOnlyKeys(value, ['status', 'evidence_id', 'tested_boundary', 'reviewer', 'date'], targetPath);
    assertString(value.status, `${targetPath}.status`, 1, 80);
    assertString(value.evidence_id, `${targetPath}.evidence_id`, 1, 120);
    assertString(value.tested_boundary, `${targetPath}.tested_boundary`, 1, 500);
    assertString(value.reviewer, `${targetPath}.reviewer`, 1, 180);
    assertDate(value.date, `${targetPath}.date`);
    if (value.status === 'blocked' || value.status === 'revoked') fail('INVALID_QUALIFICATION', 'Qualification material cannot mark a package blocked or revoked.', `${targetPath}.status`);
  }
}

export function packageHash(fileMap, manifest) {
  const files = Object.keys(fileMap).sort().map((relativePath) => {
    let content = fileMap[relativePath];
    if (relativePath === 'manifest.json') {
      const manifestForHash = { ...manifest };
      delete manifestForHash.content_hash;
      content = manifestForHash;
    }
    return {
      path: relativePath,
      content: typeof content === 'string' ? content : canonicalize(content),
    };
  });
  return `sha256:${sha256(canonicalStringify({ schema_version: BAZAAR_SCHEMA_VERSION, files }))}`;
}

function validatePackageLayout(packageRoot, manifest, actualFiles) {
  const expected = new Set(['manifest.json', 'README.md', 'SKILL.md']);
  const addExpected = (entries) => entries.forEach((entry) => expected.add(entry));
  addExpected(manifest.prompts);
  addExpected(manifest.recipes);
  addExpected(manifest.examples);
  addExpected(manifest.fixtures);
  addExpected(manifest.sources);
  expected.add(manifest.license);
  addExpected(manifest.notices);
  addExpected(manifest.qualification.evidence);
  const actual = new Set(actualFiles);
  for (const relativePath of expected) if (!actual.has(relativePath)) fail('MISSING_FILE', 'Manifest-referenced file is missing.', relativePath);
  for (const relativePath of actual) if (!expected.has(relativePath)) fail('UNKNOWN_FILE', 'File is not allowlisted by manifest.', relativePath);
  for (const relativePath of actual) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!['.json', '.md', '.txt'].includes(extension)) fail('FORBIDDEN_FILE', 'Only JSON, Markdown, and text package data are allowed.', relativePath);
  }
  if (!fs.existsSync(path.join(packageRoot, 'README.md'))) fail('MISSING_FILE', 'README.md is required.', 'README.md');
}

export function validatePackageDirectory(packageRoot) {
  const rootStat = fs.lstatSync(packageRoot);
  if (rootStat.isSymbolicLink()) fail('SYMLINK', 'Package root cannot be a symlink.', packageRoot);
  if (!rootStat.isDirectory()) fail('INVALID_PACKAGE', 'Package path must be a directory.', packageRoot);
  const actualFiles = walkPackageFiles(packageRoot);
  const directEntries = fs.readdirSync(packageRoot);
  const allowedDirect = new Set(['manifest.json', 'README.md', 'SKILL.md', 'prompts', 'recipes', 'examples', 'fixtures', 'provenance']);
  directEntries.forEach((entry) => {
    if (!allowedDirect.has(entry)) fail('UNKNOWN_FILE', 'Package root entry is not allowlisted.', entry);
  });
  for (const directory of ['prompts', 'recipes', 'examples', 'fixtures', 'provenance']) {
    const directoryPath = path.join(packageRoot, directory);
    const stat = fs.lstatSync(directoryPath);
    if (stat.isSymbolicLink()) fail('SYMLINK', 'Package directories cannot be symlinks.', directory);
    if (!stat.isDirectory()) fail('INVALID_PACKAGE', 'Required package section must be a directory.', directory);
  }

  const manifestText = readFileText(path.join(packageRoot, 'manifest.json'), 'manifest.json');
  const manifest = parseJsonStrict(manifestText, 'manifest.json');
  assertOnlyKeys(manifest, ROOT_FIELDS, 'manifest');
  assertString(manifest.id, 'manifest.id', 3, 120);
  if (!PACKAGE_ID_PATTERN.test(manifest.id)) fail('INVALID_ID', 'Package ID is not stable.', 'manifest.id');
  assertInteger(manifest.version, 'manifest.version', 1, 999);
  assertString(manifest.kind, 'manifest.kind', 1, 30);
  if (!['instrument', 'recipe', 'adapter', 'collection'].includes(manifest.kind)) fail('INVALID_KIND', 'Package kind is unsupported.', 'manifest.kind');
  assertString(manifest.content_hash, 'manifest.content_hash', 71, 71);
  if (!SHA256_PATTERN.test(manifest.content_hash)) fail('INVALID_HASH', 'content_hash must be a SHA-256 package hash.', 'manifest.content_hash');
  assertString(manifest.title, 'manifest.title', 1, 180);
  assertString(manifest.summary, 'manifest.summary', 1, 500);
  assertString(manifest.use_when, 'manifest.use_when', 1, 500);
  assertString(manifest.not_for, 'manifest.not_for', 1, 500);
  const keywords = assertArray(manifest.keywords, 'manifest.keywords', 1, 24);
  const keywordSet = new Set();
  keywords.forEach((keyword, index) => {
    assertString(keyword, `manifest.keywords[${index}]`, 1, 64);
    const normalized = keyword.toLowerCase();
    if (keywordSet.has(normalized)) fail('DUPLICATE_FIELD', 'Keywords must be unique.', `manifest.keywords[${index}]`);
    keywordSet.add(normalized);
  });
  validateSchema(manifest.input_schema, 'manifest.input_schema');
  validateSchema(manifest.output_schema, 'manifest.output_schema');
  if (manifest.renderer_id !== undefined) validateCapabilityId(manifest.renderer_id, 'manifest.renderer_id');
  if (manifest.behavior_ids !== undefined) validateCapabilityArray(manifest.behavior_ids, 'manifest.behavior_ids');
  if (manifest.adapter_id !== undefined) validateCapabilityId(manifest.adapter_id, 'manifest.adapter_id');
  validatePorts(manifest.ports, 'manifest.ports');
  const permissions = assertArray(manifest.permissions, 'manifest.permissions', 1, 8);
  const allowedPermissions = new Set(['read-local', 'stage-proposal', 'page-apply', 'export-local']);
  permissions.forEach((permission, index) => {
    assertString(permission, `manifest.permissions[${index}]`, 1, 40);
    if (!allowedPermissions.has(permission)) fail('INVALID_PERMISSION', 'Permission is not allowlisted.', `manifest.permissions[${index}]`);
  });
  if (manifest.locality !== 'local') fail('INVALID_LOCALITY', 'v0.1 packages must be local.', 'manifest.locality');
  validateNetwork(manifest.network, 'manifest.network');
  validateLimits(manifest.limits, 'manifest.limits');
  if (manifest.skill !== 'SKILL.md') fail('INVALID_PATH', 'skill must point to SKILL.md.', 'manifest.skill');
  assertPathArray(manifest.prompts, 'manifest.prompts', 'prompts', 1, 8);
  assertPathArray(manifest.recipes, 'manifest.recipes', 'recipes', 1, 8);
  assertPathArray(manifest.examples, 'manifest.examples', 'examples', 1, 8);
  assertPathArray(manifest.fixtures, 'manifest.fixtures', 'fixtures', 3, 12);
  assertPathArray(manifest.sources, 'manifest.sources', 'provenance', 1, 8);
  assertSafeRelativePath(manifest.license, 'manifest.license', 'provenance');
  assertPathArray(manifest.notices, 'manifest.notices', 'provenance', 1, 8);
  validateQualification(manifest.qualification, 'manifest.qualification');
  validateCompatibility(manifest.compatibility, 'manifest.compatibility');
  if (manifest.replacement !== undefined && manifest.replacement !== null) {
    assertOnlyKeys(manifest.replacement, ['id', 'version', 'reason', 'migration_notes'], 'manifest.replacement');
    assertString(manifest.replacement.id, 'manifest.replacement.id', 3, 120);
    assertInteger(manifest.replacement.version, 'manifest.replacement.version', 1, 999);
    assertString(manifest.replacement.reason, 'manifest.replacement.reason', 1, 300);
    assertString(manifest.replacement.migration_notes, 'manifest.replacement.migration_notes', 1, 500);
  }
  validatePackageLayout(packageRoot, manifest, actualFiles);

  const fileMap = {};
  let packageBytes = 0;
  for (const relativePath of actualFiles) {
    const extension = path.extname(relativePath).toLowerCase();
    const text = readFileText(path.join(packageRoot, relativePath), relativePath);
    packageBytes += Buffer.byteLength(relativePath, 'utf8') + Buffer.byteLength(text, 'utf8');
    if (packageBytes > MAX_PACKAGE_BYTES) {
      fail('OVERSIZE_PACKAGE', `Package exceeds ${MAX_PACKAGE_BYTES} bytes.`, manifest.id);
    }
    if (extension === '.json') fileMap[relativePath] = parseJsonStrict(text, relativePath);
    else {
      if (!text.trim()) fail('EMPTY_FILE', 'Package text files must not be empty.', relativePath);
      if (text.length > MAX_FILE_BYTES) fail('OVERSIZE_FILE', 'Package text exceeds the bound.', relativePath);
      scanDataForDanger(text, relativePath);
      fileMap[relativePath] = text;
    }
  }
  for (const recipePath of manifest.recipes) validateRecipe(fileMap[recipePath], recipePath, manifest, manifest.limits);
  for (const examplePath of manifest.examples) validateAuxiliaryJson(fileMap[examplePath], examplePath, 'example');
  const fixtureKinds = new Set();
  for (const fixturePath of manifest.fixtures) {
    const fixture = fileMap[fixturePath];
    validateAuxiliaryJson(fixture, fixturePath, 'fixture');
    fixtureKinds.add(fixture.kind);
  }
  for (const requiredKind of ['valid', 'malformed', 'oversized', 'loss']) {
    if (!fixtureKinds.has(requiredKind)) fail('MISSING_FIXTURE', `Package needs a ${requiredKind} fixture.`, manifest.id);
  }
  for (const sourcePath of manifest.sources) validateProvenanceJson(fileMap[sourcePath], sourcePath, 'sources');
  validateProvenanceJson(fileMap[manifest.license], manifest.license, 'license');
  for (const noticePath of manifest.notices) {
    if (typeof fileMap[noticePath] !== 'string') fail('INVALID_NOTICE', 'Notice material must be text.', noticePath);
  }
  for (const qualificationPath of manifest.qualification.evidence) validateProvenanceJson(fileMap[qualificationPath], qualificationPath, 'qualification');
  const expectedHash = packageHash(fileMap, manifest);
  if (manifest.content_hash !== expectedHash) fail('CONTENT_HASH_MISMATCH', `Expected ${expectedHash} but manifest declares ${manifest.content_hash}.`, 'manifest.content_hash');

  const recipes = manifest.recipes.map((recipePath) => ({ path: recipePath, content: fileMap[recipePath] }));
  const recipeIds = recipes.map((entry) => entry.content.id);
  return {
    id: manifest.id,
    version: manifest.version,
    content_hash: manifest.content_hash,
    manifest,
    recipe_ids: recipeIds,
    sections: {
      readme: fileMap['README.md'],
      skill: fileMap['SKILL.md'],
      prompts: manifest.prompts.map((relativePath) => ({ path: relativePath, content: fileMap[relativePath] })),
      recipes,
      examples: manifest.examples.map((relativePath) => ({ path: relativePath, content: fileMap[relativePath] })),
      fixtures: manifest.fixtures.map((relativePath) => ({ path: relativePath, content: fileMap[relativePath] })),
      provenance: [...manifest.sources, manifest.license, ...manifest.notices, ...manifest.qualification.evidence]
        .map((relativePath) => ({ path: relativePath, content: fileMap[relativePath] })),
    },
  };
}

function packageDirectoryEntries(packagesDirectory) {
  const stat = fs.lstatSync(packagesDirectory);
  if (stat.isSymbolicLink()) fail('SYMLINK', 'The package root cannot be a symlink.', packagesDirectory);
  if (!stat.isDirectory()) fail('INVALID_PACKAGE_ROOT', 'Package root must be a directory.', packagesDirectory);
  const entries = [];
  for (const idEntry of fs.readdirSync(packagesDirectory, { withFileTypes: true })) {
    if (idEntry.name.startsWith('.')) fail('UNKNOWN_FILE', 'Hidden package directories are not allowed.', idEntry.name);
    const idPath = path.join(packagesDirectory, idEntry.name);
    const idStat = fs.lstatSync(idPath);
    if (idStat.isSymbolicLink()) fail('SYMLINK', 'Package directories cannot be symlinks.', idEntry.name);
    if (!idStat.isDirectory()) fail('UNKNOWN_FILE', 'Package root may contain only package directories.', idEntry.name);
    if (!PACKAGE_ID_PATTERN.test(idEntry.name)) fail('INVALID_ID', 'Package directory name is not stable.', idEntry.name);
    const versions = fs.readdirSync(idPath, { withFileTypes: true });
    if (versions.length === 0) fail('MISSING_PACKAGE', 'Package directory has no version directory.', idEntry.name);
    for (const versionEntry of versions) {
      if (versionEntry.name.startsWith('.')) fail('UNKNOWN_FILE', 'Hidden version directories are not allowed.', `${idEntry.name}/${versionEntry.name}`);
      if (!/^v[1-9][0-9]*$/.test(versionEntry.name)) fail('INVALID_VERSION', 'Version directory must use vN.', `${idEntry.name}/${versionEntry.name}`);
      const versionPath = path.join(idPath, versionEntry.name);
      const versionStat = fs.lstatSync(versionPath);
      if (versionStat.isSymbolicLink()) fail('SYMLINK', 'Version directories cannot be symlinks.', `${idEntry.name}/${versionEntry.name}`);
      if (!versionStat.isDirectory()) fail('INVALID_PACKAGE', 'Version entry must be a directory.', `${idEntry.name}/${versionEntry.name}`);
      entries.push({ id: idEntry.name, version: Number(versionEntry.name.slice(1)), path: versionPath });
    }
  }
  if (entries.length === 0) fail('MISSING_PACKAGE', 'Vault contains no packages.', packagesDirectory);
  if (entries.length > MAX_PACKAGES) fail('OVERSIZE_CATALOG', `Vault contains more than ${MAX_PACKAGES} packages.`, packagesDirectory);
  return entries.sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
}

function summaryForPackage(record) {
  const manifest = record.manifest;
  return {
    id: record.id,
    version: record.version,
    content_hash: record.content_hash,
    kind: manifest.kind,
    title: manifest.title,
    summary: manifest.summary,
    use_when: manifest.use_when,
    not_for: manifest.not_for,
    keywords: manifest.keywords,
    locality: manifest.locality,
    network: manifest.network,
    qualification: manifest.qualification,
    compatibility: manifest.compatibility,
    recipe_ids: record.recipe_ids,
  };
}

export function compileBazaar({ packagesDirectory, indexPath, modulePath, check = false } = {}) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, '..');
  const sourceDirectory = path.resolve(packagesDirectory ?? path.join(projectRoot, 'bazaar', 'packages'));
  const resolvedIndex = path.resolve(indexPath ?? path.join(projectRoot, 'bazaar', 'catalog', 'index.json'));
  const resolvedModule = path.resolve(modulePath ?? path.join(projectRoot, 'app', 'fogwood-bazaar-catalog.generated.ts'));
  const packageRecords = packageDirectoryEntries(sourceDirectory).map((entry) => {
    const record = validatePackageDirectory(entry.path);
    if (record.id !== entry.id || record.version !== entry.version) fail('IDENTITY_MISMATCH', 'Manifest identity must match its directory.', `${entry.id}/v${entry.version}`);
    return record;
  });
  const indexPackages = packageRecords.map(summaryForPackage);
  const catalogRevision = `sha256:${sha256(canonicalStringify({ schema_version: BAZAAR_SCHEMA_VERSION, packages: indexPackages }))}`;
  const index = {
    schema_version: BAZAAR_SCHEMA_VERSION,
    catalog_source: BAZAAR_CATALOG_SOURCE,
    catalog_revision: catalogRevision,
    packages: indexPackages,
  };
  const catalog = {
    schema_version: BAZAAR_SCHEMA_VERSION,
    catalog_source: BAZAAR_CATALOG_SOURCE,
    catalog_revision: catalogRevision,
    packages: packageRecords,
  };
  const indexBytes = `${canonicalStringify(index)}\n`;
  const generated = `/* Generated by scripts/compile-bazaar.mjs. Do not edit by hand. */\nexport const FOGWOOD_BAZAAR_CATALOG = ${canonicalStringify(catalog)} as const;\nexport default FOGWOOD_BAZAAR_CATALOG;\n`;
  if (check) {
    if (!fs.existsSync(resolvedIndex) || fs.readFileSync(resolvedIndex, 'utf8') !== indexBytes) {
      fail('STALE_GENERATED_CATALOG', 'Generated catalog index does not match the source-controlled Vault.', resolvedIndex);
    }
    if (!fs.existsSync(resolvedModule) || fs.readFileSync(resolvedModule, 'utf8') !== generated) {
      fail('STALE_GENERATED_CATALOG', 'Generated browser catalog module does not match the source-controlled Vault.', resolvedModule);
    }
  } else {
    fs.mkdirSync(path.dirname(resolvedIndex), { recursive: true });
    fs.mkdirSync(path.dirname(resolvedModule), { recursive: true });
    fs.writeFileSync(resolvedIndex, indexBytes, 'utf8');
    fs.writeFileSync(resolvedModule, generated, 'utf8');
  }
  return { catalog, index, packageRecords, indexPath: resolvedIndex, modulePath: resolvedModule };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
    } else if (['--packages', '--index', '--module'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail('INVALID_ARGUMENT', `${argument} needs a path.`);
      options[argument.slice(2) === 'packages' ? 'packagesDirectory' : `${argument.slice(2)}Path`] = value;
      index += 1;
    } else {
      fail('INVALID_ARGUMENT', `Unknown argument ${argument}.`);
    }
  }
  return options;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = compileBazaar(parseArgs(process.argv.slice(2)));
    process.stdout.write(`Compiled ${result.packageRecords.length} packages at ${result.index.catalog_revision}.\n`);
  } catch (error) {
    if (error instanceof BazaarValidationError) process.stderr.write(`${error.message}\n`);
    else process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}
