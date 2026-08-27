import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { AssetRecordType } from 'tldraw';

import { validateProposalAsync } from '../app/fogwood-runtime.ts';
import { applyProposalToEditor, currentRevision, inspectSurface } from '../app/surface-tools.ts';
import { createFogwoodReceiptRecorder } from '../app/fogwood-receipt-recorder.ts';
import { createReceiptLedger } from '../app/fogwood-receipts.ts';

after(() => {
  for (const handle of process._getActiveHandles()) handle?.unref?.();
});

const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class AssetEditor {
  constructor({ maxShapesPerPage = 100, failCreateShapes = false, readonly = false } = {}) {
    this.shapes = [];
    this.assets = [];
    this.marks = [];
    this.pending = null;
    this.groups = [];
    this.runCalls = 0;
    this.failCreateShapes = failCreateShapes;
    this.readonly = readonly;
    this.options = { maxShapesPerPage };
    this.store = { allRecords: () => [...this.assets] };
  }

  getCurrentPageShapes() { return this.shapes; }
  getCurrentPageShapesSorted() { return [...this.shapes].sort((left, right) => left.id.localeCompare(right.id)); }
  getCurrentPageId() { return 'page:main'; }
  getViewportPageBounds() { return { x: 0, y: 0, w: 1200, h: 800 }; }
  getCurrentPageBounds() { return { x: 0, y: 0, w: 1200, h: 800 }; }
  getCamera() { return { x: 0, y: 0, z: 1 }; }
  getCurrentPageState() { return { selectedShapeIds: [], focusedGroupId: null, editingShapeId: null }; }
  getShapePageBounds(shape) { return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h }; }
  getAssets() { return this.assets; }
  getAsset(id) { return this.assets.find((asset) => asset.id === (typeof id === 'string' ? id : id.id)); }
  getIsReadonly() { return this.readonly; }

  markHistoryStoppingPoint(name) {
    if (this.pending) this.groups.push(this.pending);
    this.pending = null;
    this.marks.push(name);
  }

  run(fn, options) {
    assert.deepEqual(options, { history: 'record' });
    this.runCalls += 1;
    const before = clone(this.shapes);
    fn();
    const after = clone(this.shapes);
    this.pending = { before, after };
  }

  createAssets(assets) { this.assets.push(...assets); }
  deleteAssets(ids) {
    const wanted = new Set(ids.map((id) => typeof id === 'string' ? id : id.id));
    this.assets = this.assets.filter((asset) => !wanted.has(asset.id));
  }
  createShapes(shapes) {
    if (this.failCreateShapes) throw new Error('shape write refused');
    this.shapes.push(...shapes);
  }
  undo() {
    const group = this.pending ?? this.groups.pop();
    if (!group) return;
    this.shapes = clone(group.before);
    this.pending = null;
  }
}

function material(overrides = {}) {
  return {
    semantic_id: 'material:one',
    mime_type: 'image/png',
    base64: onePixelPng,
    label: 'One pixel',
    alt: 'A one pixel fixture',
    prompt_summary: 'A local raster fixture.',
    originating_capability: 'test-fixture',
    qualification_boundary: 'injected test decoder',
    x: 20,
    y: 30,
    w: 120,
    h: 120,
    ...overrides,
  };
}

async function proposalFor(editor, overrides = {}) {
  const baseRevision = currentRevision(editor);
  const result = await validateProposalAsync({
    base_revision: baseRevision,
    summary: 'Add reviewed material',
    actions: [{ type: 'add_materials', materials: [material(overrides)] }],
  }, {
    current_revision: baseRevision,
    items: [],
  }, { decodeRaster: async ({ width, height }) => ({ width, height }) });
  assert.equal(result.ok, true);
  return result.proposal;
}

test('Apply creates one built-in image asset and image shape, inspect is bounded, and one undo removes visible shape only', async () => {
  const editor = new AssetEditor();
  const beforeRevision = currentRevision(editor);
  const proposal = await proposalFor(editor);

  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  assert.equal(editor.marks.filter((mark) => mark === 'Apply agent proposal').length, 1);
  assert.equal(editor.runCalls, 1);
  assert.equal(editor.shapes.length, 1);
  assert.equal(editor.shapes[0].type, 'image');
  assert.equal(editor.shapes[0].parentId, 'page:main');
  assert.equal(editor.shapes[0].meta.fogwood.semantic_id, 'material:one');
  assert.equal(editor.shapes[0].meta.fogwood.semantic_id_source, 'stable');
  assert.equal(editor.shapes[0].props.altText, 'A one pixel fixture');
  assert.equal(editor.shapes[0].props.url, '');
  assert.equal(editor.assets.length, 1);
  assert.equal(editor.assets[0].type, 'image');
  assert.equal(editor.assets[0].meta.fogwood.kind, 'material');
  assert.equal(editor.assets[0].meta.fogwood.byte_length, 68);
  assert.match(editor.assets[0].meta.fogwood.content_hash, /^sha256:[0-9a-f]{64}$/);

  const inspected = inspectSurface(editor);
  assert.equal(inspected.counts.assets, 1);
  assert.equal(inspected.items[0].props.asset.props.mime_type, 'image/png');
  assert.equal(inspected.items[0].props.material.byte_length, 68);
  assert.equal(inspected.items[0].meta.semantic_id_source, 'stable');
  assert.match(inspected.items[0].props.material.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(inspected).includes(onePixelPng), false);
  assert.equal(JSON.stringify(inspected).includes('data:image'), false);
  assert.notEqual(inspected.content_revision, beforeRevision);

  editor.undo();
  assert.equal(editor.shapes.length, 0);
  assert.equal(editor.assets.length, 1);
  assert.equal(currentRevision(editor), beforeRevision);
});

test('content-address reuse refuses a metadata lookalike whose exact local bytes do not match', async () => {
  const editor = new AssetEditor();
  const proposal = await proposalFor(editor);
  const prepared = proposal.actions[0].materials[0];
  const assetId = AssetRecordType.createId(`fogwood-material-${prepared.content_hash.slice('sha256:'.length)}`);
  editor.assets.push(AssetRecordType.create({
    id: assetId,
    type: 'image',
    props: {
      w: prepared.dimensions.width,
      h: prepared.dimensions.height,
      name: prepared.semantic_id,
      isAnimated: false,
      mimeType: prepared.mime_type,
      src: 'https://example.test/not-local.png',
      fileSize: prepared.byte_length,
    },
    meta: {
      fogwood: {
        kind: 'material',
        content_hash: prepared.content_hash,
        byte_length: prepared.byte_length,
      },
    },
  }));

  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /content-addressed asset/i);
  assert.equal(editor.shapes.length, 0);
  assert.equal(editor.assets.length, 1);
  assert.equal(editor.assets[0].props.src, 'https://example.test/not-local.png');
});

test('content-address reuse requires the deterministic id and complete qualified metadata', async () => {
  const editor = new AssetEditor();
  const proposal = await proposalFor(editor);
  const prepared = proposal.actions[0].materials[0];
  const src = `data:${prepared.mime_type};base64,${prepared.canonical_base64}`;
  editor.assets.push(AssetRecordType.create({
    id: AssetRecordType.createId('legacy-random'),
    type: 'image',
    props: { w: prepared.width, h: prepared.height, name: 'lookalike', isAnimated: false, mimeType: prepared.mime_type, src, fileSize: prepared.byte_length },
    meta: { fogwood: { kind: 'material', content_hash: prepared.content_hash, byte_length: prepared.byte_length, mime_type: prepared.mime_type, width: prepared.width, height: prepared.height, source_status: prepared.source_status, decode_qualified: true, provenance: {} } },
  }));
  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  assert.equal(editor.assets.length, 2);
  assert.equal(editor.shapes[0].props.assetId, AssetRecordType.createId(`fogwood-material-${prepared.content_hash.slice('sha256:'.length)}`));
});

test('readonly Apply is refused before history, assets, shapes, or a false applied outcome', async () => {
  const editor = new AssetEditor({ readonly: true });
  const proposal = await proposalFor(editor);
  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /read.?only/i);
  assert.equal(editor.marks.length, 0);
  assert.equal(editor.assets.length, 0);
  assert.equal(editor.shapes.length, 0);
  assert.equal(currentRevision(editor), proposal.base_revision);
});

test('exact content deduplicates asset records while retaining separate visible placements', async () => {
  const editor = new AssetEditor();
  const first = await proposalFor(editor);
  assert.deepEqual(applyProposalToEditor(editor, first), { ok: true });
  const second = await proposalFor(editor, { semantic_id: 'material:two', x: 240 });
  assert.deepEqual(applyProposalToEditor(editor, second), { ok: true });
  assert.equal(editor.assets.length, 1);
  assert.equal(editor.shapes.length, 2);
  assert.equal(editor.shapes[1].props.assetId, editor.shapes[0].props.assetId);
});

test('stale and page-limit refusals happen before asset mutation', async () => {
  const staleEditor = new AssetEditor();
  const staleProposal = await proposalFor(staleEditor);
  staleEditor.shapes.push({ id: 'shape:existing', type: 'geo', x: 0, y: 0, parentId: 'page:main', props: { w: 20, h: 20 }, meta: {} });
  const stale = applyProposalToEditor(staleEditor, staleProposal);
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 'STALE_STATE');
  assert.equal(staleEditor.assets.length, 0);

  const limitedEditor = new AssetEditor({ maxShapesPerPage: 0 });
  const limitedProposal = await proposalFor(limitedEditor);
  const limited = applyProposalToEditor(limitedEditor, limitedProposal);
  assert.equal(limited.ok, false);
  assert.match(limited.message, /shape limit/i);
  assert.equal(limitedEditor.assets.length, 0);
});

test('newly created unreferenced assets are cleaned up when visible shape creation fails', async () => {
  const editor = new AssetEditor({ failCreateShapes: true });
  const proposal = await proposalFor(editor);
  const result = applyProposalToEditor(editor, proposal);
  assert.equal(result.ok, false);
  assert.match(result.message, /shape write refused/i);
  assert.equal(editor.shapes.length, 0);
  assert.equal(editor.assets.length, 0);
});

test('referenced asset metadata is revision-sensitive without exposing bytes', async () => {
  const editor = new AssetEditor();
  const proposal = await proposalFor(editor);
  assert.deepEqual(applyProposalToEditor(editor, proposal), { ok: true });
  const first = currentRevision(editor);
  const original = editor.assets[0];
  editor.assets[0] = {
    ...original,
    meta: {
      fogwood: {
        ...original.meta.fogwood,
        provenance: { ...original.meta.fogwood.provenance, qualification_boundary: 'changed boundary' },
      },
    },
  };
  const second = currentRevision(editor);
  assert.notEqual(second, first);
  editor.assets[0] = {
    ...original,
    props: { ...original.props, src: 'data:image/png;base64,AAAA' },
  };
  assert.notEqual(currentRevision(editor), first);
  assert.equal(JSON.stringify(inspectSurface(editor)).includes(onePixelPng), false);
});

test('AssetRecordType remains the built-in asset seam', () => {
  const id = AssetRecordType.createId('fogwood-material-test');
  assert.match(id, /^asset:/);
});

test('proposal receipts retain bounded material hash/provenance evidence and never store base64', async () => {
  const editor = new AssetEditor();
  const proposal = await proposalFor(editor);
  const storage = { value: null, read() { return this.value; }, write(value) { this.value = value; } };
  let id = 0;
  const ledger = createReceiptLedger({ storage, idSource: () => `receipt:${id++}`, clock: () => '2026-08-27T12:00:00.000Z' });
  const recorder = createFogwoodReceiptRecorder({ ledger });
  const recorded = recorder.recordProposalLifecycle({
    type: 'proposal-applied',
    proposal,
    source_revision: proposal.base_revision,
    base_revision: proposal.base_revision,
    result_revision: 'fogwood-agent-runtime/1-result',
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.receipts.length, 1);
  assert.equal(recorded.receipts[0].material_evidence.length, 1);
  assert.equal(recorded.receipts[0].material_evidence[0].byte_length, 68);
  assert.match(recorded.receipts[0].material_evidence[0].content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(recorded.receipts[0].material_evidence[0].originating_capability, 'test-fixture');
  assert.equal(storage.value.includes(onePixelPng), false);
  assert.equal(storage.value.includes('base64'), false);

  const tampered = JSON.parse(storage.value);
  tampered.receipts[0].material_evidence[0].content_hash = `sha256:${'f'.repeat(64)}`;
  const tamperedLedger = createReceiptLedger({ storage: { read: () => JSON.stringify(tampered), write() {} } });
  const listed = tamperedLedger.list({ limit: 4 });
  assert.equal(listed.ok, false);
  assert.equal(listed.status, 'MALFORMED_STORAGE');
});

test('minimal accepted provenance records honest defaults while unprepared lifecycle evidence fails closed', async () => {
  const editor = new AssetEditor();
  const baseRevision = currentRevision(editor);
  const accepted = await validateProposalAsync({
    base_revision: baseRevision,
    summary: 'Minimal provenance',
    actions: [{ type: 'add_materials', materials: [material({ prompt_summary: undefined, originating_capability: undefined, qualification_boundary: undefined })] }],
  }, { current_revision: baseRevision, items: [] }, { decodeRaster: async ({ width, height }) => ({ width, height }) });
  assert.equal(accepted.ok, true);

  const storage = { value: null, read() { return this.value; }, write(value) { this.value = value; } };
  const ledger = createReceiptLedger({ storage, idSource: () => 'receipt:minimal', clock: () => '2026-08-27T12:00:00.000Z' });
  const recorder = createFogwoodReceiptRecorder({ ledger });
  const recorded = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: accepted.proposal,
    source_revision: baseRevision,
    base_revision: baseRevision,
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.receipts[0].material_evidence[0].originating_capability, 'unspecified');
  assert.match(recorded.receipts[0].material_evidence[0].qualification_boundary, /local validation/i);

  const unsafe = recorder.recordProposalLifecycle({
    type: 'proposal-staged',
    proposal: {
      base_revision: baseRevision,
      summary: 'Bypass prepared material',
      actions: [{ type: 'add_materials', materials: [{ ...material(), content_hash: `sha256:${'a'.repeat(64)}`, byte_length: 68, dimensions: { width: 1, height: 1 }, source_status: 'original', decode_qualified: false }] }],
    },
    source_revision: baseRevision,
    base_revision: baseRevision,
  });
  assert.equal(unsafe.ok, false);
});
