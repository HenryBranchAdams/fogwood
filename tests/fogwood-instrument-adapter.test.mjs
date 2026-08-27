import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCompareInstrumentScope,
  collectInstrumentScope,
  applyInstrumentControlChange,
  applyInstrumentInputChanges,
  compareShapeIdsFromRecipeBlocks,
  inspectInstrumentData,
} from '../app/fogwood-instrument-adapter.ts';

const shapeIds = {
  'compare:weight:cost': 'shape:weight-cost',
  'compare:weight:impact': 'shape:weight-impact',
  'compare:score-input:alpha-cost': 'shape:alpha-cost',
  'compare:score-input:alpha-impact': 'shape:alpha-impact',
  'compare:score-input:beta-cost': 'shape:beta-cost',
  'compare:score-input:beta-impact': 'shape:beta-impact',
  'compare:score:alpha': 'shape:score-alpha',
  'compare:score:beta': 'shape:score-beta',
  'compare:recommendation': 'shape:recommendation',
  'compare:chart': 'shape:chart',
};

function shapesFromScope(scope) {
  return scope.blocks.map((block) => ({
    id: block.shape_id,
    type: 'surface-block',
    props: { kind: block.kind, value: block.value, data: block.data },
  }));
}

test('Compare scope builds distinct identities, exact results, and deterministic control patches', () => {
  const first = createCompareInstrumentScope('compare-and-decide:1', shapeIds);
  const second = createCompareInstrumentScope('compare-and-decide:2', {
    ...shapeIds,
    'compare:weight:cost': 'shape:copy-weight-cost',
  });
  assert.equal(first.status, 'ok');
  assert.equal(first.evaluation.results['compare:score:alpha'].outputs.weighted_score.value, 74);
  assert.equal(first.evaluation.results['compare:score:beta'].outputs.weighted_score.value, 78);
  assert.equal(first.evaluation.results['compare:recommendation'].outputs.recommended.value, 'Beta');
  assert.notDeepEqual(first.blocks, second.blocks);
  const firstCost = first.blocks.find((block) => block.shape_id === shapeIds['compare:weight:cost']);
  const secondCost = second.blocks.find((block) => block.shape_id === 'shape:copy-weight-cost');
  assert.equal(JSON.parse(firstCost.data).instrument.recipe_instance_id, 'compare-and-decide:1');
  assert.notEqual(JSON.parse(firstCost.data).instrument.record.shape_id, JSON.parse(secondCost.data).instrument.record.shape_id);
  assert.deepEqual(
    { min: JSON.parse(firstCost.data).min, max: JSON.parse(firstCost.data).max, step: JSON.parse(firstCost.data).step },
    { min: 0, max: 1, step: 0.1 },
  );
  const firstScoreInput = first.blocks.find((block) => block.shape_id === shapeIds['compare:score-input:alpha-cost']);
  assert.deepEqual(
    { min: JSON.parse(firstScoreInput.data).min, max: JSON.parse(firstScoreInput.data).max, step: JSON.parse(firstScoreInput.data).step },
    { min: 0, max: 100, step: 1 },
  );

  const shapes = shapesFromScope(first);
  const collected = collectInstrumentScope(shapes, 'compare-and-decide:1');
  assert.equal(collected.status, 'ok');
  assert.equal(collected.graph.instances.length, 10);
  assert.equal(collected.graph.bindings.length, 12);

  const changed = applyInstrumentControlChange(shapes, shapeIds['compare:score-input:alpha-impact'], '100');
  assert.equal(changed.status, 'ok');
  assert.equal(changed.evaluation.results['compare:score:alpha'].outputs.weighted_score.value, 98);
  assert.equal(changed.evaluation.results['compare:recommendation'].outputs.recommended.value, 'Alpha');
  assert.equal(changed.patches.some((patch) => patch.shape_id === shapeIds['compare:score-input:alpha-impact'] && patch.value === '100'), true);
  assert.equal(changed.patches.some((patch) => patch.shape_id === shapeIds['compare:score:alpha'] && patch.value === '98.00'), true);
  const chartPatch = changed.patches.find((patch) => patch.shape_id === shapeIds['compare:chart']);
  assert.deepEqual(JSON.parse(chartPatch.data).series, [{ label: 'Alpha', value: 98 }, { label: 'Beta', value: 78 }]);
});

test('Compare adapter previews and applies multiple numeric inputs as one deterministic patch set', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:multi', shapeIds);
  const shapes = shapesFromScope(fixture);
  const result = applyInstrumentInputChanges(shapes, [
    { id: shapeIds['compare:weight:cost'], value: 0.8 },
    { id: shapeIds['compare:weight:impact'], value: 0.2 },
  ]);
  assert.equal(result.status, 'ok');
  assert.equal(result.before_evaluation.results['compare:score:alpha'].outputs.weighted_score.value, 74);
  assert.equal(result.before_evaluation.results['compare:score:beta'].outputs.weighted_score.value, 78);
  assert.equal(result.after_evaluation.results['compare:score:alpha'].outputs.weighted_score.value, 88);
  assert.equal(result.after_evaluation.results['compare:score:beta'].outputs.weighted_score.value, 76);
  assert.equal(result.after_evaluation.results['compare:recommendation'].outputs.recommended.value, 'Alpha');
  assert.deepEqual(result.instrument_changes[0].controls.map(({ id, before, after }) => ({ id, before, after })), [
    { id: shapeIds['compare:weight:cost'], before: 0.4, after: 0.8 },
    { id: shapeIds['compare:weight:impact'], before: 0.6, after: 0.2 },
  ]);
  assert.equal(result.patches.length, 6);
});

test('Compare adapter refuses any invalid member with zero patches and no partial graph result', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:atomic', shapeIds);
  const shapes = shapesFromScope(fixture);
  const invalid = applyInstrumentInputChanges(shapes, [
    { id: shapeIds['compare:weight:cost'], value: 0.8 },
    { id: shapeIds['compare:weight:impact'], value: 2 },
  ]);
  assert.equal(invalid.status, 'invalid');
  assert.deepEqual(invalid.patches, []);
  assert.equal(invalid.errors.length > 0, true);
});

test('instrument input preview rejects bound controls and ambiguous duplicate shape patches before staging', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:preflight', shapeIds);

  const boundShapes = shapesFromScope(fixture);
  const boundData = JSON.parse(boundShapes[0].props.data);
  boundData.instrument.bindings.push({
    id: 'binding:bound-control',
    source: { instance_id: 'compare:score-input:alpha-cost', port: 'value' },
    target: { instance_id: 'compare:weight:cost', port: 'value' },
  });
  boundShapes[0].props.data = JSON.stringify(boundData);
  const bound = applyInstrumentInputChanges(boundShapes, [{ id: shapeIds['compare:weight:cost'], value: 0.8 }]);
  assert.equal(bound.status, 'invalid');
  assert.deepEqual(bound.patches, []);
  assert.equal(bound.errors.some((entry) => entry.code === 'BOUND_INPUT_CONTROL'), true);

  const duplicateShapes = shapesFromScope(fixture);
  const duplicateData = JSON.parse(duplicateShapes.find((shape) => shape.id === shapeIds['compare:weight:cost']).props.data);
  duplicateData.instrument.record.ports.outputs.push({
    direction: 'output',
    name: 'alternate',
    value_type: 'number',
    formula: { type: 'ref', path: 'value' },
  });
  duplicateShapes.find((shape) => shape.id === shapeIds['compare:weight:cost']).props.data = JSON.stringify(duplicateData);
  const duplicate = applyInstrumentInputChanges(duplicateShapes, [{ id: shapeIds['compare:weight:cost'], value: 0.8 }]);
  assert.equal(duplicate.status, 'invalid');
  assert.deepEqual(duplicate.patches, []);
  assert.equal(duplicate.errors.some((entry) => entry.code === 'DUPLICATE_PATCH_TARGET'), true);
});

test('instrument input parser rejects sparse in-process arrays without throwing', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:sparse', shapeIds);
  const shapes = shapesFromScope(fixture);
  let result;
  assert.doesNotThrow(() => {
    result = applyInstrumentInputChanges(shapes, new Array(1));
  });
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.patches, []);
});

test('instrument input no-op reports the exact rejected value path', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:no-op', shapeIds);
  const result = applyInstrumentInputChanges(shapesFromScope(scope), [
    { id: shapeIds['compare:weight:cost'], value: 0.4 },
  ]);
  assert.equal(result.status, 'invalid');
  assert.equal(result.errors.find((error) => error.code === 'NO_OP')?.path, 'changes[0].value');
});

test('instrument input patches preserve page-owned extension metadata', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:extensions', shapeIds);
  const shapes = shapesFromScope(scope);
  const target = shapes.find((shape) => shape.id === shapeIds['compare:weight:cost']);
  const data = JSON.parse(target.props.data);
  data.custom_meta = { origin: 'page', tags: ['keep'] };
  target.props.data = JSON.stringify(data);

  const result = applyInstrumentInputChanges(shapes, [
    { id: shapeIds['compare:weight:cost'], value: 0.8 },
  ]);
  assert.equal(result.status, 'ok');
  const patched = JSON.parse(result.patches.find((patch) => patch.shape_id === target.id).data);
  assert.deepEqual(patched.custom_meta, { origin: 'page', tags: ['keep'] });
});

test('instrument input preview rejects locked downstream patch targets atomically', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:locked-output', shapeIds);
  const shapes = shapesFromScope(scope);
  const derived = shapes.find((shape) => shape.id === shapeIds['compare:score:alpha']);
  derived.is_locked = true;

  const result = applyInstrumentInputChanges(shapes, [
    { id: shapeIds['compare:weight:cost'], value: 0.8 },
    { id: shapeIds['compare:weight:impact'], value: 0.2 },
  ]);
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.patches, []);
  assert.equal(result.errors.some((error) => error.code === 'LOCKED_PATCH_TARGET' && error.path === `${derived.id}.is_locked`), true);

  const nestedShapes = shapesFromScope(scope);
  const nestedDerived = nestedShapes.find((shape) => shape.id === shapeIds['compare:score:alpha']);
  nestedDerived.parent_id = 'shape:locked-frame';
  nestedShapes.push({ id: 'shape:locked-frame', type: 'frame', is_locked: true });
  const nestedResult = applyInstrumentInputChanges(nestedShapes, [
    { id: shapeIds['compare:weight:cost'], value: 0.8 },
    { id: shapeIds['compare:weight:impact'], value: 0.2 },
  ]);
  assert.equal(nestedResult.status, 'invalid');
  assert.deepEqual(nestedResult.patches, []);
  assert.equal(nestedResult.errors.some((error) => error.code === 'LOCKED_PATCH_TARGET'), true);
});

test('Compare adapter refuses malformed or cyclic scopes without updates and preserves legacy fallback', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:1', shapeIds);
  const orderedMap = compareShapeIdsFromRecipeBlocks(['shape:heading', 'shape:criteria', ...Object.values(shapeIds)]);
  assert.deepEqual(orderedMap, shapeIds);
  const incomplete = createCompareInstrumentScope('compare-and-decide:incomplete', { ...shapeIds, 'compare:chart': undefined });
  assert.equal(incomplete.status, 'invalid');
  assert.deepEqual(incomplete.blocks, []);
  const shapes = shapesFromScope(fixture);
  const malformed = shapes.map((shape) => ({ ...shape, props: { ...shape.props } }));
  const malformedData = JSON.parse(malformed[0].props.data);
  malformedData.instrument.bindings = [
    ...malformedData.instrument.bindings,
    {
      id: 'cycle',
      source: { instance_id: 'compare:score:alpha', port: 'weighted_score' },
      target: { instance_id: 'compare:weight:cost', port: 'value' },
    },
  ];
  malformed[0].props.data = JSON.stringify(malformedData);
  const refused = applyInstrumentControlChange(malformed, shapeIds['compare:score-input:alpha-impact'], '100');
  assert.equal(refused.status, 'invalid');
  assert.deepEqual(refused.patches, []);

  const malformedMap = shapes.map((shape) => ({ ...shape, props: { ...shape.props } }));
  const malformedMapData = JSON.parse(malformedMap[0].props.data);
  malformedMapData.instrument.record.input_values = 'bad';
  malformedMap[0].props.data = JSON.stringify(malformedMapData);
  const refusedMap = applyInstrumentControlChange(malformedMap, shapeIds['compare:score-input:alpha-impact'], '100');
  assert.equal(refusedMap.status, 'invalid');
  assert.deepEqual(refusedMap.patches, []);
  assert.equal(refusedMap.errors.some((entry) => entry.code === 'INVALID_INPUT_VALUES'), true);

  const legacy = applyInstrumentControlChange([
    { id: 'legacy:block', type: 'surface-block', props: { kind: 'slider', value: '4', data: '{}' } },
  ], 'legacy:block', '5');
  assert.equal(legacy.status, 'legacy');
  assert.deepEqual(legacy.patches, []);
});

test('inspect refuses oversized or malformed bindings without projecting them', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:1', shapeIds);
  const shape = shapesFromScope(fixture)[0];

  const valid = inspectInstrumentData(shape);
  assert.equal(valid?.bindings.length, 12);

  const oversizedData = JSON.parse(shape.props.data);
  oversizedData.instrument.bindings = [
    ...oversizedData.instrument.bindings,
    ...Array.from({ length: 117 }, (_, index) => ({
      id: `binding:extra:${index}`,
      source: { instance_id: 'compare:weight:cost', port: 'value' },
      target: { instance_id: 'compare:score:alpha', port: 'cost_weight' },
    })),
  ];
  const oversized = inspectInstrumentData({ ...shape, props: { ...shape.props, data: JSON.stringify(oversizedData) } });
  assert.equal(oversized, undefined);

  const malformedData = JSON.parse(shape.props.data);
  malformedData.instrument.bindings = [{ id: 'malformed' }];
  const malformed = inspectInstrumentData({ ...shape, props: { ...shape.props, data: JSON.stringify(malformedData) } });
  assert.equal(malformed, undefined);
});

test('scope collection refuses an oversized stored binding array before graph traversal or patches', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:1', shapeIds);
  const shapes = shapesFromScope(fixture);
  const data = JSON.parse(shapes[0].props.data);
  data.instrument.bindings = Array.from({ length: 129 }, (_, index) => ({ id: `oversized:${index}` }));
  shapes[0].props.data = JSON.stringify(data);

  const collected = collectInstrumentScope(shapes, 'compare-and-decide:1');
  assert.equal(collected.status, 'invalid');
  assert.equal(collected.errors.some((entry) => entry.code === 'GRAPH_BINDING_LIMIT'), true);

  const result = applyInstrumentControlChange(shapes, shapeIds['compare:score-input:alpha-impact'], '100');
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.patches, []);
});

test('inspect refuses oversized, undeclared, or incompatible record value maps', () => {
  const fixture = createCompareInstrumentScope('compare-and-decide:1', shapeIds);
  const shape = shapesFromScope(fixture)[0];

  const inspectWithRecord = (recordPatch) => {
    const data = JSON.parse(shape.props.data);
    data.instrument.record = { ...data.instrument.record, ...recordPatch };
    return inspectInstrumentData({ ...shape, props: { ...shape.props, data: JSON.stringify(data) } });
  };

  const oversizedInput = inspectWithRecord({
    input_values: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`input:${index}`, index])),
  });
  assert.equal(oversizedInput, undefined);

  const oversizedOutput = inspectWithRecord({
    output_values: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`output:${index}`, index])),
  });
  assert.equal(oversizedOutput, undefined);

  const undeclaredOutput = inspectWithRecord({ output_values: { undeclared: 1 } });
  assert.equal(undeclaredOutput, undefined);

  const incompatibleInput = inspectWithRecord({ input_values: { value: 'not-a-number' } });
  assert.equal(incompatibleInput, undefined);

  const incompatibleOutput = inspectWithRecord({ output_values: { value: 'not-a-number' } });
  assert.equal(incompatibleOutput, undefined);
});
