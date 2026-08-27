import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createCompareInstrumentScope } from '../app/fogwood-instrument-adapter.ts';
import { createInstrumentControlGesture } from '../app/surface-tools.ts';

// tldraw's state scheduler leaves a MessagePort referenced in Node tests.
after(() => {
  for (const handle of process._getActiveHandles()) handle?.unref?.();
});

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shapesFromScope(scope) {
  return scope.blocks.map((block) => ({
    id: block.shape_id,
    type: 'surface-block',
    props: { kind: block.kind, value: block.value, data: block.data },
  }));
}

class FakeEditor {
  constructor(shapes) {
    this.shapes = clone(shapes);
    this.marks = [];
    this.groups = [];
    this.pending = null;
  }

  getCurrentPageShapes() {
    return this.shapes;
  }

  markHistoryStoppingPoint(name) {
    if (this.pending) this.groups.push(this.pending);
    this.pending = null;
    this.marks.push(name);
    return `mark-${this.marks.length}`;
  }

  run(fn, options) {
    assert.deepEqual(options, { history: 'record' });
    const before = clone(this.shapes);
    fn();
    const after = clone(this.shapes);
    if (!this.pending) this.pending = { before, after };
    else this.pending.after = after;
  }

  updateShapes(updates) {
    for (const update of updates) {
      const shape = this.shapes.find((candidate) => candidate.id === update.id);
      if (!shape) throw new Error(`Missing shape ${update.id}`);
      shape.props = { ...shape.props, ...update.props };
    }
  }

  undo() {
    const group = this.pending ?? this.groups.pop();
    if (!group) return;
    this.shapes = clone(group.before);
    this.pending = null;
  }
}

test('one instrument gesture groups live updates and keeps the next gesture separately undoable', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:gesture', shapeIds);
  const editor = new FakeEditor(shapesFromScope(scope));
  const gesture = createInstrumentControlGesture(editor);
  const target = shapeIds['compare:score-input:alpha-impact'];

  gesture.start(target);
  assert.equal(gesture.update(target, '80').status, 'ok');
  assert.equal(gesture.update(target, '100').status, 'ok');
  gesture.end();

  assert.deepEqual(editor.marks, ['Update Fogwood instrument']);
  assert.equal(editor.pending !== null, true);
  assert.equal(editor.groups.length, 0);
  assert.equal(editor.shapes.find((shape) => shape.id === target).props.value, '100');

  gesture.start(target);
  assert.equal(gesture.update(target, '70').status, 'ok');
  gesture.end();

  assert.deepEqual(editor.marks, ['Update Fogwood instrument', 'Update Fogwood instrument']);
  assert.equal(editor.groups.length, 1);
  editor.undo();
  assert.equal(editor.shapes.find((shape) => shape.id === target).props.value, '100');
  editor.undo();
  assert.equal(editor.shapes.find((shape) => shape.id === target).props.value, '60');
});

test('legacy control updates remain outside the instrument gesture history seam', () => {
  const editor = new FakeEditor([
    { id: 'legacy:block', type: 'surface-block', props: { kind: 'slider', value: '4', data: '{}' } },
  ]);
  const gesture = createInstrumentControlGesture(editor);

  gesture.start('legacy:block');
  assert.equal(gesture.update('legacy:block', '5').status, 'legacy');
  gesture.end();

  assert.deepEqual(editor.marks, []);
  assert.equal(editor.shapes[0].props.value, '4');
});
