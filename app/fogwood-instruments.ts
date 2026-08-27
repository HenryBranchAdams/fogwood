/**
 * Pure, browser-safe instrument primitives for Fogwood v0.1.
 *
 * This is the semantic seam between canvas adapters and instrument behavior.
 * It intentionally has no DOM, tldraw, storage, network, or executable-code
 * dependency. A future adapter can parse shape data into these records, call
 * `evaluateInstrumentGraph`, and turn the returned semantic patches into
 * tldraw updates.
 */

export const INSTRUMENT_PROTOCOL = 'fogwood-instruments';
export const INSTRUMENT_PROTOCOL_VERSION = 1 as const;

export const INSTRUMENT_VALUE_TYPES = ['number', 'boolean', 'string', 'chart', 'table'] as const;
export type InstrumentValueType = (typeof INSTRUMENT_VALUE_TYPES)[number];

export const FORMULA_LIMITS = {
  max_nodes: 512,
  max_depth: 16,
  max_operations: 256,
  max_string_length: 180,
  max_collection_size: 32,
} as const;

export const DEFAULT_INSTRUMENT_LIMITS = {
  max_instances: 64,
  max_bindings: 128,
  max_ports_per_instance: 32,
  max_id_length: 120,
  max_formula_nodes: FORMULA_LIMITS.max_nodes,
  max_formula_depth: FORMULA_LIMITS.max_depth,
  max_formula_operations: FORMULA_LIMITS.max_operations,
  max_formula_string_length: FORMULA_LIMITS.max_string_length,
  max_formula_collection_size: FORMULA_LIMITS.max_collection_size,
} as const;

export type InstrumentLimits = {
  max_instances?: number;
  max_bindings?: number;
  max_ports_per_instance?: number;
  max_id_length?: number;
  max_formula_nodes?: number;
  max_formula_depth?: number;
  max_formula_operations?: number;
  max_formula_string_length?: number;
  max_formula_collection_size?: number;
};

export type InstrumentChartPoint = {
  label: string;
  value: number;
};

export type InstrumentChartData = {
  kind: 'chart';
  series: readonly InstrumentChartPoint[];
};

export type InstrumentTableData = {
  kind: 'table';
  columns: readonly string[];
  rows: readonly (readonly string[])[];
};

export type InstrumentScalar = number | boolean | string;
export type InstrumentValue = InstrumentScalar | InstrumentChartData | InstrumentTableData;

export type BinaryFormulaOperator = 'add' | 'sub' | 'mul' | 'div' | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
export type UnaryFormulaOperator = 'neg' | 'abs' | 'not' | 'round';
export type VariadicFormulaOperator = 'sum' | 'min' | 'max' | 'and' | 'or' | 'concat';

export type FormulaAst =
  | { type: 'literal'; value: InstrumentScalar }
  | { type: 'ref'; path: string }
  | { type: 'binary'; op: BinaryFormulaOperator; left: FormulaAst; right: FormulaAst }
  | { type: 'unary'; op: UnaryFormulaOperator; value: FormulaAst; digits?: number }
  | { type: 'variadic'; op: VariadicFormulaOperator; args: readonly FormulaAst[] }
  | { type: 'conditional'; condition: FormulaAst; then: FormulaAst; else: FormulaAst }
  | { type: 'chart'; points: readonly { label: string; value: FormulaAst }[] }
  | { type: 'table'; columns: readonly string[]; rows: readonly (readonly FormulaAst[])[] };

export type FormulaNode = FormulaAst;

export type InstrumentPort = {
  name: string;
  direction: 'input' | 'output';
  value_type: InstrumentValueType;
  required?: boolean;
  default_value?: InstrumentValue;
  formula?: FormulaAst;
};

export type InstrumentPortSet = {
  inputs: readonly InstrumentPort[];
  outputs: readonly InstrumentPort[];
};

export type InstrumentInstanceRecord = {
  /** Stable semantic identity. This is never generated from a random shape id. */
  id: string;
  /** Optional random tldraw identity, kept separate for adapter use only. */
  shape_id?: string;
  type: string;
  version: 1;
  ports: InstrumentPortSet;
  input_values?: Readonly<Record<string, unknown>>;
  output_values?: Readonly<Record<string, unknown>>;
  formulas?: Readonly<Record<string, FormulaAst>>;
};

export type InstrumentBindingEndpoint = {
  instance_id: string;
  port: string;
};

export type InstrumentBinding = {
  id?: string;
  source: InstrumentBindingEndpoint;
  target: InstrumentBindingEndpoint;
};

export type InstrumentGraph = {
  instances: readonly InstrumentInstanceRecord[];
  bindings: readonly InstrumentBinding[];
};

export type InstrumentIssue = {
  code: string;
  message: string;
  path?: string;
};

export type GraphValidationResult = {
  ok: boolean;
  errors: readonly InstrumentIssue[];
  topological_order: readonly string[];
  graph?: InstrumentGraph;
};

export type FormulaStatus = 'ok' | 'invalid' | 'stale';

export type FormulaMetrics = {
  nodes: number;
  depth: number;
  operations: number;
};

type FormulaResourceLimits = {
  max_nodes: number;
  max_depth: number;
  max_operations: number;
  max_string_length: number;
  max_collection_size: number;
};

export type FormulaResult = {
  status: FormulaStatus;
  value?: InstrumentValue;
  formatted?: string;
  errors: readonly InstrumentIssue[];
  metrics: FormulaMetrics;
};

export type EvaluatedInput = {
  status: FormulaStatus;
  value?: InstrumentValue;
  errors: readonly InstrumentIssue[];
};

export type EvaluatedInstance = {
  id: string;
  shape_id?: string;
  status: FormulaStatus;
  inputs: Readonly<Record<string, EvaluatedInput>>;
  outputs: Readonly<Record<string, FormulaResult>>;
  errors: readonly InstrumentIssue[];
};

export type InstrumentPatch = {
  instance_id: string;
  shape_id?: string;
  port: string;
  status: FormulaStatus;
  value?: InstrumentValue;
  formatted?: string;
  errors?: readonly InstrumentIssue[];
};

export type InstrumentEvaluationOptions = {
  limits?: InstrumentLimits;
  changed_instance_ids?: readonly string[];
};

export type InstrumentGraphEvaluation = {
  status: FormulaStatus;
  order: readonly string[];
  affected_instance_ids: readonly string[];
  results: Readonly<Record<string, EvaluatedInstance>>;
  patches: readonly InstrumentPatch[];
  errors: readonly InstrumentIssue[];
};

export type ParseInstrumentResult = {
  ok: boolean;
  value?: InstrumentInstanceRecord;
  errors: readonly InstrumentIssue[];
};

export type ParseInstrumentGraphResult = {
  ok: boolean;
  value?: InstrumentGraph;
  errors: readonly InstrumentIssue[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is RecordValue {
  if (!isRecord(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOwn(record: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Collect at most limit + 1 own enumerable keys without allocating an
 * unbounded key array.  Callers use the extra key to reject oversized maps
 * before copying or validating their values.
 */
function ownKeysWithinLimit(value: RecordValue, limit: number): string[] | undefined {
  const keys: string[] = [];
  for (const key in value) {
    if (!hasOwn(value, key)) continue;
    keys.push(key);
    if (keys.length > limit) return undefined;
  }
  return keys;
}

function copyRecordKeys(value: RecordValue, keys: readonly string[]): RecordValue {
  const copy: RecordValue = {};
  for (const key of keys) {
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      value: value[key],
      writable: true,
    });
  }
  return copy;
}

function issue(code: string, message: string, path?: string): InstrumentIssue {
  return path ? { code, message, path } : { code, message };
}

/** Keys that must never be used as dynamic instance or port identities. */
const RESERVED_DYNAMIC_KEYS = new Set([
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

function isReservedDynamicKey(value: string): boolean {
  return RESERVED_DYNAMIC_KEYS.has(value);
}

/** Compare UTF-16 code units without locale or runtime locale configuration. */
function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftCodeUnit = left.charCodeAt(index);
    const rightCodeUnit = right.charCodeAt(index);
    if (leftCodeUnit !== rightCodeUnit) return leftCodeUnit < rightCodeUnit ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

function boundedLimits(overrides?: InstrumentLimits): {
  max_instances: number;
  max_bindings: number;
  max_ports_per_instance: number;
  max_id_length: number;
  formula: {
    max_nodes: number;
    max_depth: number;
    max_operations: number;
    max_string_length: number;
    max_collection_size: number;
  };
} {
  const value = (key: keyof InstrumentLimits, fallback: number) => {
    const candidate = overrides?.[key];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 1) return fallback;
    return Math.min(candidate, fallback);
  };
  return {
    max_instances: value('max_instances', DEFAULT_INSTRUMENT_LIMITS.max_instances),
    max_bindings: value('max_bindings', DEFAULT_INSTRUMENT_LIMITS.max_bindings),
    max_ports_per_instance: value('max_ports_per_instance', DEFAULT_INSTRUMENT_LIMITS.max_ports_per_instance),
    max_id_length: value('max_id_length', DEFAULT_INSTRUMENT_LIMITS.max_id_length),
    formula: {
      max_nodes: value('max_formula_nodes', FORMULA_LIMITS.max_nodes),
      max_depth: value('max_formula_depth', FORMULA_LIMITS.max_depth),
      max_operations: value('max_formula_operations', FORMULA_LIMITS.max_operations),
      max_string_length: value('max_formula_string_length', FORMULA_LIMITS.max_string_length),
      max_collection_size: value('max_formula_collection_size', FORMULA_LIMITS.max_collection_size),
    },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundNumber(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return value;
  const places = Math.max(0, Math.min(6, Math.trunc(digits)));
  const normalized = Number(value.toFixed(places));
  return Object.is(normalized, -0) ? 0 : normalized;
}

function scalarType(value: unknown): InstrumentValueType | undefined {
  if (isFiniteNumber(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  return undefined;
}

type ChartRecord = { kind: 'chart'; series: readonly unknown[] };
type TableRecord = { kind: 'table'; columns: readonly unknown[]; rows: readonly unknown[] };

/** Identify structured values without walking their untrusted children. */
function isChartRecord(value: unknown): value is ChartRecord {
  return isRecord(value) && value.kind === 'chart' && Array.isArray(value.series);
}

/** Identify structured values without walking their untrusted children. */
function isTableRecord(value: unknown): value is TableRecord {
  return isRecord(value) && value.kind === 'table' && Array.isArray(value.columns) && Array.isArray(value.rows);
}

/** Check a structured value only after its top-level collection size is bounded. */
function isChartData(value: unknown): value is InstrumentChartData {
  if (!isChartRecord(value) || value.series.length > FORMULA_LIMITS.max_collection_size) return false;
  return value.series.every((point) => isRecord(point) && typeof point.label === 'string' && isFiniteNumber(point.value));
}

/** Check a structured value only after its top-level collection sizes are bounded. */
function isTableData(value: unknown): value is InstrumentTableData {
  if (!isTableRecord(value) || value.columns.length > FORMULA_LIMITS.max_collection_size || value.rows.length > FORMULA_LIMITS.max_collection_size) return false;
  return value.columns.every((column) => typeof column === 'string') && value.rows.every((row) => Array.isArray(row) && row.length <= FORMULA_LIMITS.max_collection_size && row.every((cell) => typeof cell === 'string'));
}

function valueType(value: unknown): InstrumentValueType | undefined {
  return scalarType(value) ?? (isChartRecord(value) ? 'chart' : isTableRecord(value) ? 'table' : undefined);
}

function valueResourceIssue(value: unknown, limits: FormulaResourceLimits): InstrumentIssue | undefined {
  if (typeof value === 'string' && value.length > limits.max_string_length) {
    return issue('FORMULA_STRING_LIMIT', 'String values exceed the bounded formula string limit.');
  }
  if (isChartRecord(value)) {
    if (value.series.length > limits.max_collection_size) {
      return issue('FORMULA_COLLECTION_LIMIT', 'Chart series exceed the bounded collection limit.');
    }
    for (const point of value.series) {
      if (!isRecord(point) || typeof point.label !== 'string' || !isFiniteNumber(point.value)) {
        return issue('TYPE_MISMATCH', 'Chart points require bounded string labels and finite number values.');
      }
      if (point.label.length > limits.max_string_length) {
        return issue('FORMULA_STRING_LIMIT', 'Chart labels exceed the bounded formula string limit.');
      }
    }
  }
  if (isTableRecord(value)) {
    if (value.columns.length > limits.max_collection_size || value.rows.length > limits.max_collection_size) {
      return issue('FORMULA_COLLECTION_LIMIT', 'Table dimensions exceed the bounded collection limit.');
    }
    for (const column of value.columns) {
      if (typeof column !== 'string') return issue('TYPE_MISMATCH', 'Table columns require bounded string values.');
      if (column.length > limits.max_string_length) {
        return issue('FORMULA_STRING_LIMIT', 'Table column labels exceed the bounded formula string limit.');
      }
    }
    for (const row of value.rows) {
      if (!Array.isArray(row)) return issue('TYPE_MISMATCH', 'Table rows require string cell arrays.');
      if (row.length > limits.max_collection_size) {
        return issue('FORMULA_COLLECTION_LIMIT', 'Table row cells exceed the bounded collection limit.');
      }
      for (const cell of row) {
        if (typeof cell !== 'string') return issue('TYPE_MISMATCH', 'Table cells require bounded string values.');
        if (cell.length > limits.max_string_length) {
          return issue('FORMULA_STRING_LIMIT', 'Table cells exceed the bounded formula string limit.');
        }
      }
    }
  }
  return undefined;
}

function valueHasExpectedType(value: unknown, expected: InstrumentValueType, limits: FormulaResourceLimits = FORMULA_LIMITS): InstrumentIssue | undefined {
  if (expected === 'number' && typeof value === 'number' && !Number.isFinite(value)) {
    return issue('NON_FINITE', 'Number values must be finite.');
  }
  const actual = valueType(value);
  if (actual !== expected) {
    return issue('TYPE_MISMATCH', `Expected ${expected} value${actual ? `, received ${actual}.` : '.'}`);
  }
  return valueResourceIssue(value, limits);
}

/** Stable, locale-independent display formatting for values crossing the seam. */
export function formatInstrumentValue(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? roundNumber(value, 6).toFixed(2) : 'invalid';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (isChartData(value)) {
    return JSON.stringify({ kind: 'chart', series: value.series.map((point) => ({ label: point.label, value: roundNumber(point.value) })) });
  }
  if (isTableData(value)) return JSON.stringify({ kind: 'table', columns: [...value.columns], rows: value.rows.map((row) => [...row]) });
  return '';
}

type FormulaScan = {
  errors: InstrumentIssue[];
  metrics: FormulaMetrics;
};

function formulaKind(record: RecordValue): string {
  if (typeof record.type === 'string') return record.type;
  if (typeof record.kind === 'string') return record.kind;
  if (typeof record.op === 'string') return record.op;
  return '';
}

const BINARY_OPERATORS = new Set<string>(['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte']);
const UNARY_OPERATORS = new Set<string>(['neg', 'abs', 'not', 'round']);
const VARIADIC_OPERATORS = new Set<string>(['sum', 'min', 'max', 'and', 'or', 'concat']);

function formulaOperator(record: RecordValue, kind: string): string {
  if (typeof record.op === 'string') return record.op;
  if (BINARY_OPERATORS.has(kind) || UNARY_OPERATORS.has(kind) || VARIADIC_OPERATORS.has(kind)) return kind;
  return '';
}

function scanFormula(root: unknown, limits: FormulaResourceLimits = FORMULA_LIMITS): FormulaScan {
  const maxNodes = limits.max_nodes;
  const maxDepth = limits.max_depth;
  const maxOperations = limits.max_operations;
  const maxStringLength = limits.max_string_length;
  const maxCollectionSize = limits.max_collection_size;
  const state: FormulaScan = { errors: [], metrics: { nodes: 0, depth: 0, operations: 0 } };
  const active = new WeakSet<object>();

  const fail = (code: string, message: string, path?: string) => {
    if (state.errors.length === 0) state.errors.push(issue(code, message, path));
  };
  const countOperation = (cost: number, path: string) => {
    state.metrics.operations += cost;
    if (state.metrics.operations > maxOperations) fail('FORMULA_OPERATION_LIMIT', 'Formula operation budget exceeded.', path);
  };
  const visit = (value: unknown, depth: number, path: string): void => {
    if (state.errors.length > 0) return;
    if (!isRecord(value)) {
      fail('FORMULA_NOT_AST', 'Formula values must be an allowlisted AST object.', path);
      return;
    }
    if (active.has(value)) {
      fail('CYCLIC_FORMULA', 'Formula AST contains a cycle.', path);
      return;
    }
    if (depth > maxDepth) {
      fail('FORMULA_DEPTH_LIMIT', 'Formula nesting depth exceeded.', path);
      return;
    }
    state.metrics.nodes += 1;
    state.metrics.depth = Math.max(state.metrics.depth, depth);
    if (state.metrics.nodes > maxNodes) {
      fail('FORMULA_NODE_LIMIT', 'Formula node budget exceeded.', path);
      return;
    }
    active.add(value);
    const kind = formulaKind(value);
    const op = formulaOperator(value, kind);
    switch (kind) {
      case 'literal': {
        const literalValue = value.value;
        if (typeof literalValue === 'number' && !Number.isFinite(literalValue)) fail('NON_FINITE', 'Number literals must be finite.', `${path}.value`);
        else if (typeof literalValue !== 'number' && typeof literalValue !== 'boolean' && typeof literalValue !== 'string') fail('INVALID_LITERAL', 'Only finite numbers, booleans, and bounded strings are literal values.', `${path}.value`);
        else if (typeof literalValue === 'string' && literalValue.length > maxStringLength) fail('FORMULA_STRING_LIMIT', 'Formula string budget exceeded.', `${path}.value`);
        break;
      }
      case 'ref': {
        if (typeof value.path !== 'string' || value.path.length === 0 || value.path.length > maxStringLength || !/^[A-Za-z0-9_.:-]+$/.test(value.path)) fail('INVALID_REFERENCE', 'Formula references must be bounded local names.', `${path}.path`);
        break;
      }
      case 'binary': {
        if (!BINARY_OPERATORS.has(op)) fail('FORMULA_OPERATOR_NOT_ALLOWED', 'Binary formula operator is not allowlisted.', `${path}.op`);
        else {
          countOperation(1, path);
          visit(value.left, depth + 1, `${path}.left`);
          visit(value.right, depth + 1, `${path}.right`);
        }
        break;
      }
      case 'unary': {
        if (!UNARY_OPERATORS.has(op)) fail('FORMULA_OPERATOR_NOT_ALLOWED', 'Unary formula operator is not allowlisted.', `${path}.op`);
        else {
          countOperation(1, path);
          if (op === 'round' && value.digits !== undefined && (typeof value.digits !== 'number' || !Number.isInteger(value.digits) || value.digits < 0 || value.digits > 6)) fail('INVALID_ROUND_DIGITS', 'Round digits must be an integer from 0 through 6.', `${path}.digits`);
          else visit(value.value, depth + 1, `${path}.value`);
        }
        break;
      }
      case 'variadic': {
        if (!VARIADIC_OPERATORS.has(op)) fail('FORMULA_OPERATOR_NOT_ALLOWED', 'Variadic formula operator is not allowlisted.', `${path}.op`);
        else if (!Array.isArray(value.args)) fail('INVALID_FORMULA_ARGUMENTS', 'Variadic formula operators require an args array.', `${path}.args`);
        else if (value.args.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.args`);
        else {
          value.args.forEach((item, index) => visit(item, depth + 1, `${path}.args[${index}]`));
          if (state.errors.length === 0) countOperation(Math.max(1, value.args.length), path);
        }
        break;
      }
      case 'conditional': {
        countOperation(1, path);
        visit(value.condition, depth + 1, `${path}.condition`);
        visit(value.then, depth + 1, `${path}.then`);
        visit(value.else, depth + 1, `${path}.else`);
        break;
      }
      case 'chart': {
        if (!Array.isArray(value.points)) fail('INVALID_FORMULA_COLLECTION', 'Chart formulas require points.', `${path}.points`);
        else {
          countOperation(Math.max(1, value.points.length), path);
          if (value.points.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.points`);
          else value.points.forEach((point, index) => {
            if (!isRecord(point) || typeof point.label !== 'string' || point.label.length > maxStringLength) fail('INVALID_CHART_POINT', 'Chart points require bounded string labels.', `${path}.points[${index}]`);
            else visit(point.value, depth + 1, `${path}.points[${index}].value`);
          });
        }
        break;
      }
      case 'table': {
        if (!Array.isArray(value.columns)) fail('INVALID_TABLE_COLUMNS', 'Table formulas require bounded string columns.', `${path}.columns`);
        else if (value.columns.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.columns`);
        else if (!value.columns.every((column) => typeof column === 'string' && column.length <= maxStringLength)) fail('INVALID_TABLE_COLUMNS', 'Table formulas require bounded string columns.', `${path}.columns`);
        if (!Array.isArray(value.rows)) fail('INVALID_FORMULA_COLLECTION', 'Table formulas require rows.', `${path}.rows`);
        else if (value.rows.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.rows`);
        else {
          countOperation(Math.max(1, value.rows.length), path);
          value.rows.forEach((row, rowIndex) => {
            if (!Array.isArray(row) || row.length !== (Array.isArray(value.columns) ? value.columns.length : 0)) fail('INVALID_TABLE_ROW', 'Table formula rows must match the declared columns.', `${path}.rows[${rowIndex}]`);
            else if (row.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.rows[${rowIndex}]`);
            else row.forEach((cell, columnIndex) => visit(cell, depth + 1, `${path}.rows[${rowIndex}][${columnIndex}]`));
          });
        }
        break;
      }
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
      case 'eq':
      case 'neq':
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
        countOperation(1, path);
        if (value.left === undefined || value.right === undefined) fail('INVALID_FORMULA_ARGUMENTS', 'Binary formula operators require left and right operands.', path);
        else {
          visit(value.left, depth + 1, `${path}.left`);
          visit(value.right, depth + 1, `${path}.right`);
        }
        break;
      case 'neg':
      case 'abs':
      case 'not':
      case 'round':
        countOperation(1, path);
        if (value.value === undefined) fail('INVALID_FORMULA_ARGUMENTS', 'Unary formula operators require a value operand.', path);
        else visit(value.value, depth + 1, `${path}.value`);
        break;
      case 'sum':
      case 'min':
      case 'max':
      case 'and':
      case 'or':
      case 'concat':
        if (!Array.isArray(value.args)) fail('INVALID_FORMULA_ARGUMENTS', 'Variadic formula operators require an args array.', path);
        else if (value.args.length > maxCollectionSize) fail('FORMULA_COLLECTION_LIMIT', 'Formula collection budget exceeded.', `${path}.args`);
        else {
          value.args.forEach((item, index) => visit(item, depth + 1, `${path}.args[${index}]`));
          if (state.errors.length === 0) countOperation(Math.max(1, value.args.length), path);
        }
        break;
      default:
        fail('FORMULA_OPERATOR_NOT_ALLOWED', 'Formula node is not allowlisted.', `${path}.type`);
        break;
    }
    active.delete(value);
  };

  visit(root, 1, '$');
  return state;
}

type InternalFormulaResult = {
  status: FormulaStatus;
  value?: InstrumentValue;
  errors: InstrumentIssue[];
};

function okay(value: InstrumentValue): InternalFormulaResult {
  return { status: 'ok', value, errors: [] };
}

function failed(status: FormulaStatus, errors: readonly InstrumentIssue[]): InternalFormulaResult {
  return { status, errors: [...errors] };
}

function childStatus(children: readonly InternalFormulaResult[]): FormulaStatus | undefined {
  if (children.some((child) => child.status === 'invalid')) return 'invalid';
  if (children.some((child) => child.status === 'stale')) return 'stale';
  return undefined;
}

function childErrors(children: readonly InternalFormulaResult[]): InstrumentIssue[] {
  return children.flatMap((child) => child.errors);
}

const MISSING_VALUE = Symbol('missing-formula-value');

function resolveFormulaReference(environment: Readonly<Record<string, unknown>>, path: string): unknown | typeof MISSING_VALUE {
  if (hasOwn(environment as RecordValue, path) && environment[path] !== undefined) return environment[path];
  const segments = path.split('.');
  let current: unknown = environment;
  for (const segment of segments) {
    if (!isRecord(current) || !hasOwn(current, segment) || current[segment] === undefined) return MISSING_VALUE;
    current = current[segment];
  }
  return current;
}

function interpretFormula(root: unknown, environment: Readonly<Record<string, unknown>>, limits: FormulaResourceLimits): InternalFormulaResult {
  if (!isRecord(root)) return failed('invalid', [issue('FORMULA_NOT_AST', 'Formula values must be an allowlisted AST object.')]);
  const kind = formulaKind(root);
  const op = formulaOperator(root, kind);
  switch (kind) {
    case 'literal': {
      if (typeof root.value === 'number' && Number.isFinite(root.value)) return okay(roundNumber(root.value));
      if (typeof root.value === 'boolean' || typeof root.value === 'string') return okay(root.value);
      return failed('invalid', [issue('INVALID_LITERAL', 'Literal is not a supported finite value.')]);
    }
    case 'ref': {
      const value = typeof root.path === 'string' ? resolveFormulaReference(environment, root.path) : MISSING_VALUE;
      if (value === MISSING_VALUE) return failed('stale', [issue('MISSING_INPUT', `Formula input ${String(root.path ?? '')} is missing.`)]);
      if (isFiniteNumber(value) || typeof value === 'boolean' || typeof value === 'string' || isChartData(value) || isTableData(value)) {
        const resourceError = valueResourceIssue(value, limits);
        if (resourceError) return failed('invalid', [resourceError]);
        return okay(isFiniteNumber(value) ? roundNumber(value) : value);
      }
      return failed('invalid', [issue('TYPE_MISMATCH', `Formula input ${String(root.path ?? '')} has an unsupported value type.`)]);
    }
    case 'binary': {
      const left = interpretFormula(root.left, environment, limits);
      const right = interpretFormula(root.right, environment, limits);
      const status = childStatus([left, right]);
      if (status) return failed(status, childErrors([left, right]));
      const leftValue = left.value;
      const rightValue = right.value;
      if (op === 'add' || op === 'sub' || op === 'mul' || op === 'div') {
        if (typeof leftValue !== 'number' || typeof rightValue !== 'number') return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires number values.`)]);
        if (op === 'div' && rightValue === 0) return failed('invalid', [issue('DIVISION_BY_ZERO', 'Division by zero is not allowed.')]);
        const result = op === 'add' ? leftValue + rightValue : op === 'sub' ? leftValue - rightValue : op === 'mul' ? leftValue * rightValue : leftValue / rightValue;
        if (!Number.isFinite(result)) return failed('invalid', [issue('NON_FINITE', 'Formula produced a non-finite number.')]);
        return okay(roundNumber(result));
      }
      const leftType = scalarType(leftValue);
      const rightType = scalarType(rightValue);
      if (!leftType || !rightType || leftType !== rightType || (leftType !== 'number' && leftType !== 'string' && leftType !== 'boolean')) return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires matching scalar values.`)]);
      if (op === 'eq') return okay(leftValue === rightValue);
      if (op === 'neq') return okay(leftValue !== rightValue);
      if (typeof leftValue !== 'number' || typeof rightValue !== 'number') return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires number values.`)]);
      if (op === 'lt') return okay(leftValue < rightValue);
      if (op === 'lte') return okay(leftValue <= rightValue);
      if (op === 'gt') return okay(leftValue > rightValue);
      return okay(leftValue >= rightValue);
    }
    case 'unary': {
      const child = interpretFormula(root.value, environment, limits);
      if (child.status !== 'ok') return failed(child.status, child.errors);
      if (op === 'not') {
        if (typeof child.value !== 'boolean') return failed('invalid', [issue('TYPE_MISMATCH', 'not requires a boolean value.')]);
        return okay(!child.value);
      }
      if (typeof child.value !== 'number') return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires a number value.`)]);
      const result = op === 'neg' ? -child.value : op === 'abs' ? Math.abs(child.value) : op === 'round' ? roundNumber(child.value, typeof root.digits === 'number' ? root.digits : 2) : child.value;
      if (!Number.isFinite(result)) return failed('invalid', [issue('NON_FINITE', 'Formula produced a non-finite number.')]);
      return okay(roundNumber(result));
    }
    case 'variadic': {
      const args = Array.isArray(root.args) ? root.args.map((item) => interpretFormula(item, environment, limits)) : [];
      const status = childStatus(args);
      if (status) return failed(status, childErrors(args));
      if (!Array.isArray(root.args)) return failed('invalid', [issue('INVALID_FORMULA_ARGUMENTS', 'Variadic formula operators require args.')]);
      if (op === 'concat') {
        if (args.some((arg) => typeof arg.value !== 'string')) return failed('invalid', [issue('TYPE_MISMATCH', 'concat requires string values.')]);
        const result = args.map((arg) => arg.value as string).join('');
        if (result.length > limits.max_string_length) return failed('invalid', [issue('FORMULA_STRING_LIMIT', 'Formula string budget exceeded.')]);
        return okay(result);
      }
      if (op === 'and' || op === 'or') {
        if (args.some((arg) => typeof arg.value !== 'boolean')) return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires boolean values.`)]);
        return okay(op === 'and' ? args.every((arg) => arg.value === true) : args.some((arg) => arg.value === true));
      }
      if (args.some((arg) => typeof arg.value !== 'number')) return failed('invalid', [issue('TYPE_MISMATCH', `${op} requires number values.`)]);
      const numbers = args.map((arg) => arg.value as number);
      if (numbers.length === 0) return failed('invalid', [issue('INVALID_FORMULA_ARGUMENTS', `${op} requires at least one value.`)]);
      const result = op === 'sum' ? numbers.reduce((total, value) => total + value, 0) : op === 'min' ? Math.min(...numbers) : Math.max(...numbers);
      if (!Number.isFinite(result)) return failed('invalid', [issue('NON_FINITE', 'Formula produced a non-finite number.')]);
      return okay(roundNumber(result));
    }
    case 'conditional': {
      const condition = interpretFormula(root.condition, environment, limits);
      if (condition.status !== 'ok') return failed(condition.status, condition.errors);
      if (typeof condition.value !== 'boolean') return failed('invalid', [issue('TYPE_MISMATCH', 'conditional conditions require boolean values.')]);
      const selected = interpretFormula(condition.value ? root.then : root.else, environment, limits);
      return selected;
    }
    case 'chart': {
      if (!Array.isArray(root.points)) return failed('invalid', [issue('INVALID_FORMULA_COLLECTION', 'Chart formulas require points.')]);
      const points: InstrumentChartPoint[] = [];
      const errors: InstrumentIssue[] = [];
      let status: FormulaStatus = 'ok';
      root.points.forEach((point, index) => {
        if (!isRecord(point) || typeof point.label !== 'string') {
          status = 'invalid';
          errors.push(issue('INVALID_CHART_POINT', 'Chart points require string labels.', `$.points[${index}]`));
          return;
        }
        const value = interpretFormula(point.value, environment, limits);
        if (value.status === 'invalid') status = 'invalid';
        else if (value.status === 'stale' && status === 'ok') status = 'stale';
        errors.push(...value.errors);
        if (value.status === 'ok' && typeof value.value === 'number') points.push({ label: point.label, value: roundNumber(value.value) });
        else if (value.status === 'ok') {
          status = 'invalid';
          errors.push(issue('TYPE_MISMATCH', 'Chart point values must be numbers.'));
        }
      });
      return status === 'ok' ? okay({ kind: 'chart', series: points }) : failed(status, errors);
    }
    case 'table': {
      if (!Array.isArray(root.columns) || !Array.isArray(root.rows)) return failed('invalid', [issue('INVALID_FORMULA_COLLECTION', 'Table formulas require columns and rows.')]);
      const columns = root.columns.filter((column): column is string => typeof column === 'string');
      const rows: string[][] = [];
      const errors: InstrumentIssue[] = [];
      let status: FormulaStatus = 'ok';
      root.rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== columns.length) {
          status = 'invalid';
          errors.push(issue('INVALID_TABLE_ROW', 'Table formula rows must match columns.', `$.rows[${rowIndex}]`));
          return;
        }
        const rendered: string[] = [];
        row.forEach((cell) => {
          const value = interpretFormula(cell, environment, limits);
          if (value.status === 'invalid') status = 'invalid';
          else if (value.status === 'stale' && status === 'ok') status = 'stale';
          errors.push(...value.errors);
          if (value.status === 'ok' && (typeof value.value === 'number' || typeof value.value === 'boolean' || typeof value.value === 'string')) rendered.push(formatInstrumentValue(value.value));
          else if (value.status === 'ok') {
            status = 'invalid';
            errors.push(issue('TYPE_MISMATCH', 'Table cells must be scalar values.'));
          }
        });
        if (rendered.length === row.length) rows.push(rendered);
      });
      return status === 'ok' ? okay({ kind: 'table', columns, rows }) : failed(status, errors);
    }
    default:
      return failed('invalid', [issue('FORMULA_OPERATOR_NOT_ALLOWED', 'Formula node is not allowlisted.')]);
  }
}

/** Evaluate a formula AST with bounded resources and no expression execution. */
export function evaluateFormula(
  formula: unknown,
  environment: Readonly<Record<string, unknown>> = {},
  limits: InstrumentLimits | typeof FORMULA_LIMITS = FORMULA_LIMITS,
): FormulaResult {
  const formulaLimits: FormulaResourceLimits = 'max_nodes' in limits
    ? limits
    : boundedLimits(limits).formula;
  try {
    const scan = scanFormula(formula, formulaLimits);
    if (scan.errors.length > 0) return { status: 'invalid', errors: scan.errors, metrics: scan.metrics };
    const result = interpretFormula(formula, environment, formulaLimits);
    if (result.status === 'ok' && result.value !== undefined) {
      const resourceError = valueResourceIssue(result.value, formulaLimits);
      if (resourceError) return { status: 'invalid', errors: [resourceError], metrics: scan.metrics };
    }
    return {
      status: result.status,
      ...(result.value !== undefined ? { value: result.value, formatted: formatInstrumentValue(result.value) } : {}),
      errors: result.errors,
      metrics: scan.metrics,
    };
  } catch {
    return {
      status: 'invalid',
      errors: [issue('FORMULA_ERROR', 'Formula could not be interpreted safely.')],
      metrics: { nodes: 0, depth: 0, operations: 0 },
    };
  }
}

function normalizePort(raw: unknown, directionHint?: 'input' | 'output'): { value?: InstrumentPort; errors: InstrumentIssue[] } {
  if (!isRecord(raw)) return { errors: [issue('INVALID_PORT', 'Port declarations must be objects.')] };
  const name = typeof raw.name === 'string' ? raw.name : typeof raw.id === 'string' ? raw.id : '';
  const direction = raw.direction === 'input' || raw.direction === 'output' ? raw.direction : directionHint;
  const declaredType = typeof raw.value_type === 'string' ? raw.value_type : typeof raw.type === 'string' ? raw.type : '';
  if (!name || name.length > FORMULA_LIMITS.max_string_length || isReservedDynamicKey(name)) return { errors: [issue('INVALID_PORT', 'Port names must be bounded, non-reserved, non-empty strings.')] };
  if (direction !== 'input' && direction !== 'output') return { errors: [issue('INVALID_PORT', 'Port declarations require input or output direction.')] };
  if (!INSTRUMENT_VALUE_TYPES.includes(declaredType as InstrumentValueType)) return { errors: [issue('INVALID_PORT_TYPE', 'Port value type is not allowlisted.')] };
  const errors: InstrumentIssue[] = [];
  if (directionHint === 'input' && hasOwn(raw, 'formula')) errors.push(issue('INPUT_FORMULA_NOT_ALLOWED', 'Input ports may not declare formulas.'));
  if (raw.required !== undefined && typeof raw.required !== 'boolean') errors.push(issue('INVALID_PORT', 'Port required must be boolean.'));
  if (raw.default_value !== undefined && valueHasExpectedType(raw.default_value, declaredType as InstrumentValueType)) errors.push(valueHasExpectedType(raw.default_value, declaredType as InstrumentValueType)!);
  if (errors.length > 0) return { errors };
  return {
    value: {
      name,
      direction,
      value_type: declaredType as InstrumentValueType,
      ...(raw.required !== undefined ? { required: raw.required as boolean } : {}),
      ...(raw.default_value !== undefined ? { default_value: raw.default_value as InstrumentValue } : {}),
      ...(raw.formula !== undefined ? { formula: raw.formula as FormulaAst } : {}),
    },
    errors: [],
  };
}

function normalizeInstance(
  raw: unknown,
  fromShape = false,
  shapeId?: string,
  limits: ReturnType<typeof boundedLimits> = boundedLimits(),
): { value?: InstrumentInstanceRecord; errors: InstrumentIssue[] } {
  if (!isRecord(raw)) return { errors: [issue('INVALID_INSTANCE', 'Instrument instances must be objects.')] };
  const id = typeof raw.id === 'string' ? raw.id : typeof raw.instrument_id === 'string' ? raw.instrument_id : typeof raw.semantic_id === 'string' ? raw.semantic_id : '';
  const resolvedShapeId = typeof raw.shape_id === 'string' ? raw.shape_id : shapeId;
  const type = typeof raw.type === 'string' ? raw.type : typeof raw.instrument_type === 'string' ? raw.instrument_type : typeof raw.kind === 'string' ? raw.kind : '';
  const version = raw.version === undefined ? 1 : raw.version;
  if (!id) return { errors: [issue(fromShape ? 'MISSING_STABLE_ID' : 'INVALID_INSTANCE', 'Instrument instances require a stable semantic id.')] };
  if (id.length > limits.max_id_length || (resolvedShapeId && resolvedShapeId.length > limits.max_id_length)) return { errors: [issue('INVALID_IDENTITY', 'Instrument and shape ids must be bounded.')] };
  if (isReservedDynamicKey(id)) return { errors: [issue('INVALID_IDENTITY', 'Instrument ids may not use reserved object keys.')] };
  if (resolvedShapeId === id) return { errors: [issue('IDENTITY_COLLISION', 'Stable instrument id and random shape id must differ.')] };
  if (!type || typeof type !== 'string') return { errors: [issue('INVALID_INSTANCE', 'Instrument instances require a bounded type.')] };
  if (version !== 1) return { errors: [issue('UNSUPPORTED_VERSION', 'Only instrument record version 1 is supported.')] };
  const portsValue = isRecord(raw.ports) ? raw.ports : raw;
  const inputRaw = Array.isArray(portsValue.inputs) ? portsValue.inputs : [];
  const outputRaw = Array.isArray(portsValue.outputs) ? portsValue.outputs : [];
  if (!Array.isArray(portsValue.inputs) || !Array.isArray(portsValue.outputs)) return { errors: [issue('INVALID_PORTS', 'Instrument instances require ports.inputs and ports.outputs arrays.')] };
  if (inputRaw.length + outputRaw.length > limits.max_ports_per_instance) {
    return { errors: [issue('GRAPH_PORT_LIMIT', 'Instrument port budget exceeded.', 'ports')] };
  }
  const errors: InstrumentIssue[] = [];
  if (hasOwn(raw, 'input_values') && !isPlainRecord(raw.input_values)) errors.push(issue('INVALID_INPUT_VALUES', 'Instrument input_values must be a plain object record.', 'input_values'));
  if (hasOwn(raw, 'output_values') && !isPlainRecord(raw.output_values)) errors.push(issue('INVALID_OUTPUT_VALUES', 'Instrument output_values must be a plain object record.', 'output_values'));
  if (raw.formulas !== undefined && !isPlainRecord(raw.formulas)) errors.push(issue('INVALID_FORMULAS', 'Instrument formulas must be an object keyed by output port name.'));
  const inputValues = isPlainRecord(raw.input_values) ? raw.input_values : isPlainRecord(raw.values) ? raw.values : undefined;
  const outputValues = isPlainRecord(raw.output_values) ? raw.output_values : undefined;
  const formulas = isPlainRecord(raw.formulas) ? raw.formulas : undefined;
  const inputKeys = inputValues ? ownKeysWithinLimit(inputValues, limits.formula.max_collection_size) : [];
  const outputKeys = outputValues ? ownKeysWithinLimit(outputValues, limits.formula.max_collection_size) : [];
  const formulaKeys = formulas ? ownKeysWithinLimit(formulas, limits.formula.max_collection_size) : [];
  if (inputValues && !inputKeys) errors.push(issue('FORMULA_COLLECTION_LIMIT', 'Instrument input_values exceed the bounded collection limit.', 'input_values'));
  if (outputValues && !outputKeys) errors.push(issue('FORMULA_COLLECTION_LIMIT', 'Instrument output_values exceed the bounded collection limit.', 'output_values'));
  if (formulas && !formulaKeys) errors.push(issue('FORMULA_COLLECTION_LIMIT', 'Instrument formulas exceed the bounded collection limit.', 'formulas'));
  if (errors.length > 0) return { errors };
  const inputs: InstrumentPort[] = [];
  const outputs: InstrumentPort[] = [];
  inputRaw.forEach((port, index) => {
    const normalized = normalizePort(port, 'input');
    if (normalized.value) inputs.push(normalized.value);
    errors.push(...normalized.errors.map((entry) => ({ ...entry, path: `ports.inputs[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  outputRaw.forEach((port, index) => {
    const normalized = normalizePort(port, 'output');
    if (normalized.value) outputs.push(normalized.value);
    errors.push(...normalized.errors.map((entry) => ({ ...entry, path: `ports.outputs[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  const allNames = new Set<string>();
  [...inputs, ...outputs].forEach((port) => {
    const namespaceKey = `${port.direction}:${port.name}`;
    if (allNames.has(namespaceKey)) errors.push(issue('DUPLICATE_PORT', `Duplicate ${port.direction} port ${port.name}.`));
    allNames.add(namespaceKey);
  });
  if (errors.length > 0) return { errors };
  return {
    value: {
      id,
      ...(resolvedShapeId ? { shape_id: resolvedShapeId } : {}),
      type: type.slice(0, FORMULA_LIMITS.max_string_length),
      version: 1,
      ports: { inputs, outputs },
      ...(inputValues ? { input_values: copyRecordKeys(inputValues, inputKeys!) } : {}),
      ...(outputValues ? { output_values: copyRecordKeys(outputValues, outputKeys!) } : {}),
      ...(formulas ? { formulas: copyRecordKeys(formulas, formulaKeys!) as Record<string, FormulaAst> } : {}),
    },
    errors: [],
  };
}

function unwrapShapeRecord(raw: unknown): { source?: RecordValue; shape_id?: string; from_shape: boolean; errors: InstrumentIssue[] } {
  if (!isRecord(raw)) return { from_shape: false, errors: [issue('INVALID_INSTANCE', 'Instrument instances must be objects.')] };
  const hasProps = isRecord(raw.props);
  const props = hasProps ? raw.props as RecordValue : undefined;
  const hasNestedInstrument = Boolean(props && isRecord(props.instrument));
  if (!hasProps && !isRecord(raw.instrument)) return { source: raw, from_shape: false, errors: [] };
  let source: RecordValue = hasNestedInstrument ? props!.instrument as RecordValue : hasProps ? props! : raw.instrument as RecordValue;
  if (typeof source.data === 'string') {
    try {
      const parsed: unknown = JSON.parse(source.data);
      if (isRecord(parsed)) source = { ...source, ...parsed };
    } catch {
      return { from_shape: true, shape_id: typeof raw.id === 'string' ? raw.id : undefined, errors: [issue('INVALID_INSTANCE_DATA', 'Instrument shape data must be valid JSON.')] };
    }
  }
  if (isRecord(source.instrument)) source = source.instrument;
  return { source, shape_id: typeof raw.id === 'string' ? raw.id : undefined, from_shape: true, errors: [] };
}

function parseInstrumentInstanceRecordWithLimits(raw: unknown, limits: ReturnType<typeof boundedLimits>): ParseInstrumentResult {
  const unwrapped = unwrapShapeRecord(raw);
  if (!unwrapped.source) return { ok: false, errors: unwrapped.errors };
  const normalized = normalizeInstance(unwrapped.source, unwrapped.from_shape, unwrapped.shape_id, limits);
  return normalized.value ? { ok: true, value: normalized.value, errors: [] } : { ok: false, errors: normalized.errors };
}

/** Parse a canonical record or a tldraw-shaped data object without importing tldraw. */
export function parseInstrumentInstanceRecord(raw: unknown, overrides?: InstrumentLimits): ParseInstrumentResult {
  return parseInstrumentInstanceRecordWithLimits(raw, boundedLimits(overrides));
}

export function parseInstrumentGraph(raw: unknown, overrides?: InstrumentLimits): ParseInstrumentGraphResult {
  if (!isRecord(raw) || !Array.isArray(raw.instances) || !Array.isArray(raw.bindings)) return { ok: false, errors: [issue('INVALID_GRAPH', 'Instrument graphs require instances and bindings arrays.')] };
  const limits = boundedLimits(overrides);
  const limitErrors: InstrumentIssue[] = [];
  if (raw.instances.length > limits.max_instances) limitErrors.push(issue('GRAPH_INSTANCE_LIMIT', 'Instrument instance budget exceeded.'));
  if (raw.bindings.length > limits.max_bindings) limitErrors.push(issue('GRAPH_BINDING_LIMIT', 'Instrument binding budget exceeded.'));
  if (limitErrors.length > 0) return { ok: false, errors: limitErrors };
  const errors: InstrumentIssue[] = [];
  const instances: InstrumentInstanceRecord[] = [];
  raw.instances.forEach((instance, index) => {
    const parsed = parseInstrumentInstanceRecordWithLimits(instance, limits);
    if (parsed.value) instances.push(parsed.value);
    errors.push(...parsed.errors.map((entry) => ({ ...entry, path: `instances[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  const bindings: InstrumentBinding[] = [];
  raw.bindings.forEach((binding, index) => {
    const normalized = normalizeBinding(binding, index);
    if (normalized.value) bindings.push(normalized.value);
    errors.push(...normalized.errors.map((entry) => ({ ...entry, path: `bindings[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  return errors.length === 0 ? { ok: true, value: { instances, bindings }, errors: [] } : { ok: false, errors };
}

function normalizeBinding(raw: unknown, index: number): { value?: InstrumentBinding; errors: InstrumentIssue[] } {
  if (!isRecord(raw)) return { errors: [issue('INVALID_BINDING', 'Bindings must be objects.')] };
  const sourceRecord = isRecord(raw.source) ? raw.source : undefined;
  const targetRecord = isRecord(raw.target) ? raw.target : undefined;
  const props = isRecord(raw.props) ? raw.props : undefined;
  const sourceInstance = typeof sourceRecord?.instance_id === 'string' ? sourceRecord.instance_id : typeof sourceRecord?.instanceId === 'string' ? sourceRecord.instanceId : typeof raw.source_instance_id === 'string' ? raw.source_instance_id : typeof raw.from_instance_id === 'string' ? raw.from_instance_id : typeof raw.fromId === 'string' ? raw.fromId : '';
  const targetInstance = typeof targetRecord?.instance_id === 'string' ? targetRecord.instance_id : typeof targetRecord?.instanceId === 'string' ? targetRecord.instanceId : typeof raw.target_instance_id === 'string' ? raw.target_instance_id : typeof raw.to_instance_id === 'string' ? raw.to_instance_id : typeof raw.toId === 'string' ? raw.toId : '';
  const sourcePort = typeof sourceRecord?.port === 'string' ? sourceRecord.port : typeof sourceRecord?.port_name === 'string' ? sourceRecord.port_name : typeof raw.source_port === 'string' ? raw.source_port : typeof raw.from_port === 'string' ? raw.from_port : typeof props?.source_port === 'string' ? props.source_port : typeof props?.from_port === 'string' ? props.from_port : typeof props?.fromPort === 'string' ? props.fromPort : '';
  const targetPort = typeof targetRecord?.port === 'string' ? targetRecord.port : typeof targetRecord?.port_name === 'string' ? targetRecord.port_name : typeof raw.target_port === 'string' ? raw.target_port : typeof raw.to_port === 'string' ? raw.to_port : typeof props?.target_port === 'string' ? props.target_port : typeof props?.to_port === 'string' ? props.to_port : typeof props?.toPort === 'string' ? props.toPort : '';
  if (!sourceInstance || !targetInstance || !sourcePort || !targetPort) return { errors: [issue('INVALID_BINDING', 'Bindings require source and target instance ids and port names.')] };
  const id = typeof raw.id === 'string' ? raw.id : `binding:${index}`;
  return { value: { id, source: { instance_id: sourceInstance, port: sourcePort }, target: { instance_id: targetInstance, port: targetPort } }, errors: [] };
}

function normalizeGraph(raw: unknown, limits: ReturnType<typeof boundedLimits>): { graph?: InstrumentGraph; errors: InstrumentIssue[] } {
  if (!isRecord(raw) || !Array.isArray(raw.instances) || !Array.isArray(raw.bindings)) return { errors: [issue('INVALID_GRAPH', 'Instrument graphs require instances and bindings arrays.')] };
  const errors: InstrumentIssue[] = [];
  if (raw.instances.length > limits.max_instances) errors.push(issue('GRAPH_INSTANCE_LIMIT', 'Instrument instance budget exceeded.'));
  if (raw.bindings.length > limits.max_bindings) errors.push(issue('GRAPH_BINDING_LIMIT', 'Instrument binding budget exceeded.'));
  if (errors.length > 0) return { errors };
  const instances: InstrumentInstanceRecord[] = [];
  raw.instances.forEach((rawInstance, index) => {
    const normalized = parseInstrumentInstanceRecordWithLimits(rawInstance, limits);
    if (normalized.value) {
      instances.push(normalized.value);
    }
    errors.push(...normalized.errors.map((entry) => ({ ...entry, path: `instances[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  const bindings: InstrumentBinding[] = [];
  raw.bindings.forEach((rawBinding, index) => {
    const normalized = normalizeBinding(rawBinding, index);
    if (normalized.value) bindings.push(normalized.value);
    errors.push(...normalized.errors.map((entry) => ({ ...entry, path: `bindings[${index}]${entry.path ? `.${entry.path}` : ''}` })));
  });
  if (errors.length > 0) return { errors };
  return {
    graph: {
      instances: [...instances].sort((left, right) => compareCodeUnits(left.id, right.id)),
      bindings: [...bindings].sort((left, right) => compareBindings(left, right)),
    },
    errors: [],
  };
}

function compareBindings(left: InstrumentBinding, right: InstrumentBinding): number {
  const byId = compareCodeUnits(left.id ?? '', right.id ?? '');
  if (byId !== 0) return byId;
  const bySourceInstance = compareCodeUnits(left.source.instance_id, right.source.instance_id);
  if (bySourceInstance !== 0) return bySourceInstance;
  const bySourcePort = compareCodeUnits(left.source.port, right.source.port);
  if (bySourcePort !== 0) return bySourcePort;
  const byTargetInstance = compareCodeUnits(left.target.instance_id, right.target.instance_id);
  if (byTargetInstance !== 0) return byTargetInstance;
  return compareCodeUnits(left.target.port, right.target.port);
}

function portMaps(instance: InstrumentInstanceRecord): { inputs: Map<string, InstrumentPort>; outputs: Map<string, InstrumentPort> } {
  return {
    inputs: new Map(instance.ports.inputs.map((port) => [port.name, port])),
    outputs: new Map(instance.ports.outputs.map((port) => [port.name, port])),
  };
}

function formulaLimitInput(limits: ReturnType<typeof boundedLimits>): FormulaResourceLimits {
  return limits.formula;
}

/** Validate identities, typed ports, one-way bindings, graph limits, and DAG order. */
export function validateInstrumentGraph(raw: unknown, overrides?: InstrumentLimits): GraphValidationResult {
  const limits = boundedLimits(overrides);
  const normalized = normalizeGraph(raw, limits);
  if (!normalized.graph) return { ok: false, errors: normalized.errors, topological_order: [] };
  const graph = normalized.graph;
  const errors: InstrumentIssue[] = [];
  const instancesById = new Map<string, InstrumentInstanceRecord>();
  graph.instances.forEach((instance, index) => {
    if (instancesById.has(instance.id)) errors.push(issue('DUPLICATE_INSTANCE', `Duplicate stable instrument id ${instance.id}.`, `instances[${index}].id`));
    else instancesById.set(instance.id, instance);
    if (instance.shape_id && instance.shape_id === instance.id) errors.push(issue('IDENTITY_COLLISION', 'Stable instrument id and random shape id must differ.', `instances[${index}]`));
    for (const output of instance.ports.outputs) {
      if (output.formula !== undefined) {
        const scan = scanFormula(output.formula, formulaLimitInput(limits));
        errors.push(...scan.errors.map((entry) => ({ ...entry, path: `instances[${index}].outputs.${output.name}${entry.path ? `.${entry.path}` : ''}` })));
      }
    }
    if (instance.formulas) {
      const inputNames = new Set(instance.ports.inputs.map((port) => port.name));
      const outputNames = new Set(instance.ports.outputs.map((port) => port.name));
      Object.keys(instance.formulas).sort(compareCodeUnits).forEach((name) => {
        if (inputNames.has(name)) errors.push(issue('INPUT_FORMULA_NOT_ALLOWED', 'Input ports may not have formulas.', `instances[${index}].formulas.${name}`));
        if (!outputNames.has(name)) errors.push(issue('UNKNOWN_OUTPUT_FORMULA', `Formula ${name} does not target a declared output port.`, `instances[${index}].formulas.${name}`));
        const scan = scanFormula(instance.formulas![name], formulaLimitInput(limits));
        errors.push(...scan.errors.map((entry) => ({ ...entry, path: `instances[${index}].formulas.${name}${entry.path ? `.${entry.path}` : ''}` })));
      });
    }
  });
  const normalizedBindings: InstrumentBinding[] = [];
  const targetWriters = new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  graph.instances.forEach((instance) => {
    adjacency.set(instance.id, new Set());
    indegree.set(instance.id, 0);
  });
  graph.bindings.forEach((binding, index) => {
    const source = instancesById.get(binding.source.instance_id);
    const target = instancesById.get(binding.target.instance_id);
    if (!source || !target) {
      errors.push(issue('UNKNOWN_INSTANCE', 'Binding references an unknown instrument instance.', `bindings[${index}]`));
      return;
    }
    const sourcePorts = portMaps(source);
    const targetPorts = portMaps(target);
    const sourcePort = sourcePorts.outputs.get(binding.source.port) ?? sourcePorts.inputs.get(binding.source.port);
    const targetPort = targetPorts.inputs.get(binding.target.port) ?? targetPorts.outputs.get(binding.target.port);
    if (!sourcePort || !targetPort) {
      errors.push(issue('UNKNOWN_PORT', 'Binding references an unknown port.', `bindings[${index}]`));
      return;
    }
    if (sourcePort.direction !== 'output') {
      errors.push(issue('SOURCE_NOT_OUTPUT', 'Binding source must be a declared output port.', `bindings[${index}].source`));
      return;
    }
    if (targetPort.direction !== 'input') {
      errors.push(issue('TARGET_NOT_INPUT', 'Binding target must be a declared input port.', `bindings[${index}].target`));
      return;
    }
    if (source.id === target.id) {
      errors.push(issue('SELF_EDGE', 'Instrument bindings may not connect an instance to itself.', `bindings[${index}]`));
      return;
    }
    if (sourcePort.value_type !== targetPort.value_type) {
      errors.push(issue('TYPE_MISMATCH', 'Binding source and target port types must match.', `bindings[${index}]`));
      return;
    }
    const targetKey = `${target.id}\u0000${targetPort.name}`;
    if (targetWriters.has(targetKey)) {
      errors.push(issue('DUPLICATE_TARGET', 'Each input port may have at most one binding writer.', `bindings[${index}].target`));
      return;
    }
    targetWriters.add(targetKey);
    normalizedBindings.push(binding);
    const neighbors = adjacency.get(source.id)!;
    if (!neighbors.has(target.id)) {
      neighbors.add(target.id);
      indegree.set(target.id, (indegree.get(target.id) ?? 0) + 1);
    }
  });
  if (errors.length > 0) return { ok: false, errors, topological_order: [] };
  const ready = graph.instances.filter((instance) => indegree.get(instance.id) === 0).map((instance) => instance.id).sort(compareCodeUnits);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    const targets = [...(adjacency.get(id) ?? [])].sort(compareCodeUnits);
    targets.forEach((target) => {
      const nextDegree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) {
        ready.push(target);
        ready.sort(compareCodeUnits);
      }
    });
  }
  if (order.length !== graph.instances.length) return { ok: false, errors: [issue('CYCLE', 'Instrument bindings must form an acyclic graph.')], topological_order: [] };
  return { ok: true, errors: [], topological_order: order, graph: { ...graph, bindings: normalizedBindings } };
}

function inputValuesFor(instance: InstrumentInstanceRecord): RecordValue {
  if (isRecord(instance.input_values)) return { ...instance.input_values };
  return {};
}

function outputValuesFor(instance: InstrumentInstanceRecord): RecordValue {
  if (isRecord(instance.output_values)) return { ...instance.output_values };
  return isRecord(instance.input_values) ? { ...instance.input_values } : {};
}

function aggregateStatus(statuses: readonly FormulaStatus[]): FormulaStatus {
  if (statuses.includes('invalid')) return 'invalid';
  if (statuses.includes('stale')) return 'stale';
  return 'ok';
}

function stableErrors(entries: readonly InstrumentIssue[]): InstrumentIssue[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.code}|${entry.path ?? ''}|${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function affectedIds(graph: InstrumentGraph, changed?: readonly string[]): Set<string> {
  if (!changed || changed.length === 0) return new Set(graph.instances.map((instance) => instance.id));
  const adjacency = new Map<string, string[]>();
  graph.instances.forEach((instance) => adjacency.set(instance.id, []));
  graph.bindings.forEach((binding) => {
    const targets = adjacency.get(binding.source.instance_id);
    if (targets && !targets.includes(binding.target.instance_id)) targets.push(binding.target.instance_id);
  });
  const found = new Set(changed.filter((id) => adjacency.has(id)));
  const queue = [...found];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of adjacency.get(id) ?? []) {
      if (!found.has(target)) {
        found.add(target);
        queue.push(target);
      }
    }
  }
  return found;
}

/**
 * Evaluate a validated graph in stable topological order. The returned
 * patches are semantic (`instance_id` + output port), so a tldraw adapter can
 * attach its own shape ids and props without leaking editor dependencies here.
 */
export function evaluateInstrumentGraph(raw: unknown, options: InstrumentEvaluationOptions = {}): InstrumentGraphEvaluation {
  const validation = validateInstrumentGraph(raw, options.limits);
  if (!validation.ok || !validation.graph) {
    return { status: 'invalid', order: validation.topological_order, affected_instance_ids: [], results: {}, patches: [], errors: [...validation.errors] };
  }
  const graph = validation.graph;
  const formulaLimits = boundedLimits(options.limits).formula;
  const order = [...validation.topological_order];
  const instancesById = new Map(graph.instances.map((instance) => [instance.id, instance]));
  const inbound = new Map<string, InstrumentBinding>();
  graph.bindings.forEach((binding) => inbound.set(`${binding.target.instance_id}\u0000${binding.target.port}`, binding));
  const results: Record<string, EvaluatedInstance> = {};
  const patches: InstrumentPatch[] = [];
  const graphErrors: InstrumentIssue[] = [];
  for (const id of order) {
    const instance = instancesById.get(id)!;
    const inputStates: Record<string, EvaluatedInput> = {};
    const environment: Record<string, unknown> = {};
    const inputValues = inputValuesFor(instance);
    const statuses: FormulaStatus[] = [];
    for (const port of instance.ports.inputs) {
      const binding = inbound.get(`${id}\u0000${port.name}`);
      let state: EvaluatedInput;
      if (binding) {
        const sourceResult = results[binding.source.instance_id];
        const sourceOutput = sourceResult?.outputs[binding.source.port];
        if (!sourceOutput) state = { status: 'invalid', errors: [issue('UNKNOWN_SOURCE_OUTPUT', 'Binding source output was not evaluated.')] };
        else if (sourceOutput.status !== 'ok') state = { status: sourceOutput.status, errors: [...sourceOutput.errors] };
        else {
          const typeError = valueHasExpectedType(sourceOutput.value, port.value_type, formulaLimits);
          state = typeError ? { status: 'invalid', errors: [typeError] } : { status: 'ok', value: sourceOutput.value, errors: [] };
        }
      } else if (hasOwn(inputValues, port.name) && inputValues[port.name] !== undefined) {
        const typeError = valueHasExpectedType(inputValues[port.name], port.value_type, formulaLimits);
        state = typeError ? { status: 'invalid', errors: [typeError] } : { status: 'ok', value: inputValues[port.name] as InstrumentValue, errors: [] };
      } else if (port.default_value !== undefined) {
        const typeError = valueHasExpectedType(port.default_value, port.value_type, formulaLimits);
        state = typeError ? { status: 'invalid', errors: [typeError] } : { status: 'ok', value: port.default_value, errors: [] };
      } else if (port.required !== false) {
        state = { status: 'stale', errors: [issue('MISSING_INPUT', `Required input ${port.name} is missing.`)] };
      } else {
        state = { status: 'ok', errors: [] };
      }
      inputStates[port.name] = state;
      statuses.push(state.status);
      if (state.status === 'ok' && state.value !== undefined) environment[port.name] = state.value;
    }
    environment.inputs = Object.fromEntries(Object.entries(inputStates).filter(([, value]) => value.status === 'ok' && value.value !== undefined).map(([name, value]) => [name, value.value]));
    const outputs: Record<string, FormulaResult> = {};
    const outputValues = outputValuesFor(instance);
    for (const port of instance.ports.outputs) {
      const formula = port.formula ?? instance.formulas?.[port.name];
      let output: FormulaResult;
      const inputStatus = aggregateStatus(statuses);
      if (inputStatus !== 'ok') {
        const inputErrors = Object.values(inputStates).flatMap((state) => state.errors);
        output = { status: inputStatus, errors: stableErrors(inputErrors), metrics: { nodes: 0, depth: 0, operations: 0 } };
      } else if (formula !== undefined) {
        output = evaluateFormula(formula, environment, options.limits);
      } else if (hasOwn(outputValues, port.name) && outputValues[port.name] !== undefined) {
        const typeError = valueHasExpectedType(outputValues[port.name], port.value_type, formulaLimits);
        output = typeError ? { status: 'invalid', errors: [typeError], metrics: { nodes: 0, depth: 0, operations: 0 } } : { status: 'ok', value: outputValues[port.name] as InstrumentValue, formatted: formatInstrumentValue(outputValues[port.name]), errors: [], metrics: { nodes: 0, depth: 0, operations: 0 } };
      } else {
        output = { status: 'stale', errors: [issue('MISSING_OUTPUT', `Output ${port.name} has no formula or value.`)], metrics: { nodes: 0, depth: 0, operations: 0 } };
      }
      if (output.status === 'ok') {
        const typeError = valueHasExpectedType(output.value, port.value_type, formulaLimits);
        if (typeError) output = { ...output, status: 'invalid', value: undefined, formatted: undefined, errors: [...output.errors, typeError] };
      }
      outputs[port.name] = output;
      statuses.push(output.status);
      patches.push({
        instance_id: instance.id,
        ...(instance.shape_id ? { shape_id: instance.shape_id } : {}),
        port: port.name,
        status: output.status,
        ...(output.value !== undefined ? { value: output.value, formatted: output.formatted } : {}),
        ...(output.errors.length > 0 ? { errors: output.errors } : {}),
      });
    }
    const instanceStatus = aggregateStatus(statuses);
    const errors = stableErrors([...Object.values(inputStates).flatMap((state) => state.errors), ...Object.values(outputs).flatMap((output) => output.errors)]);
    results[id] = { id, ...(instance.shape_id ? { shape_id: instance.shape_id } : {}), status: instanceStatus, inputs: inputStates, outputs, errors };
    graphErrors.push(...errors.map((entry) => ({ ...entry, path: `instances.${id}${entry.path ? `.${entry.path}` : ''}` })));
  }
  const affected = affectedIds(graph, options.changed_instance_ids);
  const filteredPatches = patches.filter((patch) => affected.has(patch.instance_id));
  return {
    status: aggregateStatus(Object.values(results).map((result) => result.status)),
    order,
    affected_instance_ids: graph.instances.map((instance) => instance.id).filter((id) => affected.has(id)),
    results,
    patches: filteredPatches,
    errors: stableErrors(graphErrors),
  };
}

/** Parse shape records, recompute the graph, and return semantic patches. */
export function recomputeInstrumentGraph(raw: unknown, options: InstrumentEvaluationOptions = {}): InstrumentGraphEvaluation {
  const parsed = parseInstrumentGraph(raw);
  if (!parsed.ok || !parsed.value) return { status: 'invalid', order: [], affected_instance_ids: [], results: {}, patches: [], errors: [...parsed.errors] };
  return evaluateInstrumentGraph(parsed.value, options);
}

export const recomputeInstrumentPatches = recomputeInstrumentGraph;

function numberInputPort(name: string): InstrumentPort {
  return { name, direction: 'input', value_type: 'number' };
}

function numberOutputPort(name: string, formula: FormulaAst): InstrumentPort {
  return { name, direction: 'output', value_type: 'number', formula };
}

function makeSlider(id: string, shapeId: string, value: number): InstrumentInstanceRecord {
  return {
    id,
    shape_id: shapeId,
    type: 'slider',
    version: 1,
    ports: {
      inputs: [numberInputPort('value')],
      outputs: [numberOutputPort('value', { type: 'ref', path: 'value' })],
    },
    input_values: { value },
  };
}

function weightedScore(id: string, shapeId: string): InstrumentInstanceRecord {
  const weightedCost: FormulaAst = { type: 'binary', op: 'mul', left: { type: 'ref', path: 'cost_weight' }, right: { type: 'ref', path: 'cost_score' } };
  const weightedImpact: FormulaAst = { type: 'binary', op: 'mul', left: { type: 'ref', path: 'impact_weight' }, right: { type: 'ref', path: 'impact_score' } };
  const numerator: FormulaAst = { type: 'binary', op: 'add', left: weightedCost, right: weightedImpact };
  const denominator: FormulaAst = { type: 'binary', op: 'add', left: { type: 'ref', path: 'cost_weight' }, right: { type: 'ref', path: 'impact_weight' } };
  return {
    id,
    shape_id: shapeId,
    type: 'weighted-score',
    version: 1,
    ports: {
      inputs: [numberInputPort('cost_weight'), numberInputPort('impact_weight'), numberInputPort('cost_score'), numberInputPort('impact_score')],
      outputs: [numberOutputPort('weighted_score', { type: 'binary', op: 'div', left: numerator, right: denominator })],
    },
  };
}

function makeRecommendation(): InstrumentInstanceRecord {
  return {
    id: 'compare:recommendation',
    shape_id: 'shape:compare-recommendation-random',
    type: 'recommendation',
    version: 1,
    ports: {
      inputs: [numberInputPort('alpha_score'), numberInputPort('beta_score')].map((port) => port),
      outputs: [{
        name: 'recommended',
        direction: 'output',
        value_type: 'string',
        formula: {
          type: 'conditional',
          condition: { type: 'binary', op: 'gte', left: { type: 'ref', path: 'alpha_score' }, right: { type: 'ref', path: 'beta_score' } },
          then: { type: 'literal', value: 'Alpha' },
          else: { type: 'literal', value: 'Beta' },
        },
      }],
    },
  };
}

function makeChart(): InstrumentInstanceRecord {
  return {
    id: 'compare:chart',
    shape_id: 'shape:compare-chart-random',
    type: 'chart',
    version: 1,
    ports: {
      inputs: [numberInputPort('alpha_score'), numberInputPort('beta_score')],
      outputs: [{
        name: 'scores',
        direction: 'output',
        value_type: 'chart',
        formula: {
          type: 'chart',
          points: [
            { label: 'Alpha', value: { type: 'ref', path: 'alpha_score' } },
            { label: 'Beta', value: { type: 'ref', path: 'beta_score' } },
          ],
        },
      }],
    },
  };
}

function binding(id: string, sourceInstance: string, sourcePort: string, targetInstance: string, targetPort: string): InstrumentBinding {
  return { id, source: { instance_id: sourceInstance, port: sourcePort }, target: { instance_id: targetInstance, port: targetPort } };
}

/** A pure fixture for the Bazaar Compare & Decide recipe. */
export function createCompareDecideFixture(): InstrumentGraph {
  const instances: InstrumentInstanceRecord[] = [
    makeSlider('compare:weight:cost', 'shape:compare-weight-cost-random', 0.4),
    makeSlider('compare:weight:impact', 'shape:compare-weight-impact-random', 0.6),
    makeSlider('compare:score-input:alpha-cost', 'shape:compare-alpha-cost-random', 95),
    makeSlider('compare:score-input:alpha-impact', 'shape:compare-alpha-impact-random', 60),
    makeSlider('compare:score-input:beta-cost', 'shape:compare-beta-cost-random', 75),
    makeSlider('compare:score-input:beta-impact', 'shape:compare-beta-impact-random', 80),
    weightedScore('compare:score:alpha', 'shape:compare-score-alpha-random'),
    weightedScore('compare:score:beta', 'shape:compare-score-beta-random'),
    makeRecommendation(),
    makeChart(),
  ];
  const bindings: InstrumentBinding[] = [
    binding('binding:alpha-cost-weight', 'compare:weight:cost', 'value', 'compare:score:alpha', 'cost_weight'),
    binding('binding:alpha-impact-weight', 'compare:weight:impact', 'value', 'compare:score:alpha', 'impact_weight'),
    binding('binding:alpha-cost-score', 'compare:score-input:alpha-cost', 'value', 'compare:score:alpha', 'cost_score'),
    binding('binding:alpha-impact-score', 'compare:score-input:alpha-impact', 'value', 'compare:score:alpha', 'impact_score'),
    binding('binding:beta-cost-weight', 'compare:weight:cost', 'value', 'compare:score:beta', 'cost_weight'),
    binding('binding:beta-impact-weight', 'compare:weight:impact', 'value', 'compare:score:beta', 'impact_weight'),
    binding('binding:beta-cost-score', 'compare:score-input:beta-cost', 'value', 'compare:score:beta', 'cost_score'),
    binding('binding:beta-impact-score', 'compare:score-input:beta-impact', 'value', 'compare:score:beta', 'impact_score'),
    binding('binding:recommendation-alpha', 'compare:score:alpha', 'weighted_score', 'compare:recommendation', 'alpha_score'),
    binding('binding:recommendation-beta', 'compare:score:beta', 'weighted_score', 'compare:recommendation', 'beta_score'),
    binding('binding:chart-alpha', 'compare:score:alpha', 'weighted_score', 'compare:chart', 'alpha_score'),
    binding('binding:chart-beta', 'compare:score:beta', 'weighted_score', 'compare:chart', 'beta_score'),
  ];
  return { instances, bindings };
}

export const COMPARE_DECIDE_FIXTURE: InstrumentGraph = createCompareDecideFixture();

/** Recompute the fixture after replacing one-input control values by stable id. */
export function recomputeCompareDecide(changes: Readonly<Record<string, unknown>> = {}): InstrumentGraphEvaluation {
  const graph = createCompareDecideFixture();
  const instances = graph.instances.map((instance) => {
    const hasDirect = hasOwn(changes as RecordValue, instance.id);
    const dottedKey = instance.ports.inputs.length === 1 ? `${instance.id}.${instance.ports.inputs[0].name}` : '';
    const hasDotted = dottedKey !== '' && hasOwn(changes as RecordValue, dottedKey);
    if (!hasDirect && !hasDotted) return instance;
    const nextValue = hasDirect ? changes[instance.id] : changes[dottedKey];
    return { ...instance, input_values: { ...(instance.input_values ?? {}), [instance.ports.inputs[0].name]: nextValue } };
  });
  return evaluateInstrumentGraph({ ...graph, instances });
}
