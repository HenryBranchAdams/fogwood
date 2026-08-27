import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPARE_DECIDE_FIXTURE,
  DEFAULT_INSTRUMENT_LIMITS,
  FORMULA_LIMITS,
  createCompareDecideFixture,
  evaluateFormula,
  evaluateInstrumentGraph,
  formatInstrumentValue,
  parseInstrumentGraph,
  parseInstrumentInstanceRecord,
  recomputeCompareDecide,
  validateInstrumentGraph,
} from '../app/fogwood-instruments.ts';

const numberPort = (name, direction = 'input') => ({
  name,
  direction,
  value_type: 'number',
});

const baseInstance = (id, inputs = [], outputs = [], extra = {}) => ({
  id,
  type: 'test-instrument',
  version: 1,
  ports: { inputs, outputs },
  input_values: {},
  ...extra,
});

const literal = (value) => ({ type: 'literal', value });
const ref = (path) => ({ type: 'ref', path });

test('formula AST computes exact typed results with deterministic formatting', () => {
  const result = evaluateFormula(
    {
      type: 'binary',
      op: 'div',
      left: {
        type: 'binary',
        op: 'add',
        left: ref('left'),
        right: ref('right'),
      },
      right: literal(3),
    },
    { left: 1, right: 5 },
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.value, 2);
  assert.equal(result.formatted, '2.00');
  assert.deepEqual(result.metrics, { nodes: 5, depth: 3, operations: 2 });
  assert.equal(formatInstrumentValue(2), '2.00');
  assert.equal(formatInstrumentValue(true), 'true');
  assert.equal(formatInstrumentValue('Alpha'), 'Alpha');
});

test('formula AST reports stale missing input and invalid type/division/non-finite results', () => {
  const stale = evaluateFormula({ type: 'binary', op: 'add', left: ref('present'), right: ref('missing') }, { present: 2 });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.errors[0].code, 'MISSING_INPUT');

  const mismatch = evaluateFormula({ type: 'binary', op: 'add', left: ref('text'), right: literal(1) }, { text: 'one' });
  assert.equal(mismatch.status, 'invalid');
  assert.equal(mismatch.errors[0].code, 'TYPE_MISMATCH');

  const division = evaluateFormula({ type: 'binary', op: 'div', left: literal(1), right: literal(0) }, {});
  assert.equal(division.status, 'invalid');
  assert.equal(division.errors[0].code, 'DIVISION_BY_ZERO');

  const overflow = evaluateFormula({ type: 'binary', op: 'mul', left: literal(Number.MAX_VALUE), right: literal(2) }, {});
  assert.equal(overflow.status, 'invalid');
  assert.equal(overflow.errors[0].code, 'NON_FINITE');
});

test('formula AST enforces node, depth, operation, string, and collection caps without dynamic execution', () => {
  const tooManyNodes = {
    type: 'variadic',
    op: 'sum',
    args: Array.from({ length: FORMULA_LIMITS.max_nodes + 1 }, () => literal(1)),
  };
  const nodes = evaluateFormula(tooManyNodes, {}, {
    ...FORMULA_LIMITS,
    max_collection_size: FORMULA_LIMITS.max_nodes + 1,
  });
  assert.equal(nodes.status, 'invalid');
  assert.equal(nodes.errors[0].code, 'FORMULA_NODE_LIMIT');

  let deep = literal(1);
  for (let index = 0; index < FORMULA_LIMITS.max_depth + 1; index += 1) {
    deep = { type: 'unary', op: 'neg', value: deep };
  }
  const depth = evaluateFormula(deep, {});
  assert.equal(depth.status, 'invalid');
  assert.equal(depth.errors[0].code, 'FORMULA_DEPTH_LIMIT');

  const operations = evaluateFormula(
    { type: 'variadic', op: 'sum', args: Array.from({ length: FORMULA_LIMITS.max_operations + 1 }, () => literal(1)) },
    {},
    {
      ...FORMULA_LIMITS,
      max_collection_size: FORMULA_LIMITS.max_operations + 1,
    },
  );
  assert.equal(operations.status, 'invalid');
  assert.equal(operations.errors[0].code, 'FORMULA_OPERATION_LIMIT');

  const longString = evaluateFormula(literal('x'.repeat(FORMULA_LIMITS.max_string_length + 1)), {});
  assert.equal(longString.status, 'invalid');
  assert.equal(longString.errors[0].code, 'FORMULA_STRING_LIMIT');

  const longChart = evaluateFormula({
    type: 'chart',
    points: Array.from({ length: FORMULA_LIMITS.max_collection_size + 1 }, (_, index) => ({ label: String(index), value: literal(index) })),
  }, {});
  assert.equal(longChart.status, 'invalid');
  assert.equal(longChart.errors[0].code, 'FORMULA_COLLECTION_LIMIT');
});

test('formula AST rejects oversized variadic and table collections before iterating them', () => {
  const sparseArgs = new Array(FORMULA_LIMITS.max_collection_size + 1);
  const sparse = evaluateFormula({ type: 'variadic', op: 'sum', args: sparseArgs }, {});
  assert.equal(sparse.status, 'invalid');
  assert.equal(sparse.errors[0].code, 'FORMULA_COLLECTION_LIMIT');

  let variadicVisited = false;
  const guardedArgs = new Array(FORMULA_LIMITS.max_collection_size + 1);
  Object.defineProperty(guardedArgs, 0, {
    configurable: true,
    enumerable: true,
    get() {
      variadicVisited = true;
      throw new Error('oversized variadic args must not be traversed');
    },
  });
  const guarded = evaluateFormula({ type: 'sum', args: guardedArgs }, {});
  assert.equal(guarded.status, 'invalid');
  assert.equal(guarded.errors[0].code, 'FORMULA_COLLECTION_LIMIT');
  assert.equal(variadicVisited, false);

  let columnsVisited = false;
  const oversizedColumns = new Array(FORMULA_LIMITS.max_collection_size + 1);
  Object.defineProperty(oversizedColumns, 0, {
    configurable: true,
    enumerable: true,
    get() {
      columnsVisited = true;
      throw new Error('oversized table columns must not be traversed');
    },
  });
  const table = evaluateFormula({ type: 'table', columns: oversizedColumns, rows: [] }, {});
  assert.equal(table.status, 'invalid');
  assert.equal(table.errors[0].code, 'FORMULA_COLLECTION_LIMIT');
  assert.equal(columnsVisited, false);
});

test('formula AST accepts chart/table data and rejects cyclic or expression-string input', () => {
  const chart = evaluateFormula({
    type: 'chart',
    points: [{ label: 'Alpha', value: literal(1.234) }, { label: 'Beta', value: literal(5) }],
  }, {});
  assert.equal(chart.status, 'ok');
  assert.deepEqual(chart.value, {
    kind: 'chart',
    series: [{ label: 'Alpha', value: 1.234 }, { label: 'Beta', value: 5 }],
  });

  const table = evaluateFormula({
    type: 'table',
    columns: ['Option', 'Score'],
    rows: [[literal('Alpha'), literal(4.5)]],
  }, {});
  assert.equal(table.status, 'ok');
  assert.deepEqual(table.value, { kind: 'table', columns: ['Option', 'Score'], rows: [['Alpha', '4.50']] });

  const cyclic = { type: 'unary', op: 'neg', value: null };
  cyclic.value = cyclic;
  const cycleResult = evaluateFormula(cyclic, {});
  assert.equal(cycleResult.status, 'invalid');
  assert.equal(cycleResult.errors[0].code, 'CYCLIC_FORMULA');

  const expressionString = evaluateFormula('left + right', { left: 1, right: 2 });
  assert.equal(expressionString.status, 'invalid');
  assert.equal(expressionString.errors[0].code, 'FORMULA_NOT_AST');
});

test('graph validation rejects unknown identities/ports, mismatches, duplicate writers, self-edges, cycles, and oversized graphs', () => {
  const instances = [
    baseInstance('source', [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(1) }]),
    baseInstance('target', [numberPort('input')], []),
  ];
  const valid = { instances, bindings: [{ id: 'binding:1', source: { instance_id: 'source', port: 'value' }, target: { instance_id: 'target', port: 'input' } }] };
  const validation = validateInstrumentGraph(valid);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.topological_order, ['source', 'target']);

  const unknownInstance = validateInstrumentGraph({ ...valid, bindings: [{ ...valid.bindings[0], source: { instance_id: 'missing', port: 'value' } }] });
  assert.equal(unknownInstance.ok, false);
  assert.equal(unknownInstance.errors[0].code, 'UNKNOWN_INSTANCE');

  const unknownPort = validateInstrumentGraph({ ...valid, bindings: [{ ...valid.bindings[0], target: { instance_id: 'target', port: 'missing' } }] });
  assert.equal(unknownPort.ok, false);
  assert.equal(unknownPort.errors[0].code, 'UNKNOWN_PORT');

  const mismatch = validateInstrumentGraph({
    instances: [
      baseInstance('source', [], [{ name: 'value', direction: 'output', value_type: 'string', formula: literal('one') }]),
      baseInstance('target', [numberPort('input')], []),
    ],
    bindings: valid.bindings,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.errors[0].code, 'TYPE_MISMATCH');

  const duplicate = validateInstrumentGraph({ ...valid, bindings: [...valid.bindings, { id: 'binding:2', source: { instance_id: 'source', port: 'value' }, target: { instance_id: 'target', port: 'input' } }] });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors[0].code, 'DUPLICATE_TARGET');

  const self = validateInstrumentGraph({
    instances: [baseInstance('solo', [numberPort('input')], [{ name: 'output', direction: 'output', value_type: 'number', formula: ref('input') }])],
    bindings: [{ source: { instance_id: 'solo', port: 'output' }, target: { instance_id: 'solo', port: 'input' } }],
  });
  assert.equal(self.ok, false);
  assert.equal(self.errors[0].code, 'SELF_EDGE');

  const cycle = validateInstrumentGraph({
    instances: [
      baseInstance('a', [numberPort('in')], [{ name: 'out', direction: 'output', value_type: 'number', formula: ref('in') }]),
      baseInstance('b', [numberPort('in')], [{ name: 'out', direction: 'output', value_type: 'number', formula: ref('in') }]),
    ],
    bindings: [
      { source: { instance_id: 'a', port: 'out' }, target: { instance_id: 'b', port: 'in' } },
      { source: { instance_id: 'b', port: 'out' }, target: { instance_id: 'a', port: 'in' } },
    ],
  });
  assert.equal(cycle.ok, false);
  assert.equal(cycle.errors[0].code, 'CYCLE');

  const oversized = validateInstrumentGraph(valid, { ...DEFAULT_INSTRUMENT_LIMITS, max_instances: 1 });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.errors[0].code, 'GRAPH_INSTANCE_LIMIT');
});

test('graph validation rejects prototype-like identities and duplicate instance ids while preserving stale results', () => {
  for (const reserved of ['__proto__', 'prototype', 'constructor']) {
    const invalidIdentity = validateInstrumentGraph({
      instances: [baseInstance(reserved, [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(1) }])],
      bindings: [],
    });
    assert.equal(invalidIdentity.ok, false, `reserved instance id ${reserved} must be rejected`);
    assert.equal(invalidIdentity.errors.some((entry) => entry.code === 'INVALID_IDENTITY'), true);

    const invalidPort = validateInstrumentGraph({
      instances: [baseInstance('safe-instance', [{ name: reserved, direction: 'input', value_type: 'number' }], [])],
      bindings: [],
    });
    assert.equal(invalidPort.ok, false, `reserved port name ${reserved} must be rejected`);
    assert.equal(invalidPort.errors.some((entry) => entry.code === 'INVALID_PORT'), true);
  }

  const duplicate = validateInstrumentGraph({
    instances: [
      baseInstance('duplicate', [], [{ name: 'first', direction: 'output', value_type: 'number', formula: literal(1) }]),
      baseInstance('duplicate', [], [{ name: 'second', direction: 'output', value_type: 'number', formula: literal(2) }]),
    ],
    bindings: [],
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors.some((entry) => entry.code === 'DUPLICATE_INSTANCE'), true);

  const stale = evaluateInstrumentGraph({
    instances: [baseInstance('stale-instance', [numberPort('input')], [{ name: 'output', direction: 'output', value_type: 'number', formula: ref('input') }])],
    bindings: [],
  });
  assert.equal(stale.status, 'stale');
  assert.equal(Object.hasOwn(stale.results, 'stale-instance'), true);
  assert.equal(stale.results['stale-instance'].status, 'stale');
  assert.equal(stale.results['stale-instance'].outputs.output.status, 'stale');
});

test('caller formula limits apply to referenced and direct scalar, chart, and table values', () => {
  const limits = { max_formula_string_length: 4, max_formula_collection_size: 1 };
  const referencedString = evaluateFormula(ref('text'), { text: 'abcde' }, limits);
  assert.equal(referencedString.status, 'invalid');
  assert.equal(referencedString.errors[0].code, 'FORMULA_STRING_LIMIT');

  const referencedChart = evaluateFormula(ref('c'), {
    c: { kind: 'chart', series: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] },
  }, limits);
  assert.equal(referencedChart.status, 'invalid');
  assert.equal(referencedChart.errors[0].code, 'FORMULA_COLLECTION_LIMIT');

  const referencedChartLabel = evaluateFormula(ref('c'), {
    c: { kind: 'chart', series: [{ label: 'abcde', value: 1 }] },
  }, limits);
  assert.equal(referencedChartLabel.status, 'invalid');
  assert.equal(referencedChartLabel.errors[0].code, 'FORMULA_STRING_LIMIT');

  const referencedTable = evaluateFormula(ref('t'), {
    t: { kind: 'table', columns: ['A', 'B'], rows: [['x', 'y'], ['z', 'q']] },
  }, limits);
  assert.equal(referencedTable.status, 'invalid');
  assert.equal(referencedTable.errors[0].code, 'FORMULA_COLLECTION_LIMIT');

  const referencedTableCell = evaluateFormula(ref('t'), {
    t: { kind: 'table', columns: ['A'], rows: [['abcde']] },
  }, limits);
  assert.equal(referencedTableCell.status, 'invalid');
  assert.equal(referencedTableCell.errors[0].code, 'FORMULA_STRING_LIMIT');

  const inputValue = evaluateInstrumentGraph({
    instances: [baseInstance('input-value', [{ name: 'text', direction: 'input', value_type: 'string' }], [{ name: 'output', direction: 'output', value_type: 'string', formula: ref('text') }], { input_values: { text: 'abcde' } })],
    bindings: [],
  }, { limits });
  assert.equal(inputValue.status, 'invalid');
  assert.equal(inputValue.results['input-value'].inputs.text.errors[0].code, 'FORMULA_STRING_LIMIT');

  const outputValue = evaluateInstrumentGraph({
    instances: [baseInstance('output-value', [], [{ name: 'chart', direction: 'output', value_type: 'chart' }], {
      output_values: { chart: { kind: 'chart', series: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] } },
    })],
    bindings: [],
  }, { limits });
  assert.equal(outputValue.status, 'invalid');
  assert.equal(outputValue.results['output-value'].outputs.chart.errors[0].code, 'FORMULA_COLLECTION_LIMIT');

  const tableOutputValue = evaluateInstrumentGraph({
    instances: [baseInstance('table-output-value', [], [{ name: 'table', direction: 'output', value_type: 'table' }], {
      output_values: { table: { kind: 'table', columns: ['A'], rows: [['abcde']] } },
    })],
    bindings: [],
  }, { limits });
  assert.equal(tableOutputValue.status, 'invalid');
  assert.equal(tableOutputValue.results['table-output-value'].outputs.table.errors[0].code, 'FORMULA_STRING_LIMIT');
});

test('graph validation rejects input formulas and every non-AST formula payload', () => {
  const inputFormula = validateInstrumentGraph({
    instances: [baseInstance('input-formula', [{ name: 'input', direction: 'input', value_type: 'number', formula: 'input + 1' }], [])],
    bindings: [],
  });
  assert.equal(inputFormula.ok, false);
  assert.equal(inputFormula.errors.some((entry) => entry.code === 'INPUT_FORMULA_NOT_ALLOWED'), true);

  const outputExpression = validateInstrumentGraph({
    instances: [baseInstance('output-expression', [], [{ name: 'output', direction: 'output', value_type: 'number', formula: 'input + 1' }])],
    bindings: [],
  });
  assert.equal(outputExpression.ok, false);
  assert.equal(outputExpression.errors.some((entry) => entry.code === 'FORMULA_NOT_AST'), true);

  const formulaMapExpression = validateInstrumentGraph({
    instances: [baseInstance('formula-map-expression', [], [{ name: 'output', direction: 'output', value_type: 'number' }], { formulas: { output: 'input + 1' } })],
    bindings: [],
  });
  assert.equal(formulaMapExpression.ok, false);
  assert.equal(formulaMapExpression.errors.some((entry) => entry.code === 'FORMULA_NOT_AST'), true);

  const shadowedFormulaMapExpression = validateInstrumentGraph({
    instances: [baseInstance('shadowed-formula-map-expression', [], [{ name: 'output', direction: 'output', value_type: 'number', formula: literal(1) }], { formulas: { output: 'input + 1' } })],
    bindings: [],
  });
  assert.equal(shadowedFormulaMapExpression.ok, false);
  assert.equal(shadowedFormulaMapExpression.errors.some((entry) => entry.code === 'FORMULA_NOT_AST'), true);

  const malformedFormulaMap = validateInstrumentGraph({
    instances: [baseInstance('malformed-formula-map', [], [{ name: 'output', direction: 'output', value_type: 'number' }], { formulas: 'input + 1' })],
    bindings: [],
  });
  assert.equal(malformedFormulaMap.ok, false);
  assert.equal(malformedFormulaMap.errors.some((entry) => entry.code === 'INVALID_FORMULAS'), true);
});

test('graph ordering uses deterministic code-unit comparison for non-ASCII identities', () => {
  const graph = {
    instances: [
      baseInstance('é', [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(1) }]),
      baseInstance('Z', [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(2) }]),
      baseInstance('a', [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(3) }]),
    ],
    bindings: [],
  };
  const first = validateInstrumentGraph(graph);
  const second = validateInstrumentGraph({ instances: [...graph.instances].reverse(), bindings: [] });
  assert.equal(first.ok, true);
  assert.deepEqual(first.topological_order, ['Z', 'a', 'é']);
  assert.deepEqual(first.topological_order, second.topological_order);
  assert.deepEqual(first.graph, second.graph);
});

test('graph evaluation is deterministic, cycle-safe, typed, and returns adapter-ready semantic patches', () => {
  const graph = {
    instances: [
      baseInstance('z-target', [numberPort('value')], [{ name: 'double', direction: 'output', value_type: 'number', formula: { type: 'binary', op: 'mul', left: ref('value'), right: literal(2) } }]),
      baseInstance('a-source', [], [{ name: 'value', direction: 'output', value_type: 'number', formula: literal(3) }]),
    ],
    bindings: [{ source: { instance_id: 'a-source', port: 'value' }, target: { instance_id: 'z-target', port: 'value' } }],
  };
  const first = evaluateInstrumentGraph(graph);
  const second = evaluateInstrumentGraph({ instances: [...graph.instances].reverse(), bindings: [...graph.bindings].reverse() });
  assert.equal(first.status, 'ok');
  assert.equal(first.results['z-target'].outputs.double.value, 6);
  assert.deepEqual(first.order, ['a-source', 'z-target']);
  assert.deepEqual(first, second);
  assert.equal(first.patches[0].instance_id, 'a-source');
  assert.equal(first.patches[0].shape_id, undefined);
  assert.equal(first.patches.some((patch) => patch.instance_id === 'z-target' && patch.port === 'double' && patch.value === 6), true);

  const missing = evaluateInstrumentGraph({
    instances: [baseInstance('missing', [numberPort('input')], [{ name: 'output', direction: 'output', value_type: 'number', formula: ref('input') }])],
    bindings: [],
  });
  assert.equal(missing.status, 'stale');
  assert.equal(missing.results.missing.status, 'stale');
  assert.equal(missing.results.missing.outputs.output.status, 'stale');
});

test('stable semantic IDs stay separate from random shape IDs and shape data parses without tldraw', () => {
  const parsed = parseInstrumentInstanceRecord({
    id: 'shape:random-123',
    props: {
      semantic_id: 'instrument:stable-slider',
      instrument_type: 'slider',
      ports: { inputs: [numberPort('value')], outputs: [{ name: 'value', direction: 'output', value_type: 'number' }] },
      input_values: { value: 42 },
    },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.id, 'instrument:stable-slider');
  assert.equal(parsed.value.shape_id, 'shape:random-123');
  assert.notEqual(parsed.value.id, parsed.value.shape_id);

  const collision = parseInstrumentInstanceRecord({
    id: 'same-id',
    props: { semantic_id: 'same-id', instrument_type: 'slider', ports: { inputs: [], outputs: [] } },
  });
  assert.equal(collision.ok, false);
  assert.equal(collision.errors[0].code, 'IDENTITY_COLLISION');
});

test('instance value maps must be omitted or plain records at parser and graph seams', () => {
  const base = {
    id: 'map-record',
    type: 'test-instrument',
    version: 1,
    ports: { inputs: [], outputs: [] },
  };

  const omitted = parseInstrumentInstanceRecord(base);
  assert.equal(omitted.ok, true);
  assert.equal(omitted.value.input_values, undefined);
  assert.equal(omitted.value.output_values, undefined);

  const valid = parseInstrumentInstanceRecord({
    ...base,
    input_values: { value: 42 },
    output_values: { value: 43 },
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.input_values, { value: 42 });
  assert.deepEqual(valid.value.output_values, { value: 43 });

  for (const [field, invalid, code] of [
    ['input_values', null, 'INVALID_INPUT_VALUES'],
    ['input_values', [], 'INVALID_INPUT_VALUES'],
    ['input_values', 'bad', 'INVALID_INPUT_VALUES'],
    ['output_values', null, 'INVALID_OUTPUT_VALUES'],
    ['output_values', [], 'INVALID_OUTPUT_VALUES'],
    ['output_values', 'bad', 'INVALID_OUTPUT_VALUES'],
  ]) {
    const record = { ...base, [field]: invalid };
    const parsed = parseInstrumentInstanceRecord(record);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.errors.some((entry) => entry.code === code), true);

    const graph = parseInstrumentGraph({ instances: [record], bindings: [] });
    assert.equal(graph.ok, false);
    assert.equal(graph.errors.some((entry) => entry.code === code), true);
  }
});

test('graph parser rejects resource-overflow arrays before traversing their entries', () => {
  const invalidInstance = { id: 'invalid', type: 'test-instrument', version: 1, ports: { inputs: [], outputs: [] } };
  const oversizedInstances = Array.from({ length: DEFAULT_INSTRUMENT_LIMITS.max_instances + 1 }, () => invalidInstance);
  const instanceResult = validateInstrumentGraph({ instances: oversizedInstances, bindings: [] });
  assert.deepEqual(instanceResult.errors.map((entry) => entry.code), ['GRAPH_INSTANCE_LIMIT']);

  const oversizedBindings = Array.from({ length: DEFAULT_INSTRUMENT_LIMITS.max_bindings + 1 }, () => ({ malformed: true }));
  const bindingResult = validateInstrumentGraph({ instances: [], bindings: oversizedBindings });
  assert.deepEqual(bindingResult.errors.map((entry) => entry.code), ['GRAPH_BINDING_LIMIT']);

  const oversizedPorts = baseInstance('too-many-ports', [invalidInstance, ...Array.from({ length: DEFAULT_INSTRUMENT_LIMITS.max_ports_per_instance }, () => invalidInstance)], []);
  const portResult = validateInstrumentGraph({ instances: [oversizedPorts], bindings: [] });
  assert.deepEqual(portResult.errors.map((entry) => entry.code), ['GRAPH_PORT_LIMIT']);
});

test('instance value maps and structured values are bounded before copying or deep validation', () => {
  const base = {
    id: 'bounded-values',
    type: 'test-instrument',
    version: 1,
    ports: {
      inputs: [{ name: 'value', direction: 'input', value_type: 'number' }],
      outputs: [
        { name: 'chart', direction: 'output', value_type: 'chart' },
        { name: 'table', direction: 'output', value_type: 'table' },
      ],
    },
  };
  const tooManyValues = Object.fromEntries(Array.from({ length: FORMULA_LIMITS.max_collection_size + 1 }, (_, index) => [`value:${index}`, index]));
  const mapResult = parseInstrumentInstanceRecord({ ...base, input_values: tooManyValues });
  assert.equal(mapResult.ok, false);
  assert.equal(mapResult.errors.some((entry) => entry.code === 'FORMULA_COLLECTION_LIMIT'), true);

  const hostileSeries = new Array(FORMULA_LIMITS.max_collection_size + 1);
  Object.defineProperty(hostileSeries, 0, { get() { throw new Error('chart traversal should be skipped'); } });
  const chartResult = parseInstrumentInstanceRecord({
    ...base,
    ports: { ...base.ports, inputs: [], outputs: [{ name: 'chart', direction: 'output', value_type: 'chart', default_value: { kind: 'chart', series: hostileSeries } }] },
  });
  assert.equal(chartResult.ok, false);
  assert.equal(chartResult.errors.some((entry) => entry.code === 'FORMULA_COLLECTION_LIMIT'), true);

  const hostileRow = new Array(FORMULA_LIMITS.max_collection_size + 1);
  Object.defineProperty(hostileRow, 0, { get() { throw new Error('table traversal should be skipped'); } });
  const tableResult = parseInstrumentInstanceRecord({
    ...base,
    ports: { ...base.ports, inputs: [], outputs: [{ name: 'table', direction: 'output', value_type: 'table', default_value: { kind: 'table', columns: ['one'], rows: [hostileRow] } }] },
  });
  assert.equal(tableResult.ok, false);
  assert.equal(tableResult.errors.some((entry) => entry.code === 'FORMULA_COLLECTION_LIMIT'), true);
});

test('Compare & Decide fixture recomputes scores, recommendation, and chart deterministically with explicit error behavior', () => {
  const fixture = createCompareDecideFixture();
  assert.deepEqual(fixture, COMPARE_DECIDE_FIXTURE);
  const initial = recomputeCompareDecide();
  assert.equal(initial.status, 'ok');
  assert.equal(initial.results['compare:score:alpha'].outputs.weighted_score.value, 74);
  assert.equal(initial.results['compare:score:beta'].outputs.weighted_score.value, 78);
  assert.equal(initial.results['compare:recommendation'].outputs.recommended.value, 'Beta');
  assert.deepEqual(initial.results['compare:chart'].outputs.scores.value, {
    kind: 'chart',
    series: [{ label: 'Alpha', value: 74 }, { label: 'Beta', value: 78 }],
  });

  const changed = recomputeCompareDecide({ 'compare:score-input:alpha-impact': 100 });
  assert.equal(changed.status, 'ok');
  assert.equal(changed.results['compare:score:alpha'].outputs.weighted_score.value, 98);
  assert.equal(changed.results['compare:recommendation'].outputs.recommended.value, 'Alpha');

  const invalid = recomputeCompareDecide({ 'compare:weight:cost': 0, 'compare:weight:impact': 0 });
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.results['compare:score:alpha'].status, 'invalid');
  assert.equal(invalid.results['compare:score:alpha'].outputs.weighted_score.errors[0].code, 'DIVISION_BY_ZERO');

  const stale = recomputeCompareDecide({ 'compare:score-input:alpha-impact': undefined });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.results['compare:score:alpha'].status, 'stale');
});
