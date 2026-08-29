import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createCompareInstrumentScope } from '../app/fogwood-instrument-adapter.ts';
import { CAPABILITY_REGISTRY } from '../app/fogwood-runtime.ts';
import { applyProposalToEditor, createInstrumentControlGesture, currentContextToken, currentRevision, inspectSurface, planCapabilityRequestForEditor, proposalActivityDetail, registerSurfaceTools, updateInstrumentControl } from '../app/surface-tools.ts';
import { relationshipSemanticId } from '../app/fogwood-spatial.ts';
import { CAMERA_OPS_ACTION_SCHEMA, FOGWOOD_SEMANTIC_LOWERERS, PAGE_OPS_ACTION_SCHEMA, searchSemanticLowerers, validateSemanticLowererManifest } from '../app/capabilities/semantic-lowerers.ts';

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
    this.markSnapshots = new Map();
    this.nextMarkIndex = 0;
  }

  getCurrentPageShapes() {
    return this.shapes;
  }

  markHistoryStoppingPoint(name) {
    if (this.pending) this.groups.push(this.pending);
    this.pending = null;
    this.marks.push(name);
    const id = `mark-${this.nextMarkIndex++}`;
    this.markSnapshots.set(id, {
      shapes: clone(this.shapes),
      bindings: clone(this.bindings ?? []),
      assets: clone(this.assets ?? []),
      ...(this.pages ? { pages: clone(this.pages), currentPageId: this.currentPageId } : {}),
    });
    return id;
  }

  bailToMark(id) {
    const snapshot = this.markSnapshots.get(id);
    if (!snapshot) return;
    this.shapes = clone(snapshot.shapes);
    if ('bindings' in this) this.bindings = clone(snapshot.bindings);
    if ('assets' in this) this.assets = clone(snapshot.assets);
    if (snapshot.pages) { this.pages = clone(snapshot.pages); this.currentPageId = snapshot.currentPageId; }
    this.pending = null;
    this.markSnapshots.delete(id);
    this.marks.pop();
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
    this.options = { maxShapesPerPage: 100, maxPages: 40 };
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
    this.pages = [{ id: 'page:main', typeName: 'page', name: 'Page 1', meta: {} }];
    this.currentPageId = 'page:main';
    this.cameraFocuses = [];
    this.markSnapshots = new Map();
    this.nextMarkIndex = 0;
    this.nextIndex = shapes.length;
    this.nextBindingIndex = 0;
    this.store = { allRecords: () => [...this.shapes, ...this.bindings, ...this.assets, ...this.pages] };
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

  getCurrentPageId() { return this.currentPageId; }
  getPages() { return [...this.pages]; }
  getPage(id) { return this.pages.find((page) => page.id === (typeof id === 'string' ? id : id.id)); }
  createPage(page) { this.pages.push({ typeName: 'page', meta: {}, ...clone(page) }); return this; }
  setCurrentPage(page) { this.currentPageId = typeof page === 'string' ? page : page.id; return this; }
  zoomToBounds(bounds, options) { this.cameraFocuses.push({ bounds: clone(bounds), options: clone(options) }); return this; }

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

  createAssets(records) {
    this.assets.push(...clone(records));
  }

  deleteAssets(ids) {
    const set = new Set(ids);
    this.assets = this.assets.filter((asset) => !set.has(asset.id));
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
    const before = { shapes: clone(this.shapes), bindings: clone(this.bindings), assets: clone(this.assets), pages: clone(this.pages), currentPageId: this.currentPageId };
    fn();
    const after = { shapes: clone(this.shapes), bindings: clone(this.bindings), assets: clone(this.assets), pages: clone(this.pages), currentPageId: this.currentPageId };
    if (!this.pending) this.pending = { before, after, canvas: true };
    else this.pending.after = after;
  }

  bailToMark(id) {
    const snapshot = this.markSnapshots.get(id);
    if (!snapshot) return;
    this.shapes = clone(snapshot.shapes);
    this.bindings = clone(snapshot.bindings);
    this.assets = clone(snapshot.assets);
    this.pending = null;
    this.markSnapshots.delete(id);
    this.marks.pop();
  }

  undo() {
    const group = this.pending ?? this.groups.pop();
    if (!group) return;
    if (group.canvas) {
      this.shapes = clone(group.before.shapes);
      this.bindings = clone(group.before.bindings);
      this.assets = clone(group.before.assets);
      this.pages = clone(group.before.pages);
      this.currentPageId = group.before.currentPageId;
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

test('versioned semantic lowerers are immutable, schema-valid, and searchable through the stable capability tool', async () => {
  assert.deepEqual(FOGWOOD_SEMANTIC_LOWERERS.map((entry) => entry.id), ['page.lifecycle@1', 'camera.focus-bounds@1']);
  assert.equal(FOGWOOD_SEMANTIC_LOWERERS.every(validateSemanticLowererManifest), true);
  assert.equal(Object.isFrozen(FOGWOOD_SEMANTIC_LOWERERS), true);
  assert.equal(Object.isFrozen(FOGWOOD_SEMANTIC_LOWERERS[0].input_schema), true);
  assert.equal(FOGWOOD_SEMANTIC_LOWERERS[0].input_schema, PAGE_OPS_ACTION_SCHEMA);
  assert.equal(FOGWOOD_SEMANTIC_LOWERERS[1].input_schema, CAMERA_OPS_ACTION_SCHEMA);
  assert.equal(validateSemanticLowererManifest({ ...FOGWOOD_SEMANTIC_LOWERERS[0], version: 2 }), false);
  assert.deepEqual(searchSemanticLowerers('new page').map((entry) => entry.id), ['page.lifecycle@1']);

  const editor = new CanvasProposalEditor();
  const cleanup = registerSurfaceTools(editor, () => {});
  assert.deepEqual(editor.registeredTools.map((tool) => tool.name), ['fogwood-inspect', 'fogwood-capabilities', 'fogwood-propose']);
  const capabilities = editor.registeredTools.find((tool) => tool.name === 'fogwood-capabilities');
  const response = JSON.parse((await capabilities.execute({ mode: 'search', query: 'viewport focus' })).content[0].text);
  assert.deepEqual(response.semantic_lowerers.map((entry) => entry.id), ['camera.focus-bounds@1']);
  cleanup();
});

test('page lifecycle stages exact frozen page identity and applies or rejects through page authority', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const request = {
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Create a dedicated sketch page',
    actions: [{ type: 'page_ops', operation: { op: 'create_and_switch', semantic_id: 'page:sketches', name: 'Sketches' } }],
  };
  const staged = JSON.parse((await propose.execute(request)).content[0].text);
  assert.equal(staged.status, 'STAGED');
  const reviewed = controller.getState().plan;
  assert.equal(reviewed.actions[0].type, 'page_ops');
  assert.match(reviewed.action_lowerings[0].page.id, /^page:fogwood-[0-9a-f]{24}$/);
  assert.equal(Object.isFrozen(reviewed.action_lowerings[0].page), true);
  assert.equal(editor.pages.length, 1);
  assert.equal(controller.reject().status, 'REJECTED');
  assert.equal(editor.pages.length, 1);
  assert.equal(editor.currentPageId, 'page:main');

  assert.equal(JSON.parse((await propose.execute(request)).content[0].text).status, 'STAGED');
  assert.equal(controller.apply().status, 'APPLIED');
  assert.equal(editor.pages.length, 2);
  assert.equal(editor.currentPageId, reviewed.action_lowerings[0].page.id);
  assert.equal(editor.getPage(editor.currentPageId).meta.fogwood_semantic_id, 'page:sketches');
  assert.equal(editor.marks.filter((name) => name === 'Apply agent proposal').length, 1);
  editor.undo();
  assert.equal(editor.pages.length, 1);
  assert.equal(editor.currentPageId, 'page:main');
  cleanup();
});

test('page lifecycle refuses the page limit before staging', async () => {
  const editor = new CanvasProposalEditor();
  editor.options.maxPages = 1;
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const response = JSON.parse((await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Create a page beyond the limit',
    actions: [{ type: 'page_ops', operation: { op: 'create_and_switch', semantic_id: 'page:overflow', name: 'Overflow' } }],
  })).content[0].text);
  assert.equal(response.status, 'ERROR');
  assert.match(response.message, /page limit/i);
  assert.equal(controller.getState(), null);
  assert.equal(editor.pages.length, 1);
  cleanup();
});

test('camera focus is reviewed as an exact region and applies without document history or revision change', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const request = {
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Focus the sketch region',
    actions: [{ type: 'camera_ops', operation: { op: 'focus_bounds', x: 120, y: 80, w: 640, h: 420, inset: 48 } }],
  };
  assert.equal(JSON.parse((await propose.execute(request)).content[0].text).status, 'STAGED');
  const reviewed = controller.getState().plan;
  assert.deepEqual(reviewed.preview.regions.at(-1).bounds, { x: 120, y: 80, w: 640, h: 420 });
  assert.deepEqual(reviewed.transaction, {
    contract_version: 1, authority: 'page-owned', atomic: true, editor_run: 'none', history: 'none', undo: 'not-applicable', apply: 'frozen-context-lowering-only', reject: 'no-mutation',
  });
  assert.equal(controller.reject().status, 'REJECTED');
  assert.equal(editor.cameraFocuses.length, 0);

  assert.equal(JSON.parse((await propose.execute(request)).content[0].text).status, 'STAGED');
  assert.equal(controller.apply().status, 'APPLIED');
  assert.deepEqual(editor.cameraFocuses, [{ bounds: { x: 120, y: 80, w: 640, h: 420 }, options: { immediate: true, inset: 48 } }]);
  assert.equal(currentRevision(editor), inspected.content_revision);
  assert.equal(editor.marks.length, 0);
  cleanup();
});

test('inspect exposes a bounded context token separate from content revision', () => {
  const editor = new CanvasProposalEditor();
  const first = inspectSurface(editor);
  assert.equal(first.canvas_context.schema, 'fogwood.context.v1');
  assert.equal(first.context_token.length, 16);
  assert.equal(first.content_revision, currentRevision(editor));
  assert.equal(first.protocol.registry_version, '8');
  assert.equal(first.capability_ontology.qualified_capability_count, 9);
  assert.equal(first.medium_contract.schema, 'fogwood.medium-composition.v1');
  assert.equal(first.medium_contract.material_only_incomplete, true);
  assert.match(first.medium_contract.medium_statement, /turns capabilities into editable matter/i);
  assert.match(first.medium_contract.external_material_workflow, /wait for page Apply/i);
  assert.equal(first.medium_contract.artistic_constraints.safety_gate, false);
  assert.equal(first.medium_contract.artistic_constraints.truth_gate, false);
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

test('public empty-editor inspect stages and applies a small native vertical with typed relations atomically', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const inspectTool = editor.registeredTools.find((tool) => tool.name === 'fogwood-inspect');
  const proposeTool = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const before = clone({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets });
  const inspected = JSON.parse((await inspectTool.execute({})).content[0].text);
  const relationshipId = 'relation:question-supports-sketch';
  const response = await proposeTool.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Compose a small native vertical',
    actions: [{
      type: 'canvas_ops',
      composition_id: 'composition:vertical',
      ops: [
        { op: 'create', semantic_id: 'idea:question', kind: 'rectangle', x: 120, y: 100, w: 180, h: 100, role: 'question', region_id: 'region:upper', rotation: 0.15, opacity: 0.8 },
        { op: 'create', semantic_id: 'idea:note', kind: 'note', x: 520, y: 300, w: 180, h: 120, role: 'reflection', region_id: 'region:lower' },
        { op: 'draw', semantic_id: 'mark:thread', points: [{ x: 760, y: 120 }, { x: 820, y: 170 }, { x: 790, y: 240 }] },
        {
          op: 'connect',
          semantic_id: `relationship:${relationshipId}`,
          from_id: 'semantic:idea:note',
          to_id: 'semantic:mark:thread',
          text: 'supports',
          relationship_id: relationshipId,
          relationship_kind: 'supports',
        },
      ],
    }],
  });
  const staged = JSON.parse(response.content[0].text);
  assert.equal(staged.status, 'STAGED');
  assert.deepEqual({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets }, before);

  assert.equal(controller.apply().status, 'APPLIED');
  const applied = inspectSurface(editor);
  assert.equal(applied.items.length, 4);
  assert.equal(new Set(applied.items.map((item) => item.meta.composition_id)).size, 1);
  assert.equal(applied.items.every((item) => item.meta.composition_id === 'composition:vertical'), true);
  assert.equal(applied.counts.regions, 2);
  assert.equal(applied.semantic_relationships.length, 1);
  assert.deepEqual(applied.semantic_relationships[0], {
    id: relationshipId,
    kind: 'supports',
    source_semantic_id: 'idea:note',
    target_semantic_id: 'mark:thread',
    label: 'supports',
    shape_id: applied.semantic_relationships[0].shape_id,
  });
  assert.equal(applied.bindings.length, 2);
  assert.equal(applied.items.find((item) => item.semantic_id === 'idea:question').rotation, 0.15);
  assert.equal(applied.items.find((item) => item.semantic_id === 'idea:question').opacity, 0.8);
  assert.equal(editor.marks.filter((mark) => mark === 'Apply agent proposal').length, 1);

  editor.undo();
  assert.deepEqual({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets }, before);
  assert.deepEqual(inspectSurface(editor).items, []);
  cleanup();
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

test('public material proposals retain a frozen lowering and Apply does not decode again', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  let decodeCount = 0;
  const decoder = () => {
    decodeCount += 1;
    return { width: 1, height: 1 };
  };
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; }, undefined, { decodeRaster: decoder });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const response = await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Stage an image material',
    actions: [{
      type: 'add_materials',
      materials: [{
        semantic_id: 'material:seed-image',
        mime_type: 'image/png',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        label: 'A tiny seed image',
        x: 80,
        y: 120,
        w: 120,
        h: 120,
      }],
    }],
  });

  assert.equal(JSON.parse(response.content[0].text).status, 'STAGED');
  assert.equal(decodeCount, 1);
  const pending = controller.getState();
  assert.equal(pending.plan.schema, 'fogwood.prepared-canvas-plan.v1');
  assert.equal(pending.plan.page_id, 'page:main');
  assert.equal(pending.plan.material_evidence.length, 1);
  assert.equal(pending.plan.material_evidence[0].byte_length, 68);
  assert.equal(pending.plan.preflight.status, 'passed');
  assert.deepEqual(pending.plan.transaction, {
    contract_version: 1,
    authority: 'page-owned',
    atomic: true,
    editor_run: 'one',
    history: 'one-stopping-point',
    undo: 'one-step',
    apply: 'frozen-lowerings-only',
    reject: 'no-mutation',
  });
  assert.equal(Object.isFrozen(pending.plan), true);
  assert.equal(Object.isFrozen(pending.plan.actions), true);
  assert.equal(Object.isFrozen(pending.plan.actions[0]), true);
  assert.equal(Object.isFrozen(pending.plan.actions[0].materials), true);
  assert.equal(Object.isFrozen(pending.plan.material_lowerings[0]), true);
  assert.equal(Object.isFrozen(pending.plan.material_lowerings[0].shape), true);
  assert.equal(Object.isFrozen(pending.plan.material_evidence[0].dimensions), true);
  const stagedMaterial = pending.plan.actions.find((action) => action.type === 'add_materials').materials[0];
  assert.equal(pending.plan.prepared_materials[0], stagedMaterial);
  const stagedDigest = pending.plan.digest;

  assert.equal(controller.apply().status, 'APPLIED');
  assert.equal(decodeCount, 1);
  assert.equal(editor.assets.length, 1);
  assert.equal(editor.shapes.filter((shape) => shape.type === 'image').length, 1);
  assert.equal(editor.marks.filter((mark) => mark === 'Apply agent proposal').length, 1);
  assert.equal(stagedDigest, pending.plan.digest);
  editor.undo();
  assert.equal(editor.assets.length, 0);
  assert.equal(editor.shapes.length, 0);
  cleanup();
});

test('public prepared-plan identity makes exact retries idempotent and correlates lifecycle events', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const lifecycle = [];
  const cleanup = registerSurfaceTools(
    editor,
    () => {},
    undefined,
    undefined,
    (value) => { controller = value; },
    (event) => lifecycle.push(event),
  );
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const request = {
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Stage one native idea',
    actions: [{
      type: 'canvas_ops',
      composition_id: 'identity-proof',
      ops: [{ op: 'create', semantic_id: 'idea:identity-proof', kind: 'note', x: 120, y: 140, w: 220, h: 140, text: 'Identity proof' }],
    }],
  };

  const first = JSON.parse((await propose.execute(request)).content[0].text);
  assert.equal(first.status, 'STAGED');
  assert.match(first.plan_id, /^sha256:[0-9a-f]{64}$/);
  const stagedPlan = controller.getState().plan;
  assert.equal(stagedPlan.preview.schema, 'fogwood.prepared-canvas-preview.v1');
  assert.ok(Object.isFrozen(stagedPlan.preview));
  assert.ok(Object.isFrozen(stagedPlan.preview.additions));
  assert.equal(first.plan_id, controller.getState().plan.plan_id);
  const pending = controller.getState();

  const retry = JSON.parse((await propose.execute(clone(request))).content[0].text);
  assert.equal(retry.status, 'ALREADY_STAGED');
  assert.equal(retry.plan_id, first.plan_id);
  assert.equal(controller.getState(), pending);
  assert.equal(lifecycle.filter((event) => event.type === 'proposal-staged').length, 1);

  const divergent = JSON.parse((await propose.execute({ ...request, summary: 'A different request' })).content[0].text);
  assert.equal(divergent.status, 'ERROR');
  assert.equal(controller.getState(), pending);

  assert.equal(controller.reject().status, 'REJECTED');
  assert.deepEqual(lifecycle.map((event) => event.type), ['proposal-staged', 'proposal-rejected']);
  assert.equal(lifecycle.every((event) => event.plan_id === first.plan_id), true);

  const restaged = JSON.parse((await propose.execute(request)).content[0].text);
  assert.equal(restaged.status, 'STAGED');
  assert.equal(restaged.plan_id, first.plan_id);
  assert.equal(controller.apply().status, 'APPLIED');
  assert.deepEqual(lifecycle.map((event) => event.type), [
    'proposal-staged',
    'proposal-rejected',
    'proposal-staged',
    'proposal-applied',
  ]);
  assert.equal(lifecycle.every((event) => event.plan_id === first.plan_id), true);
  cleanup();
});

test('fogwood-inspect returns bounded plan-origin changes and explicit undo deltas through the existing tool', async () => {
  const editor = new CanvasProposalEditor();
  let storeListener = () => {};
  editor.store.listen = (listener, filters) => {
    assert.deepEqual(filters, { scope: 'document' });
    storeListener = listener;
    return () => { storeListener = () => {}; };
  };
  const originalRun = editor.run.bind(editor);
  editor.run = (fn, options) => {
    const before = new Map(editor.shapes.map((shape) => [shape.id, clone(shape)]));
    const result = originalRun(fn, options);
    const added = Object.fromEntries(editor.shapes.filter((shape) => !before.has(shape.id)).map((shape) => [shape.id, clone(shape)]));
    storeListener({ source: 'user', changes: { added, updated: {}, removed: {} } });
    return result;
  };
  const originalUndo = editor.undo.bind(editor);
  editor.undo = () => {
    const before = new Map(editor.shapes.map((shape) => [shape.id, clone(shape)]));
    originalUndo();
    const removed = Object.fromEntries([...before].filter(([id]) => !editor.shapes.some((shape) => shape.id === id)));
    storeListener({ source: 'user', changes: { added: {}, updated: {}, removed } });
  };
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const inspect = editor.registeredTools.find((tool) => tool.name === 'fogwood-inspect');
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const initial = JSON.parse((await inspect.execute({})).content[0].text);
  assert.equal(initial.change_sequence, 0);
  const staged = JSON.parse((await propose.execute({
    base_revision: initial.content_revision,
    context_token: initial.context_token,
    summary: 'Create one change-ledger proof',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'create', semantic_id: 'ledger:proof', kind: 'note', x: 80, y: 100, w: 180, h: 120, text: 'Ledger proof' }] }],
  })).content[0].text);
  assert.equal(controller.apply().status, 'APPLIED');
  const afterApply = JSON.parse((await inspect.execute({ since_sequence: 0, change_page_size: 8 })).content[0].text);
  assert.equal(afterApply.status, 'OK');
  assert.equal(afterApply.changes.length, 1);
  assert.equal(afterApply.changes[0].origin, `fogwood:${staged.plan_id}`);
  assert.deepEqual(afterApply.changes[0].semantic_ids, ['ledger:proof']);
  assert.deepEqual(afterApply.attention.auto_acknowledged_sequences, [afterApply.changes[0].sequence]);
  assert.deepEqual(afterApply.attention.wake_worthy_sequences, []);
  editor.undo();
  const afterUndo = JSON.parse((await inspect.execute({ since_sequence: afterApply.change_sequence })).content[0].text);
  assert.equal(afterUndo.changes[0].origin, 'system:undo');
  assert.equal(afterUndo.changes[0].kind, 'delete');
  assert.deepEqual(afterUndo.attention.wake_worthy_sequences, [afterUndo.changes[0].sequence]);
  cleanup();
});

test('prepared-plan digest commits to the exact accepted material bytes', async () => {
  const editor = new CanvasProposalEditor();
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const svg = (fill) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="${fill}"/></svg>`).toString('base64');
  const stage = async (base64) => {
    const inspected = inspectSurface(editor);
    const response = await propose.execute({
      base_revision: inspected.content_revision,
      context_token: inspected.context_token,
      summary: 'Stage an SVG material',
      actions: [{ type: 'add_materials', materials: [{ semantic_id: 'material:svg', mime_type: 'image/svg+xml', base64, x: 80, y: 120, w: 120, h: 80 }] }],
    });
    assert.equal(JSON.parse(response.content[0].text).status, 'STAGED');
    return controller.getState().plan;
  };

  const red = await stage(svg('red'));
  const redBytes = red.prepared_materials[0].canonical_base64;
  const redDigest = red.digest;
  const redPlanId = red.plan_id;
  assert.equal(controller.reject().status, 'REJECTED');
  const blue = await stage(svg('blue'));
  assert.notEqual(blue.prepared_materials[0].canonical_base64, redBytes);
  assert.notEqual(blue.digest, redDigest);
  assert.notEqual(blue.plan_id, redPlanId);
  assert.notEqual(blue.material_evidence[0].content_hash, red.material_evidence[0].content_hash);
  assert.equal(controller.reject().status, 'REJECTED');
  cleanup();
});

test('public Apply rolls back earlier native creates when a later connector postcondition fails', async () => {
  const editor = new CanvasProposalEditor([
    { id: 'shape:a', typeName: 'shape', type: 'geo', x: 20, y: 30, rotation: 0, opacity: 1, isLocked: false, index: '0001', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:a' } }, props: { geo: 'rectangle', w: 160, h: 100, richText: { type: 'doc', content: [] } } },
    { id: 'shape:b', typeName: 'shape', type: 'note', x: 360, y: 90, rotation: 0, opacity: 1, isLocked: false, index: '0002', parentId: 'page:main', meta: { fogwood: { semantic_id: 'idea:b' } }, props: { w: 180, h: 120, richText: { type: 'doc', content: [] } } },
  ]);
  editor.createBindings = function createOnlyOneBinding(partials) {
    return CanvasProposalEditor.prototype.createBindings.call(this, partials.slice(0, 1));
  };
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const before = clone({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets });
  const response = await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Refuse a partial connector atomically',
    actions: [{ type: 'canvas_ops', ops: [
      { op: 'create', semantic_id: 'new:a', kind: 'rectangle', x: 20, y: 260, w: 120, h: 80, text: 'A' },
      { op: 'create', semantic_id: 'new:b', kind: 'ellipse', x: 280, y: 260, w: 120, h: 80, text: 'B' },
      { op: 'connect', semantic_id: 'new:edge', from_id: 'semantic:new:a', to_id: 'semantic:new:b', text: 'fails late' },
    ] }],
  });
  assert.equal(JSON.parse(response.content[0].text).status, 'STAGED');
  const revisionBeforeApply = currentRevision(editor);
  const groupsBeforeApply = editor.groups.length;
  const result = controller.apply();
  assert.equal(result.status, 'ERROR');
  assert.deepEqual({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets }, before);
  assert.equal(currentRevision(editor), revisionBeforeApply);
  assert.equal(editor.groups.length, groupsBeforeApply);
  assert.equal(editor.pending, null);
  assert.deepEqual(editor.marks, []);
  cleanup();
});

test('public Apply rolls back an earlier material when a later shape write fails', async () => {
  const editor = new CanvasProposalEditor();
  let shapeWrites = 0;
  const createShapes = editor.createShapes.bind(editor);
  editor.createShapes = (records) => {
    shapeWrites += 1;
    if (shapeWrites === 2) throw new Error('late material shape failure');
    return createShapes(records);
  };
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; }, undefined, { decodeRaster: () => ({ width: 1, height: 1 }) });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = inspectSurface(editor);
  const before = clone({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets });
  const material = (semantic_id, x) => ({ semantic_id, mime_type: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', x, y: 40, w: 100, h: 100 });
  const response = await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Refuse a late material write atomically',
    actions: [{ type: 'add_materials', materials: [material('material:first', 20), material('material:second', 180)] }],
  });
  assert.equal(JSON.parse(response.content[0].text).status, 'STAGED');
  const revisionBeforeApply = currentRevision(editor);
  const groupsBeforeApply = editor.groups.length;
  const result = controller.apply();
  assert.equal(result.status, 'ERROR');
  assert.match(result.message, /late material shape failure/i);
  assert.deepEqual({ shapes: editor.shapes, bindings: editor.bindings, assets: editor.assets }, before);
  assert.equal(currentRevision(editor), revisionBeforeApply);
  assert.equal(editor.groups.length, groupsBeforeApply);
  assert.equal(editor.pending, null);
  assert.deepEqual(editor.marks, []);
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

test('seeded composition stages through WebMCP, preserves sources, applies once, rejects cleanly, and undoes once', async () => {
  const sources = [
    {
      id: 'shape:seed-a', typeName: 'shape', type: 'geo', x: 80, y: 120, rotation: 0, opacity: 1,
      isLocked: false, index: '0001', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'idea:seed-a', semantic_id_source: 'stable', role: 'idea' } },
      props: { geo: 'rectangle', w: 180, h: 100, color: 'blue', fill: 'solid', richText: { type: 'doc', content: [] } },
    },
    {
      id: 'shape:seed-b', typeName: 'shape', type: 'note', x: 360, y: 260, rotation: 0, opacity: 1,
      isLocked: false, index: '0002', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'idea:seed-b', semantic_id_source: 'stable', role: 'idea', variant_id: 'variant:parent' } },
      props: { w: 200, h: 200, color: 'yellow', richText: { type: 'doc', content: [] } },
    },
  ];
  const editor = new CanvasProposalEditor(sources);
  editor.setContext({ selectedShapeIds: ['shape:seed-b', 'shape:seed-a'] });
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const propose = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const before = clone(editor.shapes);
  const inspected = inspectSurface(editor);
  const response = await propose.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Seed a preserved branch-cluster',
    actions: [{ type: 'seeded_composition', scope: { kind: 'selection' }, seed: 'forest-floor', wildness: 0.7 }],
  });
  const staged = JSON.parse(response.content[0].text);
  assert.equal(staged.status, 'STAGED');
  assert.equal(staged.proposal.actions[0].algorithm_version, 1);
  assert.equal(staged.proposal.actions[0].source_revision, inspected.content_revision);
  assert.equal(staged.proposal.actions[0].lineage.length, 2);
  const preparedPlan = controller.getState().plan;
  assert.equal(preparedPlan.schema, 'fogwood.prepared-canvas-plan.v1');
  assert.equal(preparedPlan.page_id, 'page:main');
  assert.equal(preparedPlan.seeded_evidence.length, 1);
  assert.equal(preparedPlan.seeded_evidence[0].source_revision, inspected.content_revision);
  assert.equal(preparedPlan.seeded_evidence[0].algorithm_version, 1);
  const firstSeedPlanId = preparedPlan.plan_id;
  assert.equal(preparedPlan.preflight.status, 'passed');
  assert.equal(Object.isFrozen(preparedPlan.action_lowerings[0].canvas), true);
  assert.deepEqual(editor.shapes, before);

  assert.equal(controller.apply().status, 'APPLIED');
  assert.deepEqual(editor.shapes.filter((shape) => before.some((source) => source.id === shape.id)), before);
  const variants = editor.shapes.filter((shape) => !before.some((source) => source.id === shape.id));
  assert.equal(variants.length, 2);
  assert.equal(variants.every((shape) => shape.meta?.fogwood?.seeded_grammar === 'remix'), true);
  assert.equal(variants.every((shape) => shape.meta?.fogwood?.seeded_algorithm_version === 1), true);
  assert.equal(variants.every((shape) => shape.meta?.fogwood?.seeded_seed === 'forest-floor'), true);
  assert.equal(variants.every((shape) => shape.meta?.fogwood?.seeded_source_revision === inspected.content_revision), true);
  assert.deepEqual(editor.marks, ['Apply agent proposal']);
  editor.undo();
  assert.deepEqual(editor.shapes, before);

  const rejectBase = inspectSurface(editor);
  const rejectResponse = await propose.execute({
    base_revision: rejectBase.content_revision,
    context_token: rejectBase.context_token,
    summary: 'Reject another reproducible branch',
    actions: [{ type: 'seeded_composition', scope: { kind: 'selection' }, seed: 'other-branch', wildness: 0.3 }],
  });
  assert.equal(JSON.parse(rejectResponse.content[0].text).status, 'STAGED');
  assert.notEqual(controller.getState().plan.plan_id, firstSeedPlanId);
  const revisionBeforeReject = currentRevision(editor);
  assert.equal(controller.reject().status, 'REJECTED');
  assert.equal(currentRevision(editor), revisionBeforeReject);
  assert.deepEqual(editor.shapes, before);
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

test('page-owned Apply rejects retired instrument proposals before history or mutation', () => {
  const editor = new CanvasProposalEditor();
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Retired instrument request',
    actions: [{ type: 'set_instrument_inputs', changes: [{ id: 'shape:input', value: 0.8 }] }],
  };
  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /retired/i);
  assert.deepEqual(editor.shapes, before);
  assert.deepEqual(editor.marks, []);
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

test('public typed relationship text updates keep native rich text and inspected semantic labels synchronized', async () => {
  const relationshipId = 'relation:question-image';
  const relationshipSemantic = relationshipSemanticId(relationshipId);
  const editor = new CanvasProposalEditor([
    {
      id: 'shape:question', typeName: 'shape', type: 'geo', x: 20, y: 30, rotation: 0, opacity: 1,
      isLocked: false, index: '0001', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'question:one', semantic_id_source: 'stable' } },
      props: { geo: 'rectangle', w: 160, h: 100, richText: { type: 'doc', content: [] } },
    },
    {
      id: 'shape:image', typeName: 'shape', type: 'geo', x: 360, y: 90, rotation: 0, opacity: 1,
      isLocked: false, index: '0002', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'image:one', semantic_id_source: 'stable' } },
      props: { geo: 'ellipse', w: 180, h: 120, richText: { type: 'doc', content: [] } },
    },
    {
      id: 'shape:relationship', typeName: 'shape', type: 'arrow', x: 180, y: 80, rotation: 0, opacity: 1,
      isLocked: false, index: '0003', parentId: 'page:main',
      meta: {
        fogwood: {
          semantic_id: relationshipSemantic,
          semantic_id_source: 'stable',
          role: 'semantic-relationship',
          relationship_id: relationshipId,
          relationship_kind: 'depends_on',
          source_semantic_id: 'question:one',
          target_semantic_id: 'image:one',
          relationship_label: 'complicates',
          preserved_marker: 'keep-me',
        },
      },
      props: {
        start: { x: 0, y: 0 },
        end: { x: 180, y: 60 },
        richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'complicates' }] }] },
      },
    },
  ]);
  editor.createBindings([{
    type: 'arrow', fromId: 'shape:relationship', toId: 'shape:question',
    props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
  }, {
    type: 'arrow', fromId: 'shape:relationship', toId: 'shape:image',
    props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
  }]);
  let controller;
  const cleanup = registerSurfaceTools(editor, () => {}, undefined, undefined, (value) => { controller = value; });
  const inspectTool = editor.registeredTools.find((tool) => tool.name === 'fogwood-inspect');
  const proposeTool = editor.registeredTools.find((tool) => tool.name === 'fogwood-propose');
  const inspected = JSON.parse((await inspectTool.execute({})).content[0].text);
  const response = await proposeTool.execute({
    base_revision: inspected.content_revision,
    context_token: inspected.context_token,
    summary: 'Update the relationship wording',
    actions: [{ type: 'canvas_ops', ops: [{ op: 'update', id: `semantic:${relationshipSemantic}`, text: 'challenges' }] }],
  });
  assert.equal(JSON.parse(response.content[0].text).status, 'STAGED');
  assert.equal(controller.apply().status, 'APPLIED');

  const applied = JSON.parse((await inspectTool.execute({})).content[0].text);
  const arrow = applied.items.find((item) => item.semantic_id === relationshipSemantic);
  assert.match(JSON.stringify(arrow.props.richText), /challenges/);
  assert.deepEqual(applied.semantic_relationships[0], {
    id: relationshipId,
    kind: 'depends_on',
    source_semantic_id: 'question:one',
    target_semantic_id: 'image:one',
    label: 'challenges',
    shape_id: 'shape:relationship',
  });
  assert.equal(arrow.meta.relationship_kind, 'depends_on');
  assert.equal(editor.getShape('shape:relationship').meta.fogwood.preserved_marker, 'keep-me');
  cleanup();
});

test('inspect exposes semantic relationships only when exact native bindings match durable endpoint metadata', () => {
  const relationshipId = 'relation:bound-only';
  const relationshipSemantic = relationshipSemanticId(relationshipId);
  const editor = new CanvasProposalEditor([
    {
      id: 'shape:source', typeName: 'shape', type: 'geo', x: 20, y: 30, rotation: 0, opacity: 1,
      isLocked: false, index: '0001', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'idea:source', semantic_id_source: 'stable' } },
      props: { geo: 'rectangle', w: 160, h: 100, richText: { type: 'doc', content: [] } },
    },
    {
      id: 'shape:target', typeName: 'shape', type: 'geo', x: 360, y: 90, rotation: 0, opacity: 1,
      isLocked: false, index: '0002', parentId: 'page:main',
      meta: { fogwood: { semantic_id: 'idea:target', semantic_id_source: 'stable' } },
      props: { geo: 'ellipse', w: 180, h: 120, richText: { type: 'doc', content: [] } },
    },
    {
      id: 'shape:relationship', typeName: 'shape', type: 'arrow', x: 180, y: 80, rotation: 0, opacity: 1,
      isLocked: false, index: '0003', parentId: 'page:main',
      meta: {
        fogwood: {
          semantic_id: relationshipSemantic,
          semantic_id_source: 'stable',
          role: 'semantic-relationship',
          relationship_id: relationshipId,
          relationship_kind: 'supports',
          source_semantic_id: 'idea:source',
          target_semantic_id: 'idea:target',
          relationship_label: 'supports',
        },
      },
      props: {
        start: { x: 0, y: 0 }, end: { x: 180, y: 60 },
        richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'supports' }] }] },
      },
    },
  ]);

  assert.deepEqual(inspectSurface(editor).semantic_relationships, []);
  editor.createBindings([{
    type: 'arrow', fromId: 'shape:relationship', toId: 'shape:source',
    props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
  }, {
    type: 'arrow', fromId: 'shape:relationship', toId: 'shape:target',
    props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
  }]);
  assert.equal(inspectSurface(editor).semantic_relationships.length, 1);

  editor.bindings.find((binding) => binding.props.terminal === 'end').toId = 'shape:source';
  assert.deepEqual(inspectSurface(editor).semantic_relationships, []);
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

test('page-owned Apply rejects retired instrument proposals before lock evaluation', () => {
  const editor = new CanvasProposalEditor();
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Reject legacy scenario',
    actions: [{ type: 'set_instrument_inputs', changes: [{ id: 'shape:input', value: 0.8 }] }],
  };

  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /retired/i);
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

test('proposal activity describes the generic native diff counts', () => {
  assert.equal(proposalActivityDetail({
    counts: { adds: 12, updates: 0, moves: 0, removes: 0 },
  }), '12 additions, 0 updates, 0 moves, 0 removals await review.');
});
