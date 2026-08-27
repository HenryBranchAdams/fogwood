/**
 * Trusted, data-only adapter between Fogwood surface blocks and the pure
 * instrument engine.  This module is deliberately not part of the public
 * proposal schema: the only v1 path that creates records and bindings is an
 * immutable host-owned recipe insertion.
 */

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { COMPARE_DECIDE_FIXTURE, DEFAULT_INSTRUMENT_LIMITS, FORMULA_LIMITS, INSTRUMENT_PROTOCOL, evaluateInstrumentGraph, formatInstrumentValue, parseInstrumentGraph, parseInstrumentInstanceRecord, validateInstrumentGraph } from './fogwood-instruments.ts';
import type { InstrumentBinding, InstrumentGraph, InstrumentGraphEvaluation, InstrumentInstanceRecord, InstrumentIssue, InstrumentPort, InstrumentValue } from './fogwood-instruments.ts';

export const INSTRUMENT_DATA_VERSION = 1 as const;
export const COMPARE_RECIPE_ID = 'compare-and-decide' as const;

type JsonRecord = Record<string, unknown>;

export type InstrumentShapeLike = {
  id: string;
  type?: string;
  parent_id?: string;
  is_locked?: boolean;
  props?: {
    kind?: unknown;
    title?: unknown;
    value?: unknown;
    data?: unknown;
    [key: string]: unknown;
  };
};

export type StoredInstrumentData = {
  protocol: typeof INSTRUMENT_PROTOCOL;
  version: typeof INSTRUMENT_DATA_VERSION;
  recipe_instance_id: string;
  record: InstrumentInstanceRecord;
  bindings: readonly InstrumentBinding[];
};

export type InstrumentBlockPatch = {
  shape_id: string;
  kind: 'slider' | 'metric' | 'chart';
  value: string;
  data: string;
  status: 'ok' | 'stale' | 'invalid';
};

export type InstrumentInputChange = {
  id: string;
  value: number;
};

export type InstrumentChangeValue = number | string | boolean | { kind: 'chart'; series: Array<{ label: string; value: number }> } | { kind: 'table'; columns: string[]; rows: string[][] } | null;

export type InstrumentChangeEntry = {
  id: string;
  label: string;
  before: InstrumentChangeValue;
  after: InstrumentChangeValue;
};

export type InstrumentChangeScope = {
  recipe_instance_id: string;
  controls: readonly InstrumentChangeEntry[];
  derived: readonly InstrumentChangeEntry[];
};

export type InstrumentScopeCollection =
  | {
      status: 'legacy';
      recipe_instance_id?: string;
      shapes: readonly InstrumentShapeLike[];
      errors: readonly InstrumentIssue[];
    }
  | {
      status: 'invalid';
      recipe_instance_id: string;
      shapes: readonly InstrumentShapeLike[];
      errors: readonly InstrumentIssue[];
    }
  | {
      status: 'ok';
      recipe_instance_id: string;
      shapes: readonly InstrumentShapeLike[];
      graph: InstrumentGraph;
      errors: readonly InstrumentIssue[];
    };

export type CompareInstrumentScope = {
  status: 'ok' | 'invalid';
  recipe_instance_id: string;
  graph: InstrumentGraph;
  evaluation: InstrumentGraphEvaluation;
  blocks: readonly InstrumentBlockPatch[];
  errors: readonly InstrumentIssue[];
};

export type InstrumentControlResult = {
  status: 'legacy' | 'ok' | 'stale' | 'invalid';
  recipe_instance_id?: string;
  scope_shape_ids?: readonly string[];
  evaluation?: InstrumentGraphEvaluation;
  instrument_changes?: readonly InstrumentChangeScope[];
  patches: readonly InstrumentBlockPatch[];
  errors: readonly InstrumentIssue[];
};

export type InstrumentInputChangeResult = {
  status: 'legacy' | 'ok' | 'stale' | 'invalid';
  recipe_instance_id?: string;
  scope_shape_ids?: readonly string[];
  before_evaluation?: InstrumentGraphEvaluation;
  after_evaluation?: InstrumentGraphEvaluation;
  instrument_changes: readonly InstrumentChangeScope[];
  patches: readonly InstrumentBlockPatch[];
  errors: readonly InstrumentIssue[];
};

const INSTRUMENT_KEYS = ['protocol', 'version', 'recipe_instance_id', 'record', 'bindings'] as const;
const DATA_KEYS = ['items', 'columns', 'rows', 'options', 'series', 'min', 'max', 'step'] as const;
const COMPARE_INSTANCE_IDS = COMPARE_DECIDE_FIXTURE.instances.map((instance) => instance.id);

export const COMPARE_INSTRUMENT_INSTANCE_IDS = [...COMPARE_INSTANCE_IDS] as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Collect at most limit + 1 own enumerable keys without an unbounded copy. */
function ownKeysWithinLimit(value: JsonRecord, limit: number): string[] | undefined {
  const keys: string[] = [];
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    keys.push(key);
    if (keys.length > limit) return undefined;
  }
  return keys;
}

function hasOnlyKeys(value: JsonRecord, allowed: readonly string[]) {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function issue(code: string, message: string, path?: string): InstrumentIssue {
  return path ? { code, message, path } : { code, message };
}

function parseData(value: unknown): JsonRecord {
  if (isRecord(value)) {
    const data: JsonRecord = {};
    try {
      for (const key of Object.keys(value).slice(0, 64)) {
        Object.defineProperty(data, key, { configurable: true, enumerable: true, value: value[key], writable: true });
      }
    } catch {
      return {};
    }
    return data;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cloneData(value: unknown): JsonRecord {
  const parsed = isRecord(value) ? value : {};
  const data: JsonRecord = {};
  for (const key of DATA_KEYS) {
    if (!(key in parsed)) continue;
    const child = parsed[key];
    if (Array.isArray(child)) data[key] = child;
    else if (typeof child === 'number' && Number.isFinite(child)) data[key] = child;
  }
  return data;
}

function boundedScope(value: string): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 120) return undefined;
  return value;
}

function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableKey(value[key])}`).join(',')}}`;
}

function recordForStorage(record: InstrumentInstanceRecord, recipeInstanceId: string, bindings: readonly InstrumentBinding[], baseData: unknown = {}): string {
  const data = cloneData(baseData);
  const instrument: StoredInstrumentData = {
    protocol: INSTRUMENT_PROTOCOL,
    version: INSTRUMENT_DATA_VERSION,
    recipe_instance_id: recipeInstanceId,
    record,
    bindings,
  };
  data.instrument = instrument;
  return JSON.stringify(data);
}

function parseStoredInstrument(shape: InstrumentShapeLike): {
  scope?: string;
  value?: StoredInstrumentData;
  errors: InstrumentIssue[];
} {
  const data = parseData(shape.props?.data);
  if (!('instrument' in data)) return { errors: [] };
  const raw = data.instrument;
  if (!isRecord(raw)) return { errors: [issue('INVALID_INSTRUMENT_DATA', 'Instrument data must be an object.', `${shape.id}.data.instrument`)] };
  if (!hasOnlyKeys(raw, INSTRUMENT_KEYS)) return { errors: [issue('UNKNOWN_INSTRUMENT_FIELD', 'Instrument data contains an unknown field.', `${shape.id}.data.instrument`)] };
  const scope = boundedScope(typeof raw.recipe_instance_id === 'string' ? raw.recipe_instance_id : '');
  if (!scope) return { errors: [issue('INVALID_RECIPE_INSTANCE_ID', 'recipe_instance_id must be a bounded non-empty string.', `${shape.id}.data.instrument.recipe_instance_id`)] };
  if (raw.protocol !== INSTRUMENT_PROTOCOL || raw.version !== INSTRUMENT_DATA_VERSION) {
    return { scope, errors: [issue('UNSUPPORTED_INSTRUMENT_PROTOCOL', 'Instrument data protocol or version is unsupported.', `${shape.id}.data.instrument`)] };
  }
  if (!Array.isArray(raw.bindings)) return { scope, errors: [issue('INVALID_INSTRUMENT_BINDINGS', 'Instrument data bindings must be an array.', `${shape.id}.data.instrument.bindings`)] };
  if (raw.bindings.length > DEFAULT_INSTRUMENT_LIMITS.max_bindings) {
    return { scope, errors: [issue('GRAPH_BINDING_LIMIT', 'Instrument binding budget exceeded.', `${shape.id}.data.instrument.bindings`)] };
  }
  const parsed = parseInstrumentInstanceRecord(raw.record);
  if (!parsed.ok || !parsed.value) return { scope, errors: parsed.errors.map((entry) => ({ ...entry, path: `${shape.id}.data.instrument.record${entry.path ? `.${entry.path}` : ''}` })) };
  if (parsed.value.shape_id !== shape.id) {
    return { scope, errors: [issue('SHAPE_ID_MISMATCH', 'Instrument record shape_id must match its owning surface block id.', `${shape.id}.data.instrument.record.shape_id`)] };
  }
  const safeRecord = copyInspectableRecord(parsed.value);
  if (!safeRecord) {
    return { scope, errors: [issue('INVALID_INSTRUMENT_VALUES', 'Instrument record values must be bounded, declared, and type-compatible.', `${shape.id}.data.instrument.record`)] };
  }
  const parsedBindings = parseInstrumentGraph({ instances: [safeRecord], bindings: raw.bindings });
  if (!parsedBindings.ok || !parsedBindings.value) {
    return {
      scope,
      errors: parsedBindings.errors.map((entry) => ({
        ...entry,
        path: `${shape.id}.data.instrument.bindings${entry.path ? `.${entry.path}` : ''}`,
      })),
    };
  }
  return {
    scope,
    value: {
      protocol: INSTRUMENT_PROTOCOL,
      version: INSTRUMENT_DATA_VERSION,
      recipe_instance_id: scope,
      record: safeRecord,
      bindings: parsedBindings.value.bindings,
    },
    errors: [],
  };
}

function copyBindings(bindings: readonly InstrumentBinding[]) {
  return bindings.map((binding) => ({
    ...(binding.id ? { id: binding.id } : {}),
    source: { ...binding.source },
    target: { ...binding.target },
  }));
}

function copyInspectableValue(value: unknown, expectedType: InstrumentPort['value_type']): InstrumentValue | undefined {
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (expectedType === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (expectedType === 'string') return typeof value === 'string' && value.length <= FORMULA_LIMITS.max_string_length ? value : undefined;
  if (expectedType === 'chart') {
    if (!isRecord(value) || value.kind !== 'chart' || !Array.isArray(value.series) || value.series.length > FORMULA_LIMITS.max_collection_size) return undefined;
    const series = value.series.map((point) => {
      if (!isRecord(point) || typeof point.label !== 'string' || point.label.length > FORMULA_LIMITS.max_string_length || typeof point.value !== 'number' || !Number.isFinite(point.value)) return undefined;
      return { label: point.label, value: point.value };
    });
    return series.every((point): point is { label: string; value: number } => point !== undefined) ? { kind: 'chart', series } : undefined;
  }
  if (expectedType === 'table') {
    if (!isRecord(value) || value.kind !== 'table' || !Array.isArray(value.columns) || !Array.isArray(value.rows) || value.columns.length > FORMULA_LIMITS.max_collection_size || value.rows.length > FORMULA_LIMITS.max_collection_size) return undefined;
    if (value.columns.some((column) => typeof column !== 'string' || column.length > FORMULA_LIMITS.max_string_length)) return undefined;
    const rows = value.rows.map((row) => {
      if (!Array.isArray(row) || row.length > FORMULA_LIMITS.max_collection_size || row.some((cell) => typeof cell !== 'string' || cell.length > FORMULA_LIMITS.max_string_length)) return undefined;
      return [...row] as string[];
    });
    return rows.every((row): row is string[] => row !== undefined) ? { kind: 'table', columns: [...value.columns], rows } : undefined;
  }
  return undefined;
}

function copyInspectableValues(
  values: Readonly<Record<string, unknown>> | undefined,
  ports: readonly InstrumentPort[],
): { ok: true; value?: Readonly<Record<string, unknown>> } | { ok: false } {
  if (values === undefined) return { ok: true };
  const keys = ownKeysWithinLimit(values, FORMULA_LIMITS.max_collection_size);
  if (!keys) return { ok: false };
  const portsByName = new Map(ports.map((port) => [port.name, port]));
  const copied: Record<string, unknown> = {};
  for (const key of keys) {
    const port = portsByName.get(key);
    if (!port) return { ok: false };
    const value = copyInspectableValue(values[key], port.value_type);
    if (value === undefined) return { ok: false };
    Object.defineProperty(copied, key, { configurable: true, enumerable: true, value, writable: true });
  }
  return { ok: true, value: copied };
}

function copyInspectableRecord(record: InstrumentInstanceRecord): InstrumentInstanceRecord | undefined {
  const inputValues = copyInspectableValues(record.input_values, record.ports.inputs);
  const outputValues = copyInspectableValues(record.output_values, record.ports.outputs);
  if (!inputValues.ok || !outputValues.ok) return undefined;
  return {
    ...record,
    ...(record.input_values !== undefined ? { input_values: inputValues.value } : {}),
    ...(record.output_values !== undefined ? { output_values: outputValues.value } : {}),
  };
}

function makeScopedGraph(recipeInstanceId: string, shapeIds: Readonly<Record<string, string>>): InstrumentGraph | undefined {
  if (!boundedScope(recipeInstanceId)) return undefined;
  if (COMPARE_INSTANCE_IDS.some((id) => typeof shapeIds[id] !== 'string' || shapeIds[id].length === 0 || shapeIds[id] === id)) return undefined;
  const instances = COMPARE_DECIDE_FIXTURE.instances.map((instance) => ({
    ...instance,
    shape_id: shapeIds[instance.id],
    ports: {
      inputs: instance.ports.inputs.map((port) => ({ ...port })),
      outputs: instance.ports.outputs.map((port) => ({ ...port })),
    },
    ...(instance.input_values ? { input_values: { ...instance.input_values } } : {}),
  }));
  const bindings = COMPARE_DECIDE_FIXTURE.bindings.map((binding) => ({
    ...binding,
    id: `${recipeInstanceId}:${binding.id ?? 'binding'}`.slice(0, 120),
    source: { ...binding.source },
    target: { ...binding.target },
  }));
  const graph = { instances, bindings };
  return validateInstrumentGraph(graph).ok ? graph : undefined;
}

function compareBlockDataFor(record: InstrumentInstanceRecord, baseData: unknown = {}): JsonRecord {
  const data = cloneData(baseData);
  if (record.type === 'slider') {
    const value = record.input_values?.value;
    if (record.id.startsWith('compare:weight:')) {
      data.min = 0;
      data.max = 1;
      data.step = 0.1;
    } else {
      data.min = 0;
      data.max = 100;
      data.step = 1;
    }
    if (typeof value === 'number' && Number.isFinite(value)) data.control_value = value;
  }
  return data;
}

function outputDisplay(patch: InstrumentGraphEvaluation['patches'][number], kind: InstrumentBlockPatch['kind'], currentValue: unknown): { value: string; dataChanges: JsonRecord } {
  const dataChanges: JsonRecord = {};
  if (patch.status !== 'ok') return { value: patch.status === 'stale' ? 'Stale' : 'Invalid', dataChanges: kind === 'chart' ? { series: [] } : dataChanges };
  if (kind === 'slider') return { value: patch.value === undefined ? String(currentValue ?? '') : String(patch.value), dataChanges };
  if (isRecord(patch.value) && patch.value.kind === 'chart' && Array.isArray(patch.value.series)) {
    dataChanges.series = patch.value.series.map((point) => ({ label: point.label, value: point.value }));
    return { value: '', dataChanges };
  }
  if (isRecord(patch.value) && patch.value.kind === 'table' && Array.isArray(patch.value.columns) && Array.isArray(patch.value.rows)) {
    dataChanges.columns = [...patch.value.columns];
    dataChanges.rows = patch.value.rows.map((row) => [...row]);
    return { value: '', dataChanges };
  }
  return { value: patch.formatted ?? formatInstrumentValue(patch.value), dataChanges };
}

function blockKind(shape: InstrumentShapeLike, record: InstrumentInstanceRecord): InstrumentBlockPatch['kind'] {
  if (shape.props?.kind === 'chart' || record.type === 'chart') return 'chart';
  if (shape.props?.kind === 'slider' || record.type === 'slider') return 'slider';
  return 'metric';
}

function buildBlockPatches(
  shapes: readonly InstrumentShapeLike[],
  graph: InstrumentGraph,
  evaluation: InstrumentGraphEvaluation,
  recipeInstanceId: string,
): InstrumentBlockPatch[] {
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const recordById = new Map(graph.instances.map((record) => [record.id, record]));
  const patchByShapeId = new Map<string, InstrumentGraphEvaluation['patches'][number]>();
  evaluation.patches.forEach((patch) => {
    if (patch.shape_id) patchByShapeId.set(patch.shape_id, patch);
  });
  const result: InstrumentBlockPatch[] = [];
  for (const patch of evaluation.patches) {
    if (!patch.shape_id) continue;
    const shape = shapeById.get(patch.shape_id);
    const record = recordById.get(patch.instance_id);
    if (!shape || !record) continue;
    const kind = blockKind(shape, record);
    const currentData = parseData(shape.props?.data);
    const currentValue = shape.props?.value;
    const display = outputDisplay(patch, kind, currentValue);
    const instrumentRecord = { ...record, ports: { inputs: [...record.ports.inputs], outputs: [...record.ports.outputs] } };
    const preservedData = typeof shape.props?.data === 'string' ? currentData : {};
    const nextData = { ...preservedData, ...compareBlockDataFor(record, currentData), ...display.dataChanges };
    nextData.instrument = {
      protocol: INSTRUMENT_PROTOCOL,
      version: INSTRUMENT_DATA_VERSION,
      recipe_instance_id: recipeInstanceId,
      record: instrumentRecord,
      bindings: copyBindings(graph.bindings),
    } satisfies StoredInstrumentData;
    result.push({ shape_id: patch.shape_id, kind, value: display.value, data: JSON.stringify(nextData), status: patch.status });
  }
  return result;
}

/** Build a host-owned Compare fixture scope after tldraw shape IDs exist. */
export function createCompareInstrumentScope(
  recipeInstanceId: string,
  shapeIds: Readonly<Record<string, string>>,
): CompareInstrumentScope {
  const graph = makeScopedGraph(recipeInstanceId, shapeIds);
  if (!graph) {
    const emptyEvaluation: InstrumentGraphEvaluation = { status: 'invalid', order: [], affected_instance_ids: [], results: {}, patches: [], errors: [issue('INVALID_COMPARE_SCOPE', 'Compare instrument scope could not be constructed safely.')] };
    return { status: 'invalid', recipe_instance_id: recipeInstanceId, graph: { instances: [], bindings: [] }, evaluation: emptyEvaluation, blocks: [], errors: emptyEvaluation.errors };
  }
  const evaluation = evaluateInstrumentGraph(graph);
  const shapes: InstrumentShapeLike[] = graph.instances.map((record) => ({ id: record.shape_id!, type: 'surface-block', props: { kind: record.type === 'slider' ? 'slider' : record.type === 'chart' ? 'chart' : 'metric', value: record.input_values?.value ?? '', data: '{}' } }));
  const blocks = buildBlockPatches(shapes, graph, evaluation, recipeInstanceId).map((patch) => {
    if (patch.kind === 'slider') {
      const record = graph.instances.find((instance) => instance.shape_id === patch.shape_id);
      const value = record?.input_values?.value;
      return { ...patch, value: typeof value === 'number' ? String(value) : patch.value };
    }
    return patch;
  });
  return { status: evaluation.status === 'ok' ? 'ok' : 'invalid', recipe_instance_id: recipeInstanceId, graph, evaluation, blocks, errors: evaluation.errors };
}

/** Map the ordered Compare recipe blocks to pure-fixture semantic instances. */
export function compareShapeIdsFromRecipeBlocks(blockIds: readonly string[]): Record<string, string> {
  const map: Record<string, string> = {};
  COMPARE_INSTANCE_IDS.forEach((instanceId, index) => {
    const shapeId = blockIds[index + 2];
    if (typeof shapeId === 'string') map[instanceId] = shapeId;
  });
  return map;
}

/** Parse and validate one complete scope from surface-block JSON data. */
export function collectInstrumentScope(shapes: readonly InstrumentShapeLike[], recipeInstanceId?: string): InstrumentScopeCollection {
  const records = new Map<string, InstrumentInstanceRecord>();
  const bindings = new Map<string, InstrumentBinding>();
  const matchingShapes: InstrumentShapeLike[] = [];
  const errors: InstrumentIssue[] = [];
  let selectedScope = boundedScope(recipeInstanceId ?? '');
  for (const shape of shapes) {
    const parsed = parseStoredInstrument(shape);
    if (parsed.errors.length > 0) {
      if (!selectedScope || parsed.scope === selectedScope) errors.push(...parsed.errors);
      continue;
    }
    if (!parsed.value || !parsed.scope) continue;
    if (!selectedScope) selectedScope = parsed.scope;
    if (parsed.scope !== selectedScope) continue;
    matchingShapes.push(shape);
    const existing = records.get(parsed.value.record.id);
    if (existing && stableKey(existing) !== stableKey(parsed.value.record)) errors.push(issue('DUPLICATE_INSTANCE', `Scope contains conflicting record ${parsed.value.record.id}.`));
    else records.set(parsed.value.record.id, parsed.value.record);
    for (const binding of parsed.value.bindings) {
      const key = stableKey(binding);
      if (!bindings.has(key)) bindings.set(key, binding);
    }
  }
  if (!selectedScope || records.size === 0) return { status: 'legacy', ...(selectedScope ? { recipe_instance_id: selectedScope } : {}), shapes: [], errors };
  if (errors.length > 0) return { status: 'invalid', recipe_instance_id: selectedScope, shapes: matchingShapes, errors };
  const graph = { instances: [...records.values()], bindings: [...bindings.values()] };
  const validation = validateInstrumentGraph(graph);
  if (!validation.ok || !validation.graph) return { status: 'invalid', recipe_instance_id: selectedScope, shapes: matchingShapes, errors: validation.errors };
  return { status: 'ok', recipe_instance_id: selectedScope, shapes: matchingShapes, graph: validation.graph, errors: [] };
}

function shapeIsEffectivelyLocked(shapeId: string, shapes: readonly InstrumentShapeLike[]) {
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  const direct = byId.get(shapeId);
  if (direct?.is_locked === true) return true;
  const visited = new Set<string>();
  let parentId = direct?.parent_id;
  while (typeof parentId === 'string' && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    if (parent.is_locked === true) return true;
    parentId = parent.parent_id;
  }
  return false;
}

function changeValue(value: unknown): InstrumentChangeValue {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'boolean' || typeof value === 'string') return typeof value === 'string' ? value.slice(0, FORMULA_LIMITS.max_string_length) : value;
  if (isRecord(value) && value.kind === 'chart' && Array.isArray(value.series)) {
    return {
      kind: 'chart',
      series: value.series.slice(0, FORMULA_LIMITS.max_collection_size).flatMap((point) => {
        if (!isRecord(point) || typeof point.label !== 'string' || !isFiniteNumber(point.value)) return [];
        return [{ label: point.label.slice(0, FORMULA_LIMITS.max_string_length), value: point.value }];
      }),
    };
  }
  if (isRecord(value) && value.kind === 'table' && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      kind: 'table',
      columns: value.columns.slice(0, FORMULA_LIMITS.max_collection_size).filter((column): column is string => typeof column === 'string').map((column) => column.slice(0, FORMULA_LIMITS.max_string_length)),
      rows: value.rows.slice(0, FORMULA_LIMITS.max_collection_size).flatMap((row) => Array.isArray(row) ? [row.slice(0, FORMULA_LIMITS.max_collection_size).filter((cell): cell is string => typeof cell === 'string').map((cell) => cell.slice(0, FORMULA_LIMITS.max_string_length))] : []),
    };
  }
  return null;
}

function shapeLabel(shape: InstrumentShapeLike | undefined, fallback: string, portName?: string, multiplePorts = false) {
  const title = typeof shape?.props?.title === 'string' && shape.props.title.trim() ? shape.props.title.trim().slice(0, 180) : fallback;
  return multiplePorts && portName ? `${title} · ${portName}`.slice(0, 200) : title;
}

function evaluationOutput(evaluation: InstrumentGraphEvaluation, instanceId: string, portName: string): InstrumentChangeValue {
  const output = evaluation.results[instanceId]?.outputs[portName];
  return output?.status === 'ok' && output.value !== undefined ? changeValue(output.value) : null;
}

function buildInstrumentChanges(
  shapes: readonly InstrumentShapeLike[],
  graph: InstrumentGraph,
  before: InstrumentGraphEvaluation,
  after: InstrumentGraphEvaluation,
  changes: readonly InstrumentInputChange[],
  recipeInstanceId: string,
): InstrumentChangeScope[] {
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const recordByShapeId = new Map(graph.instances.flatMap((record) => record.shape_id ? [[record.shape_id, record] as const] : []));
  const controls = changes
    .map((change) => {
      const record = recordByShapeId.get(change.id);
      const port = record?.ports.inputs[0];
      const beforeValue = record && port ? record.input_values?.[port.name] : undefined;
      return {
        id: change.id,
        label: shapeLabel(shapeById.get(change.id), record?.id ?? change.id),
        before: changeValue(beforeValue),
        after: changeValue(change.value),
      } satisfies InstrumentChangeEntry;
    })
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const affected = new Set(after.affected_instance_ids);
  const derived: InstrumentChangeEntry[] = [];
  for (const record of graph.instances) {
    if (!affected.has(record.id) || record.type === 'slider' || !record.shape_id) continue;
    const shape = shapeById.get(record.shape_id);
    const multiplePorts = record.ports.outputs.length > 1;
    for (const port of record.ports.outputs) {
      derived.push({
        id: record.shape_id,
        label: shapeLabel(shape, record.id, port.name, multiplePorts),
        before: evaluationOutput(before, record.id, port.name),
        after: evaluationOutput(after, record.id, port.name),
      });
    }
  }
  derived.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : left.label < right.label ? -1 : left.label > right.label ? 1 : 0);
  return [{ recipe_instance_id: recipeInstanceId, controls, derived }];
}

function invalidInstrumentInputResult(
  errors: readonly InstrumentIssue[],
  recipeInstanceId?: string,
  scopeShapeIds?: readonly string[],
  beforeEvaluation?: InstrumentGraphEvaluation,
  afterEvaluation?: InstrumentGraphEvaluation,
  status: InstrumentInputChangeResult['status'] = 'invalid',
): InstrumentInputChangeResult {
  return {
    status,
    ...(recipeInstanceId ? { recipe_instance_id: recipeInstanceId } : {}),
    ...(scopeShapeIds ? { scope_shape_ids: scopeShapeIds } : {}),
    ...(beforeEvaluation ? { before_evaluation: beforeEvaluation } : {}),
    ...(afterEvaluation ? { after_evaluation: afterEvaluation } : {}),
    instrument_changes: [],
    patches: [],
    errors: [...errors],
  };
}

function parseInputChanges(raw: unknown): { changes: InstrumentInputChange[]; errors: InstrumentIssue[] } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12) {
    return { changes: [], errors: [issue('INVALID_CHANGE_COUNT', 'Instrument input changes must contain 1-12 entries.', 'changes')] };
  }
  const changes: InstrumentInputChange[] = [];
  const errors: InstrumentIssue[] = [];
  const ids = new Set<string>();
  raw.forEach((entry, index) => {
    const path = `changes[${index}]`;
    if (!isRecord(entry) || !Object.keys(entry).every((key) => key === 'id' || key === 'value')) {
      errors.push(issue('INVALID_CHANGE', 'Each instrument input change needs only an exact id and finite numeric value.', path));
      return;
    }
    if (typeof entry.id !== 'string' || entry.id.length === 0 || entry.id.length > 180) {
      errors.push(issue('INVALID_CHANGE_ID', 'Instrument input change ids must be bounded non-empty strings.', `${path}.id`));
      return;
    }
    if (ids.has(entry.id)) {
      errors.push(issue('DUPLICATE_TARGET', 'An instrument input id may appear only once.', `${path}.id`));
      return;
    }
    ids.add(entry.id);
    if (!isFiniteNumber(entry.value)) {
      errors.push(issue('INVALID_CONTROL_VALUE', 'Instrument input changes require finite numeric values.', `${path}.value`));
      return;
    }
    changes.push({ id: entry.id, value: entry.value });
  });
  if (errors.length === 0 && changes.length !== raw.length) {
    errors.push(issue('INVALID_CHANGE', 'Instrument input changes cannot contain omitted or sparse entries.', 'changes'));
  }
  return { changes, errors };
}

/** Preview a bounded all-or-nothing multi-input change without mutating shapes. */
export function applyInstrumentInputChanges(
  shapes: readonly InstrumentShapeLike[],
  rawChanges: unknown,
): InstrumentInputChangeResult {
  const parsedChanges = parseInputChanges(rawChanges);
  if (parsedChanges.errors.length > 0) return invalidInstrumentInputResult(parsedChanges.errors);
  const changes = parsedChanges.changes;
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const owners = changes.map((change, index) => {
    const path = `changes[${index}]`;
    const shape = shapeById.get(change.id);
    if (!shape) return { change, shape, errors: [issue('UNKNOWN_TARGET', 'Instrument input target does not exist on the current page.', `${path}.id`)] };
    if (shape.type !== 'surface-block') return { change, shape, errors: [issue('TARGET_NOT_SURFACE_BLOCK', 'Instrument input targets must be surface-blocks.', `${path}.id`)] };
    if (shape.props?.kind !== 'slider') return { change, shape, errors: [issue('TARGET_NOT_SLIDER', 'Instrument input targets must be slider surface-blocks.', `${path}.id`)] };
    if (shapeIsEffectivelyLocked(change.id, shapes)) return { change, shape, errors: [issue('LOCKED_TARGET', 'Locked instrument controls or controls under a locked ancestor cannot change.', `${path}.id`)] };
    const parsed = parseStoredInstrument(shape);
    if (parsed.errors.length > 0 || !parsed.value || !parsed.scope) return { change, shape, errors: parsed.errors.length > 0 ? parsed.errors : [issue('INVALID_INSTRUMENT_DATA', 'Instrument input target does not contain validated instrument data.', `${path}.id`)] };
    const data = parseData(shape.props?.data);
    if (!isFiniteNumber(data.min) || !isFiniteNumber(data.max) || data.min > data.max) return { change, shape, scope: parsed.scope, parsed: parsed.value, errors: [issue('INVALID_DECLARED_RANGE', 'Instrument slider targets require finite declared min and max values.', `${path}.id`)] };
    if (change.value < data.min || change.value > data.max) return { change, shape, scope: parsed.scope, parsed: parsed.value, errors: [issue('OUT_OF_RANGE', `Instrument input must remain between ${data.min} and ${data.max}.`, `${path}.value`)] };
    return { change, shape, scope: parsed.scope, parsed: parsed.value, errors: [] };
  });
  const targetErrors = owners.flatMap((owner) => owner.errors);
  if (targetErrors.length > 0) return invalidInstrumentInputResult(targetErrors);
  const recipeInstanceId = owners[0].scope!;
  if (owners.some((owner) => owner.scope !== recipeInstanceId)) return invalidInstrumentInputResult([issue('MIXED_SCOPE', 'All instrument input targets must belong to one recipe-instance scope.')]);
  const collection = collectInstrumentScope(shapes, recipeInstanceId);
  const scopeShapeIds = collection.shapes.map((shape) => shape.id);
  if (collection.status !== 'ok') return invalidInstrumentInputResult(collection.errors.length > 0 ? collection.errors : [issue('INVALID_SCOPE', 'Instrument input scope is not valid.')], recipeInstanceId, scopeShapeIds);
  const recordByShapeId = new Map(collection.graph.instances.flatMap((record) => record.shape_id ? [[record.shape_id, record] as const] : []));
  const nextValues = new Map<string, number>();
  for (const owner of owners) {
    const record = recordByShapeId.get(owner.change.id);
    if (!record || record.type !== 'slider' || record.ports.inputs.length !== 1 || record.ports.inputs[0].direction !== 'input' || record.ports.inputs[0].value_type !== 'number') {
      return invalidInstrumentInputResult([issue('INVALID_INPUT_CONTROL', 'Instrument input targets require one declared numeric input port.', `changes[${changes.findIndex((change) => change.id === owner.change.id)}].id`)], recipeInstanceId, scopeShapeIds);
    }
    const input = record.ports.inputs[0];
    if (collection.graph.bindings.some((binding) => binding.target.instance_id === record.id && binding.target.port === input.name)) {
      return invalidInstrumentInputResult([issue('BOUND_INPUT_CONTROL', 'Instrument input targets cannot be driven by an inbound binding.', `changes[${changes.findIndex((change) => change.id === owner.change.id)}].id`)], recipeInstanceId, scopeShapeIds);
    }
    const beforeValue = record.input_values?.[input.name];
    if (!isFiniteNumber(beforeValue)) return invalidInstrumentInputResult([issue('INVALID_CURRENT_VALUE', 'Instrument input controls require a finite current numeric value.', `changes[${changes.findIndex((change) => change.id === owner.change.id)}].id`)], recipeInstanceId, scopeShapeIds);
    if (owner.change.value === beforeValue) return invalidInstrumentInputResult([issue('NO_OP', 'Instrument input change does not change the current value.', `changes[${changes.findIndex((change) => change.id === owner.change.id)}].value`)], recipeInstanceId, scopeShapeIds);
    nextValues.set(record.id, owner.change.value);
  }
  const beforeEvaluation = evaluateInstrumentGraph(collection.graph);
  if (beforeEvaluation.status !== 'ok') {
    return invalidInstrumentInputResult(beforeEvaluation.errors, recipeInstanceId, scopeShapeIds, beforeEvaluation, undefined, beforeEvaluation.status);
  }
  const nextGraph: InstrumentGraph = {
    instances: collection.graph.instances.map((record) => {
      const nextValue = nextValues.get(record.id);
      return nextValue === undefined ? record : { ...record, input_values: { ...(record.input_values ?? {}), [record.ports.inputs[0].name]: nextValue } };
    }),
    bindings: collection.graph.bindings,
  };
  const afterEvaluation = evaluateInstrumentGraph(nextGraph, { changed_instance_ids: [...nextValues.keys()] });
  if (afterEvaluation.status !== 'ok') {
    return invalidInstrumentInputResult(afterEvaluation.errors, recipeInstanceId, scopeShapeIds, beforeEvaluation, afterEvaluation, afterEvaluation.status);
  }
  const patches = buildBlockPatches(collection.shapes, nextGraph, afterEvaluation, recipeInstanceId);
  const patchShapeIds = patches.map((patch) => patch.shape_id);
  if (new Set(patchShapeIds).size !== patchShapeIds.length) {
    return invalidInstrumentInputResult([issue('DUPLICATE_PATCH_TARGET', 'Instrument evaluation produced more than one patch for the same page shape.')], recipeInstanceId, scopeShapeIds, beforeEvaluation, afterEvaluation);
  }
  const lockedPatch = patches.find((patch) => shapeIsEffectivelyLocked(patch.shape_id, shapes));
  if (lockedPatch) {
    return invalidInstrumentInputResult(
      [issue('LOCKED_PATCH_TARGET', 'Every affected instrument block must be unlocked and outside locked ancestors before this scenario can be staged.', `${lockedPatch.shape_id}.is_locked`)],
      recipeInstanceId,
      scopeShapeIds,
      beforeEvaluation,
      afterEvaluation,
    );
  }
  if (patches.length === 0 || patches.some((patch) => patch.status !== 'ok')) {
    return invalidInstrumentInputResult([issue('PATCH_SET_INVALID', 'Instrument evaluation did not produce a complete valid patch set.')], recipeInstanceId, scopeShapeIds, beforeEvaluation, afterEvaluation);
  }
  const instrumentChanges = buildInstrumentChanges(collection.shapes, collection.graph, beforeEvaluation, afterEvaluation, changes, recipeInstanceId);
  return {
    status: 'ok',
    recipe_instance_id: recipeInstanceId,
    scope_shape_ids: scopeShapeIds,
    before_evaluation: beforeEvaluation,
    after_evaluation: afterEvaluation,
    instrument_changes: instrumentChanges,
    patches,
    errors: [],
  };
}

/** Alias emphasizing that this seam is a side-effect-free scenario preview. */
export const previewInstrumentInputChanges = applyInstrumentInputChanges;

/** Apply a typed control change to one scope, returning deterministic block patches only. */
export function applyInstrumentControlChange(
  shapes: readonly InstrumentShapeLike[],
  shapeId: string,
  rawValue: unknown,
): InstrumentControlResult {
  const owner = shapes.find((shape) => shape.id === shapeId);
  if (!owner || !('instrument' in parseData(owner.props?.data))) return { status: 'legacy', patches: [], errors: [] };
  const parsedOwner = parseStoredInstrument(owner);
  const collection = collectInstrumentScope(shapes, parsedOwner.scope);
  if (collection.status !== 'ok') return { status: 'invalid', recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), patches: [], errors: collection.errors.length > 0 ? collection.errors : [issue('INVALID_SCOPE', 'Instrument scope is not valid.')] };
  const instance = collection.graph.instances.find((record) => record.shape_id === shapeId);
  if (!instance || instance.ports.inputs.length === 0) return { status: 'invalid', recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), patches: [], errors: [issue('NOT_INPUT_CONTROL', 'The selected instrument has no editable input port.')] };
  const input = instance.ports.inputs[0];
  let value: InstrumentValue;
  if (input.value_type === 'number') {
    if (typeof rawValue === 'number') value = rawValue;
    else if (typeof rawValue === 'string' && rawValue.trim() !== '' && Number.isFinite(Number(rawValue))) value = Number(rawValue);
    else return { status: 'invalid', recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), patches: [], errors: [issue('INVALID_CONTROL_VALUE', 'Numeric instrument controls require a finite number.')] };
    const scenario = applyInstrumentInputChanges(shapes, [{ id: shapeId, value }]);
    return {
      status: scenario.status,
      ...(scenario.recipe_instance_id ? { recipe_instance_id: scenario.recipe_instance_id } : {}),
      ...(scenario.scope_shape_ids ? { scope_shape_ids: scenario.scope_shape_ids } : {}),
      ...(scenario.after_evaluation ? { evaluation: scenario.after_evaluation } : {}),
      ...(scenario.instrument_changes.length > 0 ? { instrument_changes: scenario.instrument_changes } : {}),
      patches: scenario.patches,
      errors: scenario.errors,
    };
  } else if (input.value_type === 'boolean') {
    if (typeof rawValue === 'boolean') value = rawValue;
    else if (rawValue === 'true' || rawValue === 'false') value = rawValue === 'true';
    else return { status: 'invalid', recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), patches: [], errors: [issue('INVALID_CONTROL_VALUE', 'Boolean instrument controls require true or false.')] };
  } else if (input.value_type === 'string' && typeof rawValue === 'string') value = rawValue;
  else return { status: 'invalid', recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), patches: [], errors: [issue('INVALID_CONTROL_VALUE', `Control value does not match the ${input.value_type} input type.`)] };
  const graph: InstrumentGraph = {
    instances: collection.graph.instances.map((record) => record.id === instance.id
      ? { ...record, input_values: { ...(record.input_values ?? {}), [input.name]: value } }
      : record),
    bindings: collection.graph.bindings,
  };
  const evaluation = evaluateInstrumentGraph(graph, { changed_instance_ids: [instance.id] });
  const patches = buildBlockPatches(collection.shapes, graph, evaluation, collection.recipe_instance_id);
  return { status: evaluation.status, recipe_instance_id: collection.recipe_instance_id, scope_shape_ids: collection.shapes.map((shape) => shape.id), evaluation, patches, errors: evaluation.errors };
}

/** Return a record's evaluated status for renderers without mutating the page. */
export function instrumentStatusForShape(shapes: readonly InstrumentShapeLike[], shapeId: string): 'ok' | 'stale' | 'invalid' | undefined {
  const owner = shapes.find((shape) => shape.id === shapeId);
  if (!owner) return undefined;
  const parsed = parseStoredInstrument(owner);
  if (!parsed.value || parsed.errors.length > 0) return parsed.errors.length > 0 ? 'invalid' : undefined;
  const collection = collectInstrumentScope(shapes, parsed.scope);
  if (collection.status !== 'ok') return 'invalid';
  const instance = collection.graph.instances.find((record) => record.shape_id === shapeId);
  if (!instance) return 'invalid';
  const evaluation = evaluateInstrumentGraph(collection.graph);
  return evaluation.results[instance.id]?.status;
}

/** Expose only validated, bounded storage data at the inspect seam. */
export function inspectInstrumentData(shape: InstrumentShapeLike): StoredInstrumentData | undefined {
  const parsed = parseStoredInstrument(shape);
  if (!parsed.value || parsed.errors.length > 0) return undefined;
  if (parsed.value.bindings.length > DEFAULT_INSTRUMENT_LIMITS.max_bindings) return undefined;
  const record = copyInspectableRecord(parsed.value.record);
  if (!record) return undefined;
  const recordValidation = validateInstrumentGraph({ instances: [record], bindings: [] });
  if (!recordValidation.ok) return undefined;
  // Inspect receives one block, while a Compare block stores the complete
  // scope's bindings. Parse the exact binding payload so malformed entries
  // cannot be copied, without requiring the other scope records at this seam.
  const graph = parseInstrumentGraph({ instances: [record], bindings: parsed.value.bindings });
  if (!graph.ok || !graph.value) return undefined;
  return {
    protocol: INSTRUMENT_PROTOCOL,
    version: INSTRUMENT_DATA_VERSION,
    recipe_instance_id: parsed.value.recipe_instance_id,
    record,
    bindings: copyBindings(graph.value.bindings),
  };
}

export function instrumentDataForRecord(
  record: InstrumentInstanceRecord,
  recipeInstanceId: string,
  bindings: readonly InstrumentBinding[],
  baseData: unknown = {},
): string {
  return recordForStorage(record, recipeInstanceId, bindings, { ...compareBlockDataFor(record, baseData), ...cloneData(baseData) });
}
