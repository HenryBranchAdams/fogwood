import { AssetRecordType, PageRecordType, b64Vecs, createShapeId, toRichText } from 'tldraw';
import type { Editor, TLAsset, TLAssetId, TLPageId, TLParentId, TLShape, TLShapeId } from 'tldraw';
import {
  BLOCK_KINDS,
  BLOCK_TONES,
  CANVAS_COLORS,
  CANVAS_FILLS,
  CANVAS_SHAPE_KINDS,
  CAPABILITY_INPUT_SCHEMA,
  buildContextProjection,
  canonicalSerialize,
  computeContextToken,
  computePageRevision,
  deterministicHash,
  FOGWOOD_PROTOCOL,
  FOGWOOD_PROTOCOL_VERSION,
  FOGWOOD_REGISTRY_VERSION,
  FOGWOOD_CONTEXT_SELECTION_LIMIT,
  FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT,
  FOGWOOD_MEDIUM_CONTRACT,
  FOGWOOD_PARTICIPATION_CONTRACT,
  FOGWOOD_PREPARED_CANVAS_PLAN_SCHEMA,
  isRetiredActionType,
  INSPECT_INPUT_SCHEMA,
  PROPOSAL_TOOL_INPUT_SCHEMA,
  searchCapabilities,
  validateProposal,
  validateProposalAsync,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../fogwood-runtime.ts';
import type {
  BlockInput,
  BlockKind,
  BlockTone,
  CanvasShapeKind,
  CapabilitySearchInput,
  FogwoodMeta,
  InspectableItem,
  ProposalAction,
  ProposalControllerState,
  ProposalDiff,
  PreparedMaterialEvidence,
  ProposalV1,
} from '../fogwood-runtime';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isPreparedMaterial, MATERIAL_LIMITS, SUPPORTED_MATERIAL_MIME_TYPES } from '../fogwood-materials.ts';
import type { MaterialDecoder, PreparedMaterial } from '../fogwood-materials';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { buildPreparedCanvasPreview } from '../review/prepared-plan-preview.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { createEditorChangeCapture, createFogwoodChangeLedger, FOGWOOD_CHANGE_STORAGE_KEY } from '../runtime/change-ledger.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_SEMANTIC_LOWERERS, searchSemanticLowerers } from '../capabilities/semantic-lowerers.ts';
import type { JsonObject } from '@tldraw/utils';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { sha256Hex } from '../fogwood-identities.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_CANVAS_PROTOCOL, planCanvasOps } from '../fogwood-canvas-ops.ts';
import type { CanvasOpPlan } from '../fogwood-canvas-ops.ts';
import {
  FOGWOOD_CAPABILITY_ONTOLOGY,
  FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
  listCapabilityAvailability,
  isValidDesiredEffects,
  planCapabilities,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../fogwood-capability-planner.ts';
import type { FogwoodCapabilityPlanningRequest } from '../fogwood-capability-planner.ts';
import {
  FOGWOOD_FULL_SURFACE_VERSION,
  FULL_SURFACE_ADAPTERS,
  FULL_SURFACE_ROUTES,
  compileFullSurfaceRequest,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../fogwood-capability-compiler.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { TLDRAW_EXAMPLE_CATALOG, TLDRAW_EXAMPLE_SOURCE } from '../fogwood-tldraw-capabilities.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_PERSISTENCE } from '../fogwood-persistence.ts';
import {
  createProposalLifecycleController,
  type ProposalLifecycleEvent,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../fogwood-proposal-lifecycle.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { createFogwoodSurface } from '../fogwood-surface.ts';
import type { PreparedCanvasPlan } from '../fogwood-runtime.ts';
import {
  applyInstrumentControlChange,
  inspectInstrumentData,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../fogwood-instrument-adapter.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isStableSemanticId, relationshipSemanticId, SPATIAL_LIMITS } from '../fogwood-spatial.ts';
import type { SemanticRelationship } from '../fogwood-spatial.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { registerWebMcpTools } from '../webmcp-registration.ts';
import type { ModelContext, ToolConnection, WebMcpTool } from '../webmcp-registration';

export type { ToolConnection } from '../webmcp-registration';
export type { BlockKind, BlockTone, CanvasShapeKind } from '../fogwood-runtime';

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

/** Keep the activity feed meaningful for every current protocol proposal. */
export function proposalActivityDetail(diff: Pick<ProposalDiff, 'counts'>) {
  return `${diff.counts.adds} additions, ${diff.counts.updates} updates, ${diff.counts.moves} moves, ${diff.counts.removes} removals await review.`;
}

function positionFor(
  editor: Editor,
  input: Record<string, unknown>,
  index: number,
  coordinateSpace: 'viewport' | 'page',
) {
  const defaultX = 70 + (index % 3) * 370;
  const defaultY = 90 + Math.floor(index / 3) * 250;
  const rawX = clampNumber(input.x, defaultX, -100_000, 100_000);
  const rawY = clampNumber(input.y, defaultY, -100_000, 100_000);
  if (coordinateSpace === 'page') return { x: rawX, y: rawY };
  const viewport = editor.getViewportPageBounds();
  return { x: viewport.x + rawX, y: viewport.y + rawY };
}

type MutationOptions = {
  coordinateSpace?: 'viewport' | 'page';
  focusAfter?: boolean;
  select?: boolean;
  recordHistory?: boolean;
  parentId?: string;
  fogwood?: FogwoodMeta;
  /** Optional IDs allocated during stage so later lowerings stay stable. */
  shapeIds?: readonly TLShapeId[];
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
    ...(fogwood?.seeded_grammar ? { seeded_grammar: fogwood.seeded_grammar } : {}),
    ...(fogwood?.seeded_algorithm_version !== undefined ? { seeded_algorithm_version: fogwood.seeded_algorithm_version } : {}),
    ...(fogwood?.seeded_prng ? { seeded_prng: fogwood.seeded_prng } : {}),
    ...(fogwood?.seeded_seed !== undefined ? { seeded_seed: fogwood.seeded_seed } : {}),
    ...(fogwood?.seeded_wildness !== undefined ? { seeded_wildness: fogwood.seeded_wildness } : {}),
    ...(fogwood?.seeded_source_revision ? { seeded_source_revision: fogwood.seeded_source_revision } : {}),
    ...(fogwood?.seeded_source_fingerprint ? { seeded_source_fingerprint: fogwood.seeded_source_fingerprint } : {}),
    ...(fogwood?.seeded_branch_index !== undefined ? { seeded_branch_index: fogwood.seeded_branch_index } : {}),
    ...(fogwood?.seeded_depth !== undefined ? { seeded_depth: fogwood.seeded_depth } : {}),
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
    const id = options.shapeIds?.[index] ?? createShapeId();
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
      rotation: clampNumber(input.rotation, 0, -Math.PI * 4, Math.PI * 4),
      opacity: clampNumber(input.opacity, 1, 0, 1),
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
    ...(typeof root.seeded_grammar === 'string' ? { seeded_grammar: root.seeded_grammar.slice(0, 40) } : {}),
    ...(typeof root.seeded_algorithm_version === 'number' && Number.isSafeInteger(root.seeded_algorithm_version) ? { seeded_algorithm_version: root.seeded_algorithm_version } : {}),
    ...(typeof root.seeded_prng === 'string' ? { seeded_prng: root.seeded_prng.slice(0, 40) } : {}),
    ...((typeof root.seeded_seed === 'string' && root.seeded_seed.length <= 96) || (typeof root.seeded_seed === 'number' && Number.isSafeInteger(root.seeded_seed)) ? { seeded_seed: root.seeded_seed } : {}),
    ...(typeof root.seeded_wildness === 'number' && Number.isFinite(root.seeded_wildness) && root.seeded_wildness >= 0 && root.seeded_wildness <= 1 ? { seeded_wildness: root.seeded_wildness } : {}),
    ...(typeof root.seeded_source_revision === 'string' ? { seeded_source_revision: root.seeded_source_revision.slice(0, 120) } : {}),
    ...(typeof root.seeded_source_fingerprint === 'string' ? { seeded_source_fingerprint: root.seeded_source_fingerprint.slice(0, 80) } : {}),
    ...(typeof root.seeded_branch_index === 'number' && Number.isSafeInteger(root.seeded_branch_index) ? { seeded_branch_index: root.seeded_branch_index } : {}),
    ...(typeof root.seeded_depth === 'number' && Number.isSafeInteger(root.seeded_depth) ? { seeded_depth: root.seeded_depth } : {}),
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

type CurrentPageBinding = { fromId: string; toId: string; id: string; type: string; props: unknown };

function currentSemanticRelationships(shapes: readonly TLShape[], bindings: readonly CurrentPageBinding[]): SemanticRelationship[] {
  const shapesById = new Map(shapes.map((shape) => [String(shape.id), shape]));
  const relationships: SemanticRelationship[] = [];
  for (const shape of shapes) {
    if (shape.type !== 'arrow') continue;
    const meta = fogwoodMeta(shape);
    const kind = meta.relationship_kind;
    const id = meta.relationship_id;
    const source = meta.source_semantic_id;
    const target = meta.target_semantic_id;
    if (meta.role !== 'semantic-relationship') continue;
    if (meta.semantic_id_source === 'legacy-shape-id') continue;
    if (typeof id !== 'string' || typeof source !== 'string' || typeof target !== 'string') continue;
    if (!isStableSemanticId(id) || !isStableSemanticId(source) || !isStableSemanticId(target) || source === target) continue;
    if (meta.semantic_id !== relationshipSemanticId(id)) continue;
    const arrowBindings = bindings.filter((binding) => binding.type === 'arrow' && binding.fromId === shape.id);
    if (arrowBindings.length !== 2) continue;
    const start = arrowBindings.find((binding) => isRecord(binding.props) && binding.props.terminal === 'start');
    const end = arrowBindings.find((binding) => isRecord(binding.props) && binding.props.terminal === 'end');
    if (!start || !end || start.toId === end.toId) continue;
    const sourceShape = shapesById.get(start.toId);
    const targetShape = shapesById.get(end.toId);
    if (!sourceShape || !targetShape) continue;
    const sourceMeta = fogwoodMeta(sourceShape);
    const targetMeta = fogwoodMeta(targetShape);
    if (sourceMeta.semantic_id_source === 'legacy-shape-id' || targetMeta.semantic_id_source === 'legacy-shape-id') continue;
    if (sourceMeta.semantic_id !== source || targetMeta.semantic_id !== target) continue;
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
  const bindings: CurrentPageBinding[] = editor.store
    .allRecords()
    .filter((record) => record.typeName === 'binding')
    .map((record) => record as unknown as { fromId: string; toId: string; id: string; type: string; props: unknown })
    .filter((record) => shapeIds.has(record.fromId) && shapeIds.has(record.toId));
  return { shapes, bindings, assets: referencedAssets(editor, shapes), semantic_relationships: currentSemanticRelationships(shapes, bindings) };
}

function bindingCountsByShape(bindings: readonly { fromId: string; toId: string }[]) {
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    counts.set(binding.fromId, (counts.get(binding.fromId) ?? 0) + 1);
    counts.set(binding.toId, (counts.get(binding.toId) ?? 0) + 1);
  }
  return counts;
}

export function currentRevision(editor: Editor) {
  const { shapes, bindings, assets } = pageContent(editor);
  return computePageRevision(editor.getCurrentPageId(), shapes, bindings, assets);
}

type ContextEditor = Editor & {
  getCurrentToolId?: () => unknown;
  getPath?: () => unknown;
  root?: { getPath?: () => unknown };
};

function currentSelectionSource(editor: Editor): readonly unknown[] {
  try {
    const state = editor.getCurrentPageState();
    if (Array.isArray(state.selectedShapeIds)) return state.selectedShapeIds;
  } catch {
    // Minimal editor doubles may omit ephemeral page-state APIs.
  }
  try {
    if (typeof editor.getSelectedShapeIds === 'function') {
      const selected = editor.getSelectedShapeIds();
      if (Array.isArray(selected)) return selected;
    }
  } catch {
    // Selection is optional at the page adapter boundary.
  }
  return [];
}

function currentSelectionIds(editor: Editor): string[] {
  return currentSelectionSource(editor)
    .slice(0, FOGWOOD_CONTEXT_SELECTION_LIMIT + 1)
    .map(String);
}

function currentContextState(editor: Editor) {
  const candidate = editor as ContextEditor;
  let state: { selectedShapeIds?: readonly unknown[]; focusedGroupId?: unknown; editingShapeId?: unknown } = {};
  try {
    state = editor.getCurrentPageState() as typeof state;
  } catch {
    // Minimal editor doubles may omit ephemeral page-state APIs.
  }
  let toolId: unknown;
  let toolPath: unknown;
  try {
    if (typeof candidate.getCurrentToolId === 'function') toolId = candidate.getCurrentToolId();
  } catch {
    toolId = undefined;
  }
  try {
    if (typeof candidate.getPath === 'function') toolPath = candidate.getPath();
    else if (candidate.root && typeof candidate.root.getPath === 'function') toolPath = candidate.root.getPath();
  } catch {
    toolPath = undefined;
  }
  let readonly = false;
  try {
    readonly = typeof editor.getIsReadonly === 'function' && editor.getIsReadonly();
  } catch {
    readonly = false;
  }
  return {
    page_id: editor.getCurrentPageId(),
    selected_ids: currentSelectionSource(editor),
    current_tool_id: toolId,
    current_tool_path: toolPath,
    readonly,
    focused_group_id: state.focusedGroupId,
    editing_shape_id: state.editingShapeId,
    ontology_version: FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
    registry_version: FOGWOOD_REGISTRY_VERSION,
  };
}

/** Project only bounded ephemeral semantic state for the opaque context token. */
export function canvasContextForEditor(editor: Editor) {
  return buildContextProjection(currentContextState(editor));
}

export const projectCanvasContext = canvasContextForEditor;

export function contextTokenForEditor(editor: Editor) {
  return computeContextToken(canvasContextForEditor(editor));
}

export const currentContextToken = contextTokenForEditor;

function capabilityFactsForEditor(editor: Editor) {
  const shapes = editor.getCurrentPageShapes();
  const selectedShapeIds = currentSelectionIds(editor);
  const shapeById = new Map(shapes.map((shape) => [String(shape.id), shape]));
  const hasLockedAncestor = (shapeId: string) => {
    const visited = new Set<string>();
    let current = shapeById.get(shapeId);
    while (current && !visited.has(String(current.id))) {
      visited.add(String(current.id));
      if (current.isLocked) return true;
      current = shapeById.get(String(current.parentId));
    }
    return false;
  };
  let readonly = false;
  try {
    readonly = typeof editor.getIsReadonly === 'function' && editor.getIsReadonly();
  } catch {
    readonly = false;
  }
  return {
    current_revision: currentRevision(editor),
    current_context_token: contextTokenForEditor(editor),
    page_item_count: shapes.length,
    selection_count: selectedShapeIds.length,
    locked_selection_count: selectedShapeIds.filter(hasLockedAncestor).length,
    locked_page_item_count: shapes.filter((shape) => hasLockedAncestor(String(shape.id))).length,
    readonly,
  };
}

/**
 * Pure page adapter for capability planning. It projects only bounded facts
 * from the live editor and delegates to the data-only ontology planner.
 */
export function planCapabilityRequestForEditor(
  editor: Editor,
  request: FogwoodCapabilityPlanningRequest,
) {
  return planCapabilities(request, capabilityFactsForEditor(editor));
}

/** Return all semantic manifests annotated with current page availability. */
export function availableCapabilitiesForEditor(editor: Editor) {
  return listCapabilityAvailability(capabilityFactsForEditor(editor));
}

export const inspectAvailableCapabilities = availableCapabilitiesForEditor;

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

function inspectItem(editor: Editor, shape: TLShape, bindingCount = 0): InspectableItem {
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
    binding_count: bindingCount,
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
  const bindingCounts = bindingCountsByShape(bindings);
  const allItems = shapes.map((shape) => inspectItem(editor, shape, bindingCounts.get(String(shape.id)) ?? 0));
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
  const canvasContext = canvasContextForEditor(editor);
  const contextToken = computeContextToken(canvasContext);
  const viewport = editor.getViewportPageBounds();
  const camera = editor.getCamera();
  const pageBounds = editor.getCurrentPageBounds();
  const blockCount = shapes.filter((shape) => shape.type === 'surface-block').length;
  const nativeCount = shapes.length - blockCount;
  const itemComplete = nextOffset >= allItems.length;
  const bindingComplete = bindingNextOffset >= allBindingItems.length;
  const selectedShapeIds = [...canvasContext.selected_ids];
  const selectedShapeTotal = canvasContext.selection_completeness.total;
  const selectionLimit = FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT;
  const selectedShapeIdsPage = selectedShapeIds.slice(0, selectionLimit);
  const selectionComplete = selectedShapeTotal <= selectionLimit;
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
  const publicCanvasContext = {
    ...canvasContext,
    selected_ids: canvasContext.selected_ids_preview,
  };
  return {
    protocol: { name: FOGWOOD_PROTOCOL, version: FOGWOOD_PROTOCOL_VERSION, registry_version: FOGWOOD_REGISTRY_VERSION },
    canvas_protocol: FOGWOOD_CANVAS_PROTOCOL,
    capability_ontology: {
      schema: 'fogwood.capability.v1',
      version: FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
      qualified_capability_count: FOGWOOD_CAPABILITY_ONTOLOGY.length,
      planning_modes: ['search', 'route', 'plan', 'available'],
      planning_policy: { purity: 'pure', determinism: 'deterministic', speculation: 'shadow-only' },
      mutation_policy: { revision_keyed: true, speculation: 'never', page_apply_required: true },
    },
    semantic_lowerers: { schema: 'fogwood.semantic-lowerer.v1', count: FOGWOOD_SEMANTIC_LOWERERS.length, manifests: FOGWOOD_SEMANTIC_LOWERERS },
    tldraw_examples: {
      source: TLDRAW_EXAMPLE_SOURCE,
      count: TLDRAW_EXAMPLE_CATALOG.length,
      status_counts: {
        callable: TLDRAW_EXAMPLE_CATALOG.filter((entry) => entry.status === 'callable').length,
      },
      full_surface: {
        schema: 'fogwood.example-route.v1',
        version: FOGWOOD_FULL_SURFACE_VERSION,
        route_count: FULL_SURFACE_ROUTES.length,
        adapter_family_count: FULL_SURFACE_ADAPTERS.length,
        contract: 'Every pinned example has an exact callable route. Route fidelity, local execution, host requirements, and page Apply authority remain separate evidence.',
      },
    },
    persistence: FOGWOOD_PERSISTENCE,
    participation_contract: FOGWOOD_PARTICIPATION_CONTRACT,
    medium_contract: FOGWOOD_MEDIUM_CONTRACT,
    workflow: ['inspect live canvas', 'route and compose any pinned capability', 'use live host capabilities when explicitly required', 'bring bounded results back through Fogwood', 'stage proposal', 'page Apply/Reject', 'inspect human edits again'],
    workflow_contract: 'inspect -> full-surface route/plan -> local or observed host capability -> bounded proposal -> page Apply/Reject -> inspect again',
    authority: { agent: 'read current state, search local capabilities, and stage typed proposals', page: 'owns validation and Apply/Reject; only page Apply mutates content' },
    no_code: true,
    content_revision: currentRevision(editor),
    revision_source: 'current-page-shapes-bindings-and-referenced-asset-metadata; camera and selection excluded',
    context_token: contextToken,
    canvas_context: publicCanvasContext,
    page: {
      id: editor.getCurrentPageId(),
      bounds: pageBounds ? { x: pageBounds.x, y: pageBounds.y, w: pageBounds.w, h: pageBounds.h } : null,
      coordinate_system: 'page coordinates',
    },
    viewport: { page_coordinates: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h }, camera: { x: camera.x, y: camera.y, z: camera.z } },
    selection: { shape_ids: selectedShapeIdsPage, semantic_ids: selectedSemanticIds, focused_group_id: currentState.focusedGroupId ?? null, editing_shape_id: currentState.editingShapeId ?? null },
    selection_count: selectedShapeTotal,
    selection_semantic_ids: selectedSemanticIds,
    selection_completeness: { complete: selectionComplete, truncated: !selectionComplete, total: selectedShapeTotal, returned: selectedShapeIdsPage.length, limit: selectionLimit },
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
  const bindingCounts = bindingCountsByShape(content.bindings);
  const items = content.shapes.map((shape) => inspectItem(editor, shape, bindingCounts.get(String(shape.id)) ?? 0));
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

type PreparedMaterialLowering = Readonly<{
  material: PreparedMaterial;
  src: string;
  assetId: TLAssetId;
  asset?: TLAsset;
  shape: Record<string, unknown>;
}>;

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

/**
 * Turn qualified materials into immutable page records during stage.  In
 * particular, data URLs, asset identities, and shape IDs are all resolved
 * before the human review state is published. Apply only inserts these frozen
 * records; it never decodes or reinterprets a transfer.
 */
function prepareMaterialLowerings(
  editor: Editor,
  materials: readonly PreparedMaterial[],
): PreparedMaterialLowering[] {
  if (materials.length === 0) return [];
  if (typeof editor.createAssets !== 'function' || typeof editor.createShapes !== 'function') throw new Error('This page adapter does not expose the built-in tldraw asset and image-shape APIs.');
  const pageId = editor.getCurrentPageId() as TLParentId;
  const lowerings: PreparedMaterialLowering[] = [];
  for (const material of materials) {
    if (!isPreparedMaterial(material) || !material.decode_qualified) throw new Error('Material decode proof was not retained through Apply.');
    const src = materialDataUrl(material);
    const assetId = AssetRecordType.createId(`fogwood-material-${material.content_hash.slice('sha256:'.length)}`) as TLAssetId;
    const existing = findContentAddressedAsset(editor, material, src, assetId);
    let asset: TLAsset | undefined = existing;
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
    }
    const imageAsset = asset as TLAsset & { type: 'image'; props: { w: number; h: number } };
    const shapeId = createShapeId();
    lowerings.push({
      material,
      src,
      assetId,
      ...(existing ? {} : { asset }),
      shape: {
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
      },
    });
  }
  return lowerings;
}

function applyMaterialLowerings(
  editor: Editor,
  lowerings: readonly PreparedMaterialLowering[],
  createdAssetIds: TLAssetId[],
) {
  for (const lowering of lowerings) {
    let asset = findContentAddressedAsset(editor, lowering.material, lowering.src, lowering.assetId);
    if (!asset && lowering.asset) {
      if (assetRecords(editor).some((candidate) => candidate.id === lowering.assetId)) throw new Error('The staged content-addressed asset id is occupied by different bytes or metadata.');
      editor.createAssets([lowering.asset]);
      createdAssetIds.push(lowering.assetId);
      asset = findContentAddressedAsset(editor, lowering.material, lowering.src, lowering.assetId);
    }
    if (!asset) throw new Error('The staged local material asset is no longer available.');
    editor.createShapes([lowering.shape] as never);
  }
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

/**
 * Undo the currently running Apply back to the mark created immediately
 * before it. tldraw's `run` batches history but deliberately does not roll
 * back when an operation throws; `bailToMark` is the public API that reverses
 * that batch and discards the mark. Asset records are intentionally written
 * outside the normal history stream, so their newly-created, unreferenced
 * records are cleaned up separately.
 */
function rollbackPreparedApply(editor: Editor, markId: string | undefined, createdAssetIds: readonly TLAssetId[]) {
  if (markId) {
    try {
      editor.bailToMark(markId);
    } catch {
      // A real tldraw editor should never fail this public history operation.
      // Keep the cleanup below best-effort and let the caller report the
      // original Apply failure rather than masking it with rollback noise.
    }
  }
  cleanupUnreferencedAssets(editor, createdAssetIds);
}

function cloneShapeRecord(shape: TLShape): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    try {
      const clone = structuredClone(shape) as unknown;
      if (isRecord(clone)) return clone;
    } catch {
      // JSON fallback below is sufficient for tldraw's plain shape records.
    }
  }
  try {
    const clone = JSON.parse(JSON.stringify(shape)) as unknown;
    if (isRecord(clone)) return clone;
  } catch {
    // Fail closed below rather than returning the original record by reference.
  }
  throw new Error('Fogwood could not safely clone the native shape record.');
}

function hasReusableLocalImageAsset(editor: Editor, source: TLShape) {
  if (source.type !== 'image' || !isRecord(source.props) || typeof source.props.assetId !== 'string' || typeof editor.getAsset !== 'function') return false;
  const asset = editor.getAsset(source.props.assetId as TLAssetId);
  if (!asset || asset.type !== 'image' || !isRecord(asset.props)) return false;
  const mimeType = asset.props.mimeType;
  if (typeof mimeType !== 'string' || !SUPPORTED_MATERIAL_MIME_TYPES.includes(mimeType as never)) return false;
  const maxBytes = mimeType === 'image/svg+xml' ? MATERIAL_LIMITS.max_svg_bytes : MATERIAL_LIMITS.max_raster_bytes;
  const src = asset.props.src;
  const prefix = `data:${mimeType};base64,`;
  if (typeof src !== 'string' || !src.startsWith(prefix)) return false;
  const base64 = src.slice(prefix.length);
  if (base64.length === 0 || base64.length > 4 * Math.ceil(maxBytes / 3)) return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(base64)) return false;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = (base64.length * 3) / 4 - padding;
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maxBytes) return false;
  if (!Number.isSafeInteger(asset.props.fileSize) || asset.props.fileSize !== byteLength) return false;
  const { w, h } = asset.props;
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  if (w > MATERIAL_LIMITS.max_dimension || h > MATERIAL_LIMITS.max_dimension || w * h > MATERIAL_LIMITS.max_pixels) return false;
  if (mimeType === 'image/svg+xml') {
    const fogwood = isRecord(asset.meta) && isRecord(asset.meta.fogwood) ? asset.meta.fogwood : undefined;
    if (!fogwood || fogwood.kind !== 'material' || fogwood.source_status !== 'sanitized' || fogwood.decode_qualified !== true) return false;
  }
  return true;
}

function createVariantShape(
  editor: Editor,
  input: {
    sourceId: string;
    semanticId: string;
    variantId?: string;
    x: number;
    y: number;
    lineageSourceId: string;
    parentVariantId?: string;
    patches?: { text?: string; color?: string; fill?: string };
    provenance?: FogwoodMeta;
  },
) {
  const source = editor.getShape(input.sourceId as TLShapeId);
  if (!source) throw new Error(`Variant source ${input.sourceId} no longer exists.`);
  if (source.type === 'image' && !hasReusableLocalImageAsset(editor, source)) throw new Error('Variant image source does not have a current device-local asset.');
  const clone = cloneShapeRecord(source);
  const id = createShapeId();
  const sourceMeta = fogwoodMeta(source);
  const variantSourceMeta = { ...sourceMeta };
  for (const key of ['relationship_id', 'relationship_kind', 'source_semantic_id', 'target_semantic_id', 'relationship_label'] as const) delete variantSourceMeta[key];
  const fogwood = {
    ...variantSourceMeta,
    ...(input.provenance ?? {}),
    semantic_id: input.semanticId,
    semantic_id_source: 'stable',
    role: 'variant',
    variant_id: input.variantId ?? input.semanticId,
    ...(input.parentVariantId ? { parent_variant_id: input.parentVariantId } : {}),
    lineage_source_id: input.lineageSourceId,
  } satisfies FogwoodMeta;
  const props = isRecord(clone.props) ? { ...clone.props } : {};
  if (input.patches?.text !== undefined) {
    if (source.type === 'image') props.altText = input.patches.text;
    else if (source.type === 'frame') props.name = input.patches.text;
    else props.richText = toRichText(input.patches.text);
  }
  if (input.patches?.color !== undefined) {
    props.color = input.patches.color;
    if ('labelColor' in props) props.labelColor = input.patches.color;
  }
  if (input.patches?.fill !== undefined) props.fill = input.patches.fill;
  clone.id = id;
  delete clone.index;
  clone.x = input.x;
  clone.y = input.y;
  clone.parentId = editor.getCurrentPageId();
  clone.isLocked = false;
  clone.meta = {
    ...(isRecord(source.meta) ? source.meta : {}),
    ...shapeMeta(String(id), fogwood),
  };
  clone.props = props;
  editor.createShapes([clone] as never);
  return id as TLShapeId;
}

/**
 * Apply a previously validated Canvas Protocol plan to tldraw. The caller owns
 * the surrounding editor transaction and history stopping point.
 */
type SeededCompositionAction = Extract<ProposalAction, { type: 'seeded_composition' }>;

export function applyCanvasOpPlan(
  editor: Editor,
  plan: CanvasOpPlan,
  options: { seeded?: SeededCompositionAction } = {},
) {
  const createdIds = new Map<string, TLShapeId>();
  const compositionId = plan.normalized_action.composition_id;
  const resolveId = (id: string) => createdIds.get(id) ?? (id as TLShapeId);

  for (const step of plan.steps) {
    if (step.kind === 'create') {
      const [id] = addCanvasShapes(editor, [{
        kind: step.op.kind,
        semantic_id: step.op.semantic_id,
        x: step.op.x,
        y: step.op.y,
        ...(step.op.w === undefined ? {} : { w: step.op.w }),
        ...(step.op.h === undefined ? {} : { h: step.op.h }),
        ...(step.op.end_x === undefined ? {} : { end_x: step.op.end_x }),
        ...(step.op.end_y === undefined ? {} : { end_y: step.op.end_y }),
        ...(step.op.text === undefined ? {} : { text: step.op.text }),
        ...(step.op.color === undefined ? {} : { color: step.op.color }),
        ...(step.op.fill === undefined ? {} : { fill: step.op.fill }),
        ...(step.op.role === undefined ? {} : { role: step.op.role }),
        ...(step.op.region_id === undefined ? {} : { region_id: step.op.region_id }),
        ...(step.op.rotation === undefined ? {} : { rotation: step.op.rotation }),
        ...(step.op.opacity === undefined ? {} : { opacity: step.op.opacity }),
        ...(compositionId === undefined ? {} : { composition_id: compositionId }),
      }], {
        coordinateSpace: 'page',
        focusAfter: false,
        select: false,
        recordHistory: false,
        parentId: editor.getCurrentPageId(),
        fogwood: { role: 'agent-created', ...(compositionId === undefined ? {} : { composition_id: compositionId }) },
      });
      if (!id) throw new Error(`Canvas Protocol could not create ${step.op.semantic_id}.`);
      createdIds.set(step.pending_id, id);
      if (step.op.kind !== 'arrow') editor.resizeToBounds([id], step.bounds);
      continue;
    }

    if (step.kind === 'draw') {
      const id = createShapeId();
      const localPoints = step.op.points.map((point) => ({
        x: point.x - step.bounds.x,
        y: point.y - step.bounds.y,
      }));
      editor.createShapes([{
        id,
        type: 'draw',
        x: step.bounds.x,
        y: step.bounds.y,
        parentId: editor.getCurrentPageId(),
        meta: shapeMeta(String(id), {
          semantic_id: step.op.semantic_id,
          semantic_id_source: 'stable',
          role: 'agent-drawing',
          ...(compositionId === undefined ? {} : { composition_id: compositionId }),
        }),
        props: {
          segments: [{ type: 'free', path: b64Vecs.encodePoints2D(localPoints), dim: 2 }],
          color: step.op.color ?? 'black',
          fill: step.op.fill ?? 'none',
          dash: 'draw',
          size: step.op.size ?? 'm',
          isComplete: true,
          isClosed: step.op.closed ?? false,
          isPen: false,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
        },
      }] as never);
      createdIds.set(step.pending_id, id);
      continue;
    }

    if (step.kind === 'connect') {
      const fromId = resolveId(step.op.from_id);
      const toId = resolveId(step.op.to_id);
      const fromShape = editor.getShape(fromId);
      const toShape = editor.getShape(toId);
      const fromBounds = fromShape ? editor.getShapePageBounds(fromShape) : undefined;
      const toBounds = toShape ? editor.getShapePageBounds(toShape) : undefined;
      if (!fromShape || !toShape || !fromBounds || !toBounds) throw new Error('Bound connector endpoint no longer exists.');
      const start = { x: fromBounds.x + fromBounds.w / 2, y: fromBounds.y + fromBounds.h / 2 };
      const end = { x: toBounds.x + toBounds.w / 2, y: toBounds.y + toBounds.h / 2 };
      const [arrowId] = addCanvasShapes(editor, [{
        kind: 'arrow',
        semantic_id: step.op.semantic_id,
        x: start.x,
        y: start.y,
        end_x: end.x,
        end_y: end.y,
        ...(step.op.text === undefined ? {} : { text: step.op.text }),
        ...(step.op.color === undefined ? {} : { color: step.op.color }),
      }], {
        coordinateSpace: 'page',
        focusAfter: false,
        select: false,
        recordHistory: false,
        parentId: editor.getCurrentPageId(),
        fogwood: {
          role: step.op.relationship_id && step.op.relationship_kind ? 'semantic-relationship' : 'bound-connector',
          ...(compositionId === undefined ? {} : { composition_id: compositionId }),
          ...(step.from.semantic_id ? { source_semantic_id: step.from.semantic_id } : {}),
          ...(step.to.semantic_id ? { target_semantic_id: step.to.semantic_id } : {}),
          ...(step.op.relationship_id === undefined ? {} : { relationship_id: step.op.relationship_id }),
          ...(step.op.relationship_kind === undefined ? {} : { relationship_kind: step.op.relationship_kind }),
          ...(step.op.relationship_id === undefined || step.op.text === undefined ? {} : { relationship_label: step.op.text }),
        },
      });
      if (!arrowId) throw new Error(`Canvas Protocol could not create bound connector ${step.op.semantic_id}.`);
      createdIds.set(step.pending_id, arrowId);
      editor.createBindings([{
        type: 'arrow',
        fromId: arrowId,
        toId: fromId,
        props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
      }, {
        type: 'arrow',
        fromId: arrowId,
        toId,
        props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' },
      }] as never);
      const bindings = editor.getBindingsFromShape(arrowId, 'arrow');
      const hasStart = bindings.some((binding) => binding.fromId === arrowId && binding.toId === fromId && binding.props.terminal === 'start');
      const hasEnd = bindings.some((binding) => binding.fromId === arrowId && binding.toId === toId && binding.props.terminal === 'end');
      if (bindings.length !== 2 || !hasStart || !hasEnd) {
        editor.deleteShapes([arrowId]);
        createdIds.delete(step.pending_id);
        throw new Error('The reviewed connector did not create exactly two native bindings; no connector was retained.');
      }
      continue;
    }

    if (step.kind === 'variant') {
      const seededLineage = options.seeded?.lineage.find((entry) => entry.variant_semantic_id === step.op.semantic_id);
      const id = createVariantShape(editor, {
        sourceId: String(resolveId(step.op.id)),
        semanticId: step.op.semantic_id,
        x: step.bounds.x,
        y: step.bounds.y,
        lineageSourceId: step.lineage.lineage_source_id,
        parentVariantId: step.lineage.parent_variant_id,
        ...(compositionId === undefined ? {} : { provenance: { composition_id: compositionId } }),
        ...(options.seeded && seededLineage ? {
          provenance: {
            ...(compositionId === undefined ? {} : { composition_id: compositionId }),
            seeded_grammar: options.seeded.grammar,
            seeded_algorithm_version: options.seeded.algorithm_version,
            seeded_prng: options.seeded.prng,
            seeded_seed: options.seeded.seed,
            seeded_wildness: options.seeded.wildness,
            seeded_source_revision: options.seeded.source_revision,
            seeded_source_fingerprint: options.seeded.source_fingerprint,
            seeded_branch_index: seededLineage.branch_index,
            seeded_depth: seededLineage.depth,
          },
        } : {}),
      });
      createdIds.set(step.pending_id, id);
      continue;
    }

    if (step.kind === 'update') {
      const shape = editor.getShape(resolveId(step.op.id));
      if (!shape) throw new Error(`Canvas Protocol update target ${step.op.id} no longer exists.`);
      const props: Record<string, unknown> = {};
      let meta: Record<string, unknown> | undefined;
      if (step.op.text !== undefined) {
        if (shape.type === 'frame') props.name = step.op.text;
        else props.richText = toRichText(step.op.text);
        const existingMeta = isRecord(shape.meta) ? shape.meta : {};
        const existingFogwood = isRecord(existingMeta.fogwood) ? existingMeta.fogwood : undefined;
        if (shape.type === 'arrow' && existingFogwood?.role === 'semantic-relationship') {
          meta = {
            ...existingMeta,
            fogwood: { ...existingFogwood, relationship_label: step.op.text },
          };
        }
      }
      if (step.op.color !== undefined) {
        props.color = step.op.color;
        if (isRecord(shape.props) && 'labelColor' in shape.props) props.labelColor = step.op.color;
      }
      if (step.op.fill !== undefined) props.fill = step.op.fill;
      editor.updateShapes([{
        id: shape.id,
        type: shape.type,
        ...(step.op.x === undefined ? {} : { x: step.op.x }),
        ...(step.op.y === undefined ? {} : { y: step.op.y }),
        ...(step.op.rotation === undefined ? {} : { rotation: step.op.rotation }),
        ...(step.op.opacity === undefined ? {} : { opacity: step.op.opacity }),
        ...(Object.keys(props).length === 0 ? {} : { props }),
        ...(meta === undefined ? {} : { meta }),
      }] as never);
      continue;
    }

    if (step.kind === 'resize') {
      editor.resizeToBounds([resolveId(step.op.id)], step.after);
      continue;
    }

    if (step.kind === 'arrange') {
      const updates = step.placements.map((placement) => {
        const shape = editor.getShape(resolveId(placement.id));
        if (!shape) throw new Error(`Canvas Protocol arrangement target ${placement.id} no longer exists.`);
        return {
          id: shape.id,
          type: shape.type,
          x: placement.x,
          y: placement.y,
          rotation: placement.rotation,
        };
      });
      editor.updateShapes(updates as never);
      continue;
    }

    if (step.kind === 'group') {
      const groupId = createShapeId();
      const childIds = step.op.ids.map(resolveId);
      const childShapes = childIds.flatMap((id) => {
        const shape = editor.getShape(id);
        return shape ? [shape] : [];
      });
      if (childShapes.length !== childIds.length) throw new Error('Canvas Protocol group target no longer exists.');
      const highestIndex = [...childShapes].sort((left, right) => String(left.index).localeCompare(String(right.index))).at(-1)?.index;
      editor.createShapes([{
        id: groupId,
        type: 'group',
        parentId: editor.getCurrentPageId(),
        ...(highestIndex === undefined ? {} : { index: highestIndex }),
        x: step.bounds.x,
        y: step.bounds.y,
        opacity: 1,
        meta: shapeMeta(String(groupId), {
          semantic_id: step.op.semantic_id,
          semantic_id_source: 'stable',
          role: 'agent-group',
          ...(compositionId === undefined ? {} : { composition_id: compositionId }),
        }),
        props: {},
      }] as never);
      editor.reparentShapes(childIds, groupId);
      continue;
    }

    if (step.kind === 'ungroup') {
      for (const id of step.op.ids.map(resolveId)) {
        const group = editor.getShape(id);
        if (!group || group.type !== 'group') throw new Error(`Canvas Protocol group target ${id} no longer exists.`);
        const childIds = editor.getSortedChildIdsForParent(group.id);
        editor.reparentShapes(childIds, group.parentId, group.index);
        editor.deleteShapes([group.id]);
      }
      continue;
    }

    const ids = step.op.ids.map(resolveId);
    if (step.kind === 'delete') {
      editor.deleteShapes(ids);
      continue;
    }
    if (step.op.position === 'front') editor.bringToFront(ids);
    else if (step.op.position === 'back') editor.sendToBack(ids);
    else if (step.op.position === 'forward') editor.bringForward(ids, { considerAllShapes: true });
    else editor.sendBackward(ids, { considerAllShapes: true });
  }
}

function preflightCanvasOpPlans(editor: Editor, plans: readonly CanvasOpPlan[]) {
  for (const plan of plans) {
    for (const step of plan.steps) {
      if (step.kind === 'connect') {
        if (typeof editor.canBindShapes !== 'function' || typeof editor.createBindings !== 'function' || typeof editor.getBindingsFromShape !== 'function') {
          return 'This tldraw editor does not expose the native binding APIs required by the reviewed connector.';
        }
        try {
          const startAllowed = editor.canBindShapes({ fromShape: 'arrow', toShape: step.from.type as TLShape['type'], binding: 'arrow' });
          const endAllowed = editor.canBindShapes({ fromShape: 'arrow', toShape: step.to.type as TLShape['type'], binding: 'arrow' });
          if (!startAllowed || !endAllowed) return 'The reviewed connector endpoints are not compatible with native tldraw arrow bindings.';
        } catch {
          return 'The reviewed connector could not pass the native tldraw binding preflight.';
        }
      }
      if (step.kind === 'variant') {
        const source = editor.getShape(step.op.id as TLShapeId);
        if (!source || source.type !== step.source.type) return 'The reviewed variant source no longer matches the inspected native shape.';
        if (source.type === 'image' && !hasReusableLocalImageAsset(editor, source)) return 'The reviewed image variant source does not have a current device-local asset.';
      }
    }
  }
  return undefined;
}

function preflightProposalCanvasOps(editor: Editor, proposal: ProposalV1) {
  const context = proposalContext(editor);
  const plans: CanvasOpPlan[] = [];
  for (const action of proposal.actions) {
    if (action.type !== 'canvas_ops' && action.type !== 'seeded_composition') continue;
    const result = planCanvasOps(context.items, action.ops, context.page_id, action.type === 'canvas_ops' ? action.composition_id : undefined);
    if (!result.ok) return result.errors.map((error) => error.message).join(' ').slice(0, 300);
    plans.push(result.plan);
  }
  return preflightCanvasOpPlans(editor, plans);
}

type PreparedActionLowering = Readonly<{
  action: ProposalAction;
  canvas?: CanvasOpPlan;
  page?: Readonly<{ op: 'create_and_switch'; id: TLPageId; semantic_id: string; name: string }>;
  camera?: Readonly<{ op: 'focus_bounds'; x: number; y: number; w: number; h: number; inset: number }>;
}>;

type EditorPreparedCanvasPlan = PreparedCanvasPlan & Readonly<{
  action_lowerings: readonly PreparedActionLowering[];
  material_lowerings: readonly PreparedMaterialLowering[];
}>;

function planError(status: 'STALE_STATE' | 'ERROR', message: string) {
  return { ok: false as const, status, message };
}

/**
 * Freeze the complete page-owned plan graph in place. The plan is deliberately
 * not cloned: prepared materials carry a WeakSet decode proof, so preserving
 * their object identity is part of the boundary. Typed arrays are not present
 * in the public plan today, but are left alone because freezing them throws in
 * some browsers.
 */
function freezePlanValue<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  if (typeof ArrayBuffer !== 'undefined' && (ArrayBuffer.isView(value) || value instanceof ArrayBuffer)) return value;
  seen.add(objectValue);
  if (Array.isArray(value)) {
    for (const child of value) freezePlanValue(child, seen);
  } else {
    for (const key of Object.keys(value as Record<string, unknown>)) freezePlanValue((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function materialEvidence(material: PreparedMaterial): PreparedMaterialEvidence {
  return {
    semantic_id: material.semantic_id,
    content_hash: material.content_hash,
    mime_type: material.mime_type,
    byte_length: material.byte_length,
    dimensions: { width: material.dimensions.width, height: material.dimensions.height },
    source_status: material.source_status,
    decode_qualified: true,
    originating_capability: material.originating_capability,
    qualification_boundary: material.qualification_boundary,
  };
}

function materialDigest(material: PreparedMaterial) {
  return {
    semantic_id: material.semantic_id,
    mime_type: material.mime_type,
    // The canonical base64 is the exact accepted byte sequence. Include it in
    // the plan digest instead of relying only on a hash so the prepared plan's
    // identity commits to the bytes that Apply will insert.
    canonical_base64: material.canonical_base64,
    content_hash: material.content_hash,
    byte_length: material.byte_length,
    dimensions: { width: material.dimensions.width, height: material.dimensions.height },
    source_status: material.source_status,
    decode_qualified: material.decode_qualified,
    label: material.label,
    alt: material.alt,
    prompt_summary: material.prompt_summary,
    originating_capability: material.originating_capability,
    qualification_boundary: material.qualification_boundary,
    x: material.x,
    y: material.y,
    w: material.w,
    h: material.h,
  };
}

/**
 * Prepare every page-dependent lowering while the proposal is still outside
 * the pending review state. The resulting plan retains prepared material
 * objects by identity and contains no deferred recipe expansion, decoding, or
 * validation work for Apply.
 */
export function prepareProposalPlan(
  editor: Editor,
  proposal: ProposalV1,
  diff: ProposalDiff,
): EditorPreparedCanvasPlan | { ok: false; status: 'STALE_STATE' | 'ERROR'; message: string } {
  if (currentRevision(editor) !== proposal.base_revision) return planError('STALE_STATE', 'The page changed; inspect again and re-propose before staging.');
  const retiredActionType = proposal.actions
    .map((action) => (action as unknown as { type?: unknown }).type)
    .find(isRetiredActionType);
  if (retiredActionType) return planError('ERROR', `The ${retiredActionType} action is retired; no legacy lowering is available.`);
  if (typeof editor.getIsReadonly === 'function' && editor.getIsReadonly()) return planError('ERROR', 'This page is read-only; the proposal was not staged.');
  const maxShapes = editor.options.maxShapesPerPage;
  if (Number.isFinite(maxShapes) && diff.counts.after > maxShapes) return planError('ERROR', 'The proposal would exceed this page\'s bounded shape limit; no changes were staged.');

  const actions = proposal.actions;
  const current = proposalContext(editor);

  const materialActions = actions.filter((action): action is Extract<ProposalAction, { type: 'add_materials' }> => action.type === 'add_materials');
  const rawMaterials = materialActions.flatMap((action) => action.materials);
  const preparedMaterials = rawMaterials.filter((material): material is PreparedMaterial => isPreparedMaterial(material));
  if (preparedMaterials.length !== rawMaterials.length) return planError('ERROR', 'Every material must be prepared and browser decode-qualified before staging.');
  let materialLowerings: PreparedMaterialLowering[];
  try {
    materialLowerings = prepareMaterialLowerings(editor, preparedMaterials);
  } catch (error) {
    return planError('ERROR', error instanceof Error ? error.message.slice(0, 180) : 'The material was refused before staging.');
  }

  const actionLowerings: PreparedActionLowering[] = [];
  try {
    for (const action of actions) {
      if (action.type === 'canvas_ops' || action.type === 'seeded_composition') {
        const result = planCanvasOps(current.items, action.ops, current.page_id, action.type === 'canvas_ops' ? action.composition_id : undefined);
        if (!result.ok) throw new Error(result.errors.map((error) => error.message).join(' '));
        actionLowerings.push({ action, canvas: result.plan });
      } else if (action.type === 'page_ops') {
        if (editor.getPages().length >= editor.options.maxPages) throw new Error('The page limit has been reached; remove a page before staging another.');
        const id = PageRecordType.createId(`fogwood-${sha256Hex(canonicalSerialize({ semantic_id: action.operation.semantic_id })).slice(0, 24)}`);
        if (editor.getPage(id)) throw new Error('The deterministic page target already exists; inspect again before retrying.');
        actionLowerings.push({ action, page: { op: 'create_and_switch', id, semantic_id: action.operation.semantic_id, name: action.operation.name } });
      } else if (action.type === 'camera_ops') {
        actionLowerings.push({ action, camera: { ...action.operation, inset: action.operation.inset ?? 64 } });
      } else {
        actionLowerings.push({ action });
      }
    }
  } catch (error) {
    return planError('ERROR', error instanceof Error ? error.message.slice(0, 180) : 'The spatial proposal was rejected before staging.');
  }
  const canvasAdapterError = preflightCanvasOpPlans(editor, actionLowerings.flatMap((entry) => entry.canvas ? [entry.canvas] : []));
  if (canvasAdapterError) return planError('ERROR', canvasAdapterError);

  const contextToken = contextTokenForEditor(editor);
  const pageId = String(editor.getCurrentPageId());
  const contentRevision = currentRevision(editor);
  const frozenActions = Object.freeze(actions);
  const frozenActionLowerings = Object.freeze(actionLowerings);
  const frozenMaterialLowerings = Object.freeze(materialLowerings);
  const frozenSeededEvidence = Object.freeze(diff.seeded_compositions);
  const frozenMaterialEvidence = Object.freeze(preparedMaterials.map(materialEvidence));
  const basePreview = buildPreparedCanvasPreview({
    canvasPlans: actionLowerings.flatMap((entry) => entry.canvas ? [entry.canvas] : []),
    currentItems: current.items,
    materials: preparedMaterials,
  });
  const cameraRegions = actionLowerings.flatMap((entry, index) => entry.camera ? [{
    semantic_id: `camera-focus:${index}`,
    label: 'Viewport focus',
    bounds: { x: entry.camera.x, y: entry.camera.y, w: entry.camera.w, h: entry.camera.h },
  }] : []);
  const preview = cameraRegions.length === 0 ? basePreview : { ...basePreview, regions: [...basePreview.regions, ...cameraRegions] };
  const cameraOnly = actions.length > 0 && actions.every((action) => action.type === 'camera_ops');
  const transaction = cameraOnly ? {
    contract_version: 1 as const,
    authority: 'page-owned' as const,
    atomic: true as const,
    editor_run: 'none' as const,
    history: 'none' as const,
    undo: 'not-applicable' as const,
    apply: 'frozen-context-lowering-only' as const,
    reject: 'no-mutation' as const,
  } : {
    contract_version: 1 as const,
    authority: 'page-owned' as const,
    atomic: true as const,
    editor_run: 'one' as const,
    history: 'one-stopping-point' as const,
    undo: 'one-step' as const,
    apply: 'frozen-lowerings-only' as const,
    reject: 'no-mutation' as const,
  };
  const preflight = {
    status: 'passed' as const,
    page_id: pageId,
    content_revision: contentRevision,
    target_count: diff.counts.adds + diff.counts.updates + diff.counts.moves + diff.counts.removes,
    material_decode: 'complete' as const,
    plan_lowering: 'complete' as const,
  };
  const planIdentityInput = {
    schema: FOGWOOD_PREPARED_CANVAS_PLAN_SCHEMA,
    page_id: pageId,
    base_revision: proposal.base_revision,
    content_revision: contentRevision,
    proposal,
    actions: frozenActions,
    diff,
    action_lowerings: frozenActionLowerings,
    seeded_evidence: frozenSeededEvidence,
    prepared_materials: preparedMaterials.map(materialDigest),
    preview,
    preflight,
    transaction,
  };
  const canonicalPlanIdentity = canonicalSerialize(planIdentityInput);
  const plan = freezePlanValue({
    schema: FOGWOOD_PREPARED_CANVAS_PLAN_SCHEMA,
    plan_id: `sha256:${sha256Hex(canonicalPlanIdentity)}` as const,
    page_id: pageId,
    proposal,
    diff,
    base_revision: proposal.base_revision,
    content_revision: contentRevision,
    context_token: contextToken,
    actions: frozenActions,
    operations: frozenActionLowerings,
    lowerings: Object.freeze([...frozenActionLowerings, ...frozenMaterialLowerings]),
    prepared_materials: Object.freeze(preparedMaterials),
    seeded_evidence: frozenSeededEvidence,
    material_evidence: frozenMaterialEvidence,
    preview,
    preflight,
    transaction,
    digest: deterministicHash(canonicalPlanIdentity),
    action_lowerings: frozenActionLowerings,
    material_lowerings: frozenMaterialLowerings,
  }) as EditorPreparedCanvasPlan;
  return plan;
}

function executePreparedProposal(editor: Editor, plan: EditorPreparedCanvasPlan) {
  const proposal = plan.proposal;
  if (currentRevision(editor) !== plan.base_revision) return { ok: false as const, status: 'STALE_STATE' as const, message: 'The page changed; inspect again and re-propose before applying.' };
  const retiredActionType = proposal.actions
    .map((action) => (action as unknown as { type?: unknown }).type)
    .find(isRetiredActionType);
  if (retiredActionType) return { ok: false as const, status: 'ERROR' as const, message: `The ${retiredActionType} action is retired; no legacy lowering is available.` };
  if (typeof editor.getIsReadonly === 'function' && editor.getIsReadonly()) return { ok: false as const, status: 'ERROR' as const, message: 'This page is read-only; no proposal changes were applied.' };
  // Recheck adapter capabilities and target existence immediately before the
  // transaction. Content revision equality makes context-only changes safe.
  const canvasAdapterError = preflightCanvasOpPlans(editor, plan.action_lowerings.flatMap((entry) => entry.canvas ? [entry.canvas] : []));
  if (canvasAdapterError) return { ok: false as const, status: 'ERROR' as const, message: canvasAdapterError };
  for (const entry of plan.action_lowerings) {
    if (entry.page && editor.getPage(entry.page.id)) return { ok: false as const, status: 'ERROR' as const, message: 'The reviewed page target is no longer available.' };
    if (entry.page && editor.getPages().length >= editor.options.maxPages) return { ok: false as const, status: 'ERROR' as const, message: 'The page limit was reached after review; inspect again before retrying.' };
  }
  const cameraOnly = plan.action_lowerings.length > 0 && plan.action_lowerings.every((entry) => Boolean(entry.camera));
  if (cameraOnly) {
    try {
      for (const entry of plan.action_lowerings) if (entry.camera) editor.zoomToBounds(
        { x: entry.camera.x, y: entry.camera.y, w: entry.camera.w, h: entry.camera.h },
        { immediate: true, inset: entry.camera.inset },
      );
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, status: 'ERROR' as const, message: error instanceof Error ? error.message.slice(0, 180) : 'The page rejected the camera focus.' };
    }
  }
  const createdAssetIds: TLAssetId[] = [];
  let applyMark: string | undefined;
  try {
    applyMark = editor.markHistoryStoppingPoint('Apply agent proposal');
    editor.run(() => {
      for (const entry of plan.action_lowerings) {
        const action = entry.action;
        if (action.type === 'canvas_ops') {
          if (!entry.canvas) throw new Error('Canvas Protocol plan was not retained through Apply.');
          applyCanvasOpPlan(editor, entry.canvas);
        } else if (action.type === 'seeded_composition') {
          if (!entry.canvas) throw new Error('Seeded composition plan was not retained through Apply.');
          applyCanvasOpPlan(editor, entry.canvas, { seeded: action });
        } else if (action.type === 'add_materials') {
          const materialEntry = plan.material_lowerings.filter((candidate) => action.materials.includes(candidate.material));
          if (materialEntry.length !== action.materials.length) throw new Error('The staged material lowering was incomplete.');
          applyMaterialLowerings(editor, materialEntry, createdAssetIds);
        } else if (action.type === 'page_ops') {
          if (!entry.page) throw new Error('The page lowering was not retained through Apply.');
          editor.createPage({ id: entry.page.id, name: entry.page.name, meta: { fogwood_semantic_id: entry.page.semantic_id } });
          editor.setCurrentPage(entry.page.id);
        } else if (action.type === 'camera_ops') {
          throw new Error('Camera-only plans must use the page-owned context lane.');
        }
      }
    }, { history: 'record' });
  } catch (error) {
    rollbackPreparedApply(editor, applyMark, createdAssetIds);
    return { ok: false as const, status: 'ERROR' as const, message: error instanceof Error ? error.message.slice(0, 180) : 'The page rejected the proposal.' };
  }
  if (currentRevision(editor) === proposal.base_revision) {
    rollbackPreparedApply(editor, applyMark, createdAssetIds);
    return { ok: false as const, status: 'ERROR' as const, message: 'The page reported no content change; Apply was not recorded.' };
  }
  return { ok: true as const };
}

/** Backwards-compatible direct page adapter. Public WebMCP callers use the
 * controller below, which always stages a plan before Apply. */
export function applyProposalToEditor(editor: Editor, proposal: ProposalV1) {
  if (currentRevision(editor) !== proposal.base_revision) return { ok: false as const, status: 'STALE_STATE' as const, message: 'The page changed; inspect again and re-propose before applying.' };
  const validation = validateProposal(proposal, proposalContext(editor));
  if (!validation.ok) {
    const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
    return { ok: false as const, status: stale ? 'STALE_STATE' as const : 'ERROR' as const, message: validation.errors.map((error) => error.message).join(' ') };
  }
  const plan = prepareProposalPlan(editor, validation.proposal, validation.diff);
  if ('ok' in plan) return plan;
  return executePreparedProposal(editor, plan);
}

export type SurfaceToolController = ReturnType<typeof createFogwoodSurface>;

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
  const containerDocument = editor.getContainer().ownerDocument as Document & { modelContext?: ModelContext };
  let memoryChangeLedger = '';
  const changeStorage = {
    read: () => {
      try { return containerDocument.defaultView?.localStorage?.getItem(FOGWOOD_CHANGE_STORAGE_KEY) ?? (memoryChangeLedger || null); }
      catch { return memoryChangeLedger || null; }
    },
    write: (value: string) => {
      memoryChangeLedger = value;
      try { containerDocument.defaultView?.localStorage?.setItem(FOGWOOD_CHANGE_STORAGE_KEY, value); } catch { /* Evidence storage is optional and never mutation authority. */ }
    },
  };
  const changeLedgers = new Map<string, ReturnType<typeof createFogwoodChangeLedger>>();
  const changeLedger = () => {
    const pageId = String(editor.getCurrentPageId());
    let ledger = changeLedgers.get(pageId);
    if (!ledger) {
      ledger = createFogwoodChangeLedger(changeStorage, pageId);
      changeLedgers.set(pageId, ledger);
    }
    return ledger;
  };
  const changeCapture = createEditorChangeCapture({
    store: editor.store,
    getLedger: changeLedger,
    getRevision: () => currentRevision(editor),
    getCurrentPageId: () => String(editor.getCurrentPageId()),
    getCurrentRecordIds: () => {
      const content = pageContent(editor);
      return new Set([String(editor.getCurrentPageId()), ...content.shapes.map((record) => String(record.id)), ...content.bindings.map((record) => String(record.id)), ...content.assets.map((record) => String(record.id))]);
    },
  });
  const baseController = createFogwoodSurface(
    {
      getRevision: () => currentRevision(editor),
      getContextToken: () => contextTokenForEditor(editor),
      read: (request) => {
        if (request.kind === 'inspect') return inspectSurface(editor, isRecord(request.input) ? request.input as { page_size?: number; cursor?: string; binding_page_size?: number; binding_cursor?: string } : {});
        if (request.kind === 'capabilities') {
          const input = isRecord(request.input) ? request.input : {};
          return input.mode === 'available' ? availableCapabilitiesForEditor(editor) : searchCapabilities(input as CapabilitySearchInput);
        }
        return { content_revision: currentRevision(editor), context_token: contextTokenForEditor(editor) };
      },
      prepare: (proposal, diff) => prepareProposalPlan(editor, proposal, diff),
      apply: (plan) => 'action_lowerings' in plan
        ? changeCapture.runWithOrigin(`fogwood:${plan.plan_id}`, () => executePreparedProposal(editor, plan as EditorPreparedCanvasPlan))
        : { ok: false, status: 'ERROR', message: 'The reviewed proposal is missing its page-owned lowering.' },
    },
    onProposalChange,
  );
  const lifecycleController = createProposalLifecycleController(baseController, {
    get_revision: () => currentRevision(editor),
    on_event: onProposalLifecycle,
    on_event_error: (error) => onActivity?.('Receipt was not recorded', error.message.slice(0, 180)),
  });
  const controller: SurfaceToolController = lifecycleController;
  onController?.(controller);

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
        if (Object.keys(value).some((key) => !['page_size', 'cursor', 'binding_page_size', 'binding_cursor', 'since_sequence', 'change_page_size', 'change_cursor'].includes(key))) return textResult({ status: 'INVALID_INPUT', error: 'Unknown inspect field.' }, true);
        if (value.page_size !== undefined && (typeof value.page_size !== 'number' || !Number.isInteger(value.page_size) || value.page_size < 1 || value.page_size > 128)) return textResult({ status: 'INVALID_INPUT', error: 'page_size must be an integer from 1 to 128.' }, true);
        if (value.cursor !== undefined && (typeof value.cursor !== 'string' || !/^\d+$/.test(value.cursor) || value.cursor.length > 12)) return textResult({ status: 'INVALID_INPUT', error: 'cursor must be a bounded numeric string.' }, true);
        if (value.binding_page_size !== undefined && (typeof value.binding_page_size !== 'number' || !Number.isInteger(value.binding_page_size) || value.binding_page_size < 1 || value.binding_page_size > 256)) return textResult({ status: 'INVALID_INPUT', error: 'binding_page_size must be an integer from 1 to 256.' }, true);
        if (value.binding_cursor !== undefined && (typeof value.binding_cursor !== 'string' || !/^\d+$/.test(value.binding_cursor) || value.binding_cursor.length > 12)) return textResult({ status: 'INVALID_INPUT', error: 'binding_cursor must be a bounded numeric string.' }, true);
        if (value.since_sequence !== undefined && (typeof value.since_sequence !== 'number' || !Number.isSafeInteger(value.since_sequence) || value.since_sequence < 0)) return textResult({ status: 'INVALID_INPUT', error: 'since_sequence must be a non-negative safe integer.' }, true);
        if (value.change_page_size !== undefined && (typeof value.change_page_size !== 'number' || !Number.isInteger(value.change_page_size) || value.change_page_size < 1 || value.change_page_size > 128)) return textResult({ status: 'INVALID_INPUT', error: 'change_page_size must be an integer from 1 to 128.' }, true);
        if (value.change_cursor !== undefined && (typeof value.change_cursor !== 'number' || !Number.isSafeInteger(value.change_cursor) || value.change_cursor < 0)) return textResult({ status: 'INVALID_INPUT', error: 'change_cursor must be a non-negative safe integer.' }, true);
        const inspected = baseController.read({ kind: 'inspect', input: value }) as ReturnType<typeof inspectSurface>;
        const changes = value.since_sequence === undefined
          ? { change_sequence: changeLedger().latestSequence() }
          : changeLedger().read({ since_sequence: value.since_sequence, page_size: typeof value.change_page_size === 'number' ? value.change_page_size : undefined, cursor: typeof value.change_cursor === 'number' ? value.change_cursor : undefined });
        onActivity?.('Fogwood inspected the page', `${inspected.counts.shapes} canvas items read without changing them.`);
        return textResult({ ...inspected, ...changes });
      },
    },
    {
      name: 'fogwood-capabilities',
      title: 'Discover or plan Fogwood capabilities',
      description: 'Search, inspect availability, plan exact native semantics, or route and compose any of the 213 pinned tldraw example capabilities against the inspected revision and context. Routing is pure and read-only; page mutations remain non-speculative and require fogwood-propose followed by page-owned Apply.',
      inputSchema: CAPABILITY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const value = isRecord(input) ? input : {};
        const mode = value.mode === undefined ? 'search' : value.mode;
        if (!['search', 'plan', 'route', 'available'].includes(String(mode))) return textResult({ status: 'INVALID_INPUT', error: 'mode must be search, plan, route, or available.' }, true);
        const allowedFields = mode === 'plan'
          ? ['mode', 'intent', 'base_revision', 'context_token', 'scope', 'desired_effects', 'planned_item_count', 'max_steps']
          : mode === 'route'
            ? ['mode', 'intent', 'example_ids', 'base_revision', 'context_token', 'scope', 'max_steps']
          : mode === 'available'
            ? ['mode', 'base_revision', 'context_token']
            : ['mode', 'query', 'kind', 'status', 'category', 'page_size', 'cursor'];
        if (Object.keys(value).some((key) => !allowedFields.includes(key))) return textResult({ status: 'INVALID_INPUT', error: `Unknown capability-${mode} field.` }, true);
        if (mode === 'available') {
          if (typeof value.base_revision !== 'string' || value.base_revision.length < 1 || value.base_revision.length > 120) return textResult({ status: 'INVALID_INPUT', error: 'base_revision must contain 1-120 characters.' }, true);
          if (typeof value.context_token !== 'string' || value.context_token.length < 1 || value.context_token.length > 64) return textResult({ status: 'INVALID_INPUT', error: 'context_token must contain 1-64 characters.' }, true);
          const liveRevision = currentRevision(editor);
          if (value.base_revision !== liveRevision) return textResult({ status: 'STALE_STATE', message: 'The inspected canvas revision is no longer current.', recovery: 'Call fogwood-inspect, then retry fogwood-capabilities with its returned base_revision and context_token.' }, true);
          const liveContextToken = contextTokenForEditor(editor);
          if (value.context_token !== liveContextToken) return textResult({ status: 'STALE_CONTEXT', message: 'The inspected semantic context is no longer current.', recovery: 'Call fogwood-inspect, then retry fogwood-capabilities with its returned base_revision and context_token.' }, true);
          const manifests = baseController.read({ kind: 'capabilities', input: { mode: 'available' } }) as ReturnType<typeof availableCapabilitiesForEditor>;
          return textResult({
            status: 'available',
            base_revision: liveRevision,
            context_token: liveContextToken,
            ontology_version: FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
            registry_version: FOGWOOD_REGISTRY_VERSION,
            manifests,
            semantic_lowerers: FOGWOOD_SEMANTIC_LOWERERS,
            counts: {
              available: manifests.filter((entry) => entry.availability === 'available').length,
              blocked: manifests.filter((entry) => entry.availability === 'blocked').length,
            },
          });
        }
        if (mode === 'plan') {
          if (typeof value.intent !== 'string' || value.intent.length < 1 || value.intent.length > 500) return textResult({ status: 'INVALID_INPUT', error: 'intent must contain 1-500 characters.' }, true);
          if (typeof value.base_revision !== 'string' || value.base_revision.length < 1 || value.base_revision.length > 120) return textResult({ status: 'INVALID_INPUT', error: 'base_revision must contain 1-120 characters.' }, true);
          if (typeof value.context_token !== 'string' || value.context_token.length < 1 || value.context_token.length > 64) return textResult({ status: 'INVALID_INPUT', error: 'context_token must contain 1-64 characters.' }, true);
          if (!['new', 'selection', 'page'].includes(String(value.scope))) return textResult({ status: 'INVALID_INPUT', error: 'scope must be new, selection, or page.' }, true);
          if (value.desired_effects !== undefined && !isValidDesiredEffects(value.desired_effects)) {
            return textResult({ status: 'INVALID_INPUT', error: 'desired_effects contains an unsupported or sparse value.' }, true);
          }
          if (value.planned_item_count !== undefined && (typeof value.planned_item_count !== 'number' || !Number.isInteger(value.planned_item_count) || value.planned_item_count < 0 || value.planned_item_count > 24)) return textResult({ status: 'INVALID_INPUT', error: 'planned_item_count must be an integer from 0 to 24.' }, true);
          if (value.max_steps !== undefined && (typeof value.max_steps !== 'number' || !Number.isInteger(value.max_steps) || value.max_steps < 1 || value.max_steps > 12)) return textResult({ status: 'INVALID_INPUT', error: 'max_steps must be an integer from 1 to 12.' }, true);
          const result = planCapabilityRequestForEditor(editor, value as unknown as FogwoodCapabilityPlanningRequest);
          const staleContext = result.errors.find((error) => error.code === 'STALE_CONTEXT');
          if (staleContext) return textResult({ status: 'STALE_CONTEXT', message: staleContext.message, recovery: staleContext.recovery, errors: result.errors }, true);
          onActivity?.('Fogwood planned capabilities', `${result.steps.length} qualified capability steps returned without changing the page.`);
          return textResult(result, result.status === 'refused');
        }
        if (mode === 'route') {
          if (typeof value.intent !== 'string' || value.intent.length < 1 || value.intent.length > 500) return textResult({ status: 'INVALID_INPUT', error: 'intent must contain 1-500 characters.' }, true);
          if (typeof value.base_revision !== 'string' || value.base_revision.length < 1 || value.base_revision.length > 120) return textResult({ status: 'INVALID_INPUT', error: 'base_revision must contain 1-120 characters.' }, true);
          if (typeof value.context_token !== 'string' || value.context_token.length < 1 || value.context_token.length > 64) return textResult({ status: 'INVALID_INPUT', error: 'context_token must contain 1-64 characters.' }, true);
          if (!['new', 'selection', 'page'].includes(String(value.scope))) return textResult({ status: 'INVALID_INPUT', error: 'scope must be new, selection, or page.' }, true);
          if (value.example_ids !== undefined) {
            if (!Array.isArray(value.example_ids) || value.example_ids.length < 1 || value.example_ids.length > 24) return textResult({ status: 'INVALID_INPUT', error: 'example_ids must contain 1-24 exact example IDs.' }, true);
            for (let index = 0; index < value.example_ids.length; index += 1) {
              if (!(index in value.example_ids) || typeof value.example_ids[index] !== 'string' || value.example_ids[index].length < 1 || value.example_ids[index].length > 160) return textResult({ status: 'INVALID_INPUT', error: 'example_ids must be a dense array of bounded strings.' }, true);
            }
          }
          if (value.max_steps !== undefined && (typeof value.max_steps !== 'number' || !Number.isInteger(value.max_steps) || value.max_steps < 1 || value.max_steps > 24)) return textResult({ status: 'INVALID_INPUT', error: 'max_steps must be an integer from 1 to 24.' }, true);
          const liveRevision = currentRevision(editor);
          if (value.base_revision !== liveRevision) return textResult({ status: 'STALE_STATE', message: 'The inspected canvas revision is no longer current.', recovery: 'Call fogwood-inspect, then retry route mode with its returned base_revision and context_token.' }, true);
          const liveContextToken = contextTokenForEditor(editor);
          if (value.context_token !== liveContextToken) return textResult({ status: 'STALE_CONTEXT', message: 'The inspected semantic context is no longer current.', recovery: 'Call fogwood-inspect, then retry route mode with its returned base_revision and context_token.' }, true);
          const result = compileFullSurfaceRequest(
            value as unknown as Parameters<typeof compileFullSurfaceRequest>[0],
            capabilityFactsForEditor(editor),
          );
          onActivity?.('Fogwood routed full-surface capabilities', `${result.steps.length} exact example routes resolved without changing the page.`);
          return textResult(result, result.status === 'refused');
        }
        if (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 120)) return textResult({ status: 'INVALID_INPUT', error: 'query must be at most 120 characters.' }, true);
        if (value.kind !== undefined && !['tool', 'action', 'primitive', 'capability', 'example'].includes(String(value.kind))) return textResult({ status: 'INVALID_INPUT', error: 'kind must be tool, action, primitive, capability, or example.' }, true);
        if (value.status !== undefined && value.status !== 'callable') return textResult({ status: 'INVALID_INPUT', error: 'status must be callable.' }, true);
        if (value.category !== undefined && (typeof value.category !== 'string' || value.category.length > 80)) return textResult({ status: 'INVALID_INPUT', error: 'category must be at most 80 characters.' }, true);
        if (value.page_size !== undefined && (typeof value.page_size !== 'number' || !Number.isInteger(value.page_size) || value.page_size < 1 || value.page_size > 20)) return textResult({ status: 'INVALID_INPUT', error: 'page_size must be an integer from 1 to 20.' }, true);
        if (value.cursor !== undefined && (typeof value.cursor !== 'string' || !/^\d+$/.test(value.cursor) || value.cursor.length > 16)) return textResult({ status: 'INVALID_INPUT', error: 'cursor must be a bounded numeric string.' }, true);
        const result = searchCapabilities(value as CapabilitySearchInput);
        const semanticLowerers = searchSemanticLowerers(typeof value.query === 'string' ? value.query : '');
        onActivity?.('Fogwood searched capabilities', `${result.results.length} local capability results returned.`);
        return textResult({ ...result, semantic_lowerers: semanticLowerers });
      },
    },
    {
      name: 'fogwood-propose',
      title: 'Propose a Fogwood change',
      description: 'Validate and stage one bounded typed proposal against an inspect content_revision and context_token. Native canvas, material, page lifecycle, and viewport focus operations all prepare frozen lowerings; a person must choose page Apply or Reject.',
      inputSchema: PROPOSAL_TOOL_INPUT_SCHEMA,
      annotations: { untrustedContentHint: true },
      execute: (input) => {
        if (!isRecord(input)) return textResult({ status: 'INVALID_INPUT', error: 'The public Fogwood proposal must be an object.' }, true);
        if (typeof input.base_revision !== 'string' || input.base_revision.length < 1 || input.base_revision.length > 120) return textResult({ status: 'INVALID_INPUT', error: 'base_revision must contain 1-120 characters.' }, true);
        if (typeof input.context_token !== 'string' || input.context_token.length < 1 || input.context_token.length > 64) return textResult({ status: 'INVALID_INPUT', error: 'context_token must contain 1-64 characters.' }, true);
        const liveRevision = currentRevision(editor);
        if (input.base_revision !== liveRevision) return textResult({ status: 'STALE_STATE', message: 'The inspected canvas revision is no longer current.', recovery: 'Call fogwood-inspect, then retry fogwood-propose with its returned base_revision and context_token.' }, true);
        const liveContextToken = contextTokenForEditor(editor);
        if (input.context_token !== liveContextToken) return textResult({ status: 'STALE_CONTEXT', message: 'The inspected semantic context is no longer current.', recovery: 'Call fogwood-inspect, then retry fogwood-propose with its returned base_revision and context_token.' }, true);
        const proposalInput = { ...input };
        delete proposalInput.context_token;
        const publicAction = isRecord(input)
          && Array.isArray(input.actions)
          && input.actions.length === 1
          && isRecord(input.actions[0])
          ? input.actions[0]
          : null;
        if (!publicAction || !['canvas_ops', 'seeded_composition', 'add_materials', 'page_ops', 'camera_ops'].includes(String(publicAction.type))) {
          return textResult({
            status: 'INVALID_INPUT',
            error: 'The public Fogwood protocol accepts exactly one bounded native, material, page, or camera action per proposal.',
          }, true);
        }
        if (isRecord(input) && Array.isArray(input.actions) && input.actions.some((action) => isRecord(action) && action.type === 'add_materials')) {
          return validateProposalAsync(proposalInput, proposalContext(editor), { decodeRaster }).then((validation) => {
            if (!validation.ok) {
              const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
              return textResult({ status: stale ? 'STALE_STATE' : 'INVALID_PROPOSAL', errors: validation.errors }, true);
            }
            if (contextTokenForEditor(editor) !== liveContextToken) return textResult({ status: 'STALE_CONTEXT', message: 'The semantic context changed while the material was being decoded.', recovery: 'Call fogwood-inspect, then retry fogwood-propose with its returned base_revision and context_token.' }, true);
            const staged = controller.stage(validation.proposal, validation.diff);
            if (staged.status !== 'STAGED' && staged.status !== 'ALREADY_STAGED') return textResult({ status: staged.status, message: staged.message }, true);
            if (staged.status === 'STAGED') onActivity?.('Fogwood staged a proposal', proposalActivityDetail(validation.diff));
            return textResult({
              status: staged.status,
              plan_id: staged.state?.plan.plan_id,
              content_revision: staged.state?.plan.content_revision,
              proposal: validation.proposal,
              diff: validation.diff,
            });
          });
        }
        const validation = validateProposal(proposalInput, proposalContext(editor));
        if (!validation.ok) {
          const stale = validation.errors.find((error) => error.code === 'STALE_STATE');
          return textResult({ status: stale ? 'STALE_STATE' : 'INVALID_PROPOSAL', errors: validation.errors }, true);
        }
        if (contextTokenForEditor(editor) !== liveContextToken) return textResult({ status: 'STALE_CONTEXT', message: 'The semantic context changed before the proposal was staged.', recovery: 'Call fogwood-inspect, then retry fogwood-propose with its returned base_revision and context_token.' }, true);
        const adapterError = preflightProposalCanvasOps(editor, validation.proposal);
        if (adapterError) return textResult({ status: 'ADAPTER_UNAVAILABLE', message: adapterError }, true);
        const staged = controller.stage(validation.proposal, validation.diff);
        if (staged.status !== 'STAGED' && staged.status !== 'ALREADY_STAGED') return textResult({ status: staged.status, message: staged.message }, true);
        if (staged.status === 'STAGED') onActivity?.('Fogwood staged a proposal', proposalActivityDetail(validation.diff));
        return textResult({
          status: staged.status,
          plan_id: staged.state?.plan.plan_id,
          content_revision: staged.state?.plan.content_revision,
          proposal: validation.proposal,
          diff: validation.diff,
        });
      },
    },
  ];

  const ContainerAbortController = containerDocument.defaultView?.AbortController ?? AbortController;
  const unregister = registerWebMcpTools({
    tools,
    getModelContext: () => containerDocument.modelContext,
    createAbortController: () => new ContainerAbortController(),
    onConnection,
  });
  return () => {
    changeCapture.dispose();
    unregister();
  };
}
