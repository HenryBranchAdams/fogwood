import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createCompareInstrumentScope } from '../app/fogwood-instrument-adapter.ts';
import { CAPABILITY_REGISTRY } from '../app/fogwood-runtime.ts';
import { applyProposalToEditor, createInstrumentControlGesture, currentContextToken, currentRevision, inspectSurface, planCapabilityRequestForEditor, proposalActivityDetail, registerSurfaceTools, updateInstrumentControl } from '../app/surface-tools.ts';

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

class CanvasProposalEditor extends ProposalEditor {
  constructor(shapes = []) {
    super(shapes);
    this.bindings = [];
    this.assets = [];
    this.nextIndex = shapes.length;
    this.nextBindingIndex = 0;
    this.store = { allRecords: () => [...this.shapes, ...this.bindings, ...this.assets] };
    this.registeredTools = [];
    this.context = {
      selectedShapeIds: [],
      focusedGroupId: null,
      editingShapeId: null,
      currentToolId: 'select',
      currentToolPath: 'select.idle',
      readonly: false,
    };
    this.ownerDocument = {
      modelContext: {
        registerTool: (tool) => {
          this.registeredTools.push(tool);
          return Promise.resolve();
        },
      },
    };
  }

  getContainer() {
    return { ownerDocument: this.ownerDocument };
  }

  getSelectedShapeIds() { return [...this.context.selectedShapeIds]; }
  getCurrentPageState() {
    return {
      selectedShapeIds: [...this.context.selectedShapeIds],
      focusedGroupId: this.context.focusedGroupId,
      editingShapeId: this.context.editingShapeId,
    };
  }
  getViewportPageBounds() { return { x: 0, y: 0, w: 1200, h: 800 }; }
  getCurrentPageBounds() { return { x: 0, y: 0, w: 1200, h: 800 }; }
  getCamera() { return { x: 0, y: 0, z: 1 }; }
  getIsReadonly() { return this.context.readonly; }
  getCurrentToolId() { return this.context.currentToolId; }
  getPath() { return this.context.currentToolPath; }
  setContext(change) { this.context = { ...this.context, ...change }; }

  getShape(id) {
    return this.shapes.find((shape) => shape.id === id);
  }

  getAsset(id) {
    return this.store.allRecords().find((record) => record.typeName === 'asset' && record.id === id);
  }

  canBindShapes({ fromShape, toShape, binding }) {
    const fromType = typeof fromShape === 'string' ? fromShape : fromShape.type;
    const toType = typeof toShape === 'string' ? toShape : toShape.type;
    const bindingType = typeof binding === 'string' ? binding : binding.type;
    return bindingType === 'arrow' && fromType === 'arrow' && !['arrow', 'group'].includes(toType);
  }

  createBindings(partials) {
    for (const partial of partials) {
      if (!this.getShape(partial.fromId) || !this.getShape(partial.toId)) continue;
      if (!this.canBindShapes({ fromShape: this.getShape(partial.fromId), toShape: this.getShape(partial.toId), binding: partial })) continue;
      this.bindings.push({
        id: `binding:${this.nextBindingIndex++}`,
        typeName: 'binding',
        type: partial.type,
        fromId: partial.fromId,
        toId: partial.toId,
        props: clone(partial.props),
        meta: {},
      });
    }
    return this;
  }

  getBindingsFromShape(shape, type) {
    const id = typeof shape === 'string' ? shape : shape.id;
    return this.bindings.filter((binding) => binding.fromId === id && (!type || binding.type === type));
  }

  run(fn, options) {
    assert.deepEqual(options, { history: 'record' });
    const before = { shapes: clone(this.shapes), bindings: clone(this.bindings) };
    fn();
    const after = { shapes: clone(this.shapes), bindings: clone(this.bindings) };
    if (!this.pending) this.pending = { before, after, canvas: true };
    else this.pending.after = after;
  }

  undo() {
    const group = this.pending ?? this.groups.pop();
    if (!group) return;
    if (group.canvas) {
      this.shapes = clone(group.before.shapes);
      this.bindings = clone(group.before.bindings);
    } else {
      this.shapes = clone(group.before);
    }
    this.pending = null;
  }

  createShapes(records) {
    for (const record of records) {
      this.shapes.push({
        typeName: 'shape',
        rotation: 0,
        opacity: 1,
        isLocked: false,
        index: String(this.nextIndex++).padStart(4, '0'),
        meta: {},
        props: {},
        ...clone(record),
      });
    }
  }

  updateShapes(updates) {
    for (const update of updates) {
      const shape = this.getShape(update.id);
      if (!shape) throw new Error(`Missing shape ${update.id}`);
      if (shape.isLocked === true) continue;
      const { props, meta, ...topLevel } = clone(update);
      Object.assign(shape, topLevel);
      if (props) shape.props = { ...shape.props, ...props };
      if (meta) shape.meta = { ...shape.meta, ...meta };
    }
  }

  resizeToBounds(ids, bounds) {
    for (const id of ids) {
      const shape = this.getShape(id);
      shape.x = bounds.x;
      shape.y = bounds.y;
      shape.props = { ...shape.props, w: bounds.w, h: bounds.h };
    }
  }

  groupShapes(ids, { groupId }) {
    // Match tldraw 5.3.2: the public helper silently returns outside Select.
    if (this.context?.currentToolId && this.context.currentToolId !== 'select') return;
    const children = ids.map((id) => this.getShape(id));
    const x = Math.min(...children.map((shape) => shape.x));
    const y = Math.min(...children.map((shape) => shape.y));
    const maxX = Math.max(...children.map((shape) => shape.x + (shape.props.w ?? 100)));
    const maxY = Math.max(...children.map((shape) => shape.y + (shape.props.h ?? 100)));
    for (const child of children) child.parentId = groupId;
    this.createShapes([{ id: groupId, type: 'group', x, y, parentId: 'page:main', props: { w: maxX - x, h: maxY - y } }]);
  }

  getSortedChildIdsForParent(parentId) {
    return this.shapes
      .filter((shape) => shape.parentId === parentId)
      .sort((left, right) => String(left.index).localeCompare(String(right.index)))
      .map((shape) => shape.id);
  }

  reparentShapes(ids, parentId) {
    for (const id of ids) {
      const shape = this.getShape(id);
      if (!shape) throw new Error(`Missing shape ${id}`);
      shape.parentId = parentId;
    }
  }

  ungroupShapes(ids) {
    for (const id of ids) {
      for (const child of this.shapes.filter((shape) => shape.parentId === id)) child.parentId = 'page:main';
      this.shapes = this.shapes.filter((shape) => shape.id !== id);
    }
  }

  deleteShapes(ids) {
    const set = new Set(ids);
    this.shapes = this.shapes.filter((shape) => !set.has(shape.id));
    this.bindings = this.bindings.filter((binding) => !set.has(binding.fromId) && !set.has(binding.toId));
  }

  bringToFront() {}
  sendToBack() {}
  bringForward() {}
  sendBackward() {}
}

test('the capability tool planner reads the live revision and returns a compound plan without mutation', () => {
  const editor = new CanvasProposalEditor();
  const before = clone(editor.shapes);
  const inspected = inspectSurface(editor);
  const result = planCapabilityRequestForEditor(editor, {
    intent: 'Create two ideas, align them, connect them with an arrow, and bring the first to front.',
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    scope: 'new',
    desired_effects: ['matter.created', 'geometry.arranged', 'connector-arrow.created', 'layer.order.changed'],
    planned_item_count: 2,
    max_steps: 6,
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.steps.map((step) => step.capability_id), [
    'matter.native.create',
    'layout.arrange',
    'connector-arrow.create',
    'layer.reorder',
  ]);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
});

test('fogwood-capabilities plan mode returns the live compound plan through the registered WebMCP tool', async () => {
  const editor = new CanvasProposalEditor();
  const cleanup = registerSurfaceTools(editor, () => {});
  const tool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-capabilities');
  assert.ok(tool);
  assert.deepEqual(
    tool.inputSchema,
    CAPABILITY_REGISTRY.find((capability) => capability.id === 'fogwood-capabilities').input_schema,
  );

  const inspected = inspectSurface(editor);
  const response = await tool.execute({
    mode: 'plan',
    intent: 'Create two ideas, align them, connect them with an arrow, and bring the first to front.',
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    scope: 'new',
    desired_effects: ['matter.created', 'geometry.arranged', 'connector-arrow.created', 'layer.order.changed'],
    planned_item_count: 2,
    max_steps: 6,
  });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.status, 'ready');
  assert.deepEqual(payload.steps.map((step) => step.capability_id), [
    'matter.native.create',
    'layout.arrange',
    'connector-arrow.create',
    'layer.reorder',
  ]);
  assert.equal(editor.shapes.length, 0);
  cleanup();
});

test('fogwood-capabilities route mode composes exact routes from all 213 examples without mutation', async () => {
  const editor = new CanvasProposalEditor();
  const cleanup = registerSurfaceTools(editor, () => {});
  const tool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-capabilities');
  const inspectTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-inspect');
  assert.ok(inspectTool);
  const inspected = inspectSurface(editor);
  const before = clone(editor.shapes);

  const response = await tool.execute({
    mode: 'route',
    intent: 'Align shapes, export the canvas as an image, and add collaborative comments.',
    example_ids: [
      'tldraw-example.editor-api.align-and-distribute-shapes',
      'tldraw-example.data.assets.export-canvas-as-image',
      'tldraw-example.collaboration.commenting',
    ],
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    scope: 'selection',
    max_steps: 8,
  });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.schema, 'fogwood.surface-plan.v1');
  assert.equal(payload.status, 'ready-with-host-requirements');
  assert.deepEqual(payload.steps.map((step) => step.family), [
    'native_canvas',
    'local_material_artifact',
    'collaboration_identity',
  ]);
  const inspectContinuation = payload.local_next_calls.find((step) => step.tool === 'fogwood-inspect');
  assert.deepEqual(inspectContinuation?.input, {});
  assert.equal(Object.hasOwn(inspectContinuation, 'projection'), false);
  const continuationResponse = await inspectTool.execute(inspectContinuation.input);
  const continuationPayload = JSON.parse(continuationResponse.content[0].text);
  assert.equal(continuationPayload.content_revision, inspected.content_revision);
  assert.deepEqual(payload.proposal_contracts.map((step) => step.action_type), ['canvas_ops']);
  assert.equal(payload.proposal_contracts[0].requires_compilation, true);
  assert.deepEqual(editor.shapes, before);
  assert.equal(editor.marks.length, 0);
  cleanup();
});

test('inspect exposes a bounded context token separate from content revision', () => {
  const editor = new CanvasProposalEditor();
  const first = inspectSurface(editor);
  assert.equal(first.canvas_context.schema, 'fogwood.context.v1');
  assert.equal(first.context_token.length, 16);
  assert.equal(first.content_revision, currentRevision(editor));
  assert.equal('camera' in first.canvas_context, false);
  assert.equal('viewport' in first.canvas_context, false);
  assert.equal('hover' in first.canvas_context, false);
  assert.equal('extensions' in first.canvas_context, false);

  for (const change of [
    { selectedShapeIds: ['shape:a', 'shape:b'] },
    { selectedShapeIds: ['shape:b', 'shape:a'] },
    { currentToolId: 'draw' },
    { currentToolPath: 'root.draw.drawing' },
    { readonly: true },
    { focusedGroupId: 'group:one' },
    { editingShapeId: 'shape:a' },
  ]) {
    editor.setContext(change);
    const next = inspectSurface(editor);
    assert.equal(next.content_revision, first.content_revision);
    assert.notEqual(next.context_token, first.context_token);
  }
});

test('inspect keeps the public context projection bounded while the opaque token covers the full selection', () => {
  const editor = new CanvasProposalEditor();
  editor.setContext({ selectedShapeIds: Array.from({ length: 200 }, (_, index) => `shape:${index}`) });
  const inspected = inspectSurface(editor);

  assert.equal(inspected.canvas_context.selected_ids.length, 128);
  assert.equal(inspected.canvas_context.selected_ids_preview.length, 128);
  assert.deepEqual(inspected.canvas_context.selected_ids, inspected.canvas_context.selected_ids_preview);
  assert.equal(inspected.canvas_context.selection_completeness.total, 200);
  assert.equal(inspected.canvas_context.selected_ids_digest_completeness.returned, 200);
  assert.equal(inspected.context_token, currentContextToken(editor));
});

test('fogwood-capabilities available mode returns only current-context commands and requires both bindings', async () => {
  const editor = new CanvasProposalEditor();
  const cleanup = registerSurfaceTools(editor, () => {});
  const tool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-capabilities');
  const inspected = inspectSurface(editor);
  const missing = await tool.execute({ mode: 'available', base_revision: inspected.content_revision });
  assert.equal(JSON.parse(missing.content[0].text).status, 'INVALID_INPUT');
  const response = await tool.execute({
    mode: 'available',
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
  });
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.status, 'available');
  assert.deepEqual(payload.manifests.filter((entry) => entry.availability === 'available').map((entry) => entry.id), [
    'matter.native.create',
    'matter.native.draw',
  ]);
  assert.equal(payload.manifests.every((entry) => entry.schema === 'fogwood.capability.v1' && [1, 2].includes(entry.version)), true);
  cleanup();
});

test('stale context blocks plan and proposal before stage while context-only changes preserve Apply', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const planTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-capabilities');
  const proposeTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  editor.setContext({ selectedShapeIds: ['shape:context'] });
  const stalePlan = await planTool.execute({
    mode: 'plan',
    intent: 'Create a note.',
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    scope: 'new',
    planned_item_count: 1,
  });
  assert.equal(JSON.parse(stalePlan.content[0].text).status, 'STALE_CONTEXT');
  const staleProposal = await proposeTool.execute({
    context_token: inspected.context_token,
    base_revision: inspected.content_revision,
    summary: 'Stale context proposal',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'create', semantic_id: 'note:stale', kind: 'note', x: 20, y: 30, w: 120, h: 80, text: 'stale' }] }],
  });
  assert.equal(JSON.parse(staleProposal.content[0].text).status, 'STALE_CONTEXT');
  assert.equal(controller.getState(), null);

  const current = inspectSurface(editor);
  const stage = await proposeTool.execute({
    context_token: current.context_token,
    base_revision: current.content_revision,
    summary: 'Context-bound proposal',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'create', semantic_id: 'note:reviewed', kind: 'note', x: 20, y: 30, w: 120, h: 80, text: 'reviewed' }] }],
  });
  assert.equal(JSON.parse(stage.content[0].text).status, 'STAGED');
  assert.equal('context_token' in controller.getState().proposal, false);
  editor.setContext({ selectedShapeIds: ['shape:changed'], currentToolId: 'draw' });
  assert.equal(controller.apply().status, 'APPLIED');
  assert.equal(editor.shapes.some((shape) => shape.meta?.fogwood?.semantic_id === 'note:reviewed'), true);
  editor.undo();
  assert.equal(editor.shapes.length, 0);
  cleanup();
});

test('async material decoder race rechecks context before staging', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  let release;
  const decoder = () => new Promise((resolve) => { release = resolve; });
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; }, undefined, { decodeRaster: decoder });
  const proposeTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const pending = proposeTool.execute({
    context_token: inspected.context_token,
    base_revision: inspected.content_revision,
    summary: 'Race proposal',
    actions: [{ type: 'add_materials', materials: [{ semantic_id: 'material:race', mime_type: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', x: 20, y: 30, w: 100, h: 100 }] }],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  editor.setContext({ selectedShapeIds: ['shape:race'] });
  release({ width: 1, height: 1 });
  const response = await pending;
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.status, 'STALE_CONTEXT');
  assert.equal(controller.getState(), null);
  assert.equal(editor.shapes.length, 0);
  cleanup();
});

test('planned capabilities flow through proposal staging, one Apply transaction, and one Undo', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const planTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-capabilities');
  const proposeTool = editor.registeredTools.find((candidate) => candidate.name === 'fogwood-propose');
  const baseRevision = currentRevision(editor);

  const planResponse = await planTool.execute({
    mode: 'plan',
    intent: 'Create two labeled ideas, align them, connect them with an arrow, and bring idea A to front.',
    base_revision: baseRevision,
    context_token: inspectSurface(editor).context_token,
    scope: 'new',
    desired_effects: ['matter.created', 'geometry.arranged', 'connector-arrow.created', 'layer.order.changed'],
    planned_item_count: 2,
  });
  assert.equal(JSON.parse(planResponse.content[0].text).status, 'ready');

  const stageResponse = await proposeTool.execute({
    base_revision: baseRevision,
    context_token: inspectSurface(editor).context_token,
    summary: 'Compose a connected pair of ideas',
    actions: [{
      type: 'canvas_ops',
      ops: [
        { op: 'create', semantic_id: 'idea:a', kind: 'rectangle', x: 40, y: 60, w: 180, h: 100, text: 'Idea A' },
        { op: 'create', semantic_id: 'idea:b', kind: 'ellipse', x: 360, y: 120, w: 160, h: 100, text: 'Idea B' },
        { op: 'align', ids: ['semantic:idea:a', 'semantic:idea:b'], axis: 'top' },
        { op: 'connect', semantic_id: 'relation:a-b', from_id: 'semantic:idea:a', to_id: 'semantic:idea:b', text: 'leads to' },
        { op: 'reorder', ids: ['semantic:idea:a'], position: 'front' },
      ],
    }],
  });
  assert.equal(JSON.parse(stageResponse.content[0].text).status, 'STAGED');
  assert.equal(editor.shapes.length, 0);

  assert.equal(controller.apply().status, 'APPLIED');
  assert.equal(editor.shapes.length, 3);
  assert.equal(editor.bindings.length, 2);
  assert.deepEqual(editor.marks, ['Apply agent proposal']);
  editor.undo();
  assert.deepEqual(editor.shapes, []);
  cleanup();
});

test('the page adapter carries locked page facts into page-scope planning', () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:locked', type: 'geo', parentId: 'page:main', isLocked: true, x: 0, y: 0, rotation: 0, opacity: 1, index: 'a1', meta: {}, props: { w: 100, h: 100 } },
    { id: 'shape:open', type: 'geo', parentId: 'page:main', isLocked: false, x: 180, y: 0, rotation: 0, opacity: 1, index: 'a2', meta: {}, props: { w: 100, h: 100 } },
  ]);
  const result = planCapabilityRequestForEditor(editor, {
    intent: 'Arrange the page.',
    base_revision: currentRevision(editor),
    context_token: inspectSurface(editor).context_token,
    scope: 'page',
    desired_effects: ['geometry.arranged'],
  });

  assert.deepEqual({ status: result.status, codes: result.errors.map((error) => error.code) }, {
    status: 'blocked',
    codes: ['LOCKED_PAGE_SCOPE'],
  });
});

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

test('Canvas Protocol creates, arranges, and groups native shapes in one Apply and one Undo', () => {
  const editor = new CanvasProposalEditor();
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Compose native ideas',
    actions: [{
      type: 'canvas_ops',
      ops: [
        { op: 'create', semantic_id: 'idea:a', kind: 'rectangle', x: 20, y: 30, w: 160, h: 100, text: 'A', color: 'violet', fill: 'semi' },
        { op: 'create', semantic_id: 'idea:b', kind: 'ellipse', x: 360, y: 80, w: 140, h: 90, text: 'B', color: 'green', fill: 'solid' },
        { op: 'stack', ids: ['semantic:idea:a', 'semantic:idea:b'], axis: 'horizontal', gap: 40 },
        { op: 'group', ids: ['semantic:idea:a', 'semantic:idea:b'], semantic_id: 'cluster:ideas' },
      ],
    }],
  };

  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  assert.deepEqual(editor.marks, ['Apply agent proposal']);
  assert.equal(editor.shapes.filter((shape) => shape.type === 'geo').length, 2);
  assert.equal(editor.shapes.filter((shape) => shape.type === 'group').length, 1);
  assert.equal(editor.shapes.every((shape) => shape.meta?.fogwood?.semantic_id), true);
  editor.undo();
  assert.deepEqual(editor.shapes, []);
});

test('Canvas Protocol Apply creates an inspected native bound connector in one Undo group', () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 20, y: 30, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:a' } }, props: { geo: 'rectangle', w: 160, h: 100, richText: { type: 'doc', content: [] } } },
    { id: 'shape:b', typeName: 'shape', type: 'note', x: 360, y: 90, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:b' } }, props: { w: 180, h: 120, richText: { type: 'doc', content: [] } } },
  ]);
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Connect the selected ideas',
    actions: [{ type: 'canvas_ops', ops: [{
      op: 'connect', semantic_id: 'connector:a-b', from_id: 'semantic:idea:a', to_id: 'semantic:idea:b', text: 'influences', color: 'violet',
    }] }],
  };

  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  const arrow = editor.shapes.find((shape) => shape.type === 'arrow');
  assert.ok(arrow);
  assert.equal(arrow.meta.fogwood.role, 'bound-connector');
  assert.equal(arrow.meta.fogwood.source_semantic_id, 'idea:a');
  assert.equal(arrow.meta.fogwood.target_semantic_id, 'idea:b');
  assert.deepEqual(editor.bindings.map((binding) => [binding.props.terminal, binding.fromId, binding.toId]), [
    ['start', arrow.id, 'shape:a'],
    ['end', arrow.id, 'shape:b'],
  ]);
  const inspected = inspectSurface(editor);
  assert.equal(inspected.bindings.length, 2);
  assert.equal(inspected.items.find((item) => item.id === 'shape:a').binding_count, 1);
  assert.equal(inspected.items.find((item) => item.id === 'shape:b').binding_count, 1);
  assert.equal(inspected.items.find((item) => item.id === arrow.id).binding_count, 2);
  assert.deepEqual(editor.marks, ['Apply agent proposal']);
  editor.undo();
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.bindings, []);
});

test('Canvas Protocol refuses a silently partial connector and restores visible page state', () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 20, y: 30, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:a', semantic_id_source: 'stable' } }, props: { geo: 'rectangle', w: 160, h: 100 } },
    { id: 'shape:b', typeName: 'shape', type: 'note', x: 360, y: 90, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:b', semantic_id_source: 'stable' } }, props: { w: 180, h: 120 } },
  ]);
  const before = clone(editor.shapes);
  editor.createBindings = function createOnlyOneBinding(partials) {
    return CanvasProposalEditor.prototype.createBindings.call(this, partials.slice(0, 1));
  };

  const result = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'A partial connector must not survive Apply',
    actions: [{ type: 'canvas_ops', ops: [{
      op: 'connect', semantic_id: 'connector:a-b', from_id: 'shape:a', to_id: 'shape:b',
    }] }],
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /exactly two native bindings|connector/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.bindings, []);
});

test('WebMCP refuses an adapter-incompatible connector before it becomes pending', async () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 0, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'a' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
    { id: 'shape:b', typeName: 'shape', type: 'geo', x: 240, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'b' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
  ]);
  editor.canBindShapes = () => false;
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const response = await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Connector must pass adapter preflight',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'connect', semantic_id: 'a-b', from_id: 'shape:a', to_id: 'shape:b' }] }],
  });
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.status, 'ADAPTER_UNAVAILABLE');
  assert.match(payload.message, /binding|connector/i);
  assert.equal(controller.getState(), null);
  assert.deepEqual(editor.marks, []);
  cleanup();
});

test('Canvas Protocol refuses an adapter-incompatible connector before history or mutation', () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 0, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'a' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
    { id: 'shape:b', typeName: 'shape', type: 'geo', x: 240, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'b' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
  ]);
  const before = clone(editor.shapes);
  editor.canBindShapes = () => false;
  const result = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'Connector must preflight',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'connect', semantic_id: 'a-b', from_id: 'shape:a', to_id: 'shape:b' }] }],
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /binding|connector/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.bindings, []);
  assert.deepEqual(editor.marks, []);
});

test('Canvas Protocol Apply preserves a source and creates one inspectable variant lineage', () => {
  const editor = new CanvasProposalEditor([{
    id: 'shape:source', typeName: 'shape', type: 'geo', x: 80, y: 120, rotation: 0, opacity: 0.8,
    isLocked: false, index: '0001', parentId: 'page:main',
    meta: { fogwood: { semantic_id: 'idea:source', semantic_id_source: 'stable', role: 'idea' }, extension: { retained: true } },
    props: { geo: 'rectangle', w: 180, h: 100, color: 'blue', fill: 'semi', richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Source' }] }] } },
  }]);
  const before = clone(editor.shapes);
  const result = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'Preserve and mutate one variant',
    actions: [{ type: 'canvas_ops', ops: [
      { op: 'variant', id: 'semantic:idea:source', semantic_id: 'idea:variant', offset_x: 48, offset_y: 64 },
      { op: 'update', id: 'semantic:idea:variant', text: 'Mutated branch', color: 'violet' },
    ] }],
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(editor.shapes.find((shape) => shape.id === 'shape:source'), before[0]);
  const variant = editor.shapes.find((shape) => shape.id !== 'shape:source');
  assert.ok(variant);
  assert.equal(variant.x, 128);
  assert.equal(variant.y, 184);
  assert.equal(variant.opacity, 0.8);
  assert.equal(variant.props.color, 'violet');
  assert.equal(variant.meta.extension.retained, true);
  assert.deepEqual(variant.meta.fogwood, {
    semantic_id: 'idea:variant',
    semantic_id_source: 'stable',
    role: 'variant',
    variant_id: 'idea:variant',
    lineage_source_id: 'idea:source',
  });
  const inspected = inspectSurface(editor).items.find((item) => item.id === variant.id);
  assert.equal(inspected.meta.lineage_source_id, 'idea:source');
  assert.equal(inspected.meta.variant_id, 'idea:variant');
  editor.undo();
  assert.deepEqual(editor.shapes, before);
});

test('Canvas Protocol refuses an image variant without its local asset before history', () => {
  const editor = new CanvasProposalEditor([{
    id: 'shape:image', typeName: 'shape', type: 'image', x: 40, y: 50, rotation: 0, opacity: 1,
    isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'image:source', semantic_id_source: 'stable' } },
    props: { w: 240, h: 160, assetId: 'asset:missing', altText: 'Local image' },
  }]);
  const before = clone(editor.shapes);
  const result = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'Do not clone a missing asset',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'variant', id: 'shape:image', semantic_id: 'image:variant' }] }],
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /device-local asset/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
});

test('Canvas Protocol refuses a remote image asset before variant history or mutation', () => {
  const editor = new CanvasProposalEditor([{
    id: 'shape:image', typeName: 'shape', type: 'image', x: 40, y: 50, rotation: 0, opacity: 1,
    isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'image:source', semantic_id_source: 'stable' } },
    props: { w: 240, h: 160, assetId: 'asset:remote', altText: 'Remote image' },
  }]);
  editor.assets.push({
    id: 'asset:remote', typeName: 'asset', type: 'image', meta: {},
    props: {
      w: 240, h: 160, name: 'Remote image', mimeType: 'image/png', fileSize: 1024,
      src: 'https://example.test/remote.png',
    },
  });
  const before = clone(editor.shapes);

  const result = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'Do not clone a remote asset',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'variant', id: 'shape:image', semantic_id: 'image:variant' }] }],
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /device-local asset/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
});

test('Canvas Protocol grouping and ungrouping are mode-independent and cannot silently skip a reviewed step', () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 0, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'a' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
    { id: 'shape:b', typeName: 'shape', type: 'geo', x: 180, y: 0, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'b' } }, props: { geo: 'rectangle', w: 100, h: 80 } },
  ]);
  editor.setContext({ currentToolId: 'draw', currentToolPath: 'draw.idle' });
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Group outside Select mode',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'group', ids: ['shape:a', 'shape:b'], semantic_id: 'group:ab' }] }],
  };
  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, true);
  const group = editor.shapes.find((shape) => shape.type === 'group');
  assert.ok(group);
  assert.deepEqual(editor.shapes.filter((shape) => shape.parentId === group.id).map((shape) => shape.id).sort(), ['shape:a', 'shape:b']);

  const ungroup = applyProposalToEditor(editor, {
    base_revision: currentRevision(editor),
    summary: 'Ungroup outside Select mode',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'ungroup', ids: [group.id] }] }],
  });
  assert.equal(ungroup.ok, true);
  assert.equal(editor.shapes.some((shape) => shape.id === group.id), false);
  assert.deepEqual(editor.shapes.filter((shape) => shape.parentId === 'page:main').map((shape) => shape.id).sort(), ['shape:a', 'shape:b']);
});

test('Canvas Protocol refuses a locked target before opening an Apply transaction', () => {
  const editor = new CanvasProposalEditor([{
    id: 'shape:locked', type: 'geo', typeName: 'shape', x: 10, y: 10, rotation: 0,
    parentId: 'page:main', isLocked: true, opacity: 1, index: '0001',
    meta: { fogwood: { semantic_id: 'locked:one', semantic_id_source: 'stable' } },
    props: { geo: 'rectangle', w: 120, h: 80, color: 'black', fill: 'none' },
  }]);
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Do not move locked matter',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'update', id: 'semantic:locked:one', x: 80 }] }],
  };

  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /locked/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
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
