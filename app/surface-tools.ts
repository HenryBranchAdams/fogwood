import { AssetRecordType, createShapeId, toRichText } from 'tldraw';
import type { Editor, TLAsset, TLAssetId, TLParentId, TLShape, TLShapeId } from 'tldraw';
import {
  BLOCK_KINDS,
  BLOCK_TONES,
  CANVAS_COLORS,
  CANVAS_FILLS,
  CANVAS_SHAPE_KINDS,
  computePageRevision,
  createProposalController,
  descendantClosure,
  deterministicHash,
  expandRecipe,
  FOGWOOD_PROTOCOL,
  FOGWOOD_PROTOCOL_VERSION,
  FOGWOOD_REGISTRY_VERSION,
  FOGWOOD_PARTICIPATION_CONTRACT,
  getRecipe,
  INSPECT_INPUT_SCHEMA,
  PROPOSAL_INPUT_SCHEMA,
  searchCapabilities,
  validateProposal,
  validateProposalAsync,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-runtime.ts';
import type {
  BlockInput,
  BlockKind,
  BlockTone,
  CanvasShapeKind,
  CapabilitySearchInput,
  FogwoodMeta,
  InspectableItem,
  ProposalAction,
  ProposalControllerResult,
  ProposalControllerState,
  ProposalDiff,
  ProposalV1,
} from './fogwood-runtime';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isPreparedMaterial } from './fogwood-materials.ts';
import type { MaterialDecoder, PreparedMaterial } from './fogwood-materials';
import type { JsonObject } from '@tldraw/utils';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_PERSISTENCE } from './fogwood-persistence.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_BAZAAR_TOOL } from './fogwood-bazaar.ts';
import {
  createProposalLifecycleController,
  type ProposalLifecycleEvent,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-proposal-lifecycle.ts';
import {
  COMPARE_INSTRUMENT_INSTANCE_IDS,
  applyInstrumentInputChanges,
  applyInstrumentControlChange,
  compareShapeIdsFromRecipeBlocks,
  createCompareInstrumentScope,
  inspectInstrumentData,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-instrument-adapter.ts';
import type { InstrumentShapeLike } from './fogwood-instrument-adapter.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isStableSemanticId, planRelationships, planSpatialMoves, relationshipSemanticId, SPATIAL_LIMITS } from './fogwood-spatial.ts';
import type { SemanticRelationship, SpatialCreatePlan } from './fogwood-spatial.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { registerWebMcpTools } from './webmcp-registration.ts';
import type { ModelContext, ToolConnection, WebMcpTool } from './webmcp-registration';

export type { ToolConnection } from './webmcp-registration';
export type { BlockKind, BlockTone, CanvasShapeKind } from './fogwood-runtime';

/** Kept as a compatibility input for internal adapters and page-owned code. */
export type SurfaceBlockInput = Partial<BlockInput> & { kind?: BlockKind };

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const DEFAULT_SIZES: Record<BlockKind, { w: number; h: number }> = {
  panel: { w: 330, h: 210 },
  heading: { w: 720, h: 130 },
  text: { w: 360, h: 180 },
  metric: { w: 230, h: 150 },
  checklist: { w: 380, h: 300 },
  table: { w: 560, h: 320 },
  input: { w: 340, h: 145 },
  select: { w: 340, h: 145 },
  slider: { w: 360, h: 150 },
  button: { w: 300, h: 150 },
  progress: { w: 350, h: 155 },
  chart: { w: 520, h: 320 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, max: number, fallback = '') {
  if (typeof value === 'string') return value.slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function normalizeKind(value: unknown): BlockKind {
  return typeof value === 'string' && BLOCK_KINDS.includes(value as BlockKind)
    ? (value as BlockKind)
    : 'panel';
}

function normalizeTone(value: unknown): BlockTone {
  return typeof value === 'string' && BLOCK_TONES.includes(value as BlockTone)
    ? (value as BlockTone)
    : 'paper';
}

function normalizeCanvasKind(value: unknown): CanvasShapeKind {
  return typeof value === 'string' && CANVAS_SHAPE_KINDS.includes(value as CanvasShapeKind)
    ? (value as CanvasShapeKind)
    : 'rectangle';
}

function normalizeCanvasColor(value: unknown) {
  return typeof value === 'string' && CANVAS_COLORS.includes(value as (typeof CANVAS_COLORS)[number])
    ? (value as (typeof CANVAS_COLORS)[number])
    : 'black';
}

function normalizeCanvasFill(value: unknown) {
  return typeof value === 'string' && CANVAS_FILLS.includes(value as (typeof CANVAS_FILLS)[number])
    ? (value as (typeof CANVAS_FILLS)[number])
    : 'semi';
}

function parseBlockData(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeTextList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .slice(0, limit)
        .map((item) => item.slice(0, 160))
    : [];
}

function makeBlockData(input: Record<string, unknown>) {
  const items = Array.isArray(input.items)
    ? input.items.slice(0, 20).flatMap((item) => {
        if (!isRecord(item) || typeof item.label !== 'string') return [];
        return [{ label: item.label.slice(0, 240), checked: item.checked === true }];
      })
    : [];
  const columns = safeTextList(input.columns, 8);
  const rows = Array.isArray(input.rows)
    ? input.rows.slice(0, 12).map((row) => safeTextList(row, 8))
    : [];
  const options = safeTextList(input.options, 20);
  const series = Array.isArray(input.series)
    ? input.series.slice(0, 10).flatMap((item) => {
        if (!isRecord(item) || typeof item.label !== 'string' || typeof item.value !== 'number') return [];
        if (!Number.isFinite(item.value)) return [];
        return [{ label: item.label.slice(0, 80), value: Math.max(-1_000_000_000, Math.min(1_000_000_000, item.value)) }];
      })
    : [];
  return JSON.stringify({
    items,
    columns,
    rows,
    options,
    series,
    min: clampNumber(input.min, 0, -1_000_000, 1_000_000),
    max: clampNumber(input.max, 100, -1_000_000, 1_000_000),
    step: clampNumber(input.step, 1, 0.001, 100_000),
  });
}

function textResult(value: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

/** Keep the activity feed meaningful for semantic scenarios that change no item count. */
export function proposalActivityDetail(diff: Pick<ProposalDiff, 'instrument_changes' | 'counts'>) {
  const controlCount = diff.instrument_changes.reduce((sum, scope) => sum + scope.controls.length, 0);
  const derivedCount = diff.instrument_changes.reduce((sum, scope) => sum + scope.derived.length, 0);
  if (controlCount > 0 || derivedCount > 0) {
    return `${controlCount} control change${controlCount === 1 ? '' : 's'} and ${derivedCount} predicted output${derivedCount === 1 ? '' : 's'} await review.`;
  }
  return `${diff.counts.adds} additions, ${diff.counts.updates} updates, ${diff.counts.moves} moves, ${diff.counts.removes} removals await review.`;
}

function positionFor(
  editor: Editor,
  input: Record<string, unknown>,
  index: number,
  coordinateSpace: 'viewport' | 'page',
) {
  const viewport = editor.getViewportPageBounds();
  const defaultX = 70 + (index % 3) * 370;
  const defaultY = 90 + Math.floor(index / 3) * 250;
  const rawX = clampNumber(input.x, defaultX, -100_000, 100_000);
  const rawY = clampNumber(input.y, defaultY, -100_000, 100_000);
  return coordinateSpace === 'viewport'
    ? { x: viewport.x + rawX, y: viewport.y + rawY }
    : { x: rawX, y: rawY };
}

type MutationOptions = {
  coordinateSpace?: 'viewport' | 'page';
  focusAfter?: boolean;
  select?: boolean;
  recordHistory?: boolean;
  parentId?: string;
  fogwood?: FogwoodMeta;
};

function shapeMeta(id: string, fogwood?: FogwoodMeta): JsonObject {
  const fogwoodMeta: JsonObject = {
    semantic_id: fogwood?.semantic_id ?? `fogwood:${id}`,
    semantic_id_source: fogwood?.semantic_id_source ?? (fogwood?.semantic_id ? 'stable' : 'legacy-shape-id'),
    ...(fogwood?.role ? { role: fogwood.role } : {}),
    ...(fogwood?.composition_id ? { composition_id: fogwood.composition_id } : {}),
    ...(fogwood?.region_id ? { region_id: fogwood.region_id } : {}),
    ...(fogwood?.variant_id ? { variant_id: fogwood.variant_id } : {}),
    ...(fogwood?.parent_variant_id ? { parent_variant_id: fogwood.parent_variant_id } : {}),
    ...(fogwood?.lineage_source_id ? { lineage_source_id: fogwood.lineage_source_id } : {}),
    ...(fogwood?.relationship_id ? { relationship_id: fogwood.relationship_id } : {}),
    ...(fogwood?.relationship_kind ? { relationship_kind: fogwood.relationship_kind } : {}),
    ...(fogwood?.source_semantic_id ? { source_semantic_id: fogwood.source_semantic_id } : {}),
    ...(fogwood?.target_semantic_id ? { target_semantic_id: fogwood.target_semantic_id } : {}),
    ...(fogwood?.relationship_label ? { relationship_label: fogwood.relationship_label } : {}),
    ...(fogwood?.recipe_id ? { recipe_id: fogwood.recipe_id } : {}),
    ...(fogwood?.recipe_version ? { recipe_version: fogwood.recipe_version } : {}),
    ...(fogwood?.recipe_instance_id ? { recipe_instance_id: fogwood.recipe_instance_id } : {}),
  };
  return { fogwood: fogwoodMeta };
}

export function addSurfaceBlocks(editor: Editor, inputs: unknown[], options: MutationOptions = {}) {
  const coordinateSpace = options.coordinateSpace ?? 'viewport';
  const records = inputs.filter(isRecord).slice(0, 48);
  if (records.length === 0) return [];
  const shapes = records.map((input, index) => {
    const kind = normalizeKind(input.kind);
    const size = DEFAULT_SIZES[kind];
    const position = positionFor(editor, input, index, coordinateSpace);
    const id = createShapeId();
    return {
      id,
      type: 'surface-block' as const,
      x: position.x,
      y: position.y,
      parentId: options.parentId ? (options.parentId as TLParentId) : editor.getCurrentPageId(),
      meta: shapeMeta(id, options.fogwood),
      props: {
        w: clampNumber(input.w, size.w, 120, 1_400),
        h: clampNumber(input.h, size.h, 56, 1_000),
        kind,
        tone: normalizeTone(input.tone),
        title: boundedText(input.title, 180),
        body: boundedText(input.body, 2_000),
        value: boundedText(input.value, 500),
        data: makeBlockData(input),
      },
    };
  });
  if (options.recordHistory !== false) editor.markHistoryStoppingPoint('Add Fogwood blocks');
  editor.createShapes(shapes);
  const ids = shapes.map((shape) => shape.id as TLShapeId);
  if (options.select !== false) editor.select(...ids);
  if (options.focusAfter !== false) editor.zoomToSelection({ animation: { duration: 320 } });
  return ids;
}

function explicitCoordinate(
  editor: Editor,
  value: unknown,
  fallback: number,
  axis: 'x' | 'y',
  coordinateSpace: 'viewport' | 'page',
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const bounded = Math.max(-100_000, Math.min(100_000, value));
  if (coordinateSpace === 'page') return bounded;
  const viewport = editor.getViewportPageBounds();
  return (axis === 'x' ? viewport.x : viewport.y) + bounded;
}

function addCanvasShapes(editor: Editor, inputs: unknown[], options: MutationOptions = {}) {
  const coordinateSpace = options.coordinateSpace ?? 'viewport';
  const records = inputs.filter(isRecord).slice(0, 64);
  if (records.length === 0) return [];
  const shapes: Array<Record<string, unknown>> = [];
  records.forEach((input, index) => {
    const kind = normalizeCanvasKind(input.kind);
    const color = normalizeCanvasColor(input.color);
    const position = positionFor(editor, input, index, coordinateSpace);
    const text = boundedText(input.text, 2_000);
    const id = createShapeId();
    const inputFogwood: FogwoodMeta = {
      ...(options.fogwood ?? {}),
      ...(typeof input.semantic_id === 'string' ? { semantic_id: input.semantic_id, semantic_id_source: 'stable' } : {}),
      ...(typeof input.role === 'string' ? { role: input.role } : {}),
      ...(typeof input.composition_id === 'string' ? { composition_id: input.composition_id } : {}),
      ...(typeof input.region_id === 'string' ? { region_id: input.region_id } : {}),
      ...(typeof input.variant_id === 'string' ? { variant_id: input.variant_id } : {}),
      ...(typeof input.parent_variant_id === 'string' ? { parent_variant_id: input.parent_variant_id } : {}),
      ...(typeof input.lineage_source_id === 'string' ? { lineage_source_id: input.lineage_source_id } : {}),
    };
    const base = {
      id,
      x: position.x,
      y: position.y,
      parentId: options.parentId ? (options.parentId as TLParentId) : editor.getCurrentPageId(),
      meta: shapeMeta(id, inputFogwood),
    };
    if (kind === 'arrow') {
      const endX = explicitCoordinate(editor, input.end_x, position.x + 240, 'x', coordinateSpace);
      const endY = explicitCoordinate(editor, input.end_y, position.y + 100, 'y', coordinateSpace);
      shapes.push({
        ...base,
        type: 'arrow',
        props: {
          color,
          labelColor: color,
          dash: 'solid',
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
          start: { x: 0, y: 0 },
          end: { x: endX - position.x, y: endY - position.y },
          richText: toRichText(text),
        },
      });
      return;
    }
    if (kind === 'frame') {
      shapes.push({
        ...base,
        type: 'frame',
        props: {
          w: clampNumber(input.w, 720, 160, 2_000),
          h: clampNumber(input.h, 480, 120, 1_600),
          name: text || 'Frame',
          color,
        },
      });
      return;
    }
    if (kind === 'note') {
      shapes.push({
        ...base,
        type: 'note',
        props: {
          color: color === 'black' ? 'yellow' : color,
          labelColor: 'black',
          font: 'sans',
          richText: toRichText(text || 'Note'),
        },
      });
      return;
    }
    if (kind === 'text') {
      shapes.push({
        ...base,
        type: 'text',
        props: {
          w: clampNumber(input.w, 320, 40, 1_400),
          color,
          font: 'sans',
          autoSize: false,
          richText: toRichText(text || 'Text'),
        },
      });
      return;
    }
    shapes.push({
      ...base,
      type: 'geo',
      props: {
        geo: kind,
        w: clampNumber(input.w, 260, 40, 1_400),
        h: clampNumber(input.h, 160, 40, 1_000),
        color,
        labelColor: color,
        fill: normalizeCanvasFill(input.fill),
        dash: 'solid',
        font: 'sans',
        align: 'middle',
        verticalAlign: 'middle',
        richText: toRichText(text),
      },
    });
  });
  if (options.recordHistory !== false) editor.markHistoryStoppingPoint('Add Fogwood shapes');
  editor.createShapes(shapes as never);
  const ids = shapes.map((shape) => shape.id as TLShapeId);
  if (options.select !== false) editor.select(...ids);
  if (options.focusAfter !== false) editor.zoomToSelection({ animation: { duration: 320 } });
  return ids;
}

function updateSurfaceBlocks(editor: Editor, rawUpdates: unknown[], options: MutationOptions = {}) {
  const updates = rawUpdates.filter(isRecord).slice(0, 48);
  const shapeUpdates: Array<Record<string, unknown>> = [];
  for (const input of updates) {
    if (typeof input.id !== 'string') continue;
    const shape = editor.getShape(input.id as TLShapeId);
    if (!shape || shape.type !== 'surface-block') continue;
    const props: Record<string, unknown> = {};
    if ('kind' in input) props.kind = normalizeKind(input.kind);
    if ('tone' in input) props.tone = normalizeTone(input.tone);
    if ('title' in input) props.title = boundedText(input.title, 180);
    if ('body' in input) props.body = boundedText(input.body, 2_000);
    if ('value' in input) props.value = boundedText(input.value, 500);
    if ('w' in input) props.w = clampNumber(input.w, shape.props.w, 120, 1_400);
    if ('h' in input) props.h = clampNumber(input.h, shape.props.h, 56, 1_000);
    if (['items', 'columns', 'rows', 'options', 'series', 'min', 'max', 'step'].some((key) => key in input)) {
      props.data = makeBlockData({ ...parseBlockData(shape.props.data), ...input });
    }
    shapeUpdates.push({
      id: shape.id,
      type: 'surface-block',
      ...(input.x === undefined ? {} : { x: clampNumber(input.x, shape.x, -100_000, 100_000) }),
      ...(input.y === undefined ? {} : { y: clampNumber(input.y, shape.y, -100_000, 100_000) }),
      props,
    });
  }
  if (shapeUpdates.length > 0) {
    if (options.recordHistory !== false) editor.markHistoryStoppingPoint('Update Fogwood blocks');
    editor.updateShapes(shapeUpdates as never);
  }
  return shapeUpdates.map((update) => update.id as TLShapeId);
}

function placeCanvasItems(editor: Editor, rawPlacements: unknown[], options: MutationOptions = {}) {
  const placements = rawPlacements.filter(isRecord).slice(0, 100);
  const updates: Array<Record<string, unknown>> = [];
  for (const input of placements) {
    if (typeof input.id !== 'string') continue;
    const shape = editor.getShape(input.id as TLShapeId);
    if (!shape) continue;
    updates.push({
      id: shape.id,
      type: shape.type,
      x: clampNumber(input.x, shape.x, -100_000, 100_000),
      y: clampNumber(input.y, shape.y, -100_000, 100_000),
      ...(input.rotation === undefined ? {} : { rotation: clampNumber(input.rotation, shape.rotation, -Math.PI * 4, Math.PI * 4) }),
    });
  }
  if (updates.length > 0) {
    if (options.recordHistory !== false) editor.markHistoryStoppingPoint('Place Fogwood items');
    editor.updateShapes(updates as never);
  }
  return updates.map((update) => update.id as TLShapeId);
}

function getNativeShapeText(editor: Editor, shape: TLShape) {
  try {
    return (editor.getShapeUtil(shape).getText(shape) || '').slice(0, 500);
  } catch {
    return '';
  }
}

function boundedValue(value: unknown, depth = 6): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 500);
  if (depth <= 0) return '[bounded]';
  if (Array.isArray(value)) return value.slice(0, 64).map((child) => boundedValue(child, depth - 1));
  if (!isRecord(value)) return null;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .slice(0, 64)
      .map((key) => [key, boundedValue(value[key], depth - 1)]),
  );
}

function boundedProps(value: unknown): Record<string, unknown> {
  const bounded = boundedValue(value);
  return isRecord(bounded) ? bounded : {};
}

function fogwoodMeta(shape: TLShape): FogwoodMeta {
  const root = isRecord(shape.meta) && isRecord(shape.meta.fogwood) ? shape.meta.fogwood : {};
  return {
    semantic_id: typeof root.semantic_id === 'string' ? root.semantic_id.slice(0, 180) : shape.id,
    semantic_id_source: typeof root.semantic_id_source === 'string' ? root.semantic_id_source.slice(0, 40) : 'legacy-shape-id',
    ...(typeof root.role === 'string' ? { role: root.role.slice(0, 120) } : {}),
    ...(typeof root.composition_id === 'string' ? { composition_id: root.composition_id.slice(0, 180) } : {}),
    ...(typeof root.region_id === 'string' ? { region_id: root.region_id.slice(0, 180) } : {}),
    ...(typeof root.variant_id === 'string' ? { variant_id: root.variant_id.slice(0, 180) } : {}),
    ...(typeof root.parent_variant_id === 'string' ? { parent_variant_id: root.parent_variant_id.slice(0, 180) } : {}),
    ...(typeof root.lineage_source_id === 'string' ? { lineage_source_id: root.lineage_source_id.slice(0, 180) } : {}),
    ...(typeof root.relationship_id === 'string' ? { relationship_id: root.relationship_id.slice(0, 180) } : {}),
    ...(typeof root.relationship_kind === 'string' ? { relationship_kind: root.relationship_kind.slice(0, 40) } : {}),
    ...(typeof root.source_semantic_id === 'string' ? { source_semantic_id: root.source_semantic_id.slice(0, 180) } : {}),
    ...(typeof root.target_semantic_id === 'string' ? { target_semantic_id: root.target_semantic_id.slice(0, 180) } : {}),
    ...(typeof root.relationship_label === 'string' ? { relationship_label: root.relationship_label.slice(0, 500) } : {}),
    ...(typeof root.recipe_id === 'string' ? { recipe_id: root.recipe_id.slice(0, 120) } : {}),
    ...(typeof root.recipe_version === 'number' ? { recipe_version: root.recipe_version } : {}),
    ...(typeof root.recipe_instance_id === 'string' ? { recipe_instance_id: root.recipe_instance_id.slice(0, 120) } : {}),
  };
}

function blockDataForInspection(data: string, shapeId?: string) {
  const parsed = parseBlockData(data);
  const instrument = shapeId ? inspectInstrumentData({ id: shapeId, type: 'surface-block', props: { data } }) : undefined;
  return {
    items: Array.isArray(parsed.items)
      ? parsed.items.slice(0, 20).flatMap((item) => (isRecord(item) && typeof item.label === 'string' ? [{ label: item.label.slice(0, 240), checked: item.checked === true }] : []))
      : [],
    columns: safeTextList(parsed.columns, 8),
    rows: Array.isArray(parsed.rows) ? parsed.rows.slice(0, 12).map((row) => safeTextList(row, 8)) : [],
    options: safeTextList(parsed.options, 20),
    series: Array.isArray(parsed.series)
      ? parsed.series.slice(0, 10).flatMap((item) => (isRecord(item) && typeof item.label === 'string' && typeof item.value === 'number' && Number.isFinite(item.value) ? [{ label: item.label.slice(0, 80), value: item.value }] : []))
      : [],
    min: clampNumber(parsed.min, 0, -1_000_000, 1_000_000),
    max: clampNumber(parsed.max, 100, -1_000_000, 1_000_000),
    step: clampNumber(parsed.step, 1, 0.001, 100_000),
    ...(instrument ? { instrument } : {}),
  };
}

function nativePropsForInspection(shape: TLShape) {
  // Keep every native props key (including richText/resource metadata) within
  // one recursive bound; plain text is exposed separately on the item.
  return boundedProps(shape.props);
}

function currentPageBindings(editor: Editor, shapeIds: Set<string>) {
  return editor.store
    .allRecords()
    .filter((record) => record.typeName === 'binding')
    .map((record) => record as unknown as { id: string; typeName: string; type: string; fromId: string; toId: string; props: unknown })
    .filter((record) => shapeIds.has(record.fromId) && shapeIds.has(record.toId))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => ({ id: record.id, type_name: record.typeName, type: record.type, from_id: record.fromId, to_id: record.toId, props: boundedProps(record.props) }));
}

function currentSemanticRelationships(shapes: readonly TLShape[]): SemanticRelationship[] {
  const liveSemanticIds = new Set(shapes.flatMap((shape) => {
    const semanticId = fogwoodMeta(shape).semantic_id;
    return typeof semanticId === 'string' && isStableSemanticId(semanticId) ? [semanticId] : [];
  }));
  const relationships: SemanticRelationship[] = [];
  for (const shape of shapes) {
    if (shape.type !== 'arrow') continue;
    const meta = fogwoodMeta(shape);
    const kind = meta.relationship_kind;
    const id = meta.relationship_id;
    const source = meta.source_semantic_id;
    const target = meta.target_semantic_id;
    if (meta.role !== 'semantic-relationship') continue;
    if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string') continue;
    if (!isStableSemanticId(id) || !isStableSemanticId(source) || !isStableSemanticId(target) || source === target) continue;
    if (meta.semantic_id !== relationshipSemanticId(id) || !liveSemanticIds.has(source) || !liveSemanticIds.has(target)) continue;
    if (!['supports', 'contradicts', 'depends_on', 'causes', 'blocks', 'echoes', 'mutates_into'].includes(kind ?? '')) continue;
    relationships.push({
      id,
      kind: kind as SemanticRelationship['kind'],
      source_semantic_id: source,
      target_semantic_id: target,
      ...(meta.relationship_label === undefined ? {} : { label: meta.relationship_label }),
      shape_id: shape.id,
    });
  }
  return relationships.sort((left, right) => left.id.localeCompare(right.id));
}

function currentRegions(shapes: readonly TLShape[]): Array<{ id: string; semantic_id?: string; x: number; y: number; w: number; h: number; label?: string }> {
  const grouped = new Map<string, { id: string; semantic_id?: string; x: number; y: number; right: number; bottom: number; label?: string }>();
  for (const shape of shapes) {
    const meta = fogwoodMeta(shape);
    if (!meta.region_id) continue;
    const bounds = { x: shape.x, y: shape.y, w: Math.max(0, shape.props && isRecord(shape.props) && typeof shape.props.w === 'number' ? shape.props.w : 0), h: Math.max(0, shape.props && isRecord(shape.props) && typeof shape.props.h === 'number' ? shape.props.h : 0) };
    const existing = grouped.get(meta.region_id);
    if (!existing) {
      grouped.set(meta.region_id, { id: meta.region_id, x: bounds.x, y: bounds.y, right: bounds.x + bounds.w, bottom: bounds.y + bounds.h });
    } else {
      existing.x = Math.min(existing.x, bounds.x);
      existing.y = Math.min(existing.y, bounds.y);
      existing.right = Math.max(existing.right, bounds.x + bounds.w);
      existing.bottom = Math.max(existing.bottom, bounds.y + bounds.h);
    }
  }
  return [...grouped.values()].sort((left, right) => left.id.localeCompare(right.id)).map((region) => ({ id: region.id, ...(region.semantic_id ? { semantic_id: region.semantic_id } : {}), x: region.x, y: region.y, w: region.right - region.x, h: region.bottom - region.y, ...(region.label ? { label: region.label } : {}) }));
}

type BoundedAssetProjection = {
  id: string;
  type: string;
  type_name?: string;
  props: {
    w?: number;
    h?: number;
    name?: string;
    mime_type?: string | null;
    file_size?: number;
    is_animated?: boolean;
    source_length?: number;
    source_fingerprint?: string;
  };
  meta: Record<string, unknown>;
};

function boundedAssetMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.fogwood)) return {};
  const root = value.fogwood;
  if (root.kind !== 'material') return {};
  const provenance = isRecord(root.provenance) ? root.provenance : {};
  return {
    fogwood: {
      kind: 'material',
      ...(typeof root.content_hash === 'string' ? { content_hash: root.content_hash.slice(0, 80) } : {}),
      ...(typeof root.byte_length === 'number' ? { byte_length: root.byte_length } : {}),
      ...(typeof root.mime_type === 'string' ? { mime_type: root.mime_type } : {}),
      ...(typeof root.width === 'number' ? { width: root.width } : {}),
      ...(typeof root.height === 'number' ? { height: root.height } : {}),
      ...(root.source_status === 'original' || root.source_status === 'sanitized' ? { source_status: root.source_status } : {}),
      ...(root.decode_qualified === true ? { decode_qualified: true } : {}),
      provenance: {
        ...(typeof provenance.originating_capability === 'string' ? { originating_capability: provenance.originating_capability.slice(0, 180) } : {}),
        ...(typeof provenance.qualification_boundary === 'string' ? { qualification_boundary: provenance.qualification_boundary.slice(0, 500) } : {}),
        ...(typeof provenance.prompt_summary === 'string' ? { prompt_summary: provenance.prompt_summary.slice(0, 500) } : {}),
      },
    },
  };
}

function boundedAssetProjection(asset: unknown): BoundedAssetProjection | undefined {
  if (!isRecord(asset) || typeof asset.id !== 'string' || typeof asset.type !== 'string') return undefined;
  const props = isRecord(asset.props) ? asset.props : {};
  const source = typeof props.src === 'string' ? props.src : undefined;
  const sourceLength = source?.length;
  const sourceFingerprint = source === undefined
    ? undefined
    : source.length <= 6 * 1024 * 1024
      ? deterministicHash(source)
      : `oversized-${source.length}`;
  return {
    id: asset.id,
    type: asset.type,
    ...(typeof asset.typeName === 'string' ? { type_name: asset.typeName } : {}),
    props: {
      ...(typeof props.w === 'number' ? { w: props.w } : {}),
      ...(typeof props.h === 'number' ? { h: props.h } : {}),
      ...(typeof props.name === 'string' ? { name: props.name.slice(0, 180) } : {}),
      ...(typeof props.mimeType === 'string' || props.mimeType === null ? { mime_type: props.mimeType } : {}),
      ...(typeof props.fileSize === 'number' ? { file_size: props.fileSize } : {}),
      ...(typeof props.isAnimated === 'boolean' ? { is_animated: props.isAnimated } : {}),
      ...(sourceLength === undefined ? {} : { source_length: sourceLength }),
      ...(sourceFingerprint === undefined ? {} : { source_fingerprint: sourceFingerprint }),
    },
    // Only the Fogwood content-addressed metadata is inspectable. In
    // particular, arbitrary host asset metadata and source/data URLs never
    // cross the page inspection boundary.
    meta: boundedAssetMetadata(asset.meta),
  };
}

function assetRecords(editor: Editor): readonly TLAsset[] {
  try {
    if (typeof editor.getAssets === 'function') return editor.getAssets();
  } catch {
    // A test/editor double may not expose asset records; callers handle empty.
  }
  try {
    return editor.store.allRecords().filter((record) => record.typeName === 'asset') as unknown as TLAsset[];
  } catch {
    return [];
  }
}

function referencedAssets(editor: Editor, shapes = editor.getCurrentPageShapes()): BoundedAssetProjection[] {
  const ids = new Set<string>();
  for (const shape of shapes) {
    if (shape.type !== 'image') continue;
    const assetId = isRecord(shape.props) && typeof shape.props.assetId === 'string' ? shape.props.assetId : undefined;
    if (assetId) ids.add(assetId);
  }
  return assetRecords(editor)
    .filter((asset) => ids.has(String(asset.id)))
    .map(boundedAssetProjection)
    .filter((asset): asset is BoundedAssetProjection => Boolean(asset))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function pageContent(editor: Editor) {
  const shapes = editor.getCurrentPageShapesSorted();
  const shapeIds = new Set<string>(shapes.map((shape) => shape.id));
  const bindings = editor.store
    .allRecords()
    .filter((record) => record.typeName === 'binding')
    .map((record) => record as unknown as { fromId: string; toId: string; id: string; type: string; props: unknown })
    .filter((record) => shapeIds.has(record.fromId) && shapeIds.has(record.toId));
  return { shapes, bindings, assets: referencedAssets(editor, shapes), semantic_relationships: currentSemanticRelationships(shapes) };
}

export function currentRevision(editor: Editor) {
  const { shapes, bindings, assets } = pageContent(editor);
  return computePageRevision(editor.getCurrentPageId(), shapes, bindings, assets);
}

export type InstrumentControlUpdateOptions = {
  /** Skip the stopping point when an enclosing UI gesture already owns it. */
  recordHistory?: boolean;
};

/**
 * Page-owned adapter entrypoint for instrument controls. Legacy blocks return
 * without mutation; instrument scopes are validated and patched as one history
 * transaction after the pure adapter has accepted the change.
 */
export function updateInstrumentControl(
  editor: Editor,
  shapeId: string,
  rawValue: unknown,
  options: InstrumentControlUpdateOptions = {},
) {
  const result = applyInstrumentControlChange(
    editor.getCurrentPageShapes().map((shape) => ({
      id: shape.id,
      type: shape.type,
      parent_id: String(shape.parentId),
      is_locked: shape.isLocked,
      props: shape.type === 'surface-block' ? (shape as Extract<TLShape, { type: 'surface-block' }>).props : undefined,
    })),
    shapeId,
    rawValue,
  );
  if (result.status === 'legacy' || result.patches.length === 0) return result;
  const currentPageShapes = editor.getCurrentPageShapes();
  const currentSurfaceBlockIds = new Set<string>(currentPageShapes.filter((shape) => shape.type === 'surface-block').map((shape) => String(shape.id)));
  const scopeShapeIds = new Set(result.scope_shape_ids ?? []);
  const patchIds = result.patches.map((patch) => patch.shape_id);
  const patchIdsUnique = new Set(patchIds);
  if (
    patchIdsUnique.size !== patchIds.length
    || patchIds.some((id) => !currentSurfaceBlockIds.has(id) || !scopeShapeIds.has(id))
  ) {
    return {
      ...result,
      status: 'invalid' as const,
      patches: [],
      errors: [{ code: 'PATCH_SCOPE_VIOLATION', message: 'Instrument patches must target unique current-page surface blocks in the selected scope.' }],
    };
  }
  const updates = result.patches.map((patch) => ({
    id: patch.shape_id as TLShapeId,
    type: 'surface-block' as const,
    props: { value: patch.value, data: patch.data },
  }));
  try {
    if (options.recordHistory !== false) editor.markHistoryStoppingPoint('Update Fogwood instrument');
    editor.run(() => {
      editor.updateShapes(updates as never);
    }, { history: 'record' });
  } catch (error) {
    return {
      ...result,
      status: 'invalid' as const,
      patches: [],
      errors: [{ code: 'EDITOR_UPDATE_FAILED', message: error instanceof Error ? error.message.slice(0, 180) : 'The page rejected the instrument update.' }],
    };
  }
  return result;
}

export type InstrumentControlGesture = {
  start: (shapeId: string) => void;
  update: (shapeId: string, rawValue: unknown) => ReturnType<typeof updateInstrumentControl>;
  end: () => void;
};

function isInstrumentControlShape(editor: Editor, shapeId: string) {
  const shape = editor.getCurrentPageShapes().find((candidate) => candidate.id === shapeId);
  if (!shape || shape.type !== 'surface-block') return false;
  const block = shape as Extract<TLShape, { type: 'surface-block' }>;
  return isRecord(parseBlockData(block.props.data).instrument);
}

/**
 * Owns one bounded control gesture for one editor and shape. The session does
 * not mutate the page itself: each update still passes through the validated
 * page-owned adapter transaction. It only moves the history stopping point to
 * the gesture boundary so live updates undo as one group.
 */
export function createInstrumentControlGesture(editor: Editor): InstrumentControlGesture {
  let activeShapeId: string | undefined;

  return {
    start(shapeId) {
      if (activeShapeId === shapeId) return;
      activeShapeId = undefined;
      if (!isInstrumentControlShape(editor, shapeId)) return;
      editor.markHistoryStoppingPoint('Update Fogwood instrument');
      activeShapeId = shapeId;
    },
    update(shapeId, rawValue) {
      const inGesture = activeShapeId === shapeId;
      if (!inGesture) activeShapeId = undefined;
      return updateInstrumentControl(
        editor,
        shapeId,
        rawValue,
        inGesture ? { recordHistory: false } : {},
      );
    },
    end() {
      activeShapeId = undefined;
    },
  };
}

function inspectItem(editor: Editor, shape: TLShape): InspectableItem {
  const bounds = editor.getShapePageBounds(shape);
  const meta = fogwoodMeta(shape);
  const base = {
    id: shape.id,
    type_name: shape.typeName,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    w: bounds?.w ?? 0,
    h: bounds?.h ?? 0,
    rotation: shape.rotation,
    parent_id: shape.parentId,
    is_locked: shape.isLocked,
    opacity: shape.opacity,
    index: shape.index,
    semantic_id: meta.semantic_id,
    meta,
  } satisfies InspectableItem;
  if (shape.type === 'surface-block') {
    const block = shape as Extract<TLShape, { type: 'surface-block' }>;
    return {
      ...base,
      kind: block.props.kind,
      w: block.props.w,
      h: block.props.h,
      props: {
        w: block.props.w,
        h: block.props.h,
        kind: block.props.kind,
        tone: block.props.tone,
        title: block.props.title.slice(0, 180),
        body: block.props.body.slice(0, 2_000),
        value: block.props.value.slice(0, 500),
        data: blockDataForInspection(block.props.data, shape.id),
      },
      text: [block.props.title, block.props.body, block.props.value].filter(Boolean).join(' ').slice(0, 500),
    };
  }
  if (shape.type === 'image') {
    const imageProps = shape.props as unknown as Record<string, unknown>;
    const assetId = typeof imageProps.assetId === 'string' ? imageProps.assetId : undefined;
    const asset = assetId ? assetRecords(editor).find((candidate) => String(candidate.id) === assetId) : undefined;
    const assetProjection = boundedAssetProjection(asset);
    const fogwoodAssetMeta = assetProjection && isRecord(assetProjection.meta.fogwood) ? assetProjection.meta.fogwood : undefined;
    const materialMeta = fogwoodAssetMeta && isRecord(fogwoodAssetMeta.material)
      ? fogwoodAssetMeta.material
      : fogwoodAssetMeta?.kind === 'material'
        ? fogwoodAssetMeta
        : undefined;
    return {
      ...base,
      kind: 'material',
      w: typeof imageProps.w === 'number' ? imageProps.w : base.w,
      h: typeof imageProps.h === 'number' ? imageProps.h : base.h,
      props: {
        w: typeof imageProps.w === 'number' ? imageProps.w : base.w,
        h: typeof imageProps.h === 'number' ? imageProps.h : base.h,
        asset_id: assetId ?? null,
        alt_text: typeof imageProps.altText === 'string' ? imageProps.altText.slice(0, 240) : '',
        ...(assetProjection ? { asset: assetProjection } : {}),
        ...(materialMeta ? { material: boundedProps(materialMeta) } : {}),
      },
      text: typeof imageProps.altText === 'string' ? imageProps.altText.slice(0, 500) : '',
    };
  }
  const text = getNativeShapeText(editor, shape);
  return { ...base, props: nativePropsForInspection(shape), text };
}

export function inspectSurface(editor: Editor, input: { page_size?: number; cursor?: string; binding_page_size?: number; binding_cursor?: string } = {}) {
  const { shapes, bindings, semantic_relationships } = pageContent(editor);
  const assets = referencedAssets(editor, shapes);
  const allItems = shapes.map((shape) => inspectItem(editor, shape));
  const pageSize = typeof input.page_size === 'number' && Number.isFinite(input.page_size)
    ? Math.max(1, Math.min(128, Math.trunc(input.page_size)))
    : 128;
  const offset = typeof input.cursor === 'string' && /^\d+$/.test(input.cursor) ? Number(input.cursor) : 0;
  const items = allItems.slice(offset, offset + pageSize);
  const nextOffset = offset + items.length;
  const shapeIds = new Set<string>(shapes.map((shape) => shape.id));
  const allBindingItems = currentPageBindings(editor, shapeIds);
  const bindingPageSize = typeof input.binding_page_size === 'number' && Number.isFinite(input.binding_page_size)
    ? Math.max(1, Math.min(256, Math.trunc(input.binding_page_size)))
    : 128;
  const bindingOffset = typeof input.binding_cursor === 'string' && /^\d+$/.test(input.binding_cursor) ? Number(input.binding_cursor) : 0;
  const bindingItems = allBindingItems.slice(bindingOffset, bindingOffset + bindingPageSize);
  const bindingNextOffset = bindingOffset + bindingItems.length;
  const currentState = editor.getCurrentPageState();
  const viewport = editor.getViewportPageBounds();
  const camera = editor.getCamera();
  const pageBounds = editor.getCurrentPageBounds();
  const blockCount = shapes.filter((shape) => shape.type === 'surface-block').length;
  const nativeCount = shapes.length - blockCount;
  const itemComplete = nextOffset >= allItems.length;
  const bindingComplete = bindingNextOffset >= allBindingItems.length;
  const selectedShapeIds = [...currentState.selectedShapeIds];
  const selectionLimit = 128;
  const selectedShapeIdsPage = selectedShapeIds.slice(0, selectionLimit);
  const selectionComplete = selectedShapeIdsPage.length >= selectedShapeIds.length;
  const selectedSemanticIds = selectedShapeIdsPage.flatMap((id) => {
    const item = allItems.find((candidate) => candidate.id === id);
    return item?.semantic_id ? [item.semantic_id] : [];
  });
  const allRegions = currentRegions(shapes);
  const regionLimit = 256;
  const regions = allRegions.slice(0, regionLimit);
  const regionComplete = regions.length >= allRegions.length;
  const semanticRelationshipLimit = SPATIAL_LIMITS.max_relationships;
  const semanticRelationshipItems = semantic_relationships.slice(0, semanticRelationshipLimit);
  const semanticRelationshipComplete = semanticRelationshipItems.length >= semantic_relationships.length;
  return {
    protocol: { name: FOGWOOD_PROTOCOL, version: FOGWOOD_PROTOCOL_VERSION, registry_version: FOGWOOD_REGISTRY_VERSION },
    persistence: FOGWOOD_PERSISTENCE,
    participation_contract: FOGWOOD_PARTICIPATION_CONTRACT,
    workflow: ['inspect', 'capability search', 'proposal', 'page Apply/Reject'],
    workflow_contract: 'inspect -> capability search -> proposal -> page Apply/Reject',
    authority: { agent: 'read current state, search local capabilities, and stage typed proposals', page: 'owns validation and Apply/Reject; only page Apply mutates content' },
    no_code: true,
    content_revision: currentRevision(editor),
    revision_source: 'current-page-shapes-bindings-and-referenced-asset-metadata; camera and selection excluded',
    page: {
      id: editor.getCurrentPageId(),
      bounds: pageBounds ? { x: pageBounds.x, y: pageBounds.y, w: pageBounds.w, h: pageBounds.h } : null,
      coordinate_system: 'page coordinates',
    },
    viewport: { page_coordinates: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h }, camera: { x: camera.x, y: camera.y, z: camera.z } },
    selection: { shape_ids: selectedShapeIdsPage, semantic_ids: selectedSemanticIds, focused_group_id: currentState.focusedGroupId ?? null, editing_shape_id: currentState.editingShapeId ?? null },
    selection_count: selectedShapeIds.length,
    selection_semantic_ids: selectedSemanticIds,
    selection_completeness: { complete: selectionComplete, truncated: !selectionComplete, total: selectedShapeIds.length, returned: selectedShapeIdsPage.length, limit: selectionLimit },
    counts: { shapes: shapes.length, blocks: blockCount, native_shapes: nativeCount, assets: assets.length, bindings: bindings.length, semantic_relationships: semantic_relationships.length, regions: allRegions.length, returned_items: items.length, returned_bindings: bindingItems.length },
    semantic_relationship_count: semantic_relationships.length,
    supported_blocks: [...BLOCK_KINDS],
    supported_native_shapes: [...CANVAS_SHAPE_KINDS],
    items,
    assets,
    bindings: bindingItems,
    regions,
    region_completeness: { complete: regionComplete, truncated: !regionComplete, total: allRegions.length, returned: regions.length, limit: regionLimit },
    semantic_relationships: semanticRelationshipItems,
    semantic_relationship_completeness: { complete: semanticRelationshipComplete, truncated: !semanticRelationshipComplete, total: semantic_relationships.length, returned: semanticRelationshipItems.length, limit: semanticRelationshipLimit },
    item_completeness: {
      complete: itemComplete,
      truncated: !itemComplete,
      total: allItems.length,
      returned: items.length,
      cursor: offset === 0 ? undefined : String(offset),
      next_cursor: itemComplete ? undefined : String(nextOffset),
      limit: pageSize,
    },
    binding_completeness: {
      complete: bindingComplete,
      truncated: !bindingComplete,
      total: allBindingItems.length,
      returned: bindingItems.length,
      cursor: bindingOffset === 0 ? undefined : String(bindingOffset),
      next_cursor: bindingComplete ? undefined : String(bindingNextOffset),
      limit: bindingPageSize,
    },
    completeness: {
      complete: itemComplete && bindingComplete && regionComplete && semanticRelationshipComplete,
      truncated: !itemComplete || !bindingComplete || !regionComplete || !semanticRelationshipComplete,
      cursor: offset === 0 ? undefined : String(offset),
      next_cursor: itemComplete ? undefined : String(nextOffset),
      limits: { page_size: pageSize, block_data_items: 20, table_columns: 8, table_rows: 12, native_text: 500, native_props_depth: 6, native_props_entries: 64, binding_page_size: bindingPageSize, regions: regionLimit, semantic_relationships: semanticRelationshipLimit },
    },
  };
}

function proposalContext(editor: Editor) {
  const content = pageContent(editor);
  const items = content.shapes.map((shape) => inspectItem(editor, shape));
  let allSelectedShapeIds: readonly string[] = [];
  try {
    allSelectedShapeIds = [...editor.getCurrentPageState().selectedShapeIds];
  } catch {
    // Legacy editor doubles and older hosts may omit ephemeral selection APIs.
  }
  const selectedShapeIds = allSelectedShapeIds.slice(0, 128);
  return {
    current_revision: currentRevision(editor),
    items,
    instrument_shapes: instrumentShapesForEditor(editor),
    page_id: editor.getCurrentPageId(),
    selection_semantic_ids: selectedShapeIds.flatMap((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return item?.semantic_id ? [item.semantic_id] : [];
    }),
    selection_complete: allSelectedShapeIds.length <= 128,
    selection_total: allSelectedShapeIds.length,
    regions: currentRegions(content.shapes),
    semantic_relationships: content.semantic_relationships,
  };
}

function instrumentShapesForEditor(editor: Editor): InstrumentShapeLike[] {
  return editor.getCurrentPageShapes().map((shape) => ({
    id: String(shape.id),
    type: shape.type,
    parent_id: String(shape.parentId),
    is_locked: shape.isLocked,
    props: shape.type === 'surface-block'
      ? (shape as Extract<TLShape, { type: 'surface-block' }>).props
      : undefined,
  }));
}

function expandActions(actions: readonly ProposalAction[], recipeInstanceIdFor: (recipeId: string) => string) {
  return actions.flatMap((action) => {
    if (action.type !== 'insert_recipe') return [action];
    const recipe = getRecipe(action.recipe_id, action.version);
    if (!recipe) return [];
    const recipeInstanceId = recipeInstanceIdFor(recipe.id);
    return expandRecipe(recipe, action.anchor).map((operation) => ({
      ...operation,
      recipeMeta: {
        recipe_id: recipe.id,
        composition_id: recipe.version === 2 ? recipe.id : undefined,
        recipe_version: recipe.version,
        recipe_instance_id: recipeInstanceId,
      },
    }));
  });
}

function recipeInstanceIds(editor: Editor) {
  const ids = new Set<string>();
  for (const shape of editor.getCurrentPageShapes()) {
    const meta = fogwoodMeta(shape);
    if (meta.recipe_instance_id) ids.add(meta.recipe_instance_id);
    if (shape.type !== 'surface-block') continue;
    const block = shape as Extract<TLShape, { type: 'surface-block' }>;
    const data = parseBlockData(block.props.data);
    if (!isRecord(data.instrument)) continue;
    if (typeof data.instrument.recipe_instance_id === 'string') ids.add(data.instrument.recipe_instance_id);
  }
  return ids;
}

function nextRecipeInstanceId(editor: Editor, recipeId: string, used: Set<string>): string | undefined {
  const existing = recipeInstanceIds(editor);
  for (let index = 1; index <= 10_000; index += 1) {
    const candidate = `${recipeId}:${index}`;
    if (!existing.has(candidate) && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  return undefined;
}

function materialDataUrl(material: PreparedMaterial) {
  if (!isRecord(material) || !/^sha256:[0-9a-f]{64}$/u.test(material.content_hash)) throw new Error('The material content hash is not canonical.');
  if (material.base64 !== material.canonical_base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(material.base64)) throw new Error('The material base64 is not canonical.');
  if (!Number.isSafeInteger(material.byte_length) || material.byte_length < 1) throw new Error('The material byte length is invalid.');
  return `data:${material.mime_type};base64,${material.base64}`;
}

function materialAssetMeta(material: PreparedMaterial): JsonObject {
  return {
    fogwood: {
      kind: 'material',
      content_hash: material.content_hash,
      byte_length: material.byte_length,
      mime_type: material.mime_type,
      width: material.dimensions.width,
      height: material.dimensions.height,
      source_status: material.source_status,
      decode_qualified: material.decode_qualified,
      provenance: {
        originating_capability: material.originating_capability,
        qualification_boundary: material.qualification_boundary,
        prompt_summary: material.prompt_summary,
      },
    },
  };
}

function findContentAddressedAsset(editor: Editor, material: PreparedMaterial, expectedSrc: string, expectedId: TLAssetId) {
  return assetRecords(editor).find((asset) => {
    if (asset.type !== 'image' || !isRecord(asset.meta) || !isRecord(asset.meta.fogwood)) return false;
    const fogwood = asset.meta.fogwood;
    const props: Record<string, unknown> = isRecord(asset.props) ? asset.props : {};
    return asset.id === expectedId
      && fogwood.kind === 'material'
      && fogwood.content_hash === material.content_hash
      && fogwood.byte_length === material.byte_length
      && fogwood.mime_type === material.mime_type
      && fogwood.width === material.dimensions.width
      && fogwood.height === material.dimensions.height
      && fogwood.source_status === material.source_status
      && fogwood.decode_qualified === true
      && props.mimeType === material.mime_type
      && props.w === material.dimensions.width
      && props.h === material.dimensions.height
      && props.src === expectedSrc;
  });
}

function addMaterialShapes(
  editor: Editor,
  materials: readonly PreparedMaterial[],
  createdAssetIds: TLAssetId[],
) {
  if (materials.length === 0) return [] as TLShapeId[];
  if (typeof editor.createAssets !== 'function' || typeof editor.createShapes !== 'function') throw new Error('This page adapter does not expose the built-in tldraw asset and image-shape APIs.');
  const pageId = editor.getCurrentPageId() as TLParentId;
  const shapes: Array<Record<string, unknown>> = [];
  for (const material of materials) {
    if (!isPreparedMaterial(material) || !material.decode_qualified) throw new Error('Material decode proof was not retained through Apply.');
    const src = materialDataUrl(material);
    const assetId = AssetRecordType.createId(`fogwood-material-${material.content_hash.slice('sha256:'.length)}`) as TLAssetId;
    const existing = findContentAddressedAsset(editor, material, src, assetId);
    let asset = existing;
    if (!asset) {
      if (assetRecords(editor).some((candidate) => candidate.id === assetId)) throw new Error('The content-addressed asset id is already occupied by different bytes or metadata.');
      asset = AssetRecordType.create({
        id: assetId,
        type: 'image',
        props: {
          w: material.dimensions.width,
          h: material.dimensions.height,
          name: material.label || material.semantic_id,
          isAnimated: false,
          mimeType: material.mime_type,
          src,
          fileSize: material.byte_length,
        },
        meta: materialAssetMeta(material),
      });
      editor.createAssets([asset]);
      createdAssetIds.push(asset.id);
    }
    const imageAsset = asset as TLAsset & { type: 'image'; props: { w: number; h: number } };
    const shapeId = createShapeId();
    shapes.push({
      id: shapeId,
      type: 'image',
      x: material.x,
      y: material.y,
      parentId: pageId,
      meta: {
        fogwood: {
          semantic_id: material.semantic_id,
          semantic_id_source: 'stable',
          role: 'proposal-material',
          material_hash: material.content_hash,
          byte_length: material.byte_length,
          source_status: material.source_status,
          originating_capability: material.originating_capability,
          qualification_boundary: material.qualification_boundary,
        },
      },
      props: {
        w: material.w,
        h: material.h,
        playing: false,
        url: '',
        assetId: imageAsset.id,
        crop: null,
        flipX: false,
        flipY: false,
        altText: material.alt || material.label || material.semantic_id,
      },
    });
  }
  editor.createShapes(shapes as never);
  return shapes.map((shape) => shape.id as TLShapeId);
}

function cleanupUnreferencedAssets(editor: Editor, assetIds: readonly TLAssetId[]) {
  if (assetIds.length === 0 || typeof editor.deleteAssets !== 'function') return;
  const referenced = new Set<string>();
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== 'image') continue;
    const assetId = isRecord(shape.props) && typeof shape.props.assetId === 'string' ? shape.props.assetId : undefined;
    if (assetId) referenced.add(assetId);
  }
  const orphaned = assetIds.filter((id) => !referenced.has(String(id)));
  if (orphaned.length > 0) editor.deleteAssets(orphaned);
}

function spatialContextForEditor(editor: Editor) {
  const content = pageContent(editor);
  const items = content.shapes.map((shape) => inspectItem(editor, shape));
  let allSelectedShapeIds: readonly string[] = [];
  try {
    allSelectedShapeIds = [...editor.getCurrentPageState().selectedShapeIds];
  } catch {
    // Minimal editor doubles may omit ephemeral selection APIs.
  }
  const selectedShapeIds = allSelectedShapeIds.slice(0, 128);
  return {
    page_id: editor.getCurrentPageId(),
    items,
    selection_semantic_ids: selectedShapeIds.flatMap((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return item?.semantic_id ? [item.semantic_id] : [];
    }),
    selection_complete: allSelectedShapeIds.length <= 128,
    selection_total: allSelectedShapeIds.length,
    regions: currentRegions(content.shapes),
    semantic_relationships: content.semantic_relationships,
  };
}

function cloneShapeRecord(shape: TLShape): Record<string, unknown> {
  const cloneValue = (value: unknown): unknown => {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch {
        // JSON fallback below is sufficient for tldraw's plain shape records.
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };
  return cloneValue(shape) as Record<string, unknown>;
}

function spatialCreateShape(
  editor: Editor,
  create: SpatialCreatePlan,
) {
  const source = create.source_shape_id ? editor.getShape(create.source_shape_id as TLShapeId) : undefined;
  if (create.kind === 'variant' && !source) throw new Error(`Variant source ${create.source_shape_id ?? ''} no longer exists.`);
  if (create.kind === 'variant' && source) {
    const clone = cloneShapeRecord(source);
    const id = createShapeId();
    const sourceMeta = fogwoodMeta(source);
    const variantSourceMeta = { ...sourceMeta };
    for (const key of ['relationship_id', 'relationship_kind', 'source_semantic_id', 'target_semantic_id', 'relationship_label'] as const) delete variantSourceMeta[key];
    const fogwood = {
      ...variantSourceMeta,
      semantic_id: create.semantic_id,
      semantic_id_source: 'stable',
      role: 'variant',
      variant_id: create.variant_id ?? create.semantic_id,
      ...(create.parent_variant_id ? { parent_variant_id: create.parent_variant_id } : {}),
      ...(create.lineage_source_id ? { lineage_source_id: create.lineage_source_id } : {}),
    } satisfies FogwoodMeta;
    const props = isRecord(clone.props) ? { ...clone.props } : {};
    if (create.patches?.text !== undefined) {
      if (source.type === 'image') props.altText = create.patches.text;
      else props.richText = toRichText(create.patches.text);
    }
    if (create.patches?.color !== undefined) {
      props.color = create.patches.color;
      if ('labelColor' in props) props.labelColor = create.patches.color;
    }
    if (create.patches?.fill !== undefined) props.fill = create.patches.fill;
    clone.id = id;
    clone.x = create.x;
    clone.y = create.y;
    clone.parentId = editor.getCurrentPageId();
    clone.meta = {
      ...(isRecord(source.meta) ? source.meta : {}),
      ...shapeMeta(String(id), fogwood),
    };
    clone.props = props;
    editor.createShapes([clone] as never);
    return id as TLShapeId;
  }
  const ids = addCanvasShapes(editor, [{
    kind: 'note',
    x: create.x,
    y: create.y,
    w: create.w,
    h: create.h,
    text: create.text ?? '',
    semantic_id: create.semantic_id,
    role: 'annotation',
    lineage_source_id: create.lineage_source_id,
  }], {
    coordinateSpace: 'page',
    focusAfter: false,
    select: false,
    recordHistory: false,
    parentId: editor.getCurrentPageId(),
    fogwood: {
      semantic_id: create.semantic_id,
      semantic_id_source: 'stable',
      role: 'annotation',
      ...(create.source_semantic_id ? { lineage_source_id: create.source_semantic_id } : {}),
    },
  });
  return ids[0];
}

function spatialRelationshipShape(editor: Editor, relationship: SemanticRelationship, recipeMeta?: FogwoodMeta) {
  const items = spatialContextForEditor(editor).items;
  const source = items.find((item) => item.semantic_id === relationship.source_semantic_id);
  const target = items.find((item) => item.semantic_id === relationship.target_semantic_id);
  if (!source || !target) throw new Error(`Relationship ${relationship.id} target no longer exists.`);
  return addCanvasShapes(editor, [{
    kind: 'arrow',
    x: source.x + source.w / 2,
    y: source.y + source.h / 2,
    end_x: target.x + target.w / 2,
    end_y: target.y + target.h / 2,
    text: relationship.label ?? '',
  }], {
    coordinateSpace: 'page',
    focusAfter: false,
    select: false,
    recordHistory: false,
    parentId: editor.getCurrentPageId(),
    fogwood: {
      semantic_id: relationshipSemanticId(relationship.id),
      semantic_id_source: 'stable',
      role: 'semantic-relationship',
      ...(recipeMeta ?? {}),
      relationship_id: relationship.id,
      relationship_kind: relationship.kind,
      source_semantic_id: relationship.source_semantic_id,
      target_semantic_id: relationship.target_semantic_id,
      ...(relationship.label ? { relationship_label: relationship.label } : {}),
    },
  })[0];
}

export function applyProposalToEditor(editor: Editor, proposal: ProposalV1) {
  if (currentRevision(editor) !== proposal.base_revision) return { ok: false as const, status: 'STALE_STATE' as const, message: 'The page changed; inspect again and re-propose before applying.' };
  if (typeof editor.getIsReadonly === 'function' && editor.getIsReadonly()) return { ok: false as const, status: 'ERROR' as const, message: 'This page is read-only; no proposal changes were applied.' };
  const validation = validateProposal(proposal, proposalContext(editor));
  if (!validation.ok) {
    const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
    return { ok: false as const, status: stale ? 'STALE_STATE' as const : 'ERROR' as const, message: validation.errors.map((error) => error.message).join(' ') };
  }
  const maxShapes = editor.options.maxShapesPerPage;
  if (Number.isFinite(maxShapes) && validation.diff.counts.after > maxShapes) {
    return { ok: false as const, status: 'ERROR' as const, message: 'The proposal would exceed this page\'s bounded shape limit; no changes were applied.' };
  }
  const scopes = new Set<string>();
  let scopeAllocationError = false;
  const actions = expandActions(validation.proposal.actions, (recipeId) => {
    const allocated = nextRecipeInstanceId(editor, recipeId, scopes);
    if (!allocated) scopeAllocationError = true;
    return allocated ?? '';
  });
  if (scopeAllocationError) return { ok: false as const, status: 'ERROR' as const, message: 'The bounded recipe-instance scope is full; no changes were applied.' };
  const materialActions = actions.filter((action): action is Extract<ProposalAction, { type: 'add_materials' }> => action.type === 'add_materials');
  const preparedMaterials = materialActions.flatMap((action) => action.materials);
  if (preparedMaterials.length > 0 && (typeof editor.createAssets !== 'function' || typeof editor.createShapes !== 'function')) {
    return { ok: false as const, status: 'ERROR' as const, message: 'The page adapter does not expose the built-in tldraw asset and image-shape APIs; no changes were applied.' };
  }
  for (const material of preparedMaterials) {
    try {
      if (!isPreparedMaterial(material) || !material.decode_qualified) throw new Error('Material decode proof was not retained through Apply.');
      materialDataUrl(material);
    } catch (error) {
      return { ok: false as const, status: 'ERROR' as const, message: error instanceof Error ? error.message.slice(0, 180) : 'The material was refused before Apply.' };
    }
  }
  let instrumentUpdates: Array<{ id: TLShapeId; type: 'surface-block'; props: { value: string; data: string } }> = [];
  for (const action of actions) {
    if (action.type !== 'set_instrument_inputs') continue;
    const scenario = applyInstrumentInputChanges(instrumentShapesForEditor(editor), action.changes);
    if (scenario.status !== 'ok') {
      const stale = scenario.status === 'stale';
      return {
        ok: false as const,
        status: stale ? 'STALE_STATE' as const : 'ERROR' as const,
        message: scenario.errors.map((error) => error.message).join(' ') || 'The instrument scenario was rejected; no changes were applied.',
      };
    }
    const currentPageShapes = editor.getCurrentPageShapes();
    const currentSurfaceBlockIds = new Set<string>(currentPageShapes.filter((shape) => shape.type === 'surface-block').map((shape) => String(shape.id)));
    const scopeShapeIds = new Set(scenario.scope_shape_ids ?? []);
    const patchIds = scenario.patches.map((patch) => patch.shape_id);
    if (new Set(patchIds).size !== patchIds.length || patchIds.some((id) => !currentSurfaceBlockIds.has(id) || !scopeShapeIds.has(id))) {
      return { ok: false as const, status: 'ERROR' as const, message: 'Instrument scenario patches were outside the current-page scope; no changes were applied.' };
    }
    instrumentUpdates = scenario.patches.map((patch) => ({
      id: patch.shape_id as TLShapeId,
      type: 'surface-block' as const,
      props: { value: patch.value, data: patch.data },
    }));
  }
  const compareRecipeBlockCounts = new Map<string, number>();
  for (const action of actions) {
    if (action.type !== 'add_blocks' || !('recipeMeta' in action)) continue;
    const recipeMeta = (action as ProposalAction & { recipeMeta?: FogwoodMeta }).recipeMeta;
    if (recipeMeta?.recipe_id !== 'compare-and-decide' || !recipeMeta.recipe_instance_id) continue;
    compareRecipeBlockCounts.set(recipeMeta.recipe_instance_id, (compareRecipeBlockCounts.get(recipeMeta.recipe_instance_id) ?? 0) + action.blocks.length);
  }
  if ([...compareRecipeBlockCounts.values()].some((count) => count !== COMPARE_INSTRUMENT_INSTANCE_IDS.length + 2)) {
    return { ok: false as const, status: 'ERROR' as const, message: 'The immutable Compare recipe mapping was incomplete; no changes were applied.' };
  }
  const spatialContext = spatialContextForEditor(editor);
  const spatialMovePlans = new Map<ProposalAction, ReturnType<typeof planSpatialMoves>>();
  const relationshipPlans = new Map<ProposalAction, SemanticRelationship[]>();
  // v2 relationships intentionally arrive in the same proposal as their
  // native endpoints. Validate those endpoints before mutation by projecting
  // the bounded composition shapes into the spatial grammar; the real arrows
  // are still created only after the editor has created the native shapes.
  const compositionItems = actions.flatMap((action) => {
    if (action.type !== 'add_shapes') return [];
    const recipeMeta = 'recipeMeta' in action
      ? (action as ProposalAction & { recipeMeta?: FogwoodMeta }).recipeMeta
      : undefined;
    if (recipeMeta?.recipe_version !== 2) return [];
    return action.shapes.map((shape) => {
      const compositionShape = shape as typeof shape & {
        semantic_id: string;
        x: number;
        y: number;
        w: number;
        h: number;
      };
      return {
      id: `composition:${recipeMeta.recipe_instance_id ?? recipeMeta.recipe_id}:${compositionShape.semantic_id}`,
      semantic_id: compositionShape.semantic_id,
      semantic_id_source: 'stable',
      type: shape.kind,
      kind: shape.kind,
      x: compositionShape.x,
      y: compositionShape.y,
      w: compositionShape.w,
      h: compositionShape.h,
      parent_id: spatialContext.page_id,
      };
    });
  });
  const relationshipContext = compositionItems.length > 0
    ? { ...spatialContext, items: [...spatialContext.items, ...compositionItems] }
    : spatialContext;
  try {
    for (const action of actions) {
      if (action.type === 'apply_spatial_moves') spatialMovePlans.set(action, planSpatialMoves(spatialContext, action));
      if (action.type === 'add_relationships') relationshipPlans.set(action, [...planRelationships(relationshipContext, action.relationships).relationships]);
    }
  } catch (error) {
    return { ok: false as const, status: 'ERROR' as const, message: error instanceof Error ? error.message.slice(0, 180) : 'The spatial proposal was rejected before mutation.' };
  }
  const compareBlocksByScope = new Map<string, TLShapeId[]>();
  const createdAssetIds: TLAssetId[] = [];
  try {
    editor.markHistoryStoppingPoint('Apply agent proposal');
    editor.run(() => {
      for (const action of actions) {
        const recipeMeta = 'recipeMeta' in action
          ? (action as ProposalAction & { recipeMeta?: FogwoodMeta }).recipeMeta
          : undefined;
        const fogwood = {
          role: recipeMeta ? 'recipe-content' : 'proposal-content',
          ...(recipeMeta ?? {}),
        };
        if (action.type === 'add_blocks') {
          const ids = addSurfaceBlocks(editor, action.blocks, { coordinateSpace: 'page', focusAfter: false, select: false, recordHistory: false, parentId: editor.getCurrentPageId(), fogwood });
          if (recipeMeta?.recipe_id === 'compare-and-decide' && recipeMeta.recipe_instance_id) {
            compareBlocksByScope.set(recipeMeta.recipe_instance_id, ids);
          }
        } else if (action.type === 'add_shapes') {
          addCanvasShapes(editor, action.shapes, { coordinateSpace: 'page', focusAfter: false, select: false, recordHistory: false, parentId: editor.getCurrentPageId(), fogwood });
        } else if (action.type === 'add_materials') {
          addMaterialShapes(editor, action.materials as readonly PreparedMaterial[], createdAssetIds);
        } else if (action.type === 'apply_spatial_moves') {
          const plan = spatialMovePlans.get(action);
          if (!plan) throw new Error('Spatial move plan was not retained through Apply.');
          const moveUpdates = plan.moves.map((move) => ({
            id: move.shape_id as TLShapeId,
            type: editor.getShape(move.shape_id as TLShapeId)?.type ?? 'geo',
            x: move.after.x,
            y: move.after.y,
            rotation: move.after.rotation,
          }));
          if (moveUpdates.length > 0) editor.updateShapes(moveUpdates as never);
          for (const create of plan.creates) spatialCreateShape(editor, create);
        } else if (action.type === 'add_relationships') {
          // Relationship metadata is canonical, but arrow geometry is derived
          // from the final positions. Project these after all action-order
          // spatial moves below, still inside this one history transaction.
        } else if (action.type === 'update_blocks') {
          updateSurfaceBlocks(editor, action.updates, { recordHistory: false });
        } else if (action.type === 'place_items') {
          placeCanvasItems(editor, action.placements, { recordHistory: false });
        } else if (action.type === 'remove_items') {
          const currentItems = proposalContext(editor).items;
          const ids = descendantClosure(action.ids, currentItems).map((item) => item.id as TLShapeId);
          editor.deleteShapes(ids);
        } else if (action.type === 'clear_surface') {
          editor.deleteShapes(editor.getCurrentPageShapes().map((shape) => shape.id));
        } else if (action.type === 'set_instrument_inputs') {
          if (instrumentUpdates.length === 0) throw new Error('Instrument scenario patches were empty.');
          editor.updateShapes(instrumentUpdates as never);
        }
      }
      for (const action of actions) {
        if (action.type !== 'add_relationships') continue;
        const relationships = relationshipPlans.get(action);
        if (!relationships) throw new Error('Relationship plan was not retained through Apply.');
        const recipeMeta = 'recipeMeta' in action
          ? (action as ProposalAction & { recipeMeta?: FogwoodMeta }).recipeMeta
          : undefined;
        for (const relationship of relationships) spatialRelationshipShape(editor, relationship, recipeMeta);
      }
      for (const [recipeInstanceId, blockIds] of compareBlocksByScope) {
        const shapeIds = compareShapeIdsFromRecipeBlocks(blockIds.map(String));
        if (Object.keys(shapeIds).length !== COMPARE_INSTRUMENT_INSTANCE_IDS.length) throw new Error('Compare recipe block mapping was incomplete.');
        const scope = createCompareInstrumentScope(recipeInstanceId, shapeIds);
        if (scope.status !== 'ok') throw new Error('Compare recipe instrument scope was rejected.');
        const updates = scope.blocks.map((patch) => ({ id: patch.shape_id as TLShapeId, type: 'surface-block' as const, props: { value: patch.value, data: patch.data } }));
        if (updates.length !== COMPARE_INSTRUMENT_INSTANCE_IDS.length) throw new Error('Compare recipe instrument patches were incomplete.');
        editor.updateShapes(updates as never);
      }
    }, { history: 'record' });
  } catch (error) {
    cleanupUnreferencedAssets(editor, createdAssetIds);
    return { ok: false as const, status: 'ERROR' as const, message: error instanceof Error ? error.message.slice(0, 180) : 'The page rejected the proposal.' };
  }
  if (currentRevision(editor) === proposal.base_revision) {
    cleanupUnreferencedAssets(editor, createdAssetIds);
    return { ok: false as const, status: 'ERROR' as const, message: 'The page reported no content change; Apply was not recorded.' };
  }
  return { ok: true as const };
}

export type SurfaceToolController = ReturnType<typeof createProposalController> & {
  stageRecipe: (recipeId: string) => ProposalControllerResult;
};

export type SurfaceMaterialOptions = {
  /** Test and host seam for browser image decode qualification. */
  decodeRaster?: MaterialDecoder;
};

function browserRasterDecoder(document: Document): MaterialDecoder {
  return async ({ mime_type, bytes }) => {
    const view = document.defaultView as (Window & { createImageBitmap?: (blob: Blob) => Promise<{ width: number; height: number; close?: () => void }>; Blob?: typeof Blob }) | null;
    if (!view?.createImageBitmap || !view.Blob) throw new Error('Browser image decode is unavailable on this page.');
    const blob = new view.Blob([new Uint8Array(bytes)], { type: mime_type });
    const bitmap = await view.createImageBitmap(blob);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return result;
  };
}

export function registerSurfaceTools(
  editor: Editor,
  onConnection: (connection: ToolConnection) => void,
  onActivity?: (title: string, detail?: string) => void,
  onProposalChange?: (state: ProposalControllerState | null) => void,
  onController?: (controller: SurfaceToolController) => void,
  onProposalLifecycle?: (event: ProposalLifecycleEvent) => void,
  options: SurfaceMaterialOptions = {},
) {
  const baseController = createProposalController(
    { getRevision: () => currentRevision(editor), apply: (proposal) => applyProposalToEditor(editor, proposal) },
    onProposalChange,
  );
  const lifecycleController = createProposalLifecycleController(baseController, {
    get_revision: () => currentRevision(editor),
    on_event: onProposalLifecycle,
    on_event_error: (error) => onActivity?.('Receipt was not recorded', error.message.slice(0, 180)),
  });
  const controller: SurfaceToolController = {
    ...lifecycleController,
    stageRecipe(recipeId) {
      const recipe = getRecipe(recipeId, 2) ?? getRecipe(recipeId, 1);
      if (!recipe) return { status: 'ERROR', message: 'Unknown immutable recipe.' };
      const proposal = {
        base_revision: currentRevision(editor),
        summary: `Review ${recipe.title}`.slice(0, 180),
        rationale: recipe.purpose.slice(0, 500),
        actions: [{ type: 'insert_recipe', recipe_id: recipe.id, version: recipe.version }],
      } satisfies ProposalV1;
      const validation = validateProposal(proposal, proposalContext(editor));
      if (!validation.ok) return { status: 'ERROR', message: validation.errors.map((error) => error.message).join(' ') };
      const staged = lifecycleController.stage(validation.proposal, validation.diff);
      if (staged.status === 'STAGED') onActivity?.('Staged a Fogwood recipe', `${recipe.title} is ready for page review.`);
      return staged;
    },
  };
  onController?.(controller);

  const containerDocument = editor.getContainer().ownerDocument as Document & { modelContext?: ModelContext };
  const decodeRaster = options.decodeRaster ?? browserRasterDecoder(containerDocument);

  const tools: WebMcpTool[] = [
    {
      name: 'fogwood-inspect',
      title: 'Inspect Fogwood',
      description: 'Inspect the live Fogwood canvas and spatial state first, including the participation contract, complete or paginated current-page state, semantic relationships, and bounded assets. This is read-only, device-local, and excludes camera and selection from the opaque content revision.',
      inputSchema: INSPECT_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const value = isRecord(input) ? input : {};
        if (Object.keys(value).some((key) => !['page_size', 'cursor', 'binding_page_size', 'binding_cursor'].includes(key))) return textResult({ status: 'INVALID_INPUT', error: 'Unknown inspect field.' }, true);
        if (value.page_size !== undefined && (typeof value.page_size !== 'number' || !Number.isInteger(value.page_size) || value.page_size < 1 || value.page_size > 128)) return textResult({ status: 'INVALID_INPUT', error: 'page_size must be an integer from 1 to 128.' }, true);
        if (value.cursor !== undefined && (typeof value.cursor !== 'string' || !/^\d+$/.test(value.cursor) || value.cursor.length > 12)) return textResult({ status: 'INVALID_INPUT', error: 'cursor must be a bounded numeric string.' }, true);
        if (value.binding_page_size !== undefined && (typeof value.binding_page_size !== 'number' || !Number.isInteger(value.binding_page_size) || value.binding_page_size < 1 || value.binding_page_size > 256)) return textResult({ status: 'INVALID_INPUT', error: 'binding_page_size must be an integer from 1 to 256.' }, true);
        if (value.binding_cursor !== undefined && (typeof value.binding_cursor !== 'string' || !/^\d+$/.test(value.binding_cursor) || value.binding_cursor.length > 12)) return textResult({ status: 'INVALID_INPUT', error: 'binding_cursor must be a bounded numeric string.' }, true);
        const surface = inspectSurface(editor, value);
        onActivity?.('Fogwood inspected the page', `${surface.counts.shapes} canvas items read without changing them.`);
        return textResult(surface);
      },
    },
    {
      name: 'fogwood-capabilities',
      title: 'Search Fogwood capabilities',
      description: 'Search the bounded host-facing Fogwood vocabulary of materials, moves, adapters, aesthetics, algorithms, provocations, primitives, and recipes. Results contain schemas and definitions only; there is no executable code or fetch URL, and host availability must be observed separately.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', maxLength: 120 },
          kind: { type: 'string', enum: ['tool', 'action', 'primitive', 'recipe'] },
          page_size: { type: 'integer', minimum: 1, maximum: 20 },
          cursor: { type: 'string', pattern: '^\\d+$', maxLength: 16 },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const value = isRecord(input) ? input : {};
        if (Object.keys(value).some((key) => !['query', 'kind', 'page_size', 'cursor'].includes(key))) return textResult({ status: 'INVALID_INPUT', error: 'Unknown capability-search field.' }, true);
        if (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 120)) return textResult({ status: 'INVALID_INPUT', error: 'query must be at most 120 characters.' }, true);
        if (value.kind !== undefined && !['tool', 'action', 'primitive', 'recipe'].includes(String(value.kind))) return textResult({ status: 'INVALID_INPUT', error: 'kind must be tool, action, primitive, or recipe.' }, true);
        if (value.page_size !== undefined && (typeof value.page_size !== 'number' || !Number.isInteger(value.page_size) || value.page_size < 1 || value.page_size > 20)) return textResult({ status: 'INVALID_INPUT', error: 'page_size must be an integer from 1 to 20.' }, true);
        if (value.cursor !== undefined && (typeof value.cursor !== 'string' || !/^\d+$/.test(value.cursor) || value.cursor.length > 16)) return textResult({ status: 'INVALID_INPUT', error: 'cursor must be a bounded numeric string.' }, true);
        const result = searchCapabilities(value as CapabilitySearchInput);
        onActivity?.('Fogwood searched capabilities', `${result.results.length} local capability results returned.`);
        return textResult(result);
      },
    },
    {
      name: 'fogwood-propose',
      title: 'Propose a Fogwood change',
      description: 'Validate and stage one bounded typed composition or page proposal against an inspect content_revision. The proposal never mutates the canvas; a person must review the diff and choose page Apply or Reject.',
      inputSchema: PROPOSAL_INPUT_SCHEMA,
      annotations: { untrustedContentHint: true },
      execute: (input) => {
        if (isRecord(input) && Array.isArray(input.actions) && input.actions.some((action) => isRecord(action) && action.type === 'add_materials')) {
          return validateProposalAsync(input, proposalContext(editor), { decodeRaster }).then((validation) => {
            if (!validation.ok) {
              const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
              return textResult({ status: stale ? 'STALE_STATE' : 'INVALID_PROPOSAL', errors: validation.errors }, true);
            }
            const staged = controller.stage(validation.proposal, validation.diff);
            if (staged.status !== 'STAGED') return textResult({ status: staged.status, message: staged.message }, true);
            onActivity?.('Fogwood staged a proposal', proposalActivityDetail(validation.diff));
            return textResult({ status: 'STAGED', proposal: validation.proposal, diff: validation.diff });
          });
        }
        const validation = validateProposal(input, proposalContext(editor));
        if (!validation.ok) {
          const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
          return textResult({ status: stale ? 'STALE_STATE' : 'INVALID_PROPOSAL', errors: validation.errors }, true);
        }
        const staged = controller.stage(validation.proposal, validation.diff);
        if (staged.status !== 'STAGED') return textResult({ status: staged.status, message: staged.message }, true);
        onActivity?.('Fogwood staged a proposal', proposalActivityDetail(validation.diff));
        return textResult({ status: 'STAGED', proposal: validation.proposal, diff: validation.diff });
      },
    },
    {
      ...FOGWOOD_BAZAAR_TOOL,
      title: 'Browse the Fogwood Bazaar',
      execute: (input) => {
        const result = FOGWOOD_BAZAAR_TOOL.execute(input);
        if (result.ok) {
          const count = 'results' in result ? result.results.length : Object.keys(result.sections).length;
          onActivity?.('Fogwood read the local Bazaar', `${count} bounded local catalog result${count === 1 ? '' : 's'} returned.`);
        }
        return textResult(result, !result.ok);
      },
    },
  ];

  const ContainerAbortController = containerDocument.defaultView?.AbortController ?? AbortController;
  return registerWebMcpTools({
    tools,
    getModelContext: () => containerDocument.modelContext,
    createAbortController: () => new ContainerAbortController(),
    onConnection,
  });
}
