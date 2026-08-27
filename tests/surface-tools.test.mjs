import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createCompareInstrumentScope } from '../app/fogwood-instrument-adapter.ts';
import { applyProposalToEditor, createInstrumentControlGesture, currentRevision, proposalActivityDetail, updateInstrumentControl } from '../app/surface-tools.ts';

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
      if (shape.isLocked === true) continue;
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

class ProposalEditor extends FakeEditor {
  constructor(shapes) {
    super(shapes);
    this.options = { maxShapesPerPage: 100 };
    this.store = { allRecords: () => [] };
  }

  getCurrentPageShapesSorted() {
    return this.shapes;
  }

  getCurrentPageId() {
    return 'page:main';
  }

  getShapePageBounds(shape) {
    return { x: shape.x, y: shape.y, w: shape.props.w ?? 280, h: shape.props.h ?? 150 };
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

test('page-owned scenario Apply patches every affected block in one history transaction and undo restores the fixture', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:proposal', shapeIds);
  const editor = new ProposalEditor(scope.blocks.map((block, index) => ({
    id: block.shape_id,
    type: 'surface-block',
    typeName: 'shape',
    x: index * 10,
    y: 0,
    rotation: 0,
    parentId: 'page:main',
    isLocked: false,
    opacity: 1,
    index: String(index),
    meta: { fogwood: { recipe_instance_id: 'compare-and-decide:proposal' } },
    props: { w: 280, h: 150, kind: block.kind, title: block.shape_id, body: '', value: block.value, data: block.data },
  })));
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Set Compare weights',
    actions: [{
      type: 'set_instrument_inputs',
      changes: [
        { id: shapeIds['compare:weight:cost'], value: 0.8 },
        { id: shapeIds['compare:weight:impact'], value: 0.2 },
      ],
    }],
  };
  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  assert.equal(editor.marks.filter((mark) => mark === 'Apply agent proposal').length, 1);
  assert.equal(editor.shapes.find((shape) => shape.id === shapeIds['compare:weight:cost']).props.value, '0.8');
  assert.equal(editor.shapes.find((shape) => shape.id === shapeIds['compare:weight:impact']).props.value, '0.2');
  assert.equal(editor.shapes.find((shape) => shape.id === shapeIds['compare:score:alpha']).props.value, '88.00');
  assert.equal(editor.shapes.find((shape) => shape.id === shapeIds['compare:score:beta']).props.value, '76.00');
  assert.equal(editor.shapes.find((shape) => shape.id === shapeIds['compare:recommendation']).props.value, 'Alpha');
  editor.undo();
  assert.deepEqual(editor.shapes, before);
});

test('page-owned scenario refuses a locked downstream block before any partial Apply', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:locked-proposal', shapeIds);
  const editor = new ProposalEditor(scope.blocks.map((block, index) => ({
    id: block.shape_id,
    type: 'surface-block',
    typeName: 'shape',
    x: index * 10,
    y: 0,
    rotation: 0,
    parentId: 'page:main',
    isLocked: block.shape_id === shapeIds['compare:score:alpha'],
    opacity: 1,
    index: String(index),
    meta: { fogwood: { recipe_instance_id: 'compare-and-decide:locked-proposal' } },
    props: { w: 280, h: 150, kind: block.kind, title: block.shape_id, body: '', value: block.value, data: block.data },
  })));
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Reject partial scenario',
    actions: [{
      type: 'set_instrument_inputs',
      changes: [
        { id: shapeIds['compare:weight:cost'], value: 0.8 },
        { id: shapeIds['compare:weight:impact'], value: 0.2 },
      ],
    }],
  };

  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /every affected instrument block must be unlocked/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
});

test('direct slider gesture refuses a locked downstream block before any patch', () => {
  const scope = createCompareInstrumentScope('compare-and-decide:locked-gesture', shapeIds);
  const editor = new FakeEditor(scope.blocks.map((block) => ({
    id: block.shape_id,
    type: 'surface-block',
    parentId: 'page:main',
    isLocked: block.shape_id === shapeIds['compare:score:alpha'],
    props: { kind: block.kind, value: block.value, data: block.data },
  })));
  const before = clone(editor.shapes);

  const result = updateInstrumentControl(editor, shapeIds['compare:score-input:alpha-impact'], '100');
  assert.equal(result.status, 'invalid');
  assert.equal(result.errors.some((error) => error.code === 'LOCKED_PATCH_TARGET'), true);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
});

test('proposal activity describes typed scenario work instead of reporting four zero mutation counts', () => {
  assert.equal(proposalActivityDetail({
    instrument_changes: [{
      recipe_instance_id: 'compare-and-decide:proposal',
      controls: [{ id: 'shape:weight-cost', label: 'Cost weight', before: 0.4, after: 0.8 }],
      derived: [
        { id: 'shape:score-alpha', label: 'Alpha weighted score', before: 74, after: 88 },
        { id: 'shape:recommendation', label: 'Recommendation', before: 'Beta', after: 'Alpha' },
      ],
    }],
    counts: { adds: 0, updates: 0, moves: 0, removes: 0 },
  }), '1 control change and 2 predicted outputs await review.');

  assert.equal(proposalActivityDetail({
    instrument_changes: [],
    counts: { adds: 12, updates: 0, moves: 0, removes: 0 },
  }), '12 additions, 0 updates, 0 moves, 0 removals await review.');
});
