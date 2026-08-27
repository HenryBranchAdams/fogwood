import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { applyProposalToEditor, currentRevision, inspectSurface } from '../app/surface-tools.ts';
import { validateProposal } from '../app/fogwood-runtime.ts';

after(() => {
  for (const handle of process._getActiveHandles()) handle?.unref?.();
});

function clone(value) {
  return structuredClone(value);
}

class SpatialEditor {
  constructor(shapes = []) {
    this.shapes = clone(shapes);
    this.assets = [];
    this.history = [];
    this.pending = null;
    this.options = { maxShapesPerPage: 100 };
    this.selected = [];
    this.store = { allRecords: () => [] };
  }

  getCurrentPageShapes() { return this.shapes; }
  getCurrentPageShapesSorted() { return this.shapes; }
  getCurrentPageId() { return 'page:main'; }
  getAssets() { return this.assets; }
  getAsset() { return undefined; }
  getShape(id) { return this.shapes.find((shape) => shape.id === id); }
  getShapePageBounds(shape) { return { x: shape.x, y: shape.y, w: shape.props?.w ?? 80, h: shape.props?.h ?? 60 }; }
  getShapeUtil() { return { getText: () => '' }; }
  getCurrentPageState() { return { selectedShapeIds: this.selected, focusedGroupId: undefined, editingShapeId: undefined }; }
  getViewportPageBounds() { return { x: 0, y: 0, w: 1_000, h: 800 }; }
  getCamera() { return { x: 0, y: 0, z: 1 }; }
  getCurrentPageBounds() { return { x: 0, y: 0, w: 1_000, h: 800 }; }
  getIsReadonly() { return false; }
  markHistoryStoppingPoint() { if (this.pending) this.history.push(this.pending); this.pending = null; }
  run(fn) { const before = clone(this.shapes); fn(); const after = clone(this.shapes); if (!this.pending) this.pending = { before, after }; else this.pending.after = after; }
  createShapes(shapes) { this.shapes.push(...clone(shapes)); }
  updateShapes(updates) {
    for (const update of updates) {
      const shape = this.getShape(update.id);
      if (!shape) throw new Error(`Missing ${update.id}`);
      Object.assign(shape, update);
      shape.props = { ...shape.props, ...(update.props ?? {}) };
    }
  }
  deleteShapes(ids) { this.shapes = this.shapes.filter((shape) => !ids.includes(shape.id)); }
  undo() { const group = this.pending ?? this.history.pop(); if (!group) return; this.shapes = clone(group.before); this.pending = null; }
}

function seedEditor() {
  return new SpatialEditor([
    { id: 'shape:a', type: 'geo', typeName: 'shape', x: 0, y: 0, rotation: 0, parentId: 'page:main', isLocked: false, opacity: 1, index: 'a', meta: { fogwood: { semantic_id: 'idea:a', semantic_id_source: 'stable' } }, props: { geo: 'rectangle', w: 80, h: 60, color: 'blue', fill: 'solid', richText: '' } },
    { id: 'shape:b', type: 'geo', typeName: 'shape', x: 120, y: 0, rotation: 0, parentId: 'page:main', isLocked: false, opacity: 1, index: 'b', meta: { fogwood: { semantic_id: 'idea:b', semantic_id_source: 'stable' } }, props: { geo: 'ellipse', w: 80, h: 60, color: 'green', fill: 'solid', richText: '' } },
  ]);
}

test('page Apply projects spatial moves, typed arrows, and a preserved variant in one undo boundary', () => {
  const editor = seedEditor();
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Compose a semantic constellation',
    actions: [
      { type: 'apply_spatial_moves', moves: [{ kind: 'orbit', scope: { kind: 'explicit', semantic_ids: ['idea:a', 'idea:b'] }, center: { x: 500, y: 400 }, radius: 180 }] },
      { type: 'add_relationships', relationships: [{ id: 'edge:a-b', kind: 'supports', source_semantic_id: 'idea:a', target_semantic_id: 'idea:b', label: 'evidence' }] },
    ],
  };
  const validation = validateProposal(proposal, {
    current_revision: proposal.base_revision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  });
  assert.equal(validation.ok, true);
  assert.equal(applyProposalToEditor(editor, proposal).ok, true);
  assert.equal(editor.history.length, 0);
  assert.equal(editor.pending !== null, true);
  assert.equal(editor.shapes.filter((shape) => shape.type === 'arrow').length, 1);
  assert.equal(editor.shapes.length, 3);
  const source = editor.shapes.find((shape) => shape.meta?.fogwood?.semantic_id === 'idea:a');
  assert.equal(source.x === 0 && source.y === 0, false);
  const inspected = inspectSurface(editor);
  assert.equal(inspected.semantic_relationships[0].kind, 'supports');
  assert.equal(inspected.semantic_relationships[0].source_semantic_id, 'idea:a');
  const variantProposal = {
    base_revision: currentRevision(editor),
    summary: 'Preserve a variant',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'mutate', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, offset: { x: 160, y: 80 }, patches: { text: 'Variant' } }] }],
  };
  assert.equal(applyProposalToEditor(editor, variantProposal).ok, true);
  const variant = editor.shapes.find((shape) => shape.meta?.fogwood?.role === 'variant');
  assert.equal(variant.meta.fogwood.lineage_source_id, 'idea:a');
  assert.equal(variant.props.richText !== undefined, true);
  editor.undo();
  assert.equal(editor.shapes.length, 3);
  editor.undo();
  assert.equal(editor.shapes.length, 2);
});

test('relationship arrow geometry derives from final positions when action order is reversed', () => {
  const editor = seedEditor();
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Move then connect',
    actions: [
      { type: 'add_relationships', relationships: [{ id: 'edge:final', kind: 'supports', source_semantic_id: 'idea:a', target_semantic_id: 'idea:b' }] },
      { type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:a', 'idea:b'] }, anchor: { x: 500, y: 500 }, columns: 1 }] },
    ],
  };
  assert.equal(applyProposalToEditor(editor, proposal).ok, true);
  const source = editor.shapes.find((shape) => shape.meta?.fogwood?.semantic_id === 'idea:a');
  const target = editor.shapes.find((shape) => shape.meta?.fogwood?.semantic_id === 'idea:b');
  const arrow = editor.shapes.find((shape) => shape.type === 'arrow');
  assert.equal(arrow.x, source.x + source.props.w / 2);
  assert.equal(arrow.y, source.y + source.props.h / 2);
  assert.equal(arrow.x + arrow.props.end.x, target.x + target.props.w / 2);
  assert.equal(arrow.y + arrow.props.end.y, target.y + target.props.h / 2);
});

test('native add_shapes retains stable composition metadata and refuses duplicate semantic IDs', () => {
  const editor = seedEditor();
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Add a labeled region mark',
    actions: [{ type: 'add_shapes', shapes: [{ kind: 'rectangle', x: 300, y: 200, w: 120, h: 80, text: 'Region', semantic_id: 'mark:region', role: 'evidence', composition_id: 'composition:one', region_id: 'region:alpha', variant_id: 'variant:one', parent_variant_id: 'variant:zero', lineage_source_id: 'idea:a' }] }],
  };
  assert.equal(applyProposalToEditor(editor, proposal).ok, true);
  const added = editor.shapes.find((shape) => shape.meta?.fogwood?.semantic_id === 'mark:region');
  assert.equal(added.meta.fogwood.semantic_id_source, 'stable');
  assert.equal(added.meta.fogwood.region_id, 'region:alpha');
  assert.equal(added.meta.fogwood.lineage_source_id, 'idea:a');
  const duplicate = validateProposal({
    base_revision: currentRevision(editor),
    summary: 'Duplicate',
    actions: [{ type: 'add_shapes', shapes: [{ kind: 'ellipse', semantic_id: 'mark:region' }] }],
  }, {
    current_revision: currentRevision(editor),
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: inspectSurface(editor).regions,
    semantic_relationships: inspectSurface(editor).semantic_relationships,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors.some((error) => error.code === 'DUPLICATE_SEMANTIC_ID'), true);
});

test('v2 composition stages native matter, applies typed edges in one undo step, then respects a human edit before the next mutation', () => {
  const editor = new SpatialEditor();
  const stagedProposal = {
    base_revision: currentRevision(editor),
    summary: 'Stage the evidence constellation',
    rationale: 'Begin with claims, sources, and counterarguments as editable native matter.',
    actions: [{ type: 'insert_recipe', recipe_id: 'fogwood.evidence-constellation', version: 2 }],
  };
  const staged = validateProposal(stagedProposal, {
    current_revision: stagedProposal.base_revision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  });
  assert.equal(staged.ok, true);
  assert.equal(staged.diff.counts.adds, 16);
  assert.equal(staged.diff.recipe_expansions[0].format, 'composition.v2');
  assert.equal(applyProposalToEditor(editor, stagedProposal).ok, true);
  assert.equal(editor.history.length, 0);
  assert.equal(editor.pending !== null, true);
  const applied = inspectSurface(editor);
  assert.equal(applied.items.filter((item) => item.meta?.composition_id === 'fogwood.evidence-constellation').length, 16);
  assert.equal(applied.semantic_relationships.length, 8);
  assert.equal(applied.semantic_relationships.every((edge) => edge.kind === 'supports' || edge.kind === 'contradicts' || edge.kind === 'depends_on'), true);

  const editedShape = editor.shapes.find((shape) => shape.meta?.fogwood?.semantic_id === 'claim:core');
  assert.ok(editedShape);
  editedShape.x += 57;
  const humanEditedX = editedShape.x;
  const editedRevision = currentRevision(editor);
  const mutation = {
    base_revision: editedRevision,
    summary: 'Reframe the edited claim',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['claim:core'] }, anchor: { x: 640, y: 420 }, columns: 1 }] }],
  };
  const mutationValidation = validateProposal(mutation, {
    current_revision: editedRevision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: inspectSurface(editor).regions,
    semantic_relationships: inspectSurface(editor).semantic_relationships,
  });
  assert.equal(mutationValidation.ok, true);
  assert.equal(mutationValidation.diff.spatial_moves[0].before.x, humanEditedX);
  assert.equal(applyProposalToEditor(editor, mutation).ok, true);
  assert.equal(inspectSurface(editor).semantic_relationships.length, 8);
  editor.undo();
  assert.equal(currentRevision(editor), editedRevision);
  assert.equal(inspectSurface(editor).items.find((item) => item.meta?.semantic_id === 'claim:core')?.x, humanEditedX);
});

test('manual geometry is part of the next revision and changes the next staged plan', () => {
  const editor = seedEditor();
  const originalRevision = currentRevision(editor);
  const first = validateProposal({
    base_revision: originalRevision,
    summary: 'Move b',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:b'] }, anchor: { x: 500, y: 500 }, columns: 1 }] }],
  }, { current_revision: originalRevision, page_id: 'page:main', items: inspectSurface(editor).items, selection_semantic_ids: [], regions: [], semantic_relationships: [] });
  assert.equal(first.ok, true);
  editor.shapes.find((shape) => shape.id === 'shape:b').x = 700;
  const movedRevision = currentRevision(editor);
  assert.notEqual(movedRevision, originalRevision);
  assert.equal(validateProposal({ ...first.proposal, base_revision: originalRevision }, { current_revision: movedRevision, page_id: 'page:main', items: inspectSurface(editor).items, selection_semantic_ids: [], regions: [], semantic_relationships: [] }).errors[0].code, 'STALE_STATE');
  const second = validateProposal({
    base_revision: movedRevision,
    summary: 'Move b again',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:b'] }, anchor: { x: 500, y: 500 }, columns: 1 }] }],
  }, { current_revision: movedRevision, page_id: 'page:main', items: inspectSurface(editor).items, selection_semantic_ids: [], regions: [], semantic_relationships: [] });
  assert.equal(second.ok, true);
  assert.notDeepEqual(first.diff.spatial_moves[0].before, second.diff.spatial_moves[0].before);
});

test('relationship proposal bound allows 256 edges but rejects 257', () => {
  const editor = seedEditor();
  const context = {
    current_revision: currentRevision(editor),
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  };
  const relationships = Array.from({ length: 256 }, (_, index) => ({
    id: `edge:bound-${index}`,
    kind: 'supports',
    source_semantic_id: 'idea:a',
    target_semantic_id: 'idea:b',
  }));
  const accepted = validateProposal({
    base_revision: context.current_revision,
    summary: 'Bounded relationship batch',
    actions: [{ type: 'add_relationships', relationships }],
  }, context);
  assert.equal(accepted.ok, true);
  const rejected = validateProposal({
    base_revision: context.current_revision,
    summary: 'Oversized relationship batch',
    actions: [{ type: 'add_relationships', relationships: [...relationships, { ...relationships[0], id: 'edge:bound-256' }] }],
  }, context);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors.some((error) => error.code === 'INVALID_RELATIONSHIP_COUNT'), true);
});

test('relationship endpoints cannot be removed in the same proposal', () => {
  const editor = seedEditor();
  const base_revision = currentRevision(editor);
  const context = {
    current_revision: base_revision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  };
  const result = validateProposal({
    base_revision,
    summary: 'Reject dangling edge',
    actions: [
      { type: 'add_relationships', relationships: [{ id: 'edge:removed', kind: 'supports', source_semantic_id: 'idea:a', target_semantic_id: 'idea:b' }] },
      { type: 'remove_items', ids: ['shape:a'] },
    ],
  }, context);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'CONFLICTING_TARGET'), true);
});

test('mutating a relationship arrow does not clone canonical relationship metadata', () => {
  const editor = seedEditor();
  const relationshipProposal = {
    base_revision: currentRevision(editor),
    summary: 'Add one canonical edge',
    actions: [{ type: 'add_relationships', relationships: [{ id: 'edge:ab', kind: 'supports', source_semantic_id: 'idea:a', target_semantic_id: 'idea:b' }] }],
  };
  assert.equal(applyProposalToEditor(editor, relationshipProposal).ok, true);
  const arrowSemanticId = inspectSurface(editor).items.find((item) => item.meta?.role === 'semantic-relationship')?.semantic_id;
  assert.equal(typeof arrowSemanticId, 'string');
  const variantProposal = {
    base_revision: currentRevision(editor),
    summary: 'Preserve a visual edge variant',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'mutate', scope: { kind: 'explicit', semantic_ids: [arrowSemanticId] }, offset: { x: 60, y: 60 } }] }],
  };
  assert.equal(applyProposalToEditor(editor, variantProposal).ok, true);
  const inspected = inspectSurface(editor);
  assert.equal(inspected.semantic_relationships.length, 1);
  assert.equal(inspected.semantic_relationships[0].id, 'edge:ab');
  const variant = inspected.items.find((item) => item.meta?.role === 'variant');
  assert.equal(variant?.meta?.relationship_id, undefined);
  assert.equal(variant?.meta?.relationship_kind, undefined);
});

test('annotation diff uses the built-in note footprint at the coordinate boundary', () => {
  const editor = seedEditor();
  editor.shapes[0].y = 99_850;
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Refuse an overflowing note',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'annotate', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, text: 'Boundary', offset: { x: 0, y: 0 } }] }],
  };
  const result = validateProposal(proposal, {
    current_revision: proposal.base_revision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'INVALID_BOUNDS'), true);
});

test('selection overflow refuses the whole move before Apply', () => {
  const shapes = Array.from({ length: 129 }, (_, index) => ({
    id: `shape:${index}`,
    type: 'geo',
    typeName: 'shape',
    x: index * 2,
    y: 0,
    rotation: 0,
    parentId: 'page:main',
    isLocked: false,
    opacity: 1,
    index: String(index),
    meta: { fogwood: { semantic_id: `idea:${index}`, semantic_id_source: 'stable' } },
    props: { geo: 'rectangle', w: 1, h: 1, color: 'blue', fill: 'solid', richText: '' },
  }));
  const editor = new SpatialEditor(shapes);
  editor.options.maxShapesPerPage = 1_000;
  editor.selected = shapes.map((shape) => shape.id);
  const before = clone(editor.shapes);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Reject truncated selection',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'selection' }, anchor: { x: 500, y: 500 }, columns: 16 }] }],
  };
  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.deepEqual(editor.shapes, before);
});

test('fractional page geometry remains exact for spatial no-op detection', () => {
  const editor = seedEditor();
  editor.shapes[0].x = 0.4;
  editor.shapes[0].y = 0.4;
  const inspected = inspectSurface(editor);
  const item = inspected.items.find((candidate) => candidate.semantic_id === 'idea:a');
  assert.equal(item.x, 0.4);
  assert.equal(item.y, 0.4);
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Move the fractional item to the origin',
    actions: [{ type: 'apply_spatial_moves', moves: [{ kind: 'montage', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, anchor: { x: 0, y: 0 }, columns: 1 }] }],
  };
  const validation = validateProposal(proposal, {
    current_revision: proposal.base_revision,
    page_id: 'page:main',
    items: inspected.items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.diff.spatial_moves[0].before.x, 0.4);
  assert.equal(validation.diff.spatial_moves[0].after.x, 0);
});

test('spatial move limit is proposal-wide and sparse arrays never escape as throws', () => {
  const editor = seedEditor();
  const move = { kind: 'annotate', scope: { kind: 'explicit', semantic_ids: ['idea:a'] }, text: 'Bounded' };
  const proposal = {
    base_revision: currentRevision(editor),
    summary: 'Reject sixteen spatial operations',
    actions: [
      { type: 'apply_spatial_moves', moves: Array.from({ length: 8 }, (_, index) => ({ ...move, text: `A ${index}` })) },
      { type: 'apply_spatial_moves', moves: Array.from({ length: 8 }, (_, index) => ({ ...move, text: `B ${index}` })) },
    ],
  };
  const context = {
    current_revision: proposal.base_revision,
    page_id: 'page:main',
    items: inspectSurface(editor).items,
    selection_semantic_ids: [],
    regions: [],
    semantic_relationships: [],
  };
  const result = validateProposal(proposal, context);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === 'INVALID_MOVE_COUNT'), true);

  const sparseMoves = new Array(1);
  assert.doesNotThrow(() => validateProposal({
    base_revision: context.current_revision,
    summary: 'Reject a sparse action',
    actions: [{ type: 'apply_spatial_moves', moves: sparseMoves }],
  }, context));
  const sparse = validateProposal({
    base_revision: context.current_revision,
    summary: 'Reject a sparse action',
    actions: [{ type: 'apply_spatial_moves', moves: sparseMoves }],
  }, context);
  assert.equal(sparse.ok, false);
});

test('inspect bounds malformed semantic edges and region projections', () => {
  const editor = seedEditor();
  editor.shapes.push({
    id: 'shape:ghost-edge', type: 'arrow', typeName: 'shape', x: 0, y: 0, rotation: 0, parentId: 'page:main', isLocked: false, opacity: 1, index: 'ghost',
    meta: { fogwood: { semantic_id: 'relationship:ghost', semantic_id_source: 'stable', role: 'semantic-relationship', relationship_id: 'edge:ghost', relationship_kind: 'supports', source_semantic_id: 'idea:a', target_semantic_id: 'idea:missing' } },
    props: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, text: '' },
  });
  for (let index = 0; index < 300; index += 1) {
    editor.shapes.push({
      id: `shape:region-${index}`, type: 'geo', typeName: 'shape', x: index, y: index, rotation: 0, parentId: 'page:main', isLocked: false, opacity: 1, index: `r${index}`,
      meta: { fogwood: { semantic_id: `region-item:${index}`, semantic_id_source: 'stable', region_id: `region:${index}` } },
      props: { geo: 'rectangle', w: 1, h: 1, color: 'grey', fill: 'none', richText: '' },
    });
  }
  editor.options.maxShapesPerPage = 1_000;
  const inspected = inspectSurface(editor);
  assert.equal(inspected.semantic_relationships.some((relationship) => relationship.id === 'edge:ghost'), false);
  assert.equal(inspected.regions.length, 256);
  assert.deepEqual(inspected.region_completeness, { complete: false, truncated: true, total: 300, returned: 256, limit: 256 });
});
